# CLAUDE.md — MSLOG Project Guide

Mount Spokane Land Owners Group community portal. Vanilla HTML/JS/CSS + Firebase backend. No build step, no framework.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Styling | Tailwind CSS via CDN + `styles.css` |
| Auth | Firebase Auth (email/password) |
| Database | Cloud Firestore |
| File Storage | Firebase Storage (PDFs, 10MB max) |
| Functions | Firebase Cloud Functions (Node.js) in `functions/` |
| Email | Resend API |
| Notifications | Discord webhooks |
| Hosting | Netlify (static files) |

---

## Key Files

| File | Purpose |
|---|---|
| `script.js` | All client-side logic (~2100 lines) |
| `styles.css` | Custom styles beyond Tailwind |
| `firebase-config.js` | Firebase app init (safe to be public) |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Firebase Storage security rules |
| `firebase.json` | Firebase project config |
| `netlify.toml` | Netlify hosting + cache config |
| `!FSD.md` | Full functional specification (source of truth) |

Pages: `index.html`, `login.html`, `dashboard.html`, `directory.html`, `documents.html`, `calendar.html`, `forum.html`, `polls.html`, `gatecode.html`, `videos.html`, `forsale.html`, `weathercam.html`, `contact.html`, `admin.html`, `sop.html`, `pending.html`

---

## Deploy Workflow — CRITICAL

**Netlify** (auto-deploys from GitHub) handles static files only. It does **not** deploy Firebase rules.

After any change to `firestore.rules` or `storage.rules`, run:

```bash
firebase deploy --only storage,firestore
```

After any change to Cloud Functions:

```bash
firebase deploy --only functions
```

Skipping this leaves live rules out of sync with the repo — this has caused `storage/unauthorized` errors in production.

---

## Security Model

- **Auth:** Firebase Auth handles sessions/JWTs
- **Firestore rules** (`firestore.rules`): Admin-only writes enforced via `isAdmin()` helper that checks `members/{uid}.role == 'admin'`
- **Storage rules** (`storage.rules`): Authenticated read; authenticated write for PDFs ≤10MB; admin enforcement for uploads delegated to Firestore rules on the `documents` collection
- **Do not** use `firestore.get()` cross-service lookups inside `storage.rules` — they are unreliable and produce `storage/unauthorized` errors

---

## Firebase Storage Upload Pattern

Always set content type explicitly on upload — browser MIME detection is unreliable for PDFs on Windows:

```js
storageRef.put(file, { contentType: 'application/pdf' })
```

---

## User Roles

| Role | Access |
|---|---|
| Guest | Public pages only (index, contact) |
| Member (pending) | Redirected to `pending.html` |
| Member (active) | All member pages except gate code |
| Admin | All pages + gate code + admin controls + Landowners tab on directory |

Role stored as `role` field (`'member'` or `'admin'`) in `members/{uid}` Firestore document.

---

## Parcel Registry (Landowners)

`directory.html` has an admin-only Members | Landowners toggle. The Landowners view reads the `parcels` Firestore collection (admin-only read/write rules) — the official county parcel list with owner and taxpayer name/address per parcel and a `dataAsOf` date. Doc IDs are auto-generated because parcel numbers can repeat (e.g. `58221.0120` has two owner records). Parcels matching a member's `lot` field get a "Member" badge, computed client-side at render time.

County-recorded sales: `functions/parcelSales.js` scrapes Spokane County SCOUT weekly (scheduled function `refreshParcelSales`, Mondays 6 AM Pacific; manual admin trigger `refreshParcelSalesManual`) and upserts into `parcel_sales` (admin-only read, no client writes; deterministic doc IDs `<parcel>_<exciseNumber>`). New sales trigger a digest email to admins. Displayed via the admin-only "Sales (Last Year)" filter on `forsale.html`. Note: the county may block datacenter IPs — if runs report `blocked403`, the fallback is running the same module locally with a service-account key.

---

## UI Conventions

- Admin-only elements: add class `admin-only` (CSS-hidden); `initNav()` strips it for admins after auth resolves
- Phone numbers display as `nnn.nnn.nnnn` via `formatPhone()` in `script.js` regardless of stored format
- Lot/parcel format: `58221.0137`, validated as `/^\d{5}\.\d{4}$/` on registration

---

## Auth Pattern

`script.js` uses a promise-based auth gate. Pages that require auth call `requireAuth()` which awaits `authReadyPromise` before redirecting. Admin-only pages call `requireAdmin()` instead, which redirects non-admins to `dashboard.html`. All `init*()` functions are called from `DOMContentLoaded` in `script.js` — they run before auth resolves, so they must not depend on auth state at call time.

---

## Color Palette

| Token | Hex |
|---|---|
| Primary navy | `#063559` |
| Accent orange | `#F9812A` |
| Slate gray | `#7E8994` |
| Light steel | `#94A1B0` |
| Background | `#f8fafc` |
