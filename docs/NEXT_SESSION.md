# Next session: finish Kiran Planner v1.1

This file is the hand-off for the next working session. Paste the prompt below into a new Claude Code session on this repository.

## Prompt to paste

> Continue Kiran Planner v1.1 from `docs/NEXT_SESSION.md` in kirancodes-dev/kirandaily. Work through the open review findings listed there, starting with the high ones, then medium, then the cheap low ones. For each finding: reproduce it first (the reviewers can be wrong), fix it minimally in the style of the code around it, and add a unit test for logic and an e2e check for anything visible. Never weaken or delete existing tests. Two unverified work-in-progress branches have a head start: `wip/review-fixes-ui` (study-session sheet, reminder toasts, Add-task focus, Notes/Goals overflow and more) and `wip/review-fixes-sync` (a three-way merge for cloud sync). Review their diffs and reuse what is sound. Don't merge them blindly. Before pushing to main, run everything: `npx tsc -b`, `npx eslint . --max-warnings=0`, `npx vitest run`, `npm run build`, `npx playwright test` (all 5 projects incl. iphone-17 and mac), `npm run test:rules` and `npm run test:sync` (these need Java for the Firebase emulators). Also check iPhone 17 (402×874) and Mac (1440×900) screenshots in light and dark mode. Then push to main (GitHub Pages deploys from it) and update this file.

## Where things stand (6 Oct 2026)

**Done and deployed on `main`** (v1.1):
- Honest ticks: a task can't be ticked before it starts (it can be ticked later), plus reminders, Needs attention and the app badge.
- The official 5th-semester calendar, with a Calendar page, important dates and Apple/Google Calendar `.ics` export and import. The timetable follows the calendar: no college on holidays, and make-up Saturdays follow the stated weekday.
- Profile with photo, a GitHub-style activity graph, XP, levels and badges, and daily motivation.
- GitHub and LeetCode stats.
- iPhone 17 and Mac polish: safe areas, a two-column Today on Mac, keyboard shortcuts and the install guide.

Each feature was built, reviewed independently and fixed. Then a cross-feature review (4 lenses) found the issues below.
- **Already fixed from that review:**
  - A device upgrading from v1.0 no longer wipes the profile details and preferences another device synced.
  - "Merge both" on first sign-in keeps the cloud's profile, settings and progress wherever this device still has the defaults. Tests: `src/sync/engine.test.ts`.
- **Checks green at hand-off:** tsc, eslint, 372 unit tests, 415 Playwright tests (30 device-specific skips), Firestore rules tests and the two-device sync e2e.
- **The user must re-publish `firestore.rules`** in the Firebase console (Firestore → Rules → paste → Publish). Until then the new `ext` document (profile, calendar dates, preferences) can't sync, and the sync badge shows an error. Everything else keeps syncing.

**Known limits (documented, not bugs to fix):**
- Notifications only fire while the app is open or recently backgrounded; there is no push server. The README points to the Calendar export for alerts that always fire.
- LeetCode stats come from community APIs.
- The attached semester PDF stays on the device it was added on.
- The .ics export is a one-time copy.
- On resume, reminders wait 5 s for synced data, so a task ticked on the other device moments earlier can briefly show a "did you do it?" toast that then closes itself.

## Open findings (40)

Severity is the reviewer's. Each entry has the suggested fix and where to look. The two high sync findings above are already fixed, so they are not listed.

### Honest data and time

1. **[high] Cloud sync merge brings back an untick from a stale copy (false green tick), or loses a tick**  
   Fix: Make the month and core merge 3-way. Keep the last agreed chunk, or per-item hashes, as the base: only items this device actually changed since the base should override the remote; untouched items take the remote version, and deletions are respected. A simpler alternative is a per-task updatedAt where the newest wins. Add an engine test for "stale device edits another item in the same month".  
   Where: `src/sync/chunks.ts:140-145`
2. **[medium] "1 hour later" on a late-evening task moves it to 00:xx of the SAME day; it can then be ticked before it happens**  
   Fix: Carry the overflow into the date: when start+60 >= 24:00, use addDays(task.date,1) with the wrapped time. In the custom form, warn (or refuse) when the chosen date and start are earlier than the task's current slot by almost a day, or in the past.  
   Where: `src/components/tasks/MoveDialog.tsx:38`, `src/utils/date.ts:127-130`
3. **[medium] Skipping is never gated and leaves the task out of the count: "Perfect day!" with 1 of 12 tasks done, and missed days can be rescued afterwards**  
   Fix: Don't let skips create green. - Perfect day only when nothing (or at most N tasks) was skipped. - A streak day needs, for example, at least 80% of the planned tasks done, or a cap on the skipped share. - Skips made after the day ended (store skippedAt) should not turn a past miss into neutral. - Optionally, only allow "Skip today" on a not-yet-started task from that day's morning onwards. - Same for special days:…
4. **[medium] Calendar events silently rewrite the timetable, including past days and from personal-note titles**  
   Fix: Only official, or explicitly flagged, events should drive the schedule: - Add an explicit 'swap'/'no college' field instead of matching titles. - Restrict title matching to source 'semester'. - Don't let personal or imported events change the timetable without a confirm. - Freeze past days: ignore holiday/swap changes for dates before today, or snapshot them when the day ends. - Warn when editing or deleting an…
5. **[medium] A study timer that runs past midnight is credited to the next day (date locked) and can't complete the evening task**  
   Fix: Date the session by its startedAt local date (or split it at midnight), let the date be edited, and list that day's started tasks in "Also complete a planned task?".
6. **[medium] Normal timer flow double-counts study time (timer session + ticked task)**  
   Fix: Carry the task through: Start timer from a task should pass its id and category (router state), and the dialog should preselect that task in "Also complete". Also, when ticking a study task that already has an unlinked same-category session overlapping its slot that day, link the session to it instead of adding the planned minutes.
7. **[medium] After the semester's "Last working day" (Jan 5, 2027) every weekday still plans College 9–5 and nags about it**  
   Fix: Treat the days after the last working day (until the semester end, or the next semester's start) like holidays for college-day templates. Alternatively, end those templates at the last working day, and keep the .ics export in step.
8. **[medium] Moving a task across a month boundary while the other device edits it duplicates the task**  
   Fix: When joining chunks, resolve same-id tasks deterministically (for example newest completedAt/updatedAt, or the moved copy wins) instead of renaming them. Never assign random ids during sync-time repair; at least use a deterministic id so two devices converge.
9. **[low] At midnight, Needs attention forgets the evening's unticked tasks**  
   Fix: Next morning, show yesterday's unticked ended tasks as a collapsed "Yesterday · N not ticked" group with the same Done / Move / Skip buttons, until they are reviewed.
10. **[low] Study streak counts a day with a 0 h target as a hit without any study**  
   Fix: When targetMinutes is 0, treat the day as not planned: 'neutral' unless studyMinutes > 0.
11. **[low] Settings → "Reset timetable" duplicates today's already-ticked routine tasks**  
   Fix: Start the fresh timetable tomorrow. Alternatively, keep today's completed tasks and add exclusions for the new templates' occurrences today whose key or slot matches a kept completed task.

12. **[low] TodayStats still says "Today counts for your streak (80%+)" on special days, while streaks are paused on special days**  
   Fix: Show the paused wording on special days, consistent with utils/streaks and the profile celebration.  
   Where: `src/components/dashboard/TodayStats.tsx`
### Data safety, sync and security

13. **[medium] Any offline change to calendar dates on one device reverts profile/photo/prefs changes made on the other device meanwhile**  
   Fix: Store the last-synced ext content (or per-section editedAt) in the sync meta. Then three-way merge profileExtra/prefs/semesterInfo: take the remote section when only the remote changed it, and the local section when only the local changed it. A cheaper option is to split events into their own chunk, so date edits never carry stale profile/prefs with them.
14. **[low] Large .ics imports can push the ext chunk over the 900 KB sync limit or the 3000-event rule, with a misleading error**  
   Fix: Before importing, estimate the ext size and event count after the import. Warn or trim the notes, and cap the total at 3000. Make the too-large message name the calendar dates/imported events when the chunk is 'ext'.
15. **[low] Project GitHub URL is rendered as a raw href (javascript: works), unlike the validated profile links**  
   Fix: Validate with isHttpUrl when saving the project, and render the link only when isHttpUrl(p.githubUrl) is true, as profileLinks does.  
   Where: `src/pages/Projects.tsx:159`

### iPhone 17 and Mac

16. **[high] Finished study session is lost by one tap outside the 'Save study session' sheet, or by Escape on Mac**  
   Fix: Do not stop or clear the timer until the session is saved. Keep it paused while the sheet is open, and let 'Don't save' and Discard be the only ways to drop it. At minimum, make backdrop tap and Escape on SessionDialog do nothing, or ask before discarding, and offer an Undo toast. Persist the pending session (for example in kiran-planner:timer) so a reload or iOS closing the app cannot lose it.
17. **[medium] Reminders that fire while any sheet or dialog is open are hidden behind it, cannot be tapped, expire after 12 s and are never repeated**  
   Fix: While a dialog[open] exists, queue reminder toasts (and don't count them as delivered) until it closes. Alternatively, render the toast region inside the top layer, for example as a popover or by moving it into the open dialog, so it shows above sheets and can be tapped.
18. **[medium] Mac: reminder toasts cover Today's 'Add task' / 'Special day' and the schedule column, and stack up and stay until dismissed when the window is not focused**  
   Fix: On wide screens, place toasts bottom-right (or top-right below the schedule header, leaving the Today header clear). Collapse reminder toasts into one item that updates, replacing older summary and single toasts for the same tasks instead of stacking up to 3. Close sticky toasts once the window regains focus and the Needs attention card is on screen.
19. **[medium] 'Start timer' on a Happening-now study block doesn't start anything, and the session is saved as College by default instead of the block's subject**  
   Fix: Pass the task to the Study page (route state, e.g. {taskId}). Either start the timer straight away or preselect it, and have SessionDialog default its category (and 'Also complete') to the task that is happening now, or the one the timer was started from.
20. **[medium] DSA page on iPhone: topic names run under the problem-count stepper (text overlaps the − button)**  
   Fix: Give the topic button a minimum width (e.g. basis-full or min-w-[8rem]) so the stepper and select wrap to a second line on phones. Or put the stepper and select on their own row below the title under the sm breakpoint.
21. **[medium] Notes and Goals: a pasted long link as a note/goal title or content makes the page scroll sideways on iPhone (scrollWidth 555 at 402)**  
   Fix: [overflow-wrap:anywhere] and min-w-0 on their card title and body text; add an e2e overflow check with a long link.  
   Where: `src/pages/Goals.tsx`, `src/pages/Notes.tsx`
22. **[medium] Add task dialog (button or the n shortcut) focuses the Close button, not the Title field, so on Mac you cannot press n and type**  
   Fix: After showModal(), focus a [data-autofocus] element inside the dialog if present; mark the Title input with it (and other forms where the first field should get focus). e2e: press n on mac, type, the title has the text.  
   Where: `src/components/common/Modal.tsx`, `src/components/tasks/TaskForm.tsx`
23. **[medium] Reminder summary toast offers "Open Today" while already on Today, and while visible covers the greeting/date navigator on iPhone and the Schedule header + Add task on Mac**  
   Fix: Hide/rename the action when already on Today (e.g. scroll to Needs attention), and make sure toasts do not cover key controls (position, size, auto-dismiss).  
   Where: `src/components/reminders/ReminderEngine.tsx`, `src/state/ToastContext.tsx`
24. **[low] iPhone: the app-open reminder toast hides the greeting and date navigator for 12 s and repeats Needs attention, with an 'Open Today' button while already on Today**  
   Fix: Skip the summary toast, or the in-app toast generally, when the Today page is visible and Needs attention or Happening now already shows these tasks; keep only the beep and the badge. Elsewhere keep 'Open Today'. Call tasks that have already started 'in progress'.
25. **[low] Sheets without a footer put their last button in the iPhone home-indicator area**  
   Fix: Add pb-[max(1rem,env(safe-area-inset-bottom))] to the Modal body when there is no footer.
26. **[low] New tasks default to 6:00–7:00 PM whatever the time, so an evening 'Add task' is instantly overdue**  
   Fix: Default the start to the next half hour after now (on today's date), or to the next free slot. Keep 18:00 only for other days.
27. **[low] Weekly review banner says 'ready on Sunday, Sunday, October 11, 2026'**  
   Fix: Drop the literal 'Sunday, ' (e.g. 'The full review is ready on {formatLongDate(sunday)}.').
28. **[low] DSA page at 360px: topic names overlap the -/+ counter on seed data**  
   Fix: Let the name truncate/wrap (min-w-0) and keep the counter shrink-0.  
   Where: `src/pages/Dsa.tsx`
29. **[low] TodayStats Gym tile: at 360px "Not completed" still runs slightly past the tile edge**  
   Fix: Use a shorter label on narrow tiles (e.g. "Not yet") with the full text for screen readers, or smaller text; check 360/390/402.  
   Where: `src/components/dashboard/TodayStats.tsx`

### Performance and storage

30. **[medium] At midnight, 'Needs attention' and the app badge silently drop all of yesterday's unticked tasks**  
   Fix: Between 00:00 and the end of last night's sleep (or a few hours, e.g. until 06:00), keep yesterday's open overdue tasks in Needs attention and in the badge, labelled 'Yesterday'. Alternatively show a one-line 'Yesterday: N tasks not ticked → review' link on Today. Add a test that runs the clock across 00:00.  
   Where: `src/utils/reminders.ts:144`
31. **[medium] Cold start grows with history: the whole dataset is Zod-validated twice and then re-saved unchanged on every launch**  
   Fix: - In loadData, when the strict appDataSchema parse succeeds, only run the cheap dedupe and default-category steps, not the per-item safeParse again. - Skip the first save in AppDataProvider (initialise skipSave to true unless loadData repaired or migrated something). - Optionally defer the streak and XP computations until after first paint.  
   Where: `src/state/AppDataContext.tsx:17-23`, `src/utils/storage.ts:140-142`
32. **[low] Every tick blocks the main thread ~100 ms after a year (~590 ms at 4x CPU), mostly from streak recomputation Today doesn't show and rewriting all data**  
   Fix: - Have Today compute only the overall streak, and let computeActivity reuse it. - Index dayLogs and problemLogs by date in buildStatsContext instead of scanning them per day. - Consider caching per-day stats for past days across data changes; only the edited date's stats change. - In the sync engine, compute hashes once per flush and reuse them in hasDirty.  
   Where: `src/sync/engine.ts:251-268`
33. **[low] All data lives in one localStorage key that grows ~1.55M chars/year with no archiving; when the quota is hit, every change silently stops persisting except for a banner at the top**  
   Fix: - Show the save failure as a sticky toast, not only a top-of-page banner. - Make the quota message point to Export, and add an 'archive tasks older than N months' action (keep per-day aggregates for the heatmap and streaks). - Or move the data to IndexedDB, which has a much larger quota and does not block the main thread.
34. **[low] When localStorage writes fail (full or blocked), the once-a-day streak celebration (toast + full-screen confetti) repeats on every visit to Today**  
   Fix: Also remember the celebrated day in a module-level variable (or sessionStorage), so a failed localStorage write still limits the celebration to once per day per session.

### Integrations (GitHub / LeetCode)

35. **[medium] Keyboard focus falls to <body> when a card changes view (Connect, Change username, Cancel, Retry, Disconnect)**  
   Fix: In edit mode, focus the username input (pass autoFocus/ref through ConnectForm when it opens from the pencil or 'Change username'). When the form closes (Connect, Cancel, Disconnect) or Retry is pressed, move focus to a stable target, for example the card heading with tabIndex=-1, or the Refresh button, using a ref plus an effect. Add an e2e check of document.activeElement after pencil → Cancel.
36. **[medium] A contributions-API outage overwrites the cached full-year graph with the 90-day push-events graph**  
   Fix: In mergeGitHubStats, when next.calendar.source === 'events' and the previous entry has a 'contributions' calendar (for example, less than 7 days old), keep the previous contributions calendar as a stale part (staleParts.calendar = prev fetchedAt) instead of downgrading. Use events only when there is no cached year graph. Add a unit test in github.test.ts ('keeping parts that failed to refresh').
37. **[low] The events fallback counts pushes but labels them 'commits'**  
   Fix: Have pushEventsToDays/fetchPushActivity report whether any event lacked size/commits (for example, a `unit: 'commits' | 'pushes'` field on ContributionCalendar, accepted by gitHubStatsSchema). Label the header, graph label and unit 'pushes' (or 'activity') in that case. Add a unit test.
38. **[low] Repos/Followers/Following tiles overflow with large numbers on phones**  
   Fix: Use compact notation for large values (Intl.NumberFormat('en-US', { notation: 'compact' }) when ≥ 100,000, with the full number in a title or sr-only text), or add min-w-0 + truncate and text-base on narrow screens.
39. **[low] DSA card's 'LeetCode' title link is a 28 px touch target**  
   Fix: Add `min-h-touch` to that ExternalLink's className, or keep the heading as plain text and add a separate 'Open LeetCode profile' link with min-h-touch (as on the Profile card).
40. **[low] leetcode.cn profile links are accepted but queried against leetcode.com**  
   Fix: Accept only leetcode.com in HOSTS.leetcode, so a .cn link fails validation with the existing 'doesn’t look like a LeetCode username' message. Add a case to usernames.test.ts.
