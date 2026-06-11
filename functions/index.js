const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Discord webhook URL from .env
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

// Resend client - fully lazy loaded to avoid deployment timeouts
let resendClient = null;
function getResend() {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('RESEND_API_KEY not configured in .env file');
            return null;
        }
        const { Resend } = require('resend');
        resendClient = new Resend(apiKey);
    }
    return resendClient;
}

/**
 * Sends a Discord webhook message with an embed.
 */
async function sendDiscord(embed) {
    if (!DISCORD_WEBHOOK) {
        console.error('DISCORD_WEBHOOK_URL not configured in .env file');
        return false;
    }
    try {
        const response = await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        if (!response.ok) {
            throw new Error(`Discord responded with ${response.status}`);
        }
        console.log('Discord notification sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending Discord notification:', error);
        return false;
    }
}

// ─── Notification helpers ────────────────────────────────────────

/**
 * Returns emails of all approved members subscribed to a topic.
 * Opt-out model: missing notifications field or missing topic = subscribed.
 * Only an explicit `false` excludes a member.
 */
async function getOptedInEmails(topic) {
    const snapshot = await admin.firestore()
        .collection('members')
        .where('status', '==', 'approved')
        .get();

    const emails = [];
    snapshot.forEach(doc => {
        const m = doc.data();
        if (!m.email) return;
        const topics = m.notifications && m.notifications.topics;
        if (topics && topics[topic] === false) return; // explicit opt-out
        emails.push(m.email);
    });
    return emails;
}

/** Shared HTML email wrapper matching MSLOG brand. */
function emailWrapper(bodyHtml) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#063559;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">MSLOG</h1>
            <p style="color:#94A1B0;margin:4px 0 0;">Mount Spokane Land Owners Group</p>
        </div>
        <div style="padding:30px;background:#f8fafc;">
            ${bodyHtml}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="color:#999;font-size:12px;margin:0;">
                You're receiving this because you're an MSLOG member with email notifications enabled.
                <a href="https://mtspokanelandgroup.org/dashboard.html" style="color:#F9812A;">Manage preferences</a>
            </p>
        </div>
        <div style="background:#063559;padding:15px;text-align:center;">
            <p style="color:#94A1B0;margin:0;font-size:12px;">Mount Spokane Land Owners Group &bull; Mount Spokane, WA</p>
        </div>
    </div>`;
}

/** Returns emails of all approved admins. */
async function getAdminEmails() {
    const snapshot = await admin.firestore()
        .collection('members')
        .where('role', '==', 'admin')
        .get();
    const emails = [];
    snapshot.forEach(doc => {
        const m = doc.data();
        if (m.email && m.status === 'approved') emails.push(m.email);
    });
    return emails;
}

/**
 * Sends a notification email to all opted-in members for a topic.
 * Sends individually so one bad address doesn't block the rest.
 */
async function sendNotifications(topic, subject, bodyHtml) {
    const emails = await getOptedInEmails(topic);
    if (!emails.length) return;
    await sendToEmails(emails, subject, bodyHtml);
}

/** Sends an email to an explicit list of recipients with the branded wrapper. */
async function sendToEmails(emails, subject, bodyHtml) {
    if (!emails.length) return;

    const resend = getResend();
    if (!resend) return;

    const html = emailWrapper(bodyHtml);
    const BATCH = 4; // stay under Resend's 5 req/s limit
    for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(to =>
            resend.emails.send({ from: 'MSLOG <noreply@mtspokanelandgroup.org>', to, subject, html })
        ));
        results.forEach((r, j) => {
            if (r.status === 'rejected') {
                console.error(`Email to ${batch[j]} failed:`, r.reason);
            } else if (r.value?.error) {
                console.error(`Email to ${batch[j]} rejected by Resend:`, r.value.error);
            } else {
                console.log(`Email to ${batch[j]} sent OK, id:`, r.value?.data?.id);
            }
        });
        if (i + BATCH < emails.length) await new Promise(r => setTimeout(r, 1100));
    }
    console.log(`Sent "${subject}" to ${emails.length} members`);
}

// ─── Member / registration notifications ─────────────────────────

/**
 * Triggered when a new member document is created in Firestore.
 * Sends a Discord notification to alert admin of pending registration.
 */
exports.notifyNewMember = functions.firestore
    .document('members/{memberId}')
    .onCreate(async (snap, context) => {
        const member = snap.data();
        const memberId = context.params.memberId;

        console.log('Function triggered for member:', memberId);

        // Only notify for pending registrations
        if (member.status !== 'pending') {
            console.log('Member not pending, skipping notification. Status:', member.status);
            return null;
        }

        await sendDiscord({
            title: 'New Member Registration',
            color: 0xF9812A,
            fields: [
                { name: 'Name', value: member.name || 'Unknown', inline: true },
                { name: 'Email', value: member.email || 'N/A', inline: true },
                { name: 'Lot', value: member.lot || 'N/A', inline: true }
            ],
            footer: { text: 'MSLOG Admin Notification' },
            timestamp: new Date().toISOString(),
            url: 'https://pughlabs.github.io/MSLOG/admin.html'
        });

        return { success: true };
    });

/**
 * Triggered when a member document is updated.
 * Sends welcome email when status changes from 'pending' to 'approved'.
 */
exports.sendApprovalEmail = functions.firestore
    .document('members/{memberId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const memberId = context.params.memberId;

        console.log('Update detected for member:', memberId);

        // Only send email if status changed from pending to approved
        if (before.status === 'pending' && after.status === 'approved') {
            console.log('Member approved! Sending welcome email to:', after.email);

            const resend = getResend();
            if (!resend) {
                console.error('Cannot send email - Resend not configured');
                return { success: false, error: 'Resend API key not configured' };
            }

            try {
                const { data, error } = await resend.emails.send({
                    from: 'MSLOG <noreply@mtspokanelandgroup.org>',
                    to: after.email,
                    subject: 'Welcome to MSLOG - Your Account is Approved!',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #063559; padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0;">MSLOG</h1>
                                <p style="color: #94A1B0; margin: 5px 0 0 0;">Mount Spokane Land Owners Group</p>
                            </div>

                            <div style="padding: 30px; background-color: #f8fafc;">
                                <h2 style="color: #063559;">Welcome, ${after.name || 'Member'}!</h2>

                                <p style="color: #333; line-height: 1.6;">
                                    Great news! Your MSLOG membership has been approved. You now have full access to our member portal.
                                </p>

                                <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                    <h3 style="color: #063559; margin-top: 0;">What you can access:</h3>
                                    <ul style="color: #333; line-height: 1.8;">
                                        <li>Community documents</li>
                                        <li>Member directory</li>
                                        <li>Event calendar</li>
                                        <li>Discussion forum</li>
                                    </ul>
                                </div>

                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="https://pughlabs.github.io/MSLOG/login.html"
                                       style="background-color: #F9812A; color: white; padding: 12px 30px;
                                              text-decoration: none; border-radius: 6px; font-weight: bold;">
                                        Login to MSLOG
                                    </a>
                                </div>

                                <p style="color: #666; font-size: 14px;">
                                    If you have any questions, please contact the MSLOG administrator.
                                </p>
                            </div>

                            <div style="background-color: #063559; padding: 15px; text-align: center;">
                                <p style="color: #94A1B0; margin: 0; font-size: 12px;">
                                    Mount Spokane Land Owners Group &bull; Mount Spokane, WA
                                </p>
                            </div>
                        </div>
                    `
                });

                if (error) {
                    console.error('Resend error:', error);
                    return { success: false, error: error.message };
                }

                console.log('Welcome email sent successfully:', data);
                return { success: true, emailId: data.id };
            } catch (error) {
                console.error('Error sending welcome email:', error);
                return { success: false, error: error.message };
            }
        }

        console.log('Status not changed to approved, skipping email');
        return null;
    });

/**
 * Triggered when a new contact message is created in Firestore.
 * Forwards the message to admin via Resend email.
 */
exports.forwardContactMessage = functions.firestore
    .document('contact_messages/{messageId}')
    .onCreate(async (snap, context) => {
        const msg = snap.data();
        const messageId = context.params.messageId;

        console.log('New contact message from:', msg.email);

        // Also notify via Discord
        await sendDiscord({
            title: 'New Contact Message',
            color: 0x063559,
            fields: [
                { name: 'From', value: `${msg.name || 'Unknown'} (${msg.email})`, inline: false },
                { name: 'Message', value: msg.message || 'No message', inline: false }
            ],
            footer: { text: 'MSLOG Contact Form' },
            timestamp: new Date().toISOString()
        });

        const resend = getResend();
        if (!resend) {
            console.error('Cannot forward message - Resend not configured');
            return { success: false, error: 'Resend API key not configured' };
        }

        try {
            const { data, error } = await resend.emails.send({
                from: 'MSLOG Contact Form <noreply@mtspokanelandgroup.org>',
                to: 'pughlabs@gmail.com',
                replyTo: msg.email,
                subject: 'MSLOG Contact: ' + (msg.name || 'Unknown'),
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #063559; padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">MSLOG Contact Form</h1>
                        </div>
                        <div style="padding: 30px; background-color: #f8fafc;">
                            <p style="color: #333;"><strong>From:</strong> ${msg.name || 'Unknown'} (${msg.email})</p>
                            <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 15px 0;">
                                <p style="color: #333; line-height: 1.6; white-space: pre-wrap;">${msg.message}</p>
                            </div>
                            <p style="color: #999; font-size: 12px;">Reply directly to this email to respond to the sender.</p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('Resend error:', error);
                return { success: false, error: error.message };
            }

            // Mark as forwarded
            await snap.ref.update({ forwarded: true });
            console.log('Contact message forwarded successfully:', data);
            return { success: true, emailId: data.id };
        } catch (error) {
            console.error('Error forwarding contact message:', error);
            return { success: false, error: error.message };
        }
    });

// ─── Member-facing content notifications ─────────────────────────

exports.notifyNewEvent = functions.firestore
    .document('events/{eventId}')
    .onCreate(async (snap) => {
        const e = snap.data();
        const dateStr = e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
        await sendNotifications('calendar', `New Event: ${e.title}`,
            `<h2 style="color:#063559;margin-top:0;">${e.title}</h2>
             ${dateStr ? `<p style="color:#333;"><strong>Date:</strong> ${dateStr}</p>` : ''}
             ${e.time ? `<p style="color:#333;"><strong>Time:</strong> ${e.time}</p>` : ''}
             ${e.location ? `<p style="color:#333;"><strong>Location:</strong> ${e.location}</p>` : ''}
             ${e.description ? `<p style="color:#555;line-height:1.6;">${e.description}</p>` : ''}
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/calendar.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Calendar
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyNewVideo = functions.firestore
    .document('videos/{videoId}')
    .onCreate(async (snap) => {
        const v = snap.data();
        await sendNotifications('videos', `New Video: ${v.title}`,
            `<h2 style="color:#063559;margin-top:0;">${v.title}</h2>
             ${v.category ? `<p style="color:#7E8994;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">${v.category}</p>` : ''}
             ${v.description ? `<p style="color:#555;line-height:1.6;">${v.description}</p>` : ''}
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/videos.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     Watch Video
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyNewThread = functions.firestore
    .document('threads/{threadId}')
    .onCreate(async (snap) => {
        const t = snap.data();
        await sendNotifications('forum', `New Discussion: ${t.title}`,
            `<h2 style="color:#063559;margin-top:0;">${t.title}</h2>
             <p style="color:#7E8994;font-size:13px;">Posted by ${t.authorName || 'A member'}</p>
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/forum.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Discussion
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyNewPoll = functions.firestore
    .document('polls/{pollId}')
    .onCreate(async (snap) => {
        const p = snap.data();
        const optionsHtml = Array.isArray(p.options)
            ? '<ul style="color:#555;line-height:1.8;padding-left:1.2em;">' +
              p.options.map(o => `<li>${o}</li>`).join('') +
              '</ul>'
            : '';
        await sendNotifications('polls', `New Poll: ${p.question}`,
            `<h2 style="color:#063559;margin-top:0;">${p.question}</h2>
             ${optionsHtml}
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/polls.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     Vote Now
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyNewDocument = functions.firestore
    .document('documents/{docId}')
    .onCreate(async (snap) => {
        const d = snap.data();
        await sendNotifications('documents', `New Document: ${d.title}`,
            `<h2 style="color:#063559;margin-top:0;">${d.title}</h2>
             ${d.category ? `<p style="color:#7E8994;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">${d.category}</p>` : ''}
             ${d.description ? `<p style="color:#555;line-height:1.6;">${d.description}</p>` : ''}
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/documents.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Documents
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyNewListing = functions.firestore
    .document('listings/{listingId}')
    .onCreate(async (snap) => {
        const l = snap.data();
        const priceStr = l.price ? `$${Number(l.price).toLocaleString()}` : '';
        await sendNotifications('forsale', `New Listing${l.lotNumber ? ': Lot ' + l.lotNumber : ''}`,
            `${l.lotNumber ? `<h2 style="color:#063559;margin-top:0;">Lot ${l.lotNumber}</h2>` : ''}
             ${priceStr ? `<p style="color:#F9812A;font-size:1.5rem;font-weight:800;margin:0 0 12px;">${priceStr}</p>` : ''}
             ${l.description ? `<p style="color:#555;line-height:1.6;">${l.description}</p>` : ''}
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/forsale.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Listing
                 </a>
             </div>`
        );
        return null;
    });

exports.notifyGateCodeChange = functions.firestore
    .document('settings/gatecode')
    .onWrite(async (change) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if (!after) return null;
        if (before && before.code === after.code) return null; // no actual change

        await sendNotifications('gateCode', 'Gate Code Updated',
            `<h2 style="color:#063559;margin-top:0;">The gate code has been updated.</h2>
             <p style="color:#555;line-height:1.6;">
                 The MSLOG gate code has changed. Log in to the member portal to see the current code.
             </p>
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/gatecode.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Gate Code
                 </a>
             </div>`
        );
        return null;
    });

// ─── County parcel sales (SCOUT scraper) ─────────────────────────

const { runParcelSalesRefresh } = require('./parcelSales');

/** Sends the new-sales digest email and a Discord alert on failures. */
async function handleSalesRefreshResult(summary) {
    if (summary.newSales.length > 0) {
        const rows = summary.newSales
            .sort((a, b) => b.saleDate.localeCompare(a.saleDate))
            .map(s => `<tr>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">Lot ${s.parcel}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#F9812A;">$${Number(s.price).toLocaleString()}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${s.saleDate}</td>
            </tr>`).join('');
        const plural = summary.newSales.length !== 1;
        // Sales view is admin-only, so the digest goes to admins only
        await sendToEmails(await getAdminEmails(),
            `${summary.newSales.length} New Recorded Sale${plural ? 's' : ''} in Our Area`,
            `<h2 style="color:#063559;margin-top:0;">New county-recorded sale${plural ? 's' : ''}</h2>
             <p style="color:#555;line-height:1.6;">
                 Spokane County has recorded the following sale${plural ? 's' : ''} on parcels in our area:
             </p>
             <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                 <tr style="background:#063559;color:white;">
                     <th style="padding:6px 12px;text-align:left;">Parcel</th>
                     <th style="padding:6px 12px;text-align:left;">Price</th>
                     <th style="padding:6px 12px;text-align:left;">Sale Date</th>
                 </tr>${rows}
             </table>
             <div style="text-align:center;margin:24px 0;">
                 <a href="https://mtspokanelandgroup.org/forsale.html"
                    style="background:#F9812A;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
                     View Sales
                 </a>
             </div>`
        );
    }
    if (summary.blocked403 > 0 || summary.failed > summary.parcelCount / 2) {
        await sendDiscord({
            title: '⚠️ Parcel sales refresh problems',
            description: `Fetched ${summary.fetched}/${summary.parcelCount} parcels. ` +
                `${summary.blocked403} blocked (403), ${summary.failed} failed.` +
                (summary.lastError ? `\nLast error: ${summary.lastError}` : ''),
            color: 0xF9812A
        });
    }
}

/**
 * Weekly scrape of SCOUT sales data for all parcels in the registry.
 */
exports.refreshParcelSales = functions
    .runWith({ timeoutSeconds: 300, memory: '256MB' })
    .pubsub.schedule('every monday 06:00')
    .timeZone('America/Los_Angeles')
    .onRun(async () => {
        const summary = await runParcelSalesRefresh(admin.firestore());
        await handleSalesRefreshResult(summary);
        return null;
    });

/**
 * Admin-triggered manual refresh — used for the first data load and as the
 * GCP-egress feasibility probe (county may block datacenter IPs).
 */
exports.refreshParcelSalesManual = functions
    .runWith({ timeoutSeconds: 300, memory: '256MB' })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
        }
        const member = await admin.firestore().collection('members').doc(context.auth.uid).get();
        if (!member.exists || member.data().role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admins only');
        }
        const summary = await runParcelSalesRefresh(admin.firestore());
        await handleSalesRefreshResult(summary);
        return { ...summary, newSales: summary.newSales.length };
    });
