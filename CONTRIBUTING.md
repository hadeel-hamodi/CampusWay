# Contributing to CampusWay

How the team works on CampusWay: branches, running and testing locally, conventions to follow, and a checklist before merging into `main`.

## 1. Workflow

1. **Update `main`.** In GitHub Desktop: *Fetch origin*, then *Pull origin* if it appears.
2. **Create a branch** for your work: *Branch → New branch*, e.g. `indoor-education-fixes` or your name.
3. **Make small, focused commits** with clear messages (e.g. "Add Education floor 5 restrooms").
4. **Run the tests** and check the app in a browser (see below).
5. **Push** the branch and open a **pull request** into `main` on GitHub.
6. Another team member reviews and tests the branch; then **merge**.
7. Merging into `main` publishes the site on GitHub Pages.

## 2. Run and test locally

```powershell
node server/campusway-server.js        # PC server: app + admin screen, reports stay on this PC
npx.cmd http-server . -p 8080 -c-1     # or a static server: python -m http.server 8080
node --test tests/*.test.cjs           # all tests (about 540) should pass; needs Node.js 21+
```

Open <http://localhost:8080/>. A static server on port 8080 sends test reports and usage counts to the real cloud inbox; the PC server keeps them on your PC ([docs/11, section 2](docs/11-installation-and-deployment.md#2-run-locally)). In DevTools → *Application* → *Service Workers*, tick **Update on reload** so you always see your latest files.

More detail: [docs/11 · Installation and deployment](docs/11-installation-and-deployment.md) and [docs/10 · Testing](docs/10-testing.md).

## 3. Conventions

| Area | Convention |
|---|---|
| Code style | Plain JavaScript, no framework or build step. New algorithm code should go into a module under `wayframe/` or `app/` with the UMD wrapper (like `route-planner.js`), so tests can `require()` it. |
| Translations | Every new user-facing string needs all four languages: English, Hebrew, Arabic and Russian (the `T` tables or `(en, he, ar, ru)` helpers in `index.html`; `INDOOR_T` and `localizedInstruction(en, ar, he, ru)` in `navigation-demo.html`; note the **ar-before-he** argument order there). |
| Right-to-left | Use CSS logical properties (`margin-inline-start`, `inset-inline-end`) instead of left/right. |
| Accessibility | Aim for 44 px touch targets, visible focus, ARIA labels on icon buttons, and `role="status"` for live messages; respect `prefers-reduced-motion` for new animations. Never show an unverified route for the Mobility profile. |
| Design tokens | Use the colour and spacing variables in `app/ui/campusway.css`. |
| Indoor data | Edit graphs with WayFrame, not by hand. Keep room labels as shown on signs, and use the same connector ID for a stairwell or shaft on every floor. |
| Test markers | Tests cut code out of the HTML pages using marker strings (e.g. `let routePath=[];`, `function buildGraph(){`). Do not rename or move them without updating the tests. |
| Offline cache | New files the app needs offline must be added to `APP_FILES` in `service-worker.js`. |
| Campus status | Outages, closures, announcements, names and hours are changed in the admin screen; **Save to live status** publishes them through the cloud inbox. `app/data/campus-status.json` is only the offline fallback: do not commit local test edits to it. |
| Private data | Never commit `server/db/` (admin accounts, reports, the cloud sync key) or `cloud/.wrangler/`. Both are in `.gitignore`; check `git status` before every commit. |

## 4. Checklist before merging into `main`

- [ ] `node --test tests/*.test.cjs` passes.
- [ ] Checked in the browser: one outdoor route, one room-to-room route, and indoor Auto mode (`?demo=1`) and Manual mode (Mobility profile).
- [ ] Checked in Hebrew (RTL) if the UI changed.
- [ ] New strings translated into all four languages (English, Hebrew, Arabic, Russian).
- [ ] `CACHE_NAME` in `service-worker.js` increased if any app file changed.
- [ ] New files added to `APP_FILES`.
- [ ] If an indoor graph changed: `BUILDING_ENTRANCES` still points to valid entrance nodes, and the admin **Data health** page shows no new problems.
- [ ] `git status` shows nothing under `server/db/` or `cloud/.wrangler/`, and no test edits to `app/data/campus-status.json`.
- [ ] Documentation in `docs/` updated if behaviour changed, and a line added to `CHANGELOG.md`.

## 5. Reporting problems

Open a GitHub issue with the steps to reproduce, the device and browser, the language and accessibility profile, and a screenshot. For route problems, include the start and destination (a share link is ideal).
