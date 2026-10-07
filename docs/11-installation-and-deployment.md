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
| Node.js | `npx.cmd http-server . -p 8080 -c-1` (Windows) or `npx http-server . -p 8080 -c-1` | <http://localhost:8080/> |
| Python 3 | `python -m http.server 8080` | <http://localhost:8080/> |
| Windows one-click | Double-click `Claude outputs/start-campusway.bat` (uses Python, or Node.js if Python is missing) | Opens <http://localhost:8765/index.html> automatically |

Keep the terminal window open while you use the app, and press **Ctrl+C** to stop the server.

`-c-1` turns off HTTP caching so edits show up immediately. The **service worker** still caches files: during development, open DevTools → *Application* → *Service Workers* and tick **Update on reload** or **Bypass for network**, or test in a private window.

### Testing on a phone

Phone sensors, the microphone and the service worker need a **secure context** (`https://` or `localhost`). A phone opening `http://<your-computer-ip>:8080` is *not* secure, so sensors will not work there. To test sensors on a phone, use one of these:

- the published GitHub Pages site (simplest);
- Chrome *Remote devices* port forwarding from the phone to `localhost:8080` (Android);
- an HTTPS tunnel tool.

## 3. Run the tests

```powershell
node --test tests/*.test.cjs
```

See [10 · Testing](10-testing.md).

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

## 5. Releasing an update

Phones that have opened CampusWay keep a cached copy. To make sure they get the new version:

1. Make and test your changes (run the tests and a manual check).
2. In `service-worker.js`, **increase `CACHE_NAME`**, e.g. `campusway-v41` → `campusway-v42`.
3. If you **added a new file** the app needs offline (a page, script, graph or floor plan), add it to `APP_FILES` in `service-worker.js`.
4. Commit, then push or merge to `main`.
5. The next time a user opens the app, the new service worker installs, deletes the old cache and takes control. A reload shows the new version.

Changing only `app/data/campus-status.json` does **not** need a new cache name; it is always fetched network-first.

## 6. Updating campus status (no code change)

Edit `app/data/campus-status.json` to announce elevator outages, closures, no-go zones or opening hours (format in [08 · Data model](08-data-model.md#5-campus-status-file)), then commit and push. The app picks it up the next time it is opened online.

## 7. Installing as an app (users)

| Platform | Steps |
|---|---|
| Android (Chrome) | Open the site → menu ⋮ → **Install app** / **Add to Home screen** |
| iPhone / iPad (Safari) | Open the site → **Share** → **Add to Home Screen** |
| Windows / macOS (Chrome, Edge) | Install icon in the address bar → **Install** |

The installed app opens in its own window (standalone) and works offline after the first full load (about 100 MB, mostly floor plans).

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page or "Failed to fetch" locally | Opened via `file://`; use a local server |
| Old version keeps showing | Service-worker cache; bump `CACHE_NAME`, or use *Update on reload* / *Clear site data* in DevTools |
| Sensors do nothing on a phone | Not a secure context, or permission denied; use the HTTPS site |
| Map is grey without streets | No internet for OpenStreetMap tiles; everything else still works |
| `node --test` finds no tests | Run it from the project folder; Node.js 18+ is required (21+ for glob patterns like `tests/*.test.cjs` on Windows PowerShell) |
