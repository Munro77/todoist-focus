# Focus Board

A personal Todoist dashboard: Today's Focus built from your own rules, your lists as lanes, and one-tap complete, move, reschedule and add. It runs entirely in the browser against the Todoist API using your personal token, so there's no server and no secret in this repo.

## Develop

Needs Node 20 or newer.

```bash
npm install
npm run dev:mock   # sample data, no token needed
npm run dev        # your real Todoist (asks for your token)
npm test           # unit tests
npm run build      # type-check + production build into dist/
```

Today's Focus rules live in [`src/rules/focus.ts`](src/rules/focus.ts). Each rule has a `where` function over a `Fact` (fields documented in [`src/rules/engine.ts`](src/rules/engine.ts)), plus optional `sort`, `limit`, `hideEmpty` and `driftDays`. Rules run in order, and a task appears only in the first rule it matches.

## Deploy

Every push to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages via `.github/workflows/deploy.yml`. Pull requests run the tests and build without deploying.

**One-time switch (from the old `/docs` setup):**
1. Merge this to `main`.
2. In **Settings → Pages → Build and deployment**, change **Source** to **GitHub Actions**.
3. Re-run the latest "Test and deploy" workflow (Actions tab → Run workflow), or push any change.
4. Once the site loads from the new build, delete the old `docs/` and `SPA/` folders.

The site URL doesn't change. Tokens saved in your browsers keep working.

After your first `npm install`, commit `package-lock.json` and switch the workflow's `npm install` step to `npm ci` for repeatable builds.

## First run on a device

1. Open the site.
2. In Todoist, go to **Settings → Integrations → Developer** and copy your API token.
3. Paste it into the page and tap **Connect**.

The token and a cached copy of your tasks stay in that browser only. **Forget token** removes both. On iPhone, use Safari's **Share → Add to Home Screen** for a full-screen app.
