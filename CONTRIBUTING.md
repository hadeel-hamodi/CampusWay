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
npx.cmd http-server . -p 8080 -c-1     # or: python -m http.server 8080
node --test tests/*.test.cjs           # all 171 tests should pass
```

Open <http://localhost:8080/>. In DevTools → *Application* → *Service Workers*, tick **Update on reload** so you always see your latest files.

More detail: [docs/11 · Installation and deployment](docs/11-installation-and-deployment.md) and [docs/10 · Testing](docs/10-testing.md).

## 3. Conventions

| Area | Convention |
|---|---|
| Code style | Plain JavaScript, no framework or build step. New algorithm code should go into a module under `wayframe/` or `app/` with the UMD wrapper (like `route-planner.js`), so tests can `require()` it. |
| Translations | Every user-facing string needs English, Hebrew and Arabic (the `T` tables or `{en, he, ar}` helpers in `index.html`; `INDOOR_T` and `localizedInstruction(en, ar, he)` in `navigation-demo.html`; note the **ar-before-he** argument order). |
| Right-to-left | Use CSS logical properties (`margin-inline-start`, `inset-inline-end`) instead of left/right. |
| Accessibility | Aim for 44 px touch targets, visible focus, ARIA labels on icon buttons, and `role="status"` for live messages; respect `prefers-reduced-motion` for new animations. Never show an unverified route for the Mobility profile. |
| Design tokens | Use the colour and spacing variables in `app/ui/campusway.css`. |
| Indoor data | Edit graphs with WayFrame, not by hand. Keep room labels as shown on signs, and use the same connector ID for a stairwell or shaft on every floor. |
| Test markers | Tests cut code out of the HTML pages using marker strings (e.g. `let routePath=[];`, `function buildGraph(){`). Do not rename or move them without updating the tests. |
| Offline cache | New files the app needs offline must be added to `APP_FILES` in `service-worker.js`. |

## 4. Checklist before merging into `main`

- [ ] `node --test tests/*.test.cjs` passes.
- [ ] Checked in the browser: one outdoor route, one room-to-room route, and indoor Auto and Manual modes.
- [ ] Checked in Hebrew (RTL) if the UI changed.
- [ ] New strings translated into all three languages.
- [ ] `CACHE_NAME` in `service-worker.js` increased if any app file changed.
- [ ] New files added to `APP_FILES`.
- [ ] If an indoor graph changed: the JS copy (`madriga-graph.js` / `multi-purpose-graph.js`) is updated where one exists, and `BUILDING_ENTRANCES` still points to valid entrance nodes.
- [ ] Documentation in `docs/` updated if behaviour changed, and a line added to `CHANGELOG.md`.

## 5. Reporting problems

Open a GitHub issue with the steps to reproduce, the device and browser, the language and accessibility profile, and a screenshot. For route problems, include the start and destination (a share link is ideal).
