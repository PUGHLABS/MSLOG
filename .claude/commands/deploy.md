# /deploy — MSLOG Deploy Guide

There are two independent deploy targets. Always confirm with the user which one(s) apply before running anything.

---

## 1. Static files → Netlify (via git push)

Netlify auto-deploys on every push to `main`. Before pushing, ask the user:
- **Full deploy** (uses Netlify build credits): `git push`
- **Skip Netlify** (push to GitHub only, no build): add `[skip netlify]` to the commit message

Typical flow:
```
git add <files>
git commit -m "description [skip netlify]"
git push
```

Use `[skip netlify]` for testing or when only Cloud Functions changed.

## 2. Cloud Functions → Firebase

Required after any change to `functions/index.js`. Netlify does NOT handle this.

```
firebase deploy --only functions
```

## 3. Firestore / Storage rules → Firebase

Required after any change to `firestore.rules` or `storage.rules`. Skipping this causes `storage/unauthorized` errors in production.

```
firebase deploy --only storage,firestore
```

---

## Checklist before deploying

- [ ] Static file changes? → git commit + push (with or without `[skip netlify]`)
- [ ] `functions/index.js` changed? → `firebase deploy --only functions`
- [ ] `firestore.rules` or `storage.rules` changed? → `firebase deploy --only storage,firestore`
