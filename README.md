# MSLOG — Mount Spokane Land Owners Group

Private communication portal for landowners on Mount Spokane, WA.

## Pages

| Page | File | Auth |
|---|---|---|
| Landing & Registration | `index.html` | Public |
| Login | `login.html` | Public |
| Member Dashboard | `dashboard.html` | Member |
| Member Directory | `directory.html` | Member |
| Documents | `documents.html` | Member |
| Calendar & Events | `calendar.html` | Member |
| IEP Gate Code | `gatecode.html` | Member |
| Videos | `videos.html` | Member |
| Discussion Forum | `forum.html` | Member |
| Admin Dashboard | `admin.html` | Admin |

## Tech Stack

- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`)
- **Firebase Auth** for secure authentication
- **Firestore** for member data storage
- Vanilla JavaScript — no framework or build step
- Open with **Live Server** in VS Code

## Firebase Setup

1. Create a project at https://console.firebase.google.com
2. Enable Email/Password authentication
3. Create a Firestore database
4. Copy your config to `firebase-config.js`

## Color Palette

| Role | Hex | Name |
|---|---|---|
| Primary | `#063559` | Deep Navy Blue |
| Secondary | `#7E8994` | Slate Gray |
| Tertiary | `#94A1B0` | Light Steel Blue |
| Accent | `#F9812A` | Tangerine |

## Validation

- HTML: https://validator.w3.org/nu/
- CSS: https://jigsaw.w3.org/css-validator/
