# Rob's Focus Today — notes for Claude

Personal Todoist dashboard for Rob (app name: "Rob's Focus Today"; title in `index.html` and `public/manifest.webmanifest`). A static site (Vite + TypeScript, no framework) that talks straight from the browser to the Todoist API v1 with a personal token the user pastes in. Deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Commands

- `npm run dev:mock`: run locally against invented sample data (no token, no network). Use this for UI work.
- `npm run dev`: run locally against the real account (asks for a token).
- `npm test`: Vitest unit tests (rules engine, store, date math).
- `npm run build`: type-check, then build to `dist/`.

Run `npm test` and `npm run build` before considering a change done.

## Deploying

- Pages source is **GitHub Actions**. Every push to `main` runs tests, builds and deploys; PRs only test and build. Live at https://munro77.github.io/todoist-focus/.
- Rob's workflow so far: small changes are committed straight to `main` and pushed, then confirm the "Test and deploy" run finishes. Ask first before anything large or risky.
- If `actions/deploy-pages` hangs ("deployment in progress" until it times out) or reports "Deployment cancelled", it's GitHub Pages, not the workflow. Don't re-run the old run (Pages cancels it); start a fresh run with workflow_dispatch instead.
- No `package-lock.json` yet, so the workflow uses `npm install`. Once a lockfile is committed, switch it to `npm ci`.

## Layout

- `src/rules/focus.ts`: **Today's Focus rules.** This is the file the user tailors most. Rules run in order; a task lands in the first one it matches.
- `src/rules/engine.ts`: rule types, `Fact` fields available to rules, sorting, `applyRules`. Pure functions; keep them pure and tested.
- `src/todoist/client.ts`: HTTP client (`sync` + `closeTask`). `TodoistApi` interface is shared with the mock.
- `src/todoist/commands.ts`: sync command builders (move, add, set due, uncomplete).
- `src/todoist/links.ts`: web links into Todoist (task/project/section). Shown as small pop-out icons beside names, never by making titles themselves links.
- `src/todoist/store.ts`: local mirror of the account, applies sync responses; `toTask` normalizes API items.
- `src/app.ts`: state, polling, optimistic updates, actions.
- `src/ui/`: DOM rendering (`board.ts`, `taskRow.ts`, `toast.ts`).
- `src/mock/mockApi.ts`: in-memory Todoist for `?mock` / `dev:mock`.
- `index.html` + `src/styles.css`: markup and styles. Colors are CSS tokens with light and dark values.

## Phone layout

Rob uses it mostly on iPhone as a Home Screen app. At ≤640px the header collapses to the title, four icon buttons (add, search, refresh, more) and the colour strip, so tasks fill the screen. Panels toggle via `show-<name>` classes on `#top` (wired in `main.ts`); closing search clears the query. Keep phone screens task-first: anything new in the header should be behind a button on mobile.

## Todoist API facts (verified against Doist's own SDK)

- Base URL `https://api.todoist.com/api/v1/`. CORS is open, auth is `Authorization: Bearer <token>`.
- Reads: `POST sync` (form-encoded) with `sync_token` (`*` = full) and `resource_types`. Later calls send the returned token and get only changes. Completed (`checked`) and deleted items arrive in incremental syncs and must be removed from the store.
- Writes: sync `commands` (JSON array, each with `type`, `uuid`, `args`; check `sync_status[uuid] === "ok"`). Used: `item_add`, `item_move` (`project_id`), `item_update` (`due`), `item_uncomplete`.
- Complete with REST `POST tasks/{id}/close`, which rolls recurring tasks forward.
- **Rescheduling a recurring task:** send `item_update` with the existing `due` object and only `date` changed (`nextDue` in commands.ts). Sending a new due string wipes the recurrence. `due: null` clears the date and ends recurrence.
- Priority on the wire is reversed: API `4` = p1 (highest).
- Rate limited per account; a 429 carries `error_extra.retry_after` seconds. The app polls every 60s only while visible.

## Ground rules

- Never commit a token or real task data. Mock data stays invented and prefixed "Sample:".
- The token lives only in the user's browser `localStorage` (`tdboard.token`); the task cache is `tdboard.cache.v1`.
- Writes may have happened even when the request fails with a network or 5xx error; the UI says "hit Refresh to check" rather than retrying writes automatically.
- The user's lists are named like `01 - This Week`; `listKey()` strips the number. Someday-style lists fold away.
- Keep it dependency-light: no UI framework unless the user asks.
