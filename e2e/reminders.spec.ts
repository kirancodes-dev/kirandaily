import { expect, test, type Page } from '@playwright/test';

// Monday, October 5, 2026 (plan start), Asia/Kolkata. Evening plan:
// College subject 18:00–19:00, Dinner 19:00–19:30, Java 19:30–21:00, German 21:00–21:30, Revision 21:30–22:00, Sleep 22:00–05:00.
const at = (time: string) => new Date(`2026-10-05T${time}:00+05:30`);

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

async function open(page: Page, hash: string, time: Date) {
  await page.clock.install({ time });
  await page.goto(`/#${hash}`);
}

/** Opening the app catches up on the last two hours with one summary alert; close it so it can't cover anything. */
async function dismissSummary(page: Page) {
  const summary = page.getByRole('alert').filter({ hasText: 'tasks are waiting' });
  await expect(summary).toBeVisible();
  await summary.getByRole('button', { name: 'Dismiss' }).click();
  await expect(summary).toHaveCount(0);
}

test('a task can’t be ticked before it starts, and can once it has started', async ({ page }) => {
  await open(page, '', at('19:00'));
  const java = page.getByRole('checkbox', { name: 'Mark Java done' });
  await expect(java).toHaveAccessibleName('Mark Java done (available from 7:30 PM)');
  await expect(page.getByText('Starts in 30m')).toBeVisible();

  await java.click();
  const notYet = page.getByRole('alert').filter({ hasText: 'Not yet — Java starts at 7:30 PM' });
  await expect(notYet).toBeVisible();
  await expect(notYet).toContainText('You can tick it once it starts (in 30 min).');
  await expect(java).not.toBeChecked();
  await expect(page.getByText('0%').first()).toBeVisible();

  // Tasks that already started can be ticked.
  await page.getByRole('checkbox', { name: 'Mark Dinner done' }).check();
  await expect(page.getByRole('checkbox', { name: 'Mark Dinner not done' })).toBeChecked();

  await page.clock.fastForward('31:00'); // 19:31
  await expect(java).toHaveAccessibleName('Mark Java done');
  await java.check();
  const javaDone = page.getByRole('checkbox', { name: 'Mark Java not done' });
  await expect(javaDone).toBeChecked();
  // Un-ticking is always allowed.
  await javaDone.uncheck();
  await expect(page.getByRole('checkbox', { name: 'Mark Java done' })).not.toBeChecked();
});

test('the action sheet (used by the week grid) is time-locked too', async ({ page }) => {
  await open(page, '/schedule', at('19:00'));
  const block = page.getByRole('button', { name: /^Java, Java, 7:30 PM to 9:00 PM/ }).locator('visible=true').first();
  await block.click();
  await page.getByRole('button', { name: 'Mark done (available from 7:30 PM)' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Not yet — Java starts at 7:30 PM' })).toBeVisible();
  await expect(block).not.toHaveAccessibleName(/completed/);

  await page.clock.fastForward('31:00');
  await block.click();
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(block).toHaveAccessibleName(/completed$/);
});

test('the study dialog only offers planned tasks that have started', async ({ page }) => {
  await open(page, '/study', at('19:00'));
  await page.getByRole('button', { name: 'Log time' }).click();
  await page.getByLabel('Category').selectOption('java');
  await expect(page.getByLabel('Also complete a planned task?')).toHaveCount(0);
  await page.getByLabel('Category').selectOption('college');
  await expect(page.getByLabel('Also complete a planned task?')).toContainText('6:00 PM College subject');

  await page.clock.fastForward('31:00');
  await page.getByLabel('Category').selectOption('java');
  await expect(page.getByLabel('Also complete a planned task?')).toContainText('7:30 PM Java');
});

test('a reminder pops up when a task starts, and is not repeated after a reload', async ({ page }) => {
  await open(page, '', at('19:28'));
  // Opened after a while: one summary instead of three separate alerts.
  const summary = page.getByRole('alert').filter({ hasText: '3 tasks are waiting' });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('2 overdue · 1 starting: Travel + rest, College subject, Dinner.');

  await page.clock.fastForward('02:30'); // 19:30:30
  const starting = page.getByRole('status').filter({ hasText: 'Java starts now' });
  await expect(starting).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Dinner ended — did you do it?' })).toBeVisible();

  // Alerts are remembered for the day, so a reload doesn't repeat them.
  const alerted = await page.evaluate(() => JSON.parse(localStorage.getItem('kiran-planner:ui:alerted:2026-10-05') ?? '[]') as string[]);
  expect(alerted.some((k) => k.startsWith('starting:') && k.includes('@2026-10-05'))).toBe(true);

  await starting.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Study');

  await page.goto('/#/');
  await page.reload();
  await page.clock.runFor(5_000);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good evening, Kiran');
  await expect(page.getByText('Java starts now')).toHaveCount(0);
  await expect(page.getByText('tasks are waiting')).toHaveCount(0);
});

test('the overdue reminder can mark the task done', async ({ page }) => {
  await open(page, '', at('20:59'));
  await dismissSummary(page);
  await page.clock.fastForward('01:30'); // 21:00:30 — Java ended without a tick
  const overdue = page.getByRole('alert').filter({ hasText: 'Java ended — did you do it?' });
  await expect(overdue).toBeVisible();
  await overdue.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark Java not done' })).toBeChecked();
});

test('Needs attention lists overdue tasks with Mark done / Skip, and shows what is happening now', async ({ page }) => {
  await open(page, '', at('19:45'));
  await dismissSummary(page);
  const card = page.getByRole('region', { name: /^Needs attention/ });
  await expect(card).toBeVisible();
  const rows = card.getByRole('list', { name: 'Tasks that need attention' }).getByRole('listitem');
  // Most recent first, 3 at a time.
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Dinner');
  // Phones show the short form.
  await expect(rows.first()).toContainText(isMobile(page) ? 'Ended 15m ago' : 'Ended 7:30 PM · 15m ago', { useInnerText: true });
  await card.getByRole('button', { name: 'Show all 8' }).click();
  await expect(rows).toHaveCount(8);

  await card.getByRole('button', { name: 'Mark Dinner done' }).click();
  await expect(rows).toHaveCount(7);
  await expect(page.getByRole('checkbox', { name: 'Mark Dinner not done' })).toBeChecked();
  // Ticked after it ended: the card says so (text, not just colour).
  await expect(page.getByRole('article', { name: /^Dinner, .*Completed late$/ })).toContainText('late');

  await card.getByRole('button', { name: 'Skip Gym' }).click();
  await expect(rows).toHaveCount(6);
  await expect(page.getByRole('article', { name: /^Gym, .*Skipped$/ })).toBeVisible();
  await page.getByRole('status').filter({ hasText: 'Skipped Gym' }).getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(7);

  await card.getByRole('button', { name: 'Move College subject' }).click();
  await expect(page.getByRole('dialog', { name: 'Move “College subject”' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Happening now: Java with its time left and a timer shortcut.
  await expect(card.getByRole('heading', { name: 'Happening now' })).toBeVisible();
  await expect(card).toContainText('Java');
  await expect(card).toContainText('1h 15m left · until 9:00 PM');
  await card.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Study');
});

test('Needs attention only shows on today and hides when nothing needs attention', async ({ page }) => {
  await open(page, '', at('04:30'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good morning, Kiran');
  await expect(page.getByRole('region', { name: /^Needs attention/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Happening now' })).toHaveCount(0);
  await page.goto('/#/?date=2026-10-06');
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await expect(page.getByRole('region', { name: /^Needs attention/ })).toHaveCount(0);
});

test('reminder settings are saved', async ({ page }) => {
  await open(page, '/settings', at('07:30'));
  const lock = page.getByRole('switch', { name: 'Time-lock', exact: true });
  const reminders = page.getByRole('switch', { name: 'Reminders', exact: true });
  const sound = page.getByRole('switch', { name: 'Sound', exact: true });
  await expect(lock).toBeChecked();
  await expect(reminders).toBeChecked();
  await expect(sound).toBeChecked();
  await expect(page.getByLabel('Remind me')).toHaveValue('0');

  await lock.uncheck();
  await sound.uncheck();
  await page.getByLabel('Remind me').selectOption('10');
  await page.reload();
  await expect(lock).not.toBeChecked();
  await expect(sound).not.toBeChecked();
  await expect(reminders).toBeChecked();
  await expect(page.getByLabel('Remind me')).toHaveValue('10');

  await reminders.uncheck();
  await expect(sound).toBeDisabled();
  await expect(page.getByLabel('Remind me')).toBeDisabled();

  await expect(page.getByText('System notifications')).toBeVisible();
  await expect(page.getByText(/notifications only work when the planner is added to the Home Screen/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Add to Calendar/ })).toHaveAttribute('href', '#/calendar');
});

/**
 * Headless Chromium always reports Notification.permission = 'denied', so these
 * tests use a stand-in that records what would be shown, plus a recorded app badge.
 */
async function fakeSystemApis(page: Page, { background = false } = {}) {
  await page.addInitScript((inBackground) => {
    const w = window as unknown as Record<string, unknown>;
    const shown: { title: string; body?: string }[] = [];
    const badges: number[] = [];
    w.__shown = shown;
    w.__badges = badges;
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission(cb?: (p: NotificationPermission) => void) {
        FakeNotification.permission = 'granted';
        cb?.('granted');
        return Promise.resolve('granted' as NotificationPermission);
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body });
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true, writable: true });
    Object.defineProperty(navigator, 'setAppBadge', { value: (n: number) => (badges.push(n), Promise.resolve()), configurable: true });
    Object.defineProperty(navigator, 'clearAppBadge', { value: () => (badges.push(0), Promise.resolve()), configurable: true });
    if (inBackground) document.hasFocus = () => false;
  }, background);
}

test('notifications can be enabled and tested', async ({ page }) => {
  await fakeSystemApis(page);
  await open(page, '/settings', at('07:30'));
  await expect(page.getByText('Off — allow them to get alerts when the planner isn’t in front.')).toBeVisible();
  await page.getByRole('button', { name: 'Enable notifications' }).click();
  await expect(page.getByText('On — you’ll get a system alert while the planner is in the background.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send a test reminder' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Test reminder' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __shown: { title: string }[] }).__shown.map((n) => n.title))).toEqual(['Test reminder']);
});

test('in the background a reminder becomes a system notification and the app badge counts overdue tasks', async ({ page }) => {
  await fakeSystemApis(page, { background: true });
  await page.addInitScript(() => (Notification as unknown as { permission: string }).permission = 'granted');
  await open(page, '', at('19:28'));
  await expect(page.getByRole('alert').filter({ hasText: '3 tasks are waiting' })).toBeVisible();
  await page.clock.fastForward('02:30'); // 19:30:30
  await expect(page.getByRole('status').filter({ hasText: 'Java starts now' })).toBeVisible();
  const titles = () => page.evaluate(() => (window as unknown as { __shown: { title: string }[] }).__shown.map((n) => n.title));
  await expect.poll(titles).toEqual(['3 tasks are waiting', 'Dinner ended — did you do it?', 'Java starts now']);
  // Badge = tasks that ended without a tick today (8 at 19:30).
  const badges = () => page.evaluate(() => (window as unknown as { __badges: number[] }).__badges);
  await expect.poll(badges).toEqual([7, 8]);
  // Ticking updates the badge right away.
  await page.getByRole('checkbox', { name: 'Mark Dinner done' }).check();
  await expect.poll(badges).toEqual([7, 8, 7]);
});

test('with the time-lock off a future task can be ticked', async ({ page }) => {
  await open(page, '/settings', at('07:30'));
  await page.getByRole('switch', { name: 'Time-lock', exact: true }).uncheck();
  await page.goto('/#/');
  const java = page.getByRole('checkbox', { name: 'Mark Java done' });
  await expect(java).toHaveAccessibleName('Mark Java done');
  await java.check();
  await expect(page.getByRole('checkbox', { name: 'Mark Java not done' })).toBeChecked();
  await expect(page.getByRole('alert').filter({ hasText: 'Not yet' })).toHaveCount(0);

  // Even another day.
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark German done' }).check();
  await expect(page.getByRole('checkbox', { name: 'Mark German not done' })).toBeChecked();
});
