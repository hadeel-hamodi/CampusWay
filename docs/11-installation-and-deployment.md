# 11 · Installation and deployment

> How to run CampusWay on your own computer, how it is published on GitHub Pages, how users install it as an app, and how to release an update so phones pick up the new version.

## 1. Get the code

**GitHub Desktop:** *File → Clone repository → `ja4smin/CampusWay`*, then choose a local folder.

**Command line:**

```powershell
git clone https://github.com/ja4smin/CampusWay.git
cd CampusWay
```

There is nothing to install or build. The app is plain HTML, CSS and JavaScript.

## 2. Run locally

The app must be served over HTTP; opening `index.html` directly from the disk (`file://`) does not work, because the app loads its data with `fetch`. Choose one option:

| Option | Command | Address |
|---|---|---|
| PC server (Node.js, also serves the admin screen) | `node server/campusway-server.js`, or double-click `start-admin.bat` (Windows) | <http://localhost:8080/> and the admin screen at <http://localhost:8080/admin.html> |
| Node.js static server | `npx.cmd http-server . -p 8080 -c-1` (Windows) or `npx http-server . -p 8080 -c-1` | <http://localhost:8080/> |
| Python 3 | `python -m http.server 8080` | <http://localhost:8080/> |
| Windows one-click | Double-click `Claude outputs/start-campusway.bat` (uses Python, or Node.js if Python is missing) | Opens <http://localhost:8765/index.html> automatically |

Keep the terminal window open while you use the app, and press **Ctrl+C** to stop the server.

The PC server uses only Node.js built-in modules. It keeps its data (reports, admin accounts, usage counts) as JSON files in `server/db/`, which is git-ignored and must never be committed. The first visit to the admin screen creates the administrator account. Details: [17 · Admin screen](17-admin-screen.md).

> ⚠️ **A static copy on port 8080 talks to the real cloud inbox.** The cloud inbox accepts requests from `http://localhost:8080` (`ALLOWED_ORIGINS` in `cloud/wrangler.toml`). A copy served on port 8080 by `http-server` or Python therefore sends its problem reports and usage counts to the live inbox, where they reach the admin screen as real reports, and shows the live campus status from it. Started with the PC server (`node server/campusway-server.js` or `start-admin.bat`), the app sends them to the PC instead and reads the PC's status file. Other ports, such as 8765 from `start-campusway.bat`, are not allowed by the inbox, so nothing is sent from them.

`-c-1` turns off HTTP caching so edits show up immediately. The **service worker** still caches files: during development, open DevTools → *Application* → *Service Workers* and tick **Update on reload** or **Bypass for network**, or test in a private window.

### Testing on a phone

Phone sensors, the microphone and the service worker need a **secure context** (`https://` or `localhost`). A phone opening `http://<your-computer-ip>:8080` is *not* secure, so sensors will not work there (the PC server's `--lan` option lets phones on the same Wi-Fi open the app and send reports, with the same limit). To test sensors on a phone, use one of these:

- the published GitHub Pages site (simplest);
- Chrome *Remote devices* port forwarding from the phone to `localhost:8080` (Android);
- an HTTPS tunnel tool.

## 3. Run the tests

```powershell
node --test tests/*.test.cjs
```

Node.js 21 or newer is needed for the `tests/*.test.cjs` pattern in PowerShell. See [10 · Testing](10-testing.md).

## 4. Deployment (GitHub Pages)

The live app is published from the repository with GitHub Pages:

**<https://ja4smin.github.io/CampusWay/>**

| Setting | Value |
|---|---|
| Source | Deploy from a branch (the repository has no Pages build workflow) |
| Branch / folder | the published branch (normally `main`) / root |
| HTTPS | Enforced (provided by GitHub Pages) |

Publishing is automatic: every push or merge to the published branch is live within a few minutes. To check or change the setting, go to *Repository → Settings → Pages* (repository admins only).

Because all paths in the app are relative, it works under the `/CampusWay/` sub-path and on any other static host (Netlify, a university web server, etc.) without changes.

The cloud inbox is not part of GitHub Pages: it is a Cloudflare Worker, set up and updated separately ([`cloud/README.md`](../cloud/README.md)).

## 5. Releasing an update

Phones that have opened CampusWay keep a copy of the app for offline use. Pages, scripts, styles, indoor maps and floor plans are fetched **network-first**, so a phone that is online gets changed files at once; other files (such as images) come from the saved copy first. To make sure every phone replaces its whole offline copy:

1. Make and test your changes (run the tests and a manual check).
2. In `service-worker.js`, **change `CACHE_NAME`**, e.g. `campusway-v68-fresh-maps` → `campusway-v69-<short-name>`.
3. If you **added a new file** the app needs offline (a page, script, graph or floor plan), add it to `APP_FILES` in `service-worker.js`.
4. Commit, then push or merge to `main`. GitHub Pages lets browsers keep its files for up to 10 minutes (`Cache-Control: max-age=600`).
5. The next time a user opens the app, the new service worker installs, deletes the old cache and takes control. A reload shows the new version.

Campus status changes do **not** need a release or a new cache name: they are published from the admin screen (section 6).

## 6. Updating campus status (no code change)

Elevator outages, closures, no-go zones, noisy areas, announcements, emergency mode, names and opening hours are changed in the admin screen on the PC ([17 · Admin screen](17-admin-screen.md)). **Save to live status** publishes them through the cloud inbox, and phones show them the next time CampusWay is opened. No commit or push is needed.

`app/data/campus-status.json` in the repository is only the offline fallback: the app uses it when the inbox cannot be reached or has nothing published yet, and it names the inbox (`reportEndpoint`). Committing it after admin changes only refreshes that fallback; editing it by hand does not change what online users see while the inbox has a published status. File format: [08 · Data model](08-data-model.md#5-campus-status-file).

## 7. Installing as an app (users)

| Platform | Steps |
|---|---|
| Android (Chrome) | Open the site → menu ⋮ → **Install app** / **Add to Home screen** |
| iPhone / iPad (Safari) | Open the site → **Share** → **Add to Home Screen** |
| Windows / macOS (Chrome, Edge) | Install icon in the address bar → **Install** |

The installed app opens in its own window (standalone) and works offline after the first full load (about 75 MB, mostly floor plans).

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page or "Failed to fetch" locally | Opened via `file://`; use a local server |
| Old version keeps showing | GitHub Pages lets browsers keep files for up to 10 minutes; wait, then reload. If it still shows, the old service worker may still control the page: reload once more, or in DevTools use *Update on reload* / *Clear site data* (on a phone, clear the site's data in the browser settings) |
| An admin change does not show on phones | The PC could not publish it (no internet): use **Publish now** on the admin Overview page; phones show it the next time CampusWay is opened |
| Test reports appear in the admin screen | A static local copy on port 8080 sent them to the real cloud inbox; run it with the PC server or on another port (section 2) |
| Sensors do nothing on a phone | Not a secure context, or permission denied; use the HTTPS site |
| Map is grey without streets | No internet for OpenStreetMap tiles; everything else still works |
| `node --test` finds no tests | Run it from the project folder; Node.js 21+ is required for glob patterns like `tests/*.test.cjs` on Windows PowerShell |
