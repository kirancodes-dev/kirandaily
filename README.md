# Kiran Planner

A mobile-first personal planner for Kiran: daily schedule, college, Java, DSA, German, projects, revision, gym (every day), sleep, study hours, weekly and monthly reviews, streaks and notes.

- **No backend server and no paid API.** Data is saved in your browser first. Optional **cloud sync** (free Firebase, Google sign-in) keeps it safe and the same on all your devices.
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

**Live site:** https://kirancodes-dev.github.io/kirandaily/

`.github/workflows/deploy.yml` runs on every push to `main`. It lints, tests and builds the app, then publishes `dist/` to the **`gh-pages` branch**, and GitHub Pages serves that branch. There's nothing to click: GitHub turns Pages on by itself the first time a `gh-pages` branch is pushed.

If you fork or rename the repo and the site doesn't appear, open **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, then choose **Branch: `gh-pages` / `(root)`** and save.

- The site lives at `https://<your-user>.github.io/<repo-name>/`. The workflow sets the base path (`/<repo-name>/`) automatically.
- The app uses hash URLs (`#/study`), so refreshing any page works on Pages.
- Don't edit the `gh-pages` branch by hand. Every deploy overwrites it.
- To redeploy without a code change, use **Actions → Deploy to GitHub Pages → Run workflow**.

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
| Day-streak threshold (80% of tasks) | `streakDayThreshold` |

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

## Cloud sync (Firebase)

Turn this on to keep your planner in the cloud and use the same data on your phone and laptop. Until you set it up, the app works local-only in the browser exactly as before.

**How it works.** Every change is saved on the device first, so the app stays instant and works offline. When you're signed in with Google, changes are also synced to **Cloud Firestore** under your own account (`users/<your-uid>/…`), and every signed-in device picks them up live. If two devices edit while one is offline, both sets of changes are merged when it reconnects; nothing is silently overwritten. Firebase's free Spark plan is far more than one person needs.

### One-time setup (about 10 minutes, free)

1. **Create a project.** Go to https://console.firebase.google.com, click **Create a project**, and give it a name (e.g. `kiran-planner`). You can turn Google Analytics off. Stay on the free **Spark** plan.
2. **Add a web app.** Open **Project settings** (⚙️) → **Your apps** → **Web** (`</>`). Name it `Kiran Planner` and leave "Firebase Hosting" unticked. Then copy the `firebaseConfig` values it shows.
3. **Paste the config.** Put those values into `pastedConfig` in **`src/config/firebase.ts`**, commit and push. They're public identifiers, not secrets, so they're safe in the repository. Your data is protected by sign-in and the security rules.
4. **Turn on Google sign-in.** Open **Build → Authentication → Get started → Sign-in method → Google → Enable** and pick your support email.
5. **Allow your website to sign in.** In **Authentication → Settings → Authorized domains → Add domain**, enter `kirancodes-dev.github.io`. `localhost` is already allowed for `npm run dev`.
6. **Create the database.** Open **Build → Firestore Database → Create database**, choose **Standard edition** and a location near you (e.g. `asia-south1 (Mumbai)`), and start in **production mode**.
7. **Publish the security rules.** In Firestore → **Rules**, replace everything with the contents of [`firestore.rules`](firestore.rules), then click **Publish**. If you use the Firebase CLI instead, run `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`.
8. **Sign in from the app.** Open the app → **Settings → Cloud sync → Sign in with Google**. Do the same on your other devices with the same Google account.

**First sign-in on a second device.** If that device also has its own data, the app asks whether to **merge both** (recommended), **use the cloud data**, or **use this device's data**.

The header cloud icon shows the sync state: synced ✓, syncing, offline (will sync later), or a problem. Open **Settings → Cloud sync** for details, **Sync now** and **Sign out**. Signing out stops syncing, and your data stays on the device and in the cloud.

**Optional extra lock.** In `firestore.rules`, `isAllowedAccount()` can restrict the whole database to your own Google email, so nobody else can even create an empty account space in your project.

### Cloud sync tests

```bash
npm run test:rules   # security rules against the Firestore emulator (needs Java)
npm run test:sync    # two "devices" syncing through the Auth + Firestore emulators (needs Java)
```

## How data is stored

- Everything is one JSON document in the browser's `localStorage` under the key `kiran-planner:data`. A running study timer is stored under `kiran-planner:timer`, so it survives refreshes and closed tabs.
- Repeating tasks are stored once, as templates. The tasks for a given day are generated from them, and only the days you change are stored. This keeps the data small, and future months appear automatically.
- Data is validated with Zod on load:
  - If storage is corrupted, the app still opens. It keeps a backup copy of the corrupted data under `kiran-planner:corrupt-backup:<time>` and repairs what it can (invalid items are dropped, duplicate ids are renamed and the gym routine is restored if missing), then shows a message.
- Without cloud sync, data is **per browser and per device**. Your phone and your laptop each have their own copy, and export/import moves data between them. With **cloud sync** on, all your signed-in devices share one copy (see above).
- Nothing is sent anywhere unless you turn on cloud sync, and then only to your own Firebase project.

### Backing up

- **Settings → Backup & data → Export data (JSON)** downloads `kiran-planner-backup-YYYY-MM-DD.json`. Do this weekly, for example after the Sunday review.
- **Import data** checks the file before replacing anything. An invalid file is refused with a list of problems, and nothing is changed.
- **Reset all data** asks for confirmation first.

Clearing your browser's site data deletes the planner data, so keep your exports somewhere safe, such as Google Drive. Don't commit personal backups to a public repository.

### Sync code

- `src/sync/chunks.ts` splits the data into a `core` document plus one document per month, and handles merging.
- `src/sync/engine.ts` holds the sync logic (local first, compare-and-set uploads, merging), tested with a fake cloud.
- `src/sync/firebaseBackend.ts` is the Google sign-in and Firestore code. It's loaded only when configured.
- `src/state/SyncContext.tsx` connects it all to the app.

---

## Updating the deployed app through Git

```bash
# make your changes (e.g. edit src/config/schedule.ts)
npm run check                 # lint + tests + build
git add .
git commit -m "Change Saturday plan"
git push
```

GitHub Actions rebuilds the `gh-pages` branch (or Vercel/Netlify redeploys) automatically, usually within 2–3 minutes. Installed PWAs update themselves on the next launch. Updating the code never deletes your data, because the data lives in your browser, not in the repository.

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
- **Day streak:** every day you finish **80% or more** of that day's tasks adds one day to your streak. Skipped tasks don't count against you. Today shows how many more tasks you need, and the monthly calendar marks counted days with 🔥. Change the 80% with `streakDayThreshold` in `src/config/schedule.ts`.
- **Streaks are forgiving.** One missed day never breaks a streak; two in a row do. Days you mark as a birthday, party or outing are ignored. There are also separate gym, study, Java, DSA and German streaks on the Progress page.
- **The timer** works from timestamps, so it stays correct when the tab is in the background or the phone is locked. In Pomodoro mode it beeps and notifies you (if allowed) when a phase changes, and breaks don't count as study time.
