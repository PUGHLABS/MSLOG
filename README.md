# MSLOG — Mount Spokane Land Owners Group

Private community portal purpose-built for rural landowners on Mount Spokane, WA. Handles gate access, property listings, member management, and community communication in one place.

---

## Landowner Management

| Feature | Description |
|---|---|
| **Parcel Registry** | Admin-only Landowners view of the official county parcel list (owner + taxpayer per parcel), cross-referenced with a Member badge on parcels owned by registered members |
| **Sales Tracker** | Admin-only "Sales (Last Year)" view of county-recorded sales, scraped weekly from Spokane County SCOUT with a digest email when new sales are recorded |
| **Gate Code** | Admin updates 4-digit IEP gate code; members view with last-updated timestamp |
| **For Sale Listings** | Property listings with lot number, price, and description; admin-managed |
| **Member Directory** | Searchable roster with lot numbers (e.g. `58221.0137`), phone, email, and role |
| **Member Approval** | HOA-style registration review; admin approves/rejects pending accounts |
| **Role Access Control** | Guest → Pending Member → Active Member → Admin with per-page enforcement |

---

## Community Tools

| Feature | Description |
|---|---|
| **Discussion Forum** | Threaded posts with Quill rich text editor, inline replies, and thumbs up/down reactions |
| **Community Polls** | Single-vote polls with live percentage results; admin creates, closes, and deletes |
| **Document Library** | PDF uploads (10 MB max) and URL links, categorized: Bylaws, Minutes, Resources, Maps |
| **Event Calendar** | Monthly grid view with upcoming event list; admin manages title, date, location, description |
| **Video Library** | YouTube embeds organized by category (Tutorial, Event, Community, Safety) |
| **Photo Gallery** | Admin-uploaded image gallery with drag-and-drop upload, drag-to-reorder, category filter (Events, Scenery, Wildlife, Community, Projects), and lightbox |
| **Weather Widget** | Live conditions, 7-day forecast, and snow accumulation via Open-Meteo (no API key) |
| **Live Weather Cam** | Dedicated camera view page for current mountain conditions |

---

## Notifications

| Channel | Triggers |
|---|---|
| **Discord Webhooks** | New member registrations, contact form submissions |
| **Resend Email** | Member welcome on approval, poll notifications, new listing alerts |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript — no framework, no build step |
| Styling | Tailwind CSS via CDN + custom `styles.css` |
| Rich Text | Quill.js (forum editor) |
| Auth | Firebase Auth (email/password) |
| Database | Cloud Firestore |
| File Storage | Firebase Storage (PDFs, 10 MB max) |
| Backend | Firebase Cloud Functions (Node.js) |
| Email | Resend API |
| Notifications | Discord Webhooks |
| Weather | Open-Meteo API |
| Hosting | Netlify (auto-deploy from GitHub) |

---

## Pages

| Page | File | Access |
|---|---|---|
| Landing & Registration | `index.html` | Public |
| Login | `login.html` | Public |
| Contact | `contact.html` | Public |
| Pending Approval | `pending.html` | Pending member |
| Member Dashboard | `dashboard.html` | Member |
| Member Directory | `directory.html` | Member (Landowners tab: Admin) |
| Documents | `documents.html` | Member |
| Calendar & Events | `calendar.html` | Member |
| Discussion Forum | `forum.html` | Member |
| Community Polls | `polls.html` | Member |
| For Sale Listings | `forsale.html` | Member |
| Videos | `videos.html` | Member |
| Photos | `photos.html` | Member (upload/manage: Admin) |
| Live Weather Cam | `weathercam.html` | Member |
| Standards of Practice | `sop.html` | Member |
| IEP Gate Code | `gatecode.html` | Admin |
| Admin Dashboard | `admin.html` | Admin |

---

## Color Palette

| Role | Hex | Name |
|---|---|---|
| Primary | `#063559` | Deep Navy |
| Accent | `#F9812A` | Tangerine |
| Secondary | `#7E8994` | Slate Gray |
| Tertiary | `#94A1B0` | Light Steel |
| Background | `#f8fafc` | Off-white |
