import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Monday, October 5, 2026, 7:45 PM IST – week 5 of the semester, IA-1 starts in 17 days.
const NOW = new Date('2026-10-05T19:45:00+05:30');

async function open(page: Page, hash = '/calendar', time = NOW) {
  await page.clock.install({ time });
  await page.goto(`/#${hash}`);
}

async function noHorizontalOverflow(page: Page, where: string) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, `horizontal overflow on ${where}`).toBeLessThanOrEqual(page.viewportSize()!.width);
}

const editButton = (page: Page, title: string) => page.getByRole('button', { name: `Edit ${title}`, exact: true });

test('calendar shows the semester header, countdowns and IA-1 in Upcoming', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendar');
  await expect(page.getByRole('heading', { name: '5th Semester · AY 2026-27' })).toBeVisible();
  await expect(page.getByText('Week 5 of 23')).toBeVisible();
  await expect(page.getByText('18% of semester done')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Semester progress' })).toHaveAttribute('aria-valuenow', '18');
  const countdowns = page.getByRole('list', { name: 'Countdowns' });
  await expect(countdowns.getByRole('listitem').nth(0)).toContainText('17 days');
  await expect(countdowns.getByRole('listitem').nth(0)).toContainText('IA-1');
  await expect(countdowns.getByRole('listitem').nth(2)).toContainText('92 days');
  await expect(page.getByText('Maintain 75% or more attendance in every subject at all times.')).toBeVisible();

  const ia1 = editButton(page, 'First Internal Assessment Test (IA-1)');
  await expect(ia1).toBeVisible();
  await expect(ia1).toHaveAccessibleDescription(/in 17 days.*Test.*Oct 22 – 29 · 8 days/);
  await expect(page.getByRole('region', { name: 'October 2026' })).toBeVisible();
  // The 15 vs 22 Feb conflict note shows on the even-semester event.
  await expect(page.getByText(/footer of the same calendar says 15 Feb 2027/)).toBeVisible();
  // Past dates are not in Upcoming.
  await expect(editButton(page, 'Gandhi Jayanthi')).toHaveCount(0);
  await noHorizontalOverflow(page, 'calendar');

  // Filters.
  await page.getByRole('button', { name: 'Holidays', exact: true }).click();
  await expect(editButton(page, 'Mahanavami')).toBeVisible();
  await expect(ia1).toHaveCount(0);
  await page.getByRole('button', { name: 'Exams & tests' }).click();
  await expect(ia1).toBeVisible();
  await expect(editButton(page, 'Mahanavami')).toHaveCount(0);

  // Semester tab lists past dates too, with a Today line.
  await page.getByRole('tab', { name: 'Semester' }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(editButton(page, 'Gandhi Jayanthi')).toHaveAccessibleDescription(/Past/);
  await expect(page.getByText('Today · Mon, Oct 5')).toBeVisible();
  await noHorizontalOverflow(page, 'semester tab');
});

test('star toggle marks a date important and persists', async ({ page }) => {
  await open(page);
  const star = page.getByRole('button', { name: 'Important: Mahanavami' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Important: Mahanavami' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Important' }).click();
  await expect(editButton(page, 'Mahanavami')).toBeVisible();
  // Un-starring from the Important tab offers Undo.
  await page.getByRole('button', { name: 'Important: Mahanavami' }).click();
  await expect(editButton(page, 'Mahanavami')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(editButton(page, 'Mahanavami')).toBeVisible();
});

test('add, edit and delete a personal important date', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add important date' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add important date' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Give the date a title.')).toBeVisible();

  await dialog.getByLabel('Title').fill('Amma birthday');
  await dialog.getByLabel('Date', { exact: true }).fill('2026-11-03');
  await dialog.getByLabel('End date').fill('2026-11-01');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('The end date can’t be before the start date.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear end date' }).click();
  await expect(dialog.getByLabel('End date')).toHaveValue('');
  await dialog.getByLabel('All day').uncheck();
  await dialog.getByLabel('Start time').fill('10:00');
  await dialog.getByLabel('End time').fill('09:00');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('End time must be after the start time.')).toBeVisible();
  await dialog.getByLabel('End time').fill('12:00');
  await expect(dialog.getByRole('radio', { name: 'Personal' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^Important/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);

  const row = editButton(page, 'Amma birthday');
  await expect(row).toHaveAccessibleDescription(/in 29 days.*Personal.*10:00 AM – 12:00 PM/);
  await expect(page.getByRole('button', { name: 'Important: Amma birthday' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Important' }).click();
  await expect(row).toBeVisible();

  // Edit.
  await row.click();
  const edit = page.getByRole('dialog', { name: 'Edit date' });
  await expect(edit.getByLabel('Title')).toHaveValue('Amma birthday');
  await edit.getByLabel('Title').fill('Amma’s birthday party');
  await edit.getByLabel('Notes').fill('Order the cake');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(editButton(page, 'Amma’s birthday party')).toBeVisible();
  await expect(page.getByText('Order the cake')).toBeVisible();
  await page.reload();
  await expect(editButton(page, 'Amma’s birthday party')).toBeVisible();

  // Delete (own dates go straight away, with Undo).
  await editButton(page, 'Amma’s birthday party').click();
  await page.getByRole('dialog', { name: 'Edit date' }).getByRole('button', { name: 'Delete' }).click();
  await expect(editButton(page, 'Amma’s birthday party')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(editButton(page, 'Amma’s birthday party')).toBeVisible();
  await editButton(page, 'Amma’s birthday party').click();
  await page.getByRole('dialog', { name: 'Edit date' }).getByRole('button', { name: 'Delete' }).click();
  await expect(editButton(page, 'Amma’s birthday party')).toHaveCount(0);
  await page.reload();
  await expect(editButton(page, 'Amma’s birthday party')).toHaveCount(0);
});

test('deleting an official semester date asks first and can be restored', async ({ page }) => {
  await open(page, '/calendar?tab=semester');
  await editButton(page, 'Mahanavami').click();
  await page.getByRole('dialog', { name: 'Edit date' }).getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this semester date?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Edit date' }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete this semester date?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(editButton(page, 'Mahanavami')).toHaveCount(0);
  await expect(page.getByText('1 official date was deleted.')).toBeVisible();
  await page.getByRole('button', { name: 'Restore them' }).click();
  await expect(editButton(page, 'Mahanavami')).toBeVisible();
});

test('export downloads valid .ics files for dates and the timetable', async ({ page }) => {
  await open(page, '/calendar?tab=sync');
  await expect(page.getByText('It’s a copy, not a live link.')).toBeVisible();

  let wait = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download \d+ dates \(\.ics\)$/ }).click();
  let download = await wait;
  expect(download.suggestedFilename()).toBe('kiran-planner-semester.ics');
  const dates = readFileSync((await download.path())!, 'utf8');
  expect(dates.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(dates).toContain('SUMMARY:First Internal Assessment Test (IA-1)');
  expect(dates).toContain('DTSTART;VALUE=DATE:20261022\r\nDTEND;VALUE=DATE:20261030');
  expect(dates).toContain('BEGIN:VALARM');
  expect(dates.trimEnd().endsWith('END:VCALENDAR')).toBe(true);

  wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download timetable (.ics)' }).click();
  download = await wait;
  expect(download.suggestedFilename()).toBe('kiran-planner-timetable.ics');
  const tt = readFileSync((await download.path())!, 'utf8');
  expect(tt).toContain('BEGIN:VCALENDAR');
  expect(tt).toContain('BEGIN:VTIMEZONE\r\nTZID:Asia/Kolkata');
  expect(tt).toContain('SUMMARY:Gym');
  expect(tt).toMatch(/RRULE:FREQ=DAILY;UNTIL=20270210T182959Z/);
  expect(tt).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20270210T182959Z');
  expect(tt).toContain('BEGIN:VALARM');
  expect(tt).toContain('TRIGGER:PT0S');
  expect(tt).not.toContain('SUMMARY:Sleep');
  // No college alarm on official weekday holidays (Mahanavami, Christmas, Republic Day…).
  await expect(page.getByLabel(/No college or travel alerts on holidays/)).toBeChecked();
  await expect(page.getByText(/6 holidays fall on a college day: Oct 20, Oct 21, Nov 10, Dec 25, Jan 14, Jan 26/)).toBeVisible();
  expect(tt).toContain('EXDATE;TZID=Asia/Kolkata:20261020T090000');
  expect(tt).toContain('EXDATE;TZID=Asia/Kolkata:20270126T090000');
  expect(tt.match(/^EXDATE/gm)!.length).toBe(6);

  // Everything incl. sleep, 10 minutes early, open ended.
  await page.getByLabel('Everything, incl. wake-up, meals, travel and sleep').check();
  await page.getByLabel('Alert', { exact: true }).selectOption('10');
  await page.getByLabel(/Stop repeating after the semester/).uncheck();
  wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download timetable (.ics)' }).click();
  const all = readFileSync((await (await wait).path())!, 'utf8');
  expect(all).toContain('SUMMARY:Sleep');
  expect(all).toContain('DTSTART;TZID=Asia/Kolkata:20261005T220000\r\nDTEND;TZID=Asia/Kolkata:20261006T050000');
  expect(all).toContain('TRIGGER:-PT10M');
  expect(all).not.toContain('UNTIL=');
  // College plus the trips there and back are skipped on each of the 6 holidays.
  expect(all.match(/^EXDATE/gm)!.length).toBe(18);
  expect(all).toContain('EXDATE;TZID=Asia/Kolkata:20261020T080000'); // get ready + travel

  // The holidays can be kept in.
  await page.getByLabel(/No college or travel alerts on holidays/).uncheck();
  wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download timetable (.ics)' }).click();
  expect(readFileSync((await (await wait).path())!, 'utf8')).not.toContain('EXDATE');

  // Google ignores the file's alerts: the how-to says so.
  await page.getByText('In Google Calendar', { exact: true }).click();
  await expect(page.getByText(/Google Calendar doesn’t import the alerts in the file/)).toBeVisible();
  await noHorizontalOverflow(page, 'sync tab');
});

test('importing an .ics file previews, skips duplicates and adds events', async ({ page }) => {
  await open(page, '/calendar?tab=sync');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    'BEGIN:VEVENT',
    'UID:hack-1',
    'SUMMARY:College hackathon',
    'DTSTART;VALUE=DATE:20261121',
    'DTEND;VALUE=DATE:20261123',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:quiz-1',
    'SUMMARY:Weekly DSA quiz',
    'DTSTART:20261010T043000Z',
    'DTEND:20261010T053000Z',
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:dup',
    'SUMMARY:Gandhi Jayanthi',
    'DTSTART;VALUE=DATE:20261002',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  await page.getByLabel('Choose calendar file to import').setInputFiles({ name: 'bad.ics', mimeType: 'text/calendar', buffer: Buffer.from('not a calendar') });
  await expect(page.getByText('That isn’t a calendar file.', { exact: false })).toBeVisible();

  await page.getByLabel('Choose calendar file to import').setInputFiles({ name: 'college.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  await expect(page.getByRole('heading', { name: '3 events in college.ics' })).toBeVisible();
  await expect(page.getByText('1 repeating event: only the first date is imported.')).toBeVisible();
  await expect(page.getByText('1 already in your calendar (same title and date) – skipped.')).toBeVisible();
  const list = page.getByRole('list', { name: 'Events to import' });
  await expect(list.getByRole('checkbox', { name: /Gandhi Jayanthi/ })).toBeDisabled();
  await expect(list.getByRole('checkbox', { name: /Weekly DSA quiz/ })).toBeChecked();
  await expect(list.getByText('10:00 AM – 11:00 AM')).toBeVisible(); // UTC converted to IST
  await page.getByRole('button', { name: 'Import 2 events' }).click();
  await expect(page.getByText('Imported 2 events')).toBeVisible();

  await page.getByRole('tab', { name: 'Upcoming' }).click();
  await expect(editButton(page, 'College hackathon')).toHaveAccessibleDescription(/Nov 21 – 22 · 2 days/);
  await expect(editButton(page, 'Weekly DSA quiz')).toBeVisible();
  await page.reload();
  await expect(editButton(page, 'College hackathon')).toBeVisible();

  // Importing the same file again finds only duplicates.
  await page.getByRole('tab', { name: 'Sync' }).click();
  await page.getByLabel('Choose calendar file to import').setInputFiles({ name: 'college.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  await expect(page.getByText('3 already in your calendar (same title and date) – skipped.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 0 events' })).toBeDisabled();
});

test('the official PDF is kept on this device and can be viewed and removed', async ({ page }) => {
  await open(page, '/calendar?tab=sync');
  const input = page.getByLabel('Choose semester calendar PDF');
  await expect(page.getByRole('button', { name: 'Attach semester calendar PDF' })).toBeVisible();
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByText('Choose a PDF file.')).toBeVisible();
  // A renamed file is caught by its content.
  await input.setInputFiles({ name: 'photo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('\x89PNG not a pdf') });
  await expect(page.getByText(/That file isn’t a PDF/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach semester calendar PDF' })).toBeVisible();

  // Some pickers give no type: it is still stored and shown as a PDF, not downloaded.
  await input.setInputFiles({ name: 'calendar_of_events.pdf', mimeType: '', buffer: Buffer.from('%PDF-1.4\n%test\n') });
  await expect(page.getByRole('main').getByText('calendar_of_events.pdf')).toBeVisible();
  const view = page.getByRole('link', { name: 'View PDF' });
  await expect(view).toHaveAttribute('href', /^blob:/);
  await expect(view).toHaveAttribute('target', '_blank');
  const blobType = (href: string) => page.evaluate(async (u) => (await (await fetch(u)).blob()).type, href);
  expect(await blobType((await view.getAttribute('href'))!)).toBe('application/pdf');

  await page.reload();
  await expect(page.getByRole('main').getByText('calendar_of_events.pdf')).toBeVisible();
  await expect(page.getByText(/this device only/)).toBeVisible();
  expect(await blobType((await page.getByRole('link', { name: 'View PDF' }).getAttribute('href'))!)).toBe('application/pdf');

  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove the PDF?' }).getByRole('button', { name: 'Remove PDF' }).click();
  await expect(page.getByRole('button', { name: 'Attach semester calendar PDF' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Attach semester calendar PDF' })).toBeVisible();
});

test('month view marks holidays, important dates and other events', async ({ page }) => {
  await open(page, '/schedule?view=month');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open 2026-10-02.*event: Gandhi Jayanthi \(holiday\)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open 2026-10-22.*event: First Internal Assessment Test \(IA-1\) \(important\)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open 2026-10-05.*events: AIML for Hydro Informatics; Overview of Geographical Information System$/ })).toBeVisible();
  // A month-long course is only marked on its first day.
  await expect(page.getByRole('button', { name: /^Open 2026-10-06/ })).not.toHaveAccessibleName(/event/);
  await expect(page.getByLabel('Legend')).toContainText('important date');
  await expect(page.getByLabel('Legend')).toContainText('holiday (grey day, dashed border)');
  await noHorizontalOverflow(page, 'month view');
  // Holidays are not tinted green: on this grid green means tasks done.
  const holidayCell = page.getByRole('button', { name: /^Open 2026-10-20/ });
  expect(await holidayCell.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/rgb\(236, 253, 245\)|rgb\(209, 250, 229\)/);
  await expect(holidayCell).toHaveClass(/border-dashed/);
  await expect(holidayCell.locator('svg.lucide-tree-palm')).toBeVisible();
  // A starred personal date shows up too.
  await page.goto('/#/calendar');
  await page.getByRole('button', { name: 'Important: Overview of Geographical Information System' }).click();
  // A starred holiday keeps its palm next to the star, on phones too.
  await page.getByRole('button', { name: 'Important: Mahanavami' }).click();
  await page.goto('/#/schedule?view=month');
  await expect(page.getByRole('button', { name: /^Open 2026-10-14.*Overview of Geographical Information System \(important\)$/ })).toBeVisible();
  const starred = page.getByRole('button', { name: /^Open 2026-10-20.*Mahanavami \(holiday\) \(important\)/ });
  await expect(starred.locator('svg.lucide-tree-palm')).toBeVisible();
  await expect(starred.locator('svg.lucide-star')).toBeVisible();
  await noHorizontalOverflow(page, 'month view with a starred holiday');
});

test('Today shows today’s events and countdowns to important dates', async ({ page }) => {
  await open(page, '/');
  const card = page.getByRole('region', { name: 'Coming up', exact: true });
  // Department courses that aren't starred share one line instead of a row each.
  await expect(card.locator('p', { hasText: 'Also today:' })).toHaveText(
    'Also today: AIML for Hydro Informatics (first day) · Overview of Geographical Information System (first day)',
  );
  await expect(card.getByRole('list', { name: 'Happening today' })).toHaveCount(0);
  await expect(card.getByText('IA-1 starts in 17 days')).toBeVisible();
  // Only starred dates in the next 30 days get a countdown (the parent–teacher meeting is 40 days away).
  await expect(card.getByRole('list', { name: 'Next important dates' }).getByRole('listitem')).toHaveCount(1);
  await expect(card.getByText(/Parent–Teacher Meeting/)).toHaveCount(0);
  // Compact on phones, so the day's tasks stay near the top.
  const box = (await card.boundingBox())!;
  expect(box.height, 'Coming up card height').toBeLessThan(260);
  await card.getByRole('link', { name: 'All dates' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendar');
});

test('a personal date with brackets keeps its full name in countdowns', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add important date' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add important date' });
  await dialog.getByLabel('Title').fill('Amma birthday (Sunday)');
  await dialog.getByLabel('Date', { exact: true }).fill('2026-10-11');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/#/');
  const card = page.getByRole('region', { name: 'Coming up', exact: true });
  await expect(card.getByText('Amma birthday (Sunday) is in 6 days')).toBeVisible();
  await expect(card.getByText(/^Sunday is in/)).toHaveCount(0);
  await expect(card.getByText('IA-1 starts in 17 days')).toBeVisible();
});

test('Today shows a holiday on its day', async ({ page }) => {
  await open(page, '/', new Date('2026-10-02T08:00:00+05:30'));
  await expect(page.getByRole('region', { name: 'Coming up', exact: true }).getByText('Holiday – Gandhi Jayanthi')).toBeVisible();
});

test('Today shows the IA-1 day count while it runs', async ({ page }) => {
  await open(page, '/', new Date('2026-10-24T08:00:00+05:30'));
  const card = page.getByRole('region', { name: 'Coming up', exact: true });
  await expect(card.getByText('IA-1 test · day 3 of 8')).toBeVisible();
  // Viewing another day lists that day's dates without countdowns.
  await page.goto('/#/?date=2026-10-20');
  await expect(page.getByRole('region', { name: 'On Oct 20' }).getByText('Holiday – Mahanavami')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Next important dates' })).toHaveCount(0);
});

test('a mis-guessed import can be fixed in the preview and never takes over the exam countdown', async ({ page }) => {
  await open(page, '/calendar?tab=sync');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:airport',
    'SUMMARY:See Priya off at the airport',
    'DTSTART;VALUE=DATE:20261008',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:final',
    'SUMMARY:Champions League final',
    'DTSTART;VALUE=DATE:20261009',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:mock',
    'SUMMARY:Mock interview',
    'DTSTART;VALUE=DATE:20261012',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  await page.getByLabel('Choose calendar file to import').setInputFiles({ name: 'friends.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  const list = page.getByRole('list', { name: 'Events to import' });
  await expect(list.getByRole('combobox', { name: 'Type of See Priya off at the airport' })).toHaveValue('event');
  await expect(list.getByRole('combobox', { name: 'Type of Champions League final' })).toHaveValue('event');
  // The user knows better: the mock interview counts as a test.
  await list.getByRole('combobox', { name: 'Type of Mock interview' }).selectOption('test');
  await noHorizontalOverflow(page, 'import preview');
  await page.getByRole('button', { name: 'Import 3 events' }).click();
  await expect(page.getByText('Imported 3 events')).toBeVisible();

  // The semester hero still counts down to the real next test… which is now the mock interview, then IA-1.
  const countdowns = page.getByRole('list', { name: 'Countdowns' });
  await expect(countdowns.getByRole('listitem').nth(0)).toContainText('7 days');
  await expect(countdowns.getByRole('listitem').nth(0)).toContainText('Mock interview');
  await expect(countdowns.getByRole('listitem').nth(0)).not.toContainText('See Priya');
  await page.getByRole('tab', { name: 'Upcoming' }).click();
  await expect(editButton(page, 'Mock interview')).toHaveAccessibleDescription(/Test/);
  await expect(editButton(page, 'See Priya off at the airport')).toHaveAccessibleDescription(/Event/);
  await page.getByRole('button', { name: 'Exams & tests' }).click();
  await expect(editButton(page, 'See Priya off at the airport')).toHaveCount(0);
});

test('keyboard focus returns to the date after closing or saving the edit sheet', async ({ page }) => {
  await open(page);
  const row = editButton(page, 'Mahanavami');
  await row.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit date' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();

  // After saving, the (renamed) row is focused again.
  await page.keyboard.press('Enter');
  await dialog.getByLabel('Title').fill('Mahanavami (Dasara)');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editButton(page, 'Mahanavami (Dasara)')).toBeFocused();

  // Cancelling the delete confirmation goes back to the Delete button in the sheet.
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this semester date?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Delete' })).toBeFocused();
});

test('the semester title keeps the academic year on one line', async ({ page }) => {
  await open(page);
  const year = page.getByRole('heading', { name: '5th Semester · AY 2026-27' }).getByText('AY 2026-27', { exact: true });
  await expect(year).toHaveCSS('white-space', 'nowrap');
  const box = (await year.boundingBox())!;
  expect(box.height, 'AY 2026-27 on one line').toBeLessThan(40);
});
