# Kiran Planner

A mobile-first personal planner for Kiran: daily schedule, college, Java, DSA, German, projects, revision, gym (every day), sleep, study hours, weekly and monthly reviews, streaks and notes.

- **No backend server and no paid API.** Data is saved in your browser first. Optional **cloud sync** (free Firebase, Google sign-in) keeps it safe and the same on all your devices.
- **Static site:** it deploys to GitHub Pages, Vercel or Netlify.
- **Installable PWA:** after the first load it works offline.
- **Plan start:** the timetable starts on **Monday, October 5, 2026** and repeats into later months.
- **Made for iPhone 17 and Mac:** Home Screen app with safe areas and bottom sheets on the phone; two-column Today, a sidebar and keyboard shortcuts on the Mac.
- **Honest ticks:** a task can't be ticked before it starts (you can still tick it later). Reminders tell you when a task starts and ask when one ends without a tick.
- **Your semester calendar built in:** the official 5th-semester dates (tests, holidays, last working day, SEE) are preloaded. You can star important dates, add your own, and export everything to Apple or Google Calendar.
- **Profile, activity graph and levels:** profile photo, GitHub-style activity heatmap, XP, levels and badges, plus your GitHub and LeetCode stats.

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

### Install on iPhone and Mac

- **iPhone (Safari):** open the site, tap **Share → Add to Home Screen**, then always open the planner from that icon. It runs full-screen, works offline, and only this Home Screen app can show notifications and an icon badge.
- **Mac (Safari):** **File → Add to Dock**. **Chrome / Edge:** the install icon in the address bar (or **More → Install now** inside the app).
- **More → Install on iPhone & Mac** in the app shows the same steps for the browser you're using.

---

## Daily use

### Honest ticks and reminders

- **No early ticks.** A task can be ticked only once it has **started**. Tapping it earlier shows *"Not yet — Java starts at 7:30 PM"*. You can still tick it any time later, and a tick made after the task ended is labelled *late*. Moving or editing a ticked task to a time that hasn't started yet removes the tick, so the record stays true. Turn this off in **Settings → Reminders & time-lock** if you ever need to.
- **Reminders.** When a task starts you get a reminder (with **Start timer** for study tasks). When one ends without a tick you're asked *"Java ended — did you do it?"* with **Mark done**. **Needs attention** on Today lists unticked tasks that have ended, with **Mark done / Move / Skip**, and **Happening now** shows the current task.
- **How the alerts reach you.** While the planner is open you get a toast and a short beep. In the background you get a system notification if you allowed them (**Settings → Reminders & time-lock → Enable notifications**). The Home Screen icon shows a badge with the number of tasks that ended without a tick.
  - A website can't wake itself up when it's fully closed. There is no push server, so for alerts that always fire, **export your timetable to the Calendar app** (next section). Apple Calendar then reminds you even when the planner is closed.

### Semester calendar and important dates

- **Calendar** (in the sidebar on Mac, under **More** on iPhone) has the official **5th-semester calendar for AY 2026-27** built in. It includes registration, IA-1 (22–29 Oct), IA-2 (7–14 Dec), lab IA, the last working day (5 Jan), SEE (from 18 Jan) and every holiday.
  - Tabs: **Upcoming**, **Semester**, **Important** (starred) and **Sync**.
  - Star any date to mark it important, or add your own dates (birthdays, deadlines, events). You can keep the original PDF on the device too.
- **The timetable follows the calendar.** On holidays the College block (and the trips to and from it) is left out, so a holiday never counts as a missed task. On the Saturdays that follow a weekday timetable (31 Oct, 28 Nov, 12 Dec, 26 Dec), Today shows that weekday's plan and study target. If a holiday is cancelled, change that date's type in Calendar.
- **Apple / Google Calendar.** **Calendar → Sync → Add to Calendar** downloads `.ics` files: the semester dates, and your repeating timetable with an alert for each block (holidays and make-up Saturdays included). Open them on the iPhone or Mac to add them to Calendar. Google Calendar imports the events but not their alerts. It's a one-time copy: after you change the timetable, export again. **Import** reads events from another calendar's `.ics` file.
- The built-in dates were typed from the official calendar PDF (the ECE copy, which uses the university-wide dates). The PDF gives two different start dates for the even semester: 15 Feb in its footer and 22 Feb in the list. The app uses 22 Feb and notes the conflict on that date.

### Profile, activity graph and levels

- **Profile** (tap your avatar): photo, name, headline, college, semester, bio and links (GitHub, LeetCode, LinkedIn, portfolio). Any photo is cropped and shrunk to a small 256×256 image before it's saved.
- **Activity graph:** a GitHub-style square for every day, coloured by how much of that day you completed. Tap a day to open it.
- **XP, levels and badges** come only from real, ticked work: tasks, high-priority tasks, study minutes, Day-streak days, perfect days, DSA problems and German words. Today shows a daily quote, your level and today's XP, and celebrates when you reach 80% and 100% of the day.

### GitHub and LeetCode

Add your usernames on **Profile** (or on the cards there and on the DSA page). The planner then shows:
- **GitHub:** followers, repositories, your latest repositories and the contribution graph.
- **LeetCode:** solved problems by difficulty, ranking and submission calendar.

Stats are cached on the device for 6 hours and also shown offline. Only your username is sent, and only to these services. GitHub is called directly (60 requests per hour per network without a token). LeetCode has no official public API, so its stats come from free community APIs, tried in order. If they're all down, the card says so and keeps the last stats.

### Keyboard shortcuts (Mac)

- **1–5:** Today, Schedule, Study, Progress, More
- **/** or **⌘K:** search
- **N:** add a task
- **[ / ]:** previous / next day
- **T:** jump to today
- **?:** the full list

Shortcuts pause while you're typing.

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
7. **Publish the security rules.** (Do this again whenever `firestore.rules` changes. **v1.1 added rules for its new `ext` document**, which holds the profile, calendar dates and reminder settings. Until the new rules are published, that part can't sync and the sync icon shows a problem. Everything else keeps syncing.) In Firestore → **Rules**, replace everything with the contents of [`firestore.rules`](firestore.rules), then click **Publish**. If you use the Firebase CLI instead, run `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`.
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
- Nothing is sent anywhere unless you turn on cloud sync, and then only to your own Firebase project. The one exception is the GitHub and LeetCode cards, which send just your username to those services when you add it.
- Some things stay on each device and are not in backups or sync: the GitHub/LeetCode stats cache (`kiran-planner:cache:*`), small UI memories such as which reminders were already shown (`kiran-planner:ui:*`), and the semester PDF you attach (IndexedDB).

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
e2e/                           Browser tests (mobile 360/412, desktop, iPhone 17 402×874, Mac 1512×982)
e2e-sync/                      Two-device cloud sync tests (Firebase emulators)
public/                        Icons (favicon, PWA, Apple touch)
src/
  config/schedule.ts           ★ Central timetable configuration
  data/                        Default data: categories, goals, roadmaps, templates, semester calendar
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
    timeGate.ts, reminders.ts  Time-lock (no early ticks) and reminder planning
    events.ts, ics.ts          Calendar dates, holidays, .ics export/import
    gamification.ts            XP, levels, badges, activity graph
    integrations/              GitHub + LeetCode fetchers, validation and cache
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
    reminders/                 Reminder engine, Needs attention / Happening now
    calendar/                  Calendar page parts, export/import, PDF attachment
    profile/                   Profile header, photo, badges, daily motivation
    integrations/              GitHub and LeetCode cards
    common/                    Buttons, cards, modal, fields, tabs, progress bars
  pages/                       Today, Schedule, Study, Progress, More, Java, Dsa, German,
                               Subjects (College), Cgpa, Projects, Goals, Notes, Search, Settings,
                               Profile, Calendar
```

## Notes on behaviour

- **Study hours** are completed study tasks plus timer or manually logged sessions. If you finish a session and tick the planned task with it, only the session's real time counts, so nothing is counted twice.
- **Missed tasks are never marked as failures.** Past tasks that weren't done just show as "not done".
- **Day streak:** every day you finish **80% or more** of that day's tasks adds one day to your streak. Skipped tasks don't count against you. Today shows how many more tasks you need, and the monthly calendar marks counted days with 🔥. Change the 80% with `streakDayThreshold` in `src/config/schedule.ts`.
- **Streaks are forgiving.** One missed day never breaks a streak; two in a row do. Days you mark as a birthday, party or outing are ignored. There are also separate gym, study, Java, DSA and German streaks on the Progress page.
- **The timer** works from timestamps, so it stays correct when the tab is in the background or the phone is locked. In Pomodoro mode it beeps and notifies you (if allowed) when a phase changes, and breaks don't count as study time.
