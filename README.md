# Kiran Planner

A mobile-first personal planner for Kiran: daily schedule, college, Java, DSA, German, projects, revision, gym (every day), sleep, study hours, weekly and monthly reviews, streaks and notes.

- **No backend, no account, no paid API.** All personal data stays in your browser (`localStorage`).
- **Static site:** it deploys to GitHub Pages, Vercel or Netlify.
- **Installable PWA:** after the first load it works offline.
- **Plan start:** the timetable starts on **Monday, October 5, 2026** and repeats into later months.

Built with React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide icons, Recharts, Zod and vite-plugin-pwa.

---

## 1. Installation

You need Node.js 20 or newer (22 is recommended, see `.nvmrc`).

```bash
npm install
```

## 2. Development

```bash
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). To open it on your phone, connect the phone to the same Wi-Fi and run `npm run dev -- --host`.

## 3. Build

```bash
npm run build
```

The build runs the TypeScript check, builds into `dist/` and generates the service worker.

## 4. Preview

```bash
npm run preview
```

This serves the production build (with offline support) at http://localhost:4173.

### Quality checks

```bash
npm run lint        # ESLint
npm test            # unit tests (schedule, stats, streaks, timer, storage, import/export)
npm run check       # lint + tests + build
npm run test:e2e    # browser tests at 360px, 412px and desktop (run `npm run build` first)
```

The first time you run `test:e2e`, you may need to run `npx playwright install chromium`.

## 5. Git setup

```bash
git init
git add .
git commit -m "Initial app"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `dist` and `.env` files. The app needs **no secrets**, so never commit passwords, API keys or tokens.

---

## Deployment

### GitHub Pages (recommended, automatic)

`.github/workflows/deploy.yml` lints, tests, builds and deploys on every push to `main`.

One-time setup:

1. Push the code to GitHub (see Git setup above).
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push again, or run the workflow by hand: **Actions → Deploy to GitHub Pages → Run workflow**.
5. The site goes live at `https://<your-user>.github.io/<repo-name>/`, for example `https://kirancodes-dev.github.io/kirandaily/`.

The workflow sets the correct base path (`/<repo-name>/`) for you. The app uses hash URLs (`#/study`), so refreshing any page works on Pages without extra configuration.

### Vercel (optional)

1. Go to vercel.com → **Add New → Project** → import the GitHub repository.
2. Vercel detects Vite. `vercel.json` already sets `npm run build` and the `dist` output folder.
3. Click **Deploy**. Every push to `main` then redeploys automatically.

### Netlify (optional)

1. Go to app.netlify.com → **Add new site → Import an existing project** → choose the repository.
2. `netlify.toml` already sets the build command (`npm run build`), the publish folder (`dist`) and Node 22.
3. Click **Deploy**. Every push to `main` then redeploys automatically.

Only one host is needed. You can delete the config files for the hosts you don't use.

### Install on your phone

Open the deployed URL in Chrome (Android) or Safari (iPhone), then choose **Add to Home screen** or **Install app**. It opens full-screen and works offline.

---

## Where do I edit things?

### My timetable

Edit the defaults in **`src/config/schedule.ts`**. It is the single place where schedule constants live:

| What | Where in `src/config/schedule.ts` |
| --- | --- |
| Plan start date | `planStartDate` |
| Study targets (4h on weekdays, 8h on Saturday and Sunday) | `weekdayStudyTarget`, `saturdayStudyTarget`, `sundayStudyTarget` |
| Wake-up, gym, breakfast, college, travel and sleep times | `routine` |
| Monday–Friday evening plan | `weekdayBlocks` |
| Saturday plan | `saturdayBlocks` |
| Sunday plan | `sundayBlocks` |
| Pomodoro presets (25/5, 50/10, 90/15) | `pomodoroPresets` |

The config seeds the app on first open. Your browser saves your own changes, so after editing the file:

- open **Settings → Backup & data → Reload timetable from config**, which applies the new timetable from today and keeps past days, or
- use **Reset all data** on a fresh start.

You can also change the timetable **inside the app**, with no code at all:

- **Today:** open a task's ⋮ menu to edit, move, reschedule, duplicate, skip or delete that one day. Birthdays and parties don't change your plan.
- **Schedule → Routine:** add, edit or remove repeating tasks. You choose an "apply from" date, and earlier days keep their history.
- **Settings → Daily routine times:** change wake-up, gym, college and sleep times.

Gym is protected. It repeats every day and its series can't be deleted. You can only skip or move a single day.

### Subjects

- In the app, rename subjects in **Settings → College subjects**. The **College** page lets you rename, add and remove subjects, and track topics, notes, assignment, revision and exam-prep status.
- The default names (`Subject 1` … `Subject 9`) are in `src/config/schedule.ts` → `subjects`.

### Java, DSA and German roadmaps

- In the app: **Settings → Roadmaps** lets you rename, add, reorder and delete sections and topics.
- The defaults are in `src/data/javaRoadmap.ts`, `src/data/dsaRoadmap.ts` and `src/data/germanRoadmap.ts`. Each file is a plain `section → [topics]` list. New defaults apply after **Reset all data**.

### Categories

**Settings → Learning categories** lets you rename them, change colours and add your own, such as SQL or Spring Boot. The defaults are in `src/data/categories.ts`.

---

## How data is stored

- Everything is one JSON document in the browser's `localStorage` under the key `kiran-planner:data`. A running study timer is stored under `kiran-planner:timer`, so it survives refreshes and closed tabs.
- Repeating tasks are stored once, as templates. The tasks for a given day are generated from them, and only the days you change are stored. This keeps the data small, and future months appear automatically.
- Data is validated with Zod on load:
  - If storage is corrupted, the app still opens. It keeps a backup copy of the corrupted data under `kiran-planner:corrupt-backup:<time>` and repairs what it can (invalid items are dropped, duplicate ids are renamed and the gym routine is restored if missing), then shows a message.
- Data is **per browser and per device**. Your phone and your laptop each have their own copy. Use export/import to move data between them.
- Nothing is ever sent to a server.

### Backing up

- **Settings → Backup & data → Export data (JSON)** downloads `kiran-planner-backup-YYYY-MM-DD.json`. Do this weekly, for example after the Sunday review.
- **Import data** checks the file before replacing anything. An invalid file is refused with a list of problems, and nothing is changed.
- **Reset all data** asks for confirmation first.

Clearing your browser's site data deletes the planner data, so keep your exports somewhere safe, such as Google Drive. Don't commit personal backups to a public repository.

### Adding cloud sync later

All reads and writes go through the `StorageAdapter` interface in `src/utils/storage.ts` (`load`, `save`, `backup`). To sync, write another adapter (for example one that calls a REST API) and pass it to `<AppDataProvider adapter={…}>` in `src/App.tsx`. The UI, hooks and calculations don't change.

---

## Updating the deployed app through Git

```bash
# make your changes (e.g. edit src/config/schedule.ts)
npm run check                 # lint + tests + build
git add .
git commit -m "Change Saturday plan"
git push
```

GitHub Actions (or Vercel/Netlify) rebuilds and redeploys automatically. Installed PWAs update themselves on the next launch. Updating the code never deletes your data, because the data lives in your browser, not in the repository.

---

## Project structure

```
.github/workflows/deploy.yml   GitHub Pages: lint → test → build → deploy
e2e/app.spec.ts                Browser tests (mobile 360/412 + desktop)
public/                        Icons (favicon, PWA, Apple touch)
src/
  config/schedule.ts           ★ Central timetable configuration
  data/                        Default data: categories, goals, roadmaps, templates
  types/                       TypeScript data model (task, study, subject, project, goal, …)
  utils/                       Pure logic (unit tested)
    date.ts                    Date/time helpers (local YYYY-MM-DD, HH:mm)
    schedule.ts                Recurrence → day tasks
    taskActions.ts             Edit / move / skip / delete / series changes
    calculations.ts            Study time, completion, weekly/monthly stats, CGPA
    streaks.ts                 Forgiving streaks
    timer.ts                   Timestamp-based stopwatch + Pomodoro
    storage.ts, schema.ts      localStorage adapter, validation, repair, import/export
    search.ts                  Global search
  state/                       React providers (app data, study timer)
  hooks/                       useTasks, useStudyTimer, useLocalStorage, useProgress, …
  components/
    layout/                    Sidebar (desktop) + bottom navigation (mobile)
    dashboard/                 Today stats, date navigator, sleep / special-day dialogs
    tasks/                     Task card, form, actions, move dialog
    schedule/                  Week time grid, month calendar, routine editor
    study/ timer/              Study timer, session dialog, category breakdown
    progress/ charts/          Streaks, charts, weekly + monthly review
    roadmap/                   Java / DSA / German roadmap view
    settings/                  Settings sections (profile, routine, targets, data…)
    common/                    Buttons, cards, modal, fields, tabs, progress bars
  pages/                       Today, Schedule, Study, Progress, More, Java, Dsa, German,
                               Subjects (College), Cgpa, Projects, Goals, Notes, Search, Settings
```

## Notes on behaviour

- **Study hours** are completed study tasks plus timer or manually logged sessions. If you finish a session and tick the planned task with it, only the session's real time counts, so nothing is counted twice.
- **Missed tasks are never marked as failures.** Past tasks that weren't done just show as "not done".
- **Streaks are forgiving.** One missed day never breaks a streak; two in a row do. Days you mark as a birthday, party or outing are ignored.
- **The timer** works from timestamps, so it stays correct when the tab is in the background or the phone is locked. In Pomodoro mode it beeps and notifies you (if allowed) when a phase changes, and breaks don't count as study time.
