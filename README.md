# ProductivityCraft

A pixel-art habit game: daily quests, streaks, achievements, and daily wrap-up PDFs.
Everything runs in the browser. No accounts, no servers, no tracking: data stays on the user's device.

## Deploy (pick one)

This folder is a static site. Upload its **contents** so `index.html` is at the site root (a subfolder also works; all paths are relative).

- **GitHub Pages:** create a public repository, upload these files, then open Settings > Pages, choose "Deploy from a branch", branch `main`, folder `/ (root)`. The site appears at `https://<username>.github.io/<repo>/`.
- **Netlify:** open app.netlify.com/drop and drag this folder onto the page.
- **Cloudflare Pages:** create a project, choose "Direct upload", and upload this folder.

HTTPS is required for offline use and for "Install app" / "Add to Home Screen"; all three hosts provide it automatically.
Opening `index.html` straight from disk also works, just without offline caching or install.

## Updating

Replace the files on the host and bump the cache name in `sw.js` (`productivitycraft-v1` to `productivitycraft-v2`, and so on). Installed copies fetch the update and show "An update is ready. Reload to use it."

## Data and privacy

- Logs, quests, rules and settings live in the browser's local storage for the site's address.
- Clearing site data erases them. **Export backup** saves a JSON file; **Import backup** restores it on any device.
- The app makes no network requests beyond loading its own files.

## Third-party components

- Press Start 2P and VT323 fonts: SIL Open Font License 1.1 (see `fonts/`).
- jsPDF 2.5.1: MIT License (see `vendor/LICENSE-jsPDF.txt`).
