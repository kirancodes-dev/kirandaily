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

  await input.setInputFiles({ name: 'calendar_of_events.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n') });
  await expect(page.getByRole('main').getByText('calendar_of_events.pdf')).toBeVisible();
  const view = page.getByRole('link', { name: 'View PDF' });
  await expect(view).toHaveAttribute('href', /^blob:/);
  await expect(view).toHaveAttribute('target', '_blank');

  await page.reload();
  await expect(page.getByRole('main').getByText('calendar_of_events.pdf')).toBeVisible();
  await expect(page.getByText(/this device only/)).toBeVisible();

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
  await expect(page.getByLabel('Legend')).toContainText('holiday');
  await noHorizontalOverflow(page, 'month view');
  // A starred personal date shows up too.
  await page.goto('/#/calendar');
  await page.getByRole('button', { name: 'Important: Overview of Geographical Information System' }).click();
  await page.goto('/#/schedule?view=month');
  await expect(page.getByRole('button', { name: /^Open 2026-10-14.*Overview of Geographical Information System \(important\)$/ })).toBeVisible();
});

test('Today shows today’s events and countdowns to important dates', async ({ page }) => {
  await open(page, '/');
  const card = page.getByRole('region', { name: 'Coming up', exact: true });
  await expect(card.getByText('AIML for Hydro Informatics starts today')).toBeVisible();
  await expect(card.getByText('IA-1 starts in 17 days')).toBeVisible();
  await expect(card.getByRole('list', { name: 'Next important dates' }).getByRole('listitem')).toHaveCount(3);
  await card.getByRole('link', { name: 'All dates' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendar');
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
