# Focus Board

A personal Todoist dashboard: Today's Focus built from your own rules, your lists as lanes, and one-tap complete, move, reschedule and add.

It's a static page. It talks straight from your browser to the Todoist API using your personal API token. No server is involved, and no token lives in this repo.

## Put it on GitHub Pages

1. Create a new repository (private is fine) and upload every file in this folder to the root of the `main` branch.
2. In the repo, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`, and save.
3. After a minute, the site is live at `https://<your-username>.github.io/<repo-name>/`.

The Pages site is public even if the repo is private. That's fine here, because the page holds no data or token until someone pastes their own.

## First run on each device

1. Open the site.
2. In Todoist, open **Settings → Integrations → Developer** and copy your API token.
3. Paste it into the page and tap **Connect**.

The token and a cached copy of your tasks are saved in that browser only. **Forget token** (top right) removes both.

## Add to iPhone Home Screen

1. Open the site in Safari.
2. Tap **Share → Add to Home Screen**.

It opens full screen with its own icon. Add it after you've connected, since Home Screen apps keep their own storage on iOS and may ask for the token once more.

## Tailoring Today's Focus

The rules are the `RULES` array near the top of the script in `index.html`. Rules run in order, and a task appears only in the first rule it matches. Each rule's `where` function gets:

| Field | Meaning |
|---|---|
| `f.list` | List name without its number, lowercase (`"this week"`, `"inbox"`) |
| `f.overdueDays` | Days past due (0 if not overdue) |
| `f.dueIn` | Days until due (0 = today, `null` if no date) |
| `f.ageDays` | Days since the task was created |
| `f.recurring` | `true` for repeating tasks |
| `f.priority` | 1 (highest) to 4 |
| `f.score` | Blend of priority, lateness and age |

Each rule can also set `sort` (`"overdue"`, `"age"`, `"score"`, `"drift"`), `limit` (show the top N), and `hideEmpty: true`. `DRIFT_DAYS` sets when a This Week task counts as drifting.

## How it uses the API

- **Reads:** Todoist's sync endpoint. The first load fetches everything; after that, each refresh only fetches changes. It refreshes every 60 seconds while the page is open and visible, and when you come back to it.
- **Writes:** complete uses `POST /tasks/{id}/close`, so recurring tasks roll to their next date. Move, reschedule, add and reopen are sync commands.
- **Rescheduling keeps a recurring task's pattern.** Only the date changes. Clearing the date on a recurring task stops it repeating.
- **Rate limits:** if Todoist returns a rate-limit response, the page waits the time Todoist asks for before trying again.
