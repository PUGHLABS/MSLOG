// Scrapes Spokane County SCOUT property pages for recorded sales on the
// group's parcels and upserts them into the parcel_sales collection.
// Shared by the scheduled/callable Cloud Functions in index.js and (if GCP
// egress is ever blocked by the county) a local fallback script.

const SCOUT_URL = 'https://cp.spokanecounty.org/SCOUT/propertyinformation/Summary.aspx?PID=';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_DELAY_MS = 500;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodeEntities(s) {
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Extracts sale rows from a SCOUT Summary.aspx page. The sales table rows are
 * identified by shape rather than position: cell0 = MM/DD/YYYY date,
 * cell1 = money amount, cell4 = parcel number. That combination appears only
 * in the sales history table on the page.
 */
function parseSales(html) {
    const sales = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let row;
    while ((row = rowRe.exec(html)) !== null) {
        const cells = [];
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let c;
        while ((c = cellRe.exec(row[1])) !== null) {
            cells.push(decodeEntities(c[1].replace(/<[^>]*>/g, '')).trim());
        }
        if (cells.length < 5) continue;
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) continue;
        if (!/^[\d,]+(\.\d{1,2})?$/.test(cells[1])) continue;
        if (!/^\d{5}\.\d{4}$/.test(cells[4])) continue;

        const [mm, dd, yyyy] = cells[0].split('/');
        sales.push({
            parcel: cells[4], // trust the page's parcel cell over the requested PID
            saleDate: `${yyyy}-${mm}-${dd}`,
            price: Number(cells[1].replace(/,/g, '')),
            instrument: cells[2],
            exciseNumber: cells[3]
        });
    }
    return sales;
}

function saleDocId(sale) {
    const suffix = sale.exciseNumber || `${sale.saleDate.replace(/-/g, '')}_${sale.price}`;
    return `${sale.parcel}_${suffix}`;
}

/**
 * Full refresh: reads parcel numbers from the parcels collection, scrapes
 * SCOUT for each, upserts all sales, and updates the settings/parcelSales
 * meta doc. Returns a summary including newly discovered sales from the last
 * year (price > 0) for digest notifications — empty on the very first run so
 * the initial history import doesn't blast subscribers.
 *
 * @param {FirebaseFirestore.Firestore} db Admin SDK Firestore instance
 */
async function runParcelSalesRefresh(db) {
    const summary = {
        parcelCount: 0, fetched: 0, failed: 0, blocked403: 0,
        salesUpserted: 0, newSales: [], firstRun: false, lastError: null
    };

    const metaRef = db.collection('settings').doc('parcelSales');
    summary.firstRun = !(await metaRef.get()).exists;

    const parcelSnap = await db.collection('parcels').get();
    const parcels = [...new Set(
        parcelSnap.docs.map(d => d.data().parcel).filter(Boolean)
    )].sort();
    summary.parcelCount = parcels.length;

    const existingIds = new Set();
    (await db.collection('parcel_sales').get()).forEach(d => existingIds.add(d.id));

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const cutoff = yearAgo.toISOString().slice(0, 10);

    let batch = db.batch();
    let opsInBatch = 0;
    const commits = [];
    let consecutive403 = 0;

    for (const parcel of parcels) {
        try {
            const res = await fetch(SCOUT_URL + encodeURIComponent(parcel), {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' }
            });
            if (res.status === 403) {
                summary.blocked403++;
                summary.failed++;
                if (++consecutive403 >= 3 && summary.fetched === 0) {
                    summary.lastError = 'Aborted: county appears to block this egress IP (3 consecutive 403s)';
                    console.error(summary.lastError);
                    break;
                }
                continue;
            }
            consecutive403 = 0;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const html = await res.text();
            const sales = parseSales(html);
            summary.fetched++;

            for (const sale of sales) {
                const id = saleDocId(sale);
                if (!existingIds.has(id) && sale.saleDate >= cutoff && sale.price > 0) {
                    summary.newSales.push(sale);
                }
                batch.set(db.collection('parcel_sales').doc(id), {
                    ...sale,
                    fetchedAt: new Date()
                }, { merge: true });
                summary.salesUpserted++;
                if (++opsInBatch >= 400) {
                    commits.push(batch.commit());
                    batch = db.batch();
                    opsInBatch = 0;
                }
            }
        } catch (e) {
            summary.failed++;
            summary.lastError = `${parcel}: ${e.message}`;
            console.error(`Parcel ${parcel} failed:`, e.message);
        }
        await sleep(FETCH_DELAY_MS);
    }
    if (opsInBatch > 0) commits.push(batch.commit());
    await Promise.all(commits);

    if (summary.firstRun) summary.newSales = []; // history import: no digest

    await metaRef.set({
        lastRun: new Date(),
        parcelCount: summary.parcelCount,
        fetched: summary.fetched,
        failed: summary.failed,
        blocked403: summary.blocked403,
        salesUpserted: summary.salesUpserted,
        newSaleCount: summary.newSales.length,
        lastError: summary.lastError
    }, { merge: true });

    console.log('Parcel sales refresh:', JSON.stringify({ ...summary, newSales: summary.newSales.length }));
    return summary;
}

module.exports = { runParcelSalesRefresh, parseSales };
