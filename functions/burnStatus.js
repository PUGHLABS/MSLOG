// Scrapes the "Current Status" widget on Spokane Clean Air's burn restrictions
// page and stores it in public_status/burn for the front page and nav button.
// SCA has no API and sends no CORS headers, so the browser can't read it directly.

const SOURCE_URL = 'https://spokanecleanair.org/burning/burn-restrictions/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function decodeEntities(s) {
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, '’')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'");
}

function cleanText(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the burn status from the page HTML. Markup (WordPress widget):
 *   <div class="aq-div aq-burnstatus status-in-effect"> ... <span class="aq-label">In Effect</span>
 *   <div class="aq-burnstatus-teaser"><div>Fire Danger Burn Restrictions ...</div></div>
 * Returns null if the widget isn't found.
 */
function parseBurnStatus(html) {
    const statusMatch = html.match(/class="[^"]*\baq-burnstatus\s+status-([a-z0-9-]+)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (!statusMatch) return null;
    const labelMatch = statusMatch[2].match(/<span[^>]*class="[^"]*\baq-label\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const label = labelMatch ? cleanText(labelMatch[1]) : '';
    if (!label) return null;
    const teaserMatch = html.match(/class="[^"]*\baq-burnstatus-teaser\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    return {
        statusClass: statusMatch[1].toLowerCase(),
        label,
        teaser: teaserMatch ? cleanText(teaserMatch[1]) : ''
    };
}

/**
 * Fetches the current status and writes public_status/burn. On failure the
 * last good values are kept; only error/checkedAt are updated.
 * Returns { changed, prev, next, error }.
 */
async function runBurnStatusRefresh(db) {
    const ref = db.collection('public_status').doc('burn');
    const prevSnap = await ref.get();
    const prev = prevSnap.exists ? prevSnap.data() : null;
    const now = new Date();

    let next = null;
    let error = null;
    try {
        const res = await fetch(SOURCE_URL, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        next = parseBurnStatus(await res.text());
        if (!next) throw new Error('Status widget not found on page');
    } catch (e) {
        error = e.message;
        console.error('Burn status refresh failed:', error);
    }

    if (!next) {
        await ref.set({ error, checkedAt: now, sourceUrl: SOURCE_URL }, { merge: true });
        return { changed: false, prev, next: null, error };
    }

    const changed = !prev || prev.label !== next.label || prev.statusClass !== next.statusClass;
    await ref.set({
        ...next,
        sourceUrl: SOURCE_URL,
        checkedAt: now,
        changedAt: changed ? now : (prev.changedAt || now),
        error: null
    }, { merge: true });

    console.log('Burn status refresh:', JSON.stringify({ changed, label: next.label, statusClass: next.statusClass }));
    return { changed, prev, next, error: null };
}

module.exports = { runBurnStatusRefresh, parseBurnStatus, SOURCE_URL };
