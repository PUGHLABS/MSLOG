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
                                        <li>Current gate codes</li>
                                        <li>Community documents & bylaws</li>
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
