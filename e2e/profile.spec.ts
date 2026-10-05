import { expect, test, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

// Late on the plan's first day (Mon, Oct 5, 2026, 23:30 IST): every task of the day has started,
// so ticking stays valid once tasks can only be ticked after their start time.
const LATE = new Date('2026-10-05T23:30:00+05:30');

async function open(page: Page, hash = '', time = LATE) {
  await page.clock.install({ time });
  await page.goto(`/#${hash}`);
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

/** A real (tiny) PNG: width × height RGB gradient. */
function makePng(width: number, height: number): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = y * stride + 1 + x * 3;
      raw[i] = Math.round((x / width) * 255);
      raw[i + 1] = Math.round((y / height) * 255);
      raw[i + 2] = 200;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The avatar in the app chrome: top bar on phones, sidebar on desktop. */
const chromeAvatar = (page: Page) =>
  isMobile(page) ? page.getByRole('banner').getByRole('link', { name: 'Your profile' }).locator('img') : page.locator('aside a[href="#/profile"] img');

async function tick(page: Page, names: string[]) {
  for (const name of names) await page.getByRole('checkbox', { name: `Mark ${name} done` }).check();
}

test('edit profile: fields are validated and persist after a reload', async ({ page }) => {
  await open(page, '/profile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit profile' });
  await dialog.getByLabel('Name', { exact: true }).fill('Kiran Kumar');
  await dialog.getByLabel('Headline').fill('Java + DSA grinder');
  await dialog.getByLabel('College').fill('ABC Institute of Technology');
  await dialog.getByLabel('Semester').selectOption('6');
  await dialog.getByLabel('Bio').fill('Gym at 5:30, code at night.');
  await dialog.getByLabel('GitHub username').fill('bad name!');
  await dialog.getByLabel('LinkedIn URL').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Save profile' }).click();
  await expect(dialog.getByText('Use only letters, numbers, - and _ (max 39).')).toBeVisible();
  await expect(dialog.getByText('Enter a full link starting with https://')).toBeVisible();
  await expect(dialog.getByLabel('GitHub username')).toBeFocused();

  await dialog.getByLabel('GitHub username').fill('https://github.com/kirancodes-dev');
  await dialog.getByLabel('LeetCode username').fill('kiran_lc');
  await dialog.getByLabel('LinkedIn URL').fill('linkedin.com/in/kiran');
  await dialog.getByLabel('Portfolio URL').fill('https://kiran.dev');
  await dialog.getByRole('button', { name: 'Save profile' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Profile saved')).toBeVisible();

  await page.reload();
  const header = page.getByRole('region', { name: 'Kiran Kumar' });
  await expect(header.getByRole('heading', { name: 'Kiran Kumar' })).toBeVisible();
  await expect(header.getByText('Java + DSA grinder')).toBeVisible();
  await expect(header.getByText('ABC Institute of Technology · Semester 6')).toBeVisible();
  await expect(header.getByText('Gym at 5:30, code at night.')).toBeVisible();
  const links = header.getByRole('list', { name: 'Links' });
  const expected: [RegExp, string][] = [
    [/^GitHub/, 'https://github.com/kirancodes-dev'],
    [/^LeetCode/, 'https://leetcode.com/u/kiran_lc/'],
    [/^LinkedIn/, 'https://linkedin.com/in/kiran'],
    [/^Portfolio/, 'https://kiran.dev'],
  ];
  for (const [name, href] of expected) {
    const link = links.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }

  // The new name is used everywhere.
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good evening, Kiran Kumar');
});

test('profile photo: upload, shows in the app bar, survives a reload, remove + undo', async ({ page }) => {
  await open(page, '/profile');
  await expect(chromeAvatar(page)).toHaveCount(0);
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: makePng(96, 64) });
  await expect(page.getByText('Profile photo updated')).toBeVisible();
  await expect(chromeAvatar(page)).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kiran-planner:data')!).profileExtra.photo as string);
  expect(stored).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
  expect(stored.length).toBeLessThan(150_000);
  // Square 256 × 256.
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, stored);
  expect(size).toEqual([256, 256]);

  await page.reload();
  await expect(chromeAvatar(page)).toHaveAttribute('src', stored);

  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(chromeAvatar(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(chromeAvatar(page)).toHaveAttribute('src', stored);
});

test('profile photo: a broken picture shows a friendly error and keeps the old photo', async ({ page }) => {
  await open(page, '/profile');
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not really a photo') });
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t use that photo' })).toBeVisible();
  await expect(page.getByText(/can’t read HEIC photos/)).toBeVisible();
  await expect(chromeAvatar(page)).toHaveCount(0);
});

test('activity graph: today’s square describes the day and opens it', async ({ page }) => {
  await open(page);
  await tick(page, ['Gym', 'Java']); // 2 of 12, 1.5 h study
  await page.goto('/#/profile');
  const cell = page.getByRole('button', { name: 'Mon, Oct 5: 17% done, 1.5 h study' });
  await expect(cell).toBeVisible();
  await expect(cell).toHaveAttribute('aria-current', 'date');
  // Phones start scrolled to the latest week: today's square is inside the visible part of the graph.
  const inside = await cell.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const scroller = el.closest('.overflow-x-auto')!.getBoundingClientRect();
    return box.left >= scroller.left && box.right <= scroller.right;
  });
  expect(inside).toBe(true);
  // Days before the plan started are drawn empty (not buttons).
  await expect(page.getByRole('button', { name: /^Sun, Oct 4:/ })).toHaveCount(0);
  await expect(page.getByText('0 streak days in the last year')).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, 'horizontal overflow on Profile').toBeLessThanOrEqual(page.viewportSize()!.width);

  await cell.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good evening, Kiran');
  await expect(page.getByText('Monday, October 5, 2026')).toBeVisible();

  // Same graph on Progress → Overview.
  await page.goto('/#/progress');
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mon, Oct 5: 17% done, 1.5 h study' })).toBeVisible();
});

test('activity graph: arrow keys move between days and Enter opens one', async ({ page }) => {
  await open(page, '/profile', new Date('2026-10-06T23:30:00+05:30'));
  const tue = page.getByRole('button', { name: 'Tue, Oct 6: 0% done, 0 h study' });
  await tue.focus();
  await page.keyboard.press('ArrowUp');
  const mon = page.getByRole('button', { name: 'Mon, Oct 5: 0% done, 0 h study' });
  await expect(mon).toBeFocused();
  await expect(mon).toHaveAttribute('tabindex', '0');
  await expect(tue).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowLeft'); // previous week is before the plan → stays
  await expect(mon).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Monday, October 5, 2026')).toBeVisible();
  await expect(page.getByText('Looking back')).toBeVisible();
});

test('Today: reaching 80% and 100% celebrates once per day', async ({ page }) => {
  await open(page);
  const card = page.getByRole('region', { name: 'Daily motivation' });
  await expect(card).toContainText('Level 1 · Beginner');
  await expect(card).toContainText('+0 XP today');
  await expect(card.locator('blockquote')).not.toBeEmpty();

  await tick(page, ['Wake up', 'Gym', 'Bath + breakfast', 'Get ready + travel', 'College', 'Travel + rest', 'College subject', 'Dinner', 'Java']);
  await expect(page.getByTestId('celebration')).toHaveCount(0); // 9/12 = 75%
  await tick(page, ['German']); // 10/12 = 83%
  await expect(page.getByTestId('celebration')).toContainText('🔥 Streak day secured!');
  await expect(page.getByRole('status').filter({ hasText: 'Streak day secured!' })).toBeVisible(); // toast

  await tick(page, ['Revision', 'Sleep']); // 12/12
  await expect(page.getByTestId('celebration')).toContainText('Perfect day!');
  await expect(card).toContainText('+290 XP today');
  await expect(card).toContainText('Level 2 · Beginner');

  // Once per day: not again after a reload, nor when un-ticking and ticking again.
  await page.reload();
  await expect(card).toContainText('+290 XP today');
  await expect(page.getByTestId('celebration')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mark Sleep not done' }).uncheck();
  await tick(page, ['Sleep']);
  await expect(page.getByRole('checkbox', { name: 'Mark Sleep not done' })).toBeChecked();
  await expect(page.getByTestId('celebration')).toHaveCount(0);

  // Only on today, not when looking at another day.
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByRole('region', { name: 'Daily motivation' })).toHaveCount(0);
});

test('Today: a day secured from another page is celebrated when Today opens', async ({ page }) => {
  await open(page);
  await tick(page, ['Wake up', 'Gym', 'Bath + breakfast', 'Get ready + travel', 'College', 'Travel + rest', 'College subject', 'Dinner', 'Java']);
  await expect(page.getByTestId('celebration')).toHaveCount(0); // 9/12 = 75%
  // Skip one task from the Schedule page: 9/11 = 82% while Today isn't on screen.
  await page.goto('/#/schedule');
  await page.getByRole('list', { name: /^Tasks on Mon/ }).locator('visible=true').getByRole('button', { name: /^Revision,/ }).click();
  await page.getByRole('button', { name: 'Skip today' }).click();
  await page.goto('/#/');
  await expect(page.getByTestId('celebration')).toContainText('🔥 Streak day secured!');
  // …and only once.
  await page.goto('/#/schedule');
  await page.goto('/#/');
  await expect(page.getByText('✓ Today counts for your streak (80%+)')).toBeVisible();
  await expect(page.getByTestId('celebration')).toHaveCount(0);
});

test('badges: "First tick" unlocks after one tick', async ({ page }) => {
  await open(page, '/profile');
  const first = page.getByRole('listitem').filter({ hasText: 'First tick' });
  await expect(first).toContainText('0/1');
  await expect(first).not.toContainText('Unlocked');
  await expect(page.getByText('0 of 17 unlocked')).toBeVisible();

  await page.goto('/#/');
  await tick(page, ['Wake up']);
  await page.goto('/#/profile');
  await expect(first).toContainText('Unlocked');
  await expect(page.getByText('1 of 17 unlocked')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Gym 7 days' })).toContainText('0/7');
  await expect(page.getByRole('listitem').filter({ hasText: 'Early bird' })).toContainText('1/7');
});

test('settings keeps name + theme and links to the full profile', async ({ page }) => {
  await open(page, '/settings');
  await expect(page.getByRole('heading', { name: 'Profile & theme' })).toBeVisible();
  await page.getByRole('link', { name: /Edit full profile/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profile');
});
