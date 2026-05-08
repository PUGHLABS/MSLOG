# !FSD — Functional Specification Document

> **As-Built Specification** | Version 4.0 | May 8, 2026
> **Project:** MSLOG — Mount Spokane Land Owners Group Community Website
> **Status:** As-Built (verified against codebase)
> **Philosophy:** ==Capture, Curate, Connect, Collaborate, and Create==

---

## Table of Contents

- [[#1.0 Introduction]]
- [[#2.0 Scope]]
- [[#3.0 Tech Stack and Architecture]]
- [[#4.0 Database]]
- [[#5.0 Functional Requirements]]
- [[#6.0 User Stories]]
- [[#7.0 Non-Functional Requirements]]
- [[#Appendix A — Glossary]]
- [[#Appendix B — Change Log]]
- [[#Appendix C — Lessons Learned]]
- [[#Appendix D — Revision History]]

---

# 1.0 Introduction

## 1.1 Purpose

This document defines the complete functional specification for the MSLOG website as it exists today. It serves as the single source of truth — describing what is actually built, deployed, and running. This document is designed to be handed to an AI development assistant (Claude) or a human developer to understand, maintain, or extend the system.

## 1.2 Intended Audience

- Development team members (human or AI)
- Project stakeholders and group leadership
- Quality assurance testers
- System administrators
- Future maintenance personnel

## 1.3 Project Background

The Mount Spokane Land Owners Group (MSLOG) needed a digital platform to facilitate communication among members, provide access to community documents, share gate codes, and streamline administrative processes like member approval. The website replaces manual and email-based systems with a centralized community portal.

## 1.4 Document Conventions

- **Must** indicates mandatory requirements (implemented)
- **Should** indicates recommended requirements (may or may not be implemented)
- **May** indicates optional requirements (not yet implemented)
- User roles are capitalized (Member, Admin, Guest)
- FR = Functional Requirement
- NFR = Non-Functional Requirement
- Strikethrough (~~text~~) = originally planned but not built

---

# 2.0 Scope

## 2.1 In Scope (What Was Built)

The website includes:

- User authentication with email/password (Firebase Auth)
- Admin approval workflow for new member registrations
- Member directory with search/filter
- Document library with PDF upload and external URL linking
- Event calendar with month view and event list
- Discussion forum (threads, inline replies, edit, thumbs up/down reactions)
- Community polls (admin create, member vote, live % results, close/delete)
- For Sale listings (admin-managed, member read)
- Gate code management (admin update, member read)
- Video library (YouTube embeds with categories)
- Weather widget (live data from Open-Meteo API)
- Public contact form with email forwarding and Discord notifications
- Admin dashboard with member management and content stats
- Mobile-responsive design with hamburger navigation
- S.O.P. page (community standards of practice)

## 2.2 Development Approach

- Vanilla HTML/CSS/JavaScript (no framework)
- Tailwind CSS via CDN for styling
- Firebase for backend (Auth, Firestore, Storage, Cloud Functions)
- GitHub repository for version control
- AI-assisted development workflow (Claude + VS Code)
- Obsidian for documentation and project management

## 2.3 Not Built (Originally Planned)

The following features were in earlier specs but are not implemented:

- ~~Property database (dedicated collection with parcel data, ownership history)~~
- ~~Payment processing (Stripe/PayPal integration, dues tracking)~~
- ~~In-app notifications (bell icon, unread count, dismissible)~~
- ~~Event RSVP (Yes/No/Maybe tracking)~~
- ~~Recurring events~~
- ~~Forum moderation tools (pin, report)~~
- ~~Password reset email flow~~
- ~~Session timeout after inactivity~~
- ~~Remember Me functionality~~

## 2.4 Future Enhancements

- Property database with parcel numbers and ownership
- Payment processing for annual dues
- Event RSVP system
- In-app notification system
- Integrated mapping with property boundaries
- Newsletter email automation
- Forum thread search/filter
- Forum pin/report moderation tools

## 2.5 Assumptions

- GitHub repository accessible for version control
- Firebase free tier (Spark plan) sufficient for current usage
- Tailwind CSS CDN remains available
- Members primarily access via mobile devices
- Admin manages site through the same web interface (no separate admin app)

## 2.6 Feature Status Matrix

| Feature | Priority | Status |
|---------|----------|--------|
| User Authentication | High | Built |
| Member Directory | High | Built |
| Document Library | High | Built |
| Admin Dashboard | High | Built |
| Gate Code Management | High | Built |
| Event Calendar | Medium | Built (no RSVP/recurring) |
| Discussion Forum | Medium | Built (threads, replies, edit, reactions) |
| Community Polls | Medium | Built |
| For Sale Listings | Low | Built |
| Contact Form | Medium | Built |
| Videos Library | Medium | Built |
| Weather Widget | Low | Built |
| Notifications (Discord + Email) | High | Built (server-side only) |
| Property Database | Low | Not Built |
| Payment Processing | Medium | Not Built |
| In-App Notifications | Low | Not Built |

---

# 3.0 Tech Stack and Architecture

## 3.1 Frontend

- **Framework:** None — vanilla HTML, CSS, JavaScript
- **Styling:** Tailwind CSS via CDN (`cdn.tailwindcss.com`) + custom `styles.css` (~203 lines)
- **JavaScript:** Single file `script.js` (~1,789 lines), all client-side logic
- **Responsive:** Mobile-first, Tailwind responsive classes, hamburger menu for mobile
- **Pages:** 15 HTML files (index, login, dashboard, directory, documents, calendar, forum, polls, gatecode, videos, forsale, contact, admin, sop, pending)

## 3.2 Backend

- **Platform:** Firebase (Google Cloud)
- **Authentication:** Firebase Auth (email/password)
- **Database:** Cloud Firestore (NoSQL document database)
- **File Storage:** Firebase Storage (PDF uploads, 10MB limit)
- **Server Functions:** Firebase Cloud Functions (Node.js) — 3 triggers
- **Email Delivery:** Resend API (transactional emails)
- **Notifications:** Discord webhooks (admin alerts)
- **Weather Data:** Open-Meteo API (free, no key required)

## 3.3 Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `notifyNewMember` | Firestore `members/{id}` onCreate | Discord webhook alert for pending registrations |
| `sendApprovalEmail` | Firestore `members/{id}` onUpdate | Welcome email via Resend when status → approved |
| `forwardContactMessage` | Firestore `contact_messages/{id}` onCreate | Discord alert + email forward to admin |

## 3.4 Hosting and Deployment

- **Primary Host:** Netlify (configured in `netlify.toml`) — deploys static HTML/CSS/JS only
- **Fallback/Legacy Config:** Firebase Hosting config exists in `firebase.json` but site is served from Netlify
- **Domain:** mtspokanelandgroup.org
- **GitHub Pages:** pughlabs.github.io/MSLOG (referenced in Cloud Functions email templates)
- **SSL:** Included via hosting platform
- **CDN:** Included via hosting platform
- **Static Asset Caching:** Configured in `netlify.toml` (images 24hr, CSS/JS 1hr)
- **⚠️ Firebase Rules Deployment:** Netlify only deploys static files. Firestore and Storage security rules must be deployed separately via `firebase deploy --only storage,firestore`. Forgetting this step leaves live rules out of sync with the repo.

```
Architecture:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│   Firebase   │────▶│  Firestore   │
│ (HTML/JS/CSS)│     │   Hosting    │     │  (Database)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                        │
       │ Firebase Auth                          │ Cloud Functions
       │ Firebase Storage                       ▼
       │                                 ┌──────────────┐
       └────────────────────────────────▶│   Resend     │
                                         │   Discord    │
                                         └──────────────┘
```

---

# 4.0 Database

## 4.1 Firestore Collections

| Collection | Purpose | Document Count |
|------------|---------|----------------|
| `members` | User accounts, profiles, roles, approval status | Per registered user |
| `documents` | PDF library metadata and download URLs | Admin-managed |
| `events` | Calendar events with date/time/location | Admin-managed |
| `threads` | Discussion forum posts | Member-created |
| `threads/{id}/replies` | Inline replies to forum threads | Member-created |
| `polls` | Community polls with options and votes | Admin-created |
| `videos` | YouTube video library with categories | Admin-managed |
| `listings` | For Sale listings | Admin-managed |
| `settings` | System configuration (gate codes) | Single doc: `gatecode` |
| `announcements` | Homepage announcements | Admin-managed |
| `contact_messages` | Public contact form submissions | Auto-created |

### Collections Defined in Rules But Unused

| Collection | Notes |
|------------|-------|
| `forum` | Defined in Firestore rules but code uses `threads` instead |

## 4.2 Document Schemas

### `members/{uid}`
```
{
  email: string,          // Firebase Auth email
  name: string,           // Display name
  lot: string,            // Lot number (format: 58221.0137)
  phone: string,          // Optional phone number
  role: "member" | "admin",
  status: "pending" | "approved",
  createdAt: Timestamp
}
```

### `documents/{id}`
```
{
  title: string,
  category: "bylaws" | "minutes" | "resources" | "maps",
  description: string,
  url: string,            // Download URL (Firebase Storage or external)
  storagePath: string,    // Firebase Storage path (if uploaded)
  fileName: string,       // Original filename (if uploaded)
  createdAt: Timestamp,
  createdBy: string       // UID of uploader
}
```

### `events/{id}`
```
{
  title: string,
  date: string,           // Format: YYYY-MM-DD
  time: string,           // Format: HH:MM (24hr)
  location: string,
  description: string,
  createdAt: Timestamp,
  createdBy: string
}
```

### `threads/{id}`
```
{
  title: string,
  body: string,
  authorId: string,       // UID
  authorName: string,     // Display name at time of posting
  replyCount: number,     // Incremented on each reply
  votes: { [uid]: "up" | "down" },  // Reaction map
  createdAt: Timestamp,
  editedAt: Timestamp     // Set on edit (optional)
}
```

### `threads/{threadId}/replies/{id}`
```
{
  body: string,           // HTML (Quill output, DOMPurify sanitized)
  authorId: string,
  authorName: string,
  createdAt: Timestamp
}
```

### `polls/{id}`
```
{
  question: string,
  options: string[],      // Array of option text labels
  votes: { [uid]: number }, // uid → option index
  closed: boolean,        // Locks voting when true
  authorId: string,
  authorName: string,
  createdAt: Timestamp
}
```

### `videos/{id}`
```
{
  title: string,
  category: "tutorial" | "event" | "community" | "safety",
  description: string,
  url: string,            // YouTube URL
  createdAt: Timestamp,
  createdBy: string
}
```

### `settings/gatecode`
```
{
  code: string,           // 4-digit gate code
  updatedAt: Timestamp,
  updatedBy: string       // UID of admin who last changed it
}
```

### `contact_messages/{id}`
```
{
  name: string,
  email: string,
  message: string,
  createdAt: Timestamp,
  read: boolean,
  forwarded: boolean      // Set by Cloud Function after email sent
}
```

### `announcements/{id}`
```
{
  title: string,
  message: string,
  date: string,
  urgent: boolean,
  createdAt: Timestamp
}
```

## 4.3 Schema Notes

- No relational joins — Firestore is NoSQL, all data is denormalized
- User UIDs (from Firebase Auth) are used as document IDs in `members`
- Timestamps use `firebase.firestore.FieldValue.serverTimestamp()`
- No soft deletes — documents are hard-deleted
- File storage: PDFs stored in Firebase Storage under `documents/` path, metadata in Firestore

---

# 5.0 Functional Requirements

## 5.1 User Authentication and Authorization

### FR-5.1.1 User Registration — BUILT

- Users register via form on `index.html` providing: name, email, phone, lot number, password
- Lot number validated client-side (format: `58221.0137` — 5 digits, dot, 4 digits)
- Password must be 8+ characters with both letters and numbers
- Password confirmation field required
- Firebase Auth creates the account immediately
- Firestore `members` document created with `status: pending`
- Cloud Function `notifyNewMember` sends Discord webhook alert to admin
- User sees confirmation message: account pending admin approval

**Data Flow:**
```
User submits form → Client validation → Firebase Auth createUser
  → Firestore members doc (status: pending)
  → Cloud Function → Discord webhook to admin
```

### FR-5.1.2 Login and Logout — BUILT

- Login via `login.html` with email/password
- Firebase Auth handles credential validation
- On success, user redirected to `dashboard.html`
- On failure, error message displayed for 4 seconds then auto-hides
- Logout available from navigation bar on every page
- Logout redirects to `index.html`
- Auth state managed via `firebase.auth().onAuthStateChanged()` listener

**Not implemented:** Remember Me checkbox, session timeout, re-authentication for sensitive operations.

### FR-5.1.3 Password Management — NOT BUILT

- No password reset email flow
- No change password from account settings
- Firebase Auth provides these capabilities but no UI was built

### FR-5.1.4 User Roles and Permissions — BUILT (Client-Side Only)

Two permission levels enforced in JavaScript:

| Role | Access Level |
|------|-------------|
| **Guest** | `index.html`, `login.html`, `contact.html` only |
| **Member** | All pages (dashboard, directory, documents, calendar, forum, gatecode, videos) |
| **Admin** | All member pages + admin dashboard, document/event/video CRUD, member approval, gate code update |

- `requireAuth()` redirects unauthenticated users to `login.html`
- `requireAdmin()` redirects non-admins to `dashboard.html`
- Admin-only UI elements use CSS class `admin-only` (hidden until admin detected)
- Role stored in `members` document as `role: "admin"` or `role: "member"`

> **SECURITY NOTE:** Role checks are enforced in client-side JavaScript only. Firestore rules grant read/write to all authenticated users on most collections. See Section 7.2 for details.

---

## 5.2 Member Directory — BUILT

### FR-5.2.1 Member Directory (`directory.html`)

- Displays all members with `status: approved` from Firestore
- Table columns: Name, Lot Number, Email, Phone, Role (badge)
- Sorted alphabetically by name (client-side sort)
- Client-side search filters table rows by any text content
- Member count displayed below table
- Requires authentication (`requireAuth()`)

**Not implemented:** Privacy settings for contact info, profile editing, profile photos.

---

## 5.3 Document Management — BUILT

### FR-5.3.1 Document Library (`documents.html`)

- Centralized document repository with two upload modes:
  - **PDF upload:** Files uploaded to Firebase Storage (max 10MB, PDF only)
  - **External URL:** Link to documents hosted elsewhere
- Four categories with color-coded badges: Bylaws, Minutes, Resources, Maps
- Category filter pills (All, Bylaws, Minutes, Resources, Maps)
- Each document displays: title, category badge, description, upload date, download link
- Upload progress bar shown during PDF uploads
- Admin-only: add document form, delete button per document
- Delete removes both Firestore metadata and Firebase Storage file
- Requires authentication

### FR-5.3.2 Document Access Control

- All authenticated users can read documents
- Only admins can add or delete documents (enforced in UI and Firestore rules)
- No public/members-only distinction — all documents visible to all members
- Firebase Storage rules enforce authentication for file access

---

## 5.4 Event Calendar — PARTIALLY BUILT

### FR-5.4.1 Event Management (`calendar.html`)

- Monthly calendar grid with day-of-week headers
- Today's date highlighted
- Days with events marked with visual indicator
- Hover tooltip shows event titles for each day
- Event list below calendar shows all events for the current year
- Events sorted by date ascending
- Upcoming events get orange date badge; past events get navy badge
- Admin-only: add event form (title, date, time, location, description)
- Admin-only: delete button per event
- Date input defaults to today

**Not implemented:** RSVP, recurring events, month navigation, multiple calendar views (agenda/list), event detail modal.

---

## 5.5 Discussion Forum — BUILT

### FR-5.5.1 Forum Threads (`forum.html`)

- Members can create new discussion threads (title + rich text body via Quill editor)
- All threads displayed in reverse chronological order (newest first)
- Limited to 50 most recent threads
- Each thread shows: title, author name, date, body text
- "New" badge shown on threads less than 3 days old
- Thread authors and admins can delete threads
- Thread authors and admins can inline-edit title and body
- New thread form toggles open/closed via button
- Requires authentication

### FR-5.5.2 Forum Replies

- Each thread has a Reply button that toggles an inline reply panel
- Existing replies displayed in chronological order with orange left border
- Reply composer uses Quill rich text editor
- Replies stored in `threads/{id}/replies` sub-collection
- `replyCount` field incremented on each reply; shown live in the Reply button

### FR-5.5.3 Forum Reactions

- Each thread has thumbs up 👍 and thumbs down 👎 buttons with live counters
- Votes stored as a `votes` map (`uid → "up"|"down"`) on the thread document
- Clicking the same reaction toggles it off; switching flips the vote
- Active reaction highlighted in green (up) or red (down)

**Not implemented:** Pin/report moderation, thread search/filter, reply notifications.

---

## 5.6 Community Polls — BUILT

### FR-5.6.1 Polls (`polls.html`)

- Admin can create polls with a question and 2–N options (dynamic add)
- Members can cast one vote per poll by clicking an option button
- Before voting: options displayed as navy clickable buttons
- After voting: live results shown as animated percentage bars; voter's choice highlighted in orange
- Closed polls show results to all members without allowing new votes
- Admin can close a poll (locks voting) or delete it permanently
- Vote data stored as `votes` map (`uid → optionIndex`) on the poll document
- Vote counts computed client-side from the map; no double-voting possible
- Requires authentication; poll creation requires admin role

---

## 5.7 Gate Code Management — BUILT (Not in Original FSD)

### FR-5.7.1 Gate Code (`gatecode.html`)

- Displays current 4-digit gate code stored in `settings/gatecode`
- Shows last updated timestamp
- Admin-only: update form with 4-digit validation
- Success confirmation message shown for 3 seconds
- Requires authentication

---

## 5.8 Video Library — BUILT (Not in Original FSD)

### FR-5.8.1 Videos (`videos.html`)

- YouTube video gallery with embedded players
- Four categories with color-coded badges: Tutorial, Event, Community, Safety
- Category filter pills
- Videos display: embedded player, title, category badge, description, date
- YouTube URL validated (extracts video ID from various URL formats)
- Admin-only: add video form, delete button per video
- Responsive grid layout
- Requires authentication

---

## 5.9 Weather Widget — BUILT (Not in Original FSD)

### FR-5.9.1 Weather (`index.html`)

- Live weather data from Open-Meteo API (free, no API key)
- Location: Mount Spokane, WA (47.9244, -117.1139)
- Displays: current temperature (°F), weather condition, 7-day forecast
- Each forecast day shows: day name, weather icon, high/low temps
- Snow accumulation total shown in header
- Graceful fallback if API unavailable
- Temperature unit: Fahrenheit
- Timezone: America/Los_Angeles
- Updated hourly (per API)

---

## 5.10 Contact Form — BUILT (Not in Original FSD)

### FR-5.10.1 Contact Form (`contact.html`)

- Public form (no authentication required)
- Fields: name, email, message
- Submits to Firestore `contact_messages` collection
- Cloud Function `forwardContactMessage` triggers on creation:
  - Sends Discord webhook notification
  - Forwards email to `pughlabs@gmail.com` via Resend API
  - Sets `replyTo` header to sender's email for easy response
  - Marks message as `forwarded: true` in Firestore

---

## 5.11 Admin Dashboard — BUILT

### FR-5.11.1 Admin Dashboard (`admin.html`)

- Requires admin role (`requireAdmin()`)
- Displays stats: total members, pending approvals, document count, forum thread count
- Lists pending member registrations with approve/reject actions
- Approve action: updates `status` to `approved`, triggers welcome email via Cloud Function
- Reject action: deletes the member document and Firebase Auth account

**Not implemented:** Bulk actions, data export/backup, financial reports, activity logs.

---

## 5.12 Notifications — PARTIALLY BUILT

### FR-5.12.1 Discord Notifications (Server-Side)

- New member registration → Discord webhook with name, email, lot
- New contact form submission → Discord webhook with sender info and message

### FR-5.12.2 Email Notifications (Server-Side)

- Member approved → Welcome email via Resend with feature list and login link
- Contact form → Forwarded to admin email via Resend

### FR-5.12.3 Email Configuration

- From address: `noreply@mtspokanelandgroup.org`
- Admin email: `pughlabs@gmail.com`
- Email service: Resend API (key stored in environment variable)
- Discord webhook URL stored in environment variable

**Not implemented:** In-app notifications, notification preferences, event reminders, payment confirmations.

---

## 5.13 Homepage — BUILT

### FR-5.13.1 Landing Page (`index.html`)

- Hero section with group name and tagline
- Dynamic CTA: "Register" for guests, "Go to Dashboard" for logged-in members
- Weather widget (see FR-5.8)
- Registration form (see FR-5.1.1)
- QR code linking to mtspokanelandgroup.org (60% desktop hover scale)
- Responsive layout

---

# 6.0 User Stories

## 6.1 New Landowner — Registration

**As a new landowner**, I want to register on the website so that I can access member resources.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can fill out a registration form with my name, email, phone, lot number, and password
- [x] My lot number is validated (5.4 digit format)
- [x] My password must meet complexity requirements
- [x] An admin is notified via Discord webhook
- [x] I see confirmation that my account is pending approval
- [x] I receive a welcome email when approved

## 6.2 Member — Accessing Documents

**As a member**, I want to find and download community documents.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can browse documents by category (Bylaws, Minutes, Resources, Maps)
- [x] I can download PDFs or follow external links
- [x] I can see when documents were posted

## 6.3 Member — Viewing Events

**As a member**, I want to see upcoming community events.

**Status:** PARTIALLY BUILT

**Acceptance Criteria:**
- [x] I can view events on a monthly calendar grid
- [x] I can see event details (title, time, location, description)
- [ ] ~~I can RSVP yes, no, or maybe~~ — Not implemented
- [ ] ~~I receive reminder emails before events~~ — Not implemented

## 6.4 Member — Community Discussion

**As a member**, I want to participate in forum discussions.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can create new discussion threads
- [x] I can view all threads with author and date
- [x] I can delete my own threads
- [x] I can edit my own threads inline
- [x] I can reply to existing threads
- [x] I can react to threads with thumbs up or thumbs down
- [ ] ~~I receive notifications when someone replies~~ — Not implemented

## 6.5 Member — Gate Code Access

**As a member**, I want to see the current gate code.

**Status:** BUILT (Not in original FSD)

**Acceptance Criteria:**
- [x] I can view the current 4-digit gate code
- [x] I can see when it was last updated

## 6.6 Admin — Member Management

**As an admin**, I want to approve new member registrations.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I receive Discord notification when someone registers
- [x] I see pending registrations on the admin dashboard
- [x] I can approve or reject applications
- [x] Approved members receive a welcome email automatically

## 6.7 Admin — Document Management

**As an admin**, I want to upload and organize documents.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can upload PDF files (up to 10MB)
- [x] I can link external URLs as documents
- [x] I can categorize documents
- [x] I can delete documents

## 6.8 Admin — Event Management

**As an admin**, I want to create and manage events.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can create events with title, date, time, location, and description
- [x] I can delete events
- [ ] ~~I can set events to recur~~ — Not implemented
- [ ] ~~I can see who has RSVP'd~~ — Not implemented

## 6.9 Guest — Information and Contact

**As a prospective member**, I want to learn about the group and make contact.

**Status:** BUILT

**Acceptance Criteria:**
- [x] I can view the public homepage with group information
- [x] I can submit a contact form without logging in
- [x] I can register for membership

---

# 7.0 Non-Functional Requirements

## 7.1 Performance

### NFR-7.1.1 Response Time

- Page load relies on CDN-delivered Tailwind CSS and Firebase SDK
- Firestore queries are indexed and return quickly for small datasets
- Weather API call is non-blocking (renders loading state, then updates)
- Document downloads served from Firebase Storage CDN

### NFR-7.1.2 Scalability

- Firebase Spark (free) plan has limits: 50K reads/day, 20K writes/day, 1GB Firestore storage
- Firebase Storage: 5GB free
- Current member base is small; free tier is sufficient
- No server-side rendering — all pages are static HTML

## 7.2 Security

### NFR-7.2.1 Authentication Security

- Firebase Auth handles password hashing (bcrypt internally)
- Firebase Auth handles session management (JWT tokens)
- Password complexity enforced client-side (8+ chars, letters + numbers)
- Lot number format validated client-side only

### NFR-7.2.2 Firestore Security Rules

**Current state:** Admin-only write restrictions are enforced in both Firestore rules (`firestore.rules`) and the client-side UI. Rules use a role-field check against the `members` collection.

```
// documents, events, videos, announcements, settings — admin write enforced:
match /documents/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();  // isAdmin() checks members/{uid}.role == 'admin'
}
```

Collections with proper admin enforcement: `documents`, `events`, `videos`, `announcements`, `settings`, `members` (delete only), `contact_messages` (read/update/delete). Forum threads/replies allow any authenticated member to create and delete their own posts.

### NFR-7.2.3 Firebase Storage Rules

- Authentication required for all file operations
- Upload restricted to: PDF files only, max 10MB; content type explicitly set to `application/pdf` on upload
- Delete allowed for any authenticated user (admin enforcement handled by UI and Firestore rules)
- **Note:** Avoid using `firestore.get()` cross-service lookups in Storage rules — they are unreliable and cause `storage/unauthorized` errors. Admin enforcement for documents is delegated to Firestore rules on the `documents` collection.

### NFR-7.2.4 Data Privacy

- Contact form accessible without authentication (by design)
- Member directory visible to all authenticated members (no privacy controls)
- Firebase config keys are public (standard for client-side Firebase — security enforced by rules)
- Admin email (`pughlabs@gmail.com`) hardcoded in Cloud Function

## 7.3 Usability

### NFR-7.3.1 User Interface

- Clean, professional design with consistent color palette:
  - Primary navy: `#063559`
  - Accent orange: `#F9812A`
  - Text grays: `#7E8994`, `#94A1B0`
  - Borders: `#e2e8f0`
- Consistent navigation across all pages
- Error messages displayed inline with auto-hide (4s timeout on login)
- Success confirmations displayed inline with auto-hide (3s timeout)
- Loading states shown during async operations (button text changes)

### NFR-7.3.2 Mobile Responsiveness

- Tailwind responsive classes used throughout
- Hamburger menu for mobile navigation
- Weather widget adapts to screen size
- Calendar grid responsive
- Document and video grids stack on mobile
- Touch-friendly button sizes

### NFR-7.3.3 Accessibility

- Semantic HTML structure
- Alt text not comprehensively applied
- No WCAG audit performed
- Keyboard navigation not explicitly tested

## 7.4 Compatibility

### NFR-7.4.1 Browser Support

- Works in modern browsers (Chrome, Firefox, Safari, Edge)
- Relies on ES6+ features (async/await, template literals, arrow functions in Cloud Functions)
- No IE11 support
- Tailwind CSS CDN requires modern browser

## 7.5 Reliability

### NFR-7.5.1 Availability

- Firebase Hosting provides 99.95% uptime SLA
- Netlify configured as fallback host
- No custom health checks or monitoring

### NFR-7.5.2 Data Backup

- Firestore provides automatic daily backups (if configured in Firebase Console)
- No explicit backup/restore procedures documented
- No point-in-time recovery configured

## 7.6 Maintainability

### NFR-7.6.1 Code Structure

- All frontend JavaScript in single file (`script.js`, ~1,789 lines)
- Functions organized by feature with comment section headers
- Consistent naming: `init*()` for page initialization, `load*()` for data fetching, `render*()` for DOM rendering
- `escapeHtml()` utility used for XSS prevention in dynamic content
- Cloud Functions in `functions/index.js` (~240 lines, 3 exports)

### NFR-7.6.2 Configuration

- Firebase config in `firebase-config.js` (public API keys)
- Template file `firebase-config.template.js` for new deployments
- Cloud Function secrets in environment variables: `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY`

## 7.7 Deployment

### NFR-7.7.1 Infrastructure

- Firebase Hosting serves static files from project root
- Netlify configured with static asset caching headers
- Firebase Cloud Functions deployed separately

### NFR-7.7.2 Files Deployed

```
Root (served by hosting):
├── index.html          Landing page + registration
├── login.html          Member login
├── dashboard.html      Member dashboard
├── directory.html      Member directory
├── documents.html      Document library
├── calendar.html       Event calendar
├── forum.html          Discussion forum (threads, replies, reactions, edit)
├── polls.html          Community polls
├── gatecode.html       Gate code display
├── videos.html         Video library
├── forsale.html        For Sale listings
├── contact.html        Public contact form
├── admin.html          Admin dashboard
├── sop.html            Standards of Practice
├── pending.html        Pending approval holding page
├── script.js           All frontend logic
├── styles.css          Custom styles
├── firebase-config.js  Firebase initialization
├── images/             Static images
├── firebase.json       Firebase hosting config
├── firestore.rules     Firestore security rules
├── storage.rules       Storage security rules
└── netlify.toml        Netlify hosting config

functions/
├── index.js            Cloud Functions (3 triggers)
└── package.json        Node.js dependencies
```

---

# Appendix A — Glossary

| Term | Definition |
|------|-----------|
| **Admin** | A member with `role: "admin"` in their Firestore document; can manage content and approve members |
| **Guest** | An unauthenticated visitor; can view homepage and submit contact form |
| **Member** | An authenticated user with `status: "approved"` and `role: "member"` |
| **Pending** | A registered user awaiting admin approval (`status: "pending"`) |
| **Lot Number** | Property identifier in format `58221.0137` (5 digits, dot, 4 digits) |
| **MSLOG** | Mount Spokane Land Owners Group — the project name and GitHub repository |
| **Firestore** | Google Cloud Firestore — NoSQL document database used as the backend |
| **Cloud Function** | Server-side code triggered by Firestore events (registration, approval, contact) |
| **Resend** | Third-party email delivery API used for transactional emails |
| **FSD** | Functional Specification Document (this document) |

---

# Appendix B — Change Log

> Changes from the original v1.0 spec to what was actually built.

| Change | Original Plan | What Was Built | Why |
|--------|--------------|----------------|-----|
| Tech stack | "Specify: React, Next.js..." | Vanilla HTML/CSS/JS + Firebase | Simplicity; no build step needed |
| Database | "Specify: SQLite, PostgreSQL..." | Cloud Firestore (NoSQL) | Firebase ecosystem; free tier; real-time capable |
| Hosting | Vercel | Firebase Hosting + Netlify | Firebase ecosystem; Netlify as fallback |
| Property database | Dedicated collection with parcel data | Not built; lot number stored in `members` only | Descoped for MVP |
| Payment processing | Stripe/PayPal integration | Not built | Descoped for MVP |
| Event RSVP | Yes/No/Maybe tracking | Not built | Descoped |
| Recurring events | Admin-configurable recurrence | Not built | Descoped |
| Forum replies | Threaded replies with moderation | Inline replies, edit, thumbs up/down reactions | Full reply UI built in v4.0 |
| Polls | Not in original spec | Admin-created polls with live % results | Community voting need identified |
| Password reset | Email-based reset flow | Not built | Firebase Auth supports it, no UI created |
| Gate code feature | Not in original spec | Fully built | Critical member need discovered during build |
| Video library | Not in original spec | Fully built | Community content sharing need |
| Weather widget | Not in original spec | Fully built | User engagement on homepage |
| Contact form | Not in original spec | Fully built with email forwarding | Public communication channel needed |
| Discord notifications | Not in original spec | Built for admin alerts | Faster admin response than email |
| In-app notifications | Planned | Not built | Descoped; Discord + email sufficient for now |
| Session management | 30-min timeout, remember me | Firebase Auth defaults | No custom session handling built |
| Admin re-authentication | Required for sensitive ops | Not built | Descoped |
| Accessibility (WCAG AA) | Full compliance target | Basic responsive only | No formal audit performed |

---

# Appendix C — Lessons Learned

| Lesson | Detail |
|--------|--------|
| Always spec the database upfront | Even a simple site needs a data model from day one |
| Notifications are never optional | Users and admins both depend on them — include from the start |
| Single FSD > multiple files | One indexed document gives AI assistants full context |
| Reconcile after build | Update the spec to match reality before moving on |
| Firebase free tier is powerful | Auth, Firestore, Storage, Functions, Hosting — all free for small projects |
| Client-side role checks are insufficient | Firestore rules must enforce admin-only writes server-side |
| Vanilla JS scales surprisingly far | 1,283 lines in one file is manageable with good section organization |
| Discord webhooks beat email for admin alerts | Faster, more visible, easier to set up than email notifications |
| Spec the gate code early | "Obvious" features are often the most critical for users |
| Don't over-spec what you won't build | Payment processing and property DB added complexity to the spec without being built |

---

# Appendix D — Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | January 30, 2026 | Jeff | Initial draft (5 separate FSDs) |
| 2.0 | February 12, 2026 | Jeff + Claude | Consolidated to single !FSD with as-built reconciliation |
| 3.0 | February 15, 2026 | Jeff + Claude | Full as-built verification against codebase; all sections updated to reflect actual implementation |
| 4.0 | May 8, 2026 | Jeff + Claude | Forum replies/edit/reactions, Polls page, For Sale, SOP, nav updates, Firestore rules for polls, UI polish (weather dish shadow, hero photo, hamburger styling) |
