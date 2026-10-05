import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Freeze the clock at the plan start: Monday, October 5, 2026, 07:30 IST.
const START = new Date('2026-10-05T07:30:00+05:30');

async function open(page: Page, hash = '') {
  await page.clock.install({ time: START });
  await page.goto(`/#${hash}`);
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function nav(page: Page, label: string) {
  if (isMobile(page)) {
    await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: label, exact: true }).click();
  } else {
    await page.locator('aside').getByRole('link', { name: label, exact: true }).click();
  }
}

test('today dashboard starts with the plan and zero progress', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good morning, Kiran');
  await expect(page.getByText('Monday, October 5, 2026')).toBeVisible();
  await expect(page.getByText('Today’s completion')).toBeVisible();
  await expect(page.getByText('0%').first()).toBeVisible();
  await expect(page.getByText('Not completed')).toBeVisible();
  await expect(page.getByText('7 h target')).toBeVisible();
  const titles = await page.locator('ol h3').allTextContents();
  expect(titles).toEqual([
    'Wake up', 'Gym', 'Bath + breakfast', 'Get ready + travel', 'College', 'Travel + rest',
    'College subject', 'Dinner', 'Java', 'German', 'Revision', 'Sleep',
  ]);
});

test('completing a task updates stats and survives a reload', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Mark Gym done' }).check();
  await expect(page.getByText('Done', { exact: true }).first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark Java done' }).check();
  await expect(page.getByText('17%')).toBeVisible(); // 2 of 12
  await expect(page.getByText('1.5 h done')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Mark Gym not done' })).toBeChecked();
  await expect(page.getByText('17%')).toBeVisible();
});

test('a day with 80% or more of its tasks done counts for the Day streak', async ({ page }) => {
  await open(page);
  await expect(page.getByText('0-day streak')).toBeVisible();
  await expect(page.getByText('10 more tasks to reach 80% and keep the streak')).toBeVisible();
  for (const name of ['Wake up', 'Gym', 'Bath + breakfast', 'Get ready + travel', 'College', 'Travel + rest', 'College subject', 'Dinner', 'Java']) {
    await page.getByRole('checkbox', { name: `Mark ${name} done` }).check();
  }
  await expect(page.getByText('1 more task to reach 80% and keep the streak')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark German done' }).check();
  await expect(page.getByText('✓ Today counts for your streak (80%+)')).toBeVisible();
  await expect(page.getByText('1-day streak')).toBeVisible();
  await page.goto('/#/schedule?view=month');
  await expect(page.getByRole('button', { name: /^Open 2026-10-05.*streak day/ })).toBeVisible();
});

test('task can be moved, duplicated, skipped and deleted for one day', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Options for German' }).click();
  await page.getByRole('button', { name: 'Move / reschedule' }).click();
  await page.getByRole('button', { name: 'Tomorrow, same time' }).click();
  await expect(page.locator('ol h3', { hasText: 'German' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await expect(page.locator('ol h3', { hasText: /^German$/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Options for Revision' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('ol h3', { hasText: /^Revision$/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Options for DSA' }).click();
  await page.getByRole('button', { name: 'Skip today' }).click();
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Options for Dinner' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Only this day' }).click();
  await expect(page.locator('ol h3', { hasText: /^Dinner$/ })).toHaveCount(0);

  // Gym can never be deleted as a series.
  await page.getByRole('button', { name: 'Options for Gym' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'This and all following days' })).toBeDisabled();
});

test('add task validates input', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Give the task a title.')).toBeVisible();
  await page.getByLabel('Title').fill('Birthday party');
  await page.getByLabel('Start').fill('19:00');
  await page.getByLabel('End').fill('19:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('End time must differ from start time.')).toBeVisible();
  await page.getByLabel('End').fill('21:00');
  await page.getByLabel('Category').selectOption('other');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('ol h3', { hasText: 'Birthday party' })).toBeVisible();
});

test('every navigation item opens a real page', async ({ page }) => {
  await open(page);
  for (const [label, heading] of [
    ['Schedule', 'Schedule'],
    ['Study', 'Study'],
    ['Progress', 'Progress'],
    ['Today', 'Good morning, Kiran'],
  ]) {
    await nav(page, label);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
  const more: [string, string][] = [
    ['Java', 'Java'], ['DSA', 'DSA'], ['German', 'German'], ['College', 'College'], ['CGPA', 'CGPA'],
    ['Projects', 'Projects'], ['Goals', 'Goals'], ['Notes', 'Notes'], ['Weekly review', 'Progress'],
    ['Search', 'Search'], ['Settings', 'Settings'],
  ];
  for (const [label, heading] of more) {
    if (isMobile(page)) {
      await nav(page, 'More');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('More');
      await page.getByRole('main').getByRole('link', { name: new RegExp(`^${label}`) }).click();
    } else {
      await nav(page, label);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    // Compare with the device width: mobile Chrome widens innerWidth when content overflows.
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `horizontal overflow on ${label}`).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test('month calendar opens a day', async ({ page }) => {
  await open(page, '/schedule?view=month');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.getByRole('button', { name: /^Open 2026-10-06/ }).click();
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await page.goto('/#/schedule?view=month');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
});

test('weekly view shows study targets and time grid', async ({ page }) => {
  await open(page, '/schedule');
  const days = page.getByRole('group', { name: 'Days of the week and study targets' });
  await expect(days.getByRole('button')).toHaveCount(7);
  await expect(days.getByRole('button').nth(0)).toContainText('4h');
  await expect(days.getByRole('button').nth(5)).toContainText('8h');
  await expect(days.getByRole('button').nth(6)).toContainText('8h');
  if (isMobile(page)) {
    await days.getByRole('button').nth(5).click();
    await expect(page.getByRole('list', { name: /Tasks on Sat 10/ }).locator('visible=true')).toHaveCount(1);
  } else {
    await expect(page.locator('.hidden.lg\\:block').getByRole('list', { name: /Tasks on/ })).toHaveCount(7);
  }
});

test('study timer: start, pause, resume, finish and save', async ({ page }) => {
  await open(page, '/study');
  await page.getByRole('button', { name: 'Start Study Session' }).click();
  await page.clock.runFor(65_000);
  await expect(page.getByRole('timer')).toHaveText('00:01:05');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByRole('timer')).toHaveText('00:01:05');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByRole('timer')).toHaveText('00:02:05');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByLabel('Minutes')).toHaveValue('2');
  await page.getByLabel('Category').selectOption('java');
  await page.getByLabel('Topic').fill('Loops');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Loops')).toBeVisible();
  await nav(page, 'Today');
  await expect(page.getByText('2m', { exact: true })).toBeVisible();
});

test('export, reset and import data', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Mark Gym done' }).check();
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data (JSON)' }).click();
  const file = await (await downloadPromise).path();
  const json = JSON.parse(readFileSync(file!, 'utf8'));
  expect(json.app).toBe('kiran-planner');
  expect(json.data.tasks.some((t: { completed: boolean }) => t.completed)).toBe(true);

  await page.getByRole('button', { name: 'Reset all data' }).click();
  await page.getByRole('button', { name: 'Reset everything' }).click();
  await expect(page.getByText('All data was reset.')).toBeVisible();

  // Invalid file is refused.
  await page.getByLabel('Choose backup file to import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await expect(page.getByText('Import refused — nothing was changed:')).toBeVisible();

  await page.getByLabel('Choose backup file to import').setInputFiles(file!);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Data imported.')).toBeVisible();
  await nav(page, 'Today');
  await expect(page.getByRole('checkbox', { name: 'Mark Gym not done' })).toBeChecked();
});

test('cloud sync is off until Firebase is configured', async ({ page }) => {
  await open(page, '/settings');
  await expect(page.getByRole('heading', { name: 'Cloud sync' })).toBeVisible();
  await expect(page.getByText('Off. Your data is saved only in this browser.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'How to set up cloud sync' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: /sync|offline/i })).toHaveCount(0); // no header badge
});

test('corrupted storage does not crash the app', async ({ page }) => {
  await page.clock.install({ time: START });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('kiran-planner:data', '{broken json');
      localStorage.setItem('kiran-planner:timer', '"oops"');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.getByText('Some saved data needed repair:')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good morning, Kiran');
});

test('progress page renders streaks, charts and reviews', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Mark Java done' }).check();
  await page.goto('/#/progress');
  await expect(page.getByRole('heading', { name: 'Streaks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly study hours' })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Weekly review' }).click();
  await expect(page.getByText('1.5 h').first()).toBeVisible();
  await page.getByLabel('What went well?').fill('Gym every day');
  await page.getByRole('button', { name: 'Save weekly review' }).click();
  await expect(page.getByText('Weekly review saved.')).toBeVisible();
  await page.getByRole('tab', { name: 'Monthly' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByText('Total study')).toBeVisible();
});

test('PWA manifest and service worker are present', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return href ? ((await (await fetch(href)).json()) as { name: string; icons: unknown[] }) : null;
  });
  expect(manifest?.name).toBe('Kiran Planner');
  expect(manifest?.icons.length).toBeGreaterThanOrEqual(2);
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(sw).toBe(true);
});
