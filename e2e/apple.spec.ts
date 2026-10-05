import { expect, test, type Page } from '@playwright/test';

// iPhone 17 + Mac polish: layout per device, safe areas, keyboard shortcuts, install tips, manifest.
// Runs on every project; checks that only make sense on one kind of screen skip the others.

// Monday, October 5, 2026, 19:45 IST (the plan's first day, evening).
const EVENING = new Date('2026-10-05T19:45:00+05:30');

const isWide = (page: Page) => (page.viewportSize()?.width ?? 1280) >= 1024;
/** Today switches to two columns at Tailwind's xl breakpoint (every Mac size). */
const isTwoColumn = (page: Page) => (page.viewportSize()?.width ?? 1280) >= 1280;
const onIphone = () => test.info().project.name === 'iphone-17';

/** iPhone 17 in portrait: Dynamic Island on top, home indicator below (Chromium can emulate the insets). */
async function emulateIphoneInsets(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 62, bottom: 34, left: 0, right: 0 } });
}

async function open(page: Page, hash = '/') {
  await page.clock.install({ time: EVENING });
  if (onIphone()) await emulateIphoneInsets(page);
  await page.goto(`/#${hash}`);
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

const ROUTES = [
  '/',
  '/?date=2026-10-11',
  '/schedule',
  '/schedule?view=month',
  '/study',
  '/progress',
  '/progress?tab=weekly',
  '/progress?tab=monthly',
  '/more',
  '/profile',
  '/calendar',
  '/java',
  '/dsa',
  '/german',
  '/subjects',
  '/cgpa',
  '/projects',
  '/goals',
  '/notes',
  '/search',
  '/settings',
];

test('no page scrolls sideways at this screen size', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const viewport = page.viewportSize()!.width;
  for (const route of ROUTES) {
    await page.goto(`/#${route}`);
    await expect(h1(page)).toBeVisible();
    // Compare with the device width: mobile Chrome widens innerWidth when content overflows.
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `horizontal overflow on ${route}`).toBeLessThanOrEqual(viewport);
  }
  await page.goto('/#/no-such-page');
  await expect(page.getByText('Page not found')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
});

test('Today: overview beside the schedule on Mac-size screens, one column on phones', async ({ page }) => {
  await open(page);
  const overview = page.getByTestId('today-overview');
  const schedule = page.getByTestId('today-schedule');
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  const a = (await overview.boundingBox())!;
  const b = (await schedule.boundingBox())!;
  if (isTwoColumn(page)) {
    expect(b.x, 'schedule sits to the right of the overview').toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(b.y - a.y), 'both columns start at the top').toBeLessThan(8);
    // The day's stats fit their column (2 tiles across), nothing spills out.
    expect(await overview.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The schedule header (title + Add task) stays pinned under the top bar while the timeline scrolls.
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    const header = (await page.getByRole('heading', { name: 'Schedule' }).boundingBox())!;
    const topbar = (await page.getByRole('banner').boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(topbar.y + topbar.height - 1);
    expect(header.y).toBeLessThan(topbar.y + topbar.height + 40);
    await expect(page.getByRole('button', { name: 'Add task' })).toBeInViewport();
  } else {
    expect(b.y, 'schedule comes after the overview').toBeGreaterThanOrEqual(a.y + a.height);
    expect(Math.abs(b.x - a.x), 'same left edge').toBeLessThan(2);
    expect(Math.abs(b.width - a.width), 'same width').toBeLessThan(2);
  }
});

test('narrow Mac window: Today falls back to one column next to the sidebar', async ({ page }) => {
  test.skip(test.info().project.name !== 'mac', 'Mac only');
  await page.setViewportSize({ width: 1100, height: 900 });
  await open(page);
  await expect(page.locator('aside')).toBeVisible();
  const a = (await page.getByTestId('today-overview').boundingBox())!;
  const b = (await page.getByTestId('today-schedule').boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  expect(Math.abs(b.x - a.x)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
});

test('iPhone 17: top bar clears the Dynamic Island, tab bar sits above the home indicator', async ({ page }) => {
  test.skip(!onIphone(), 'iPhone 17 only');
  await open(page);
  const viewport = page.viewportSize()!;
  // Top bar content starts below the 62pt status bar / Dynamic Island area.
  const search = (await page.getByRole('banner').getByRole('button', { name: 'Search' }).boundingBox())!;
  expect(search.y).toBeGreaterThanOrEqual(62);
  // Tab bar: 5 labelled tabs, at least 44pt tall, all above the 34pt home indicator.
  const tabs = page.getByRole('navigation', { name: 'Main' }).last().getByRole('link');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(['Today', 'Schedule', 'Study', 'Progress', 'More']);
  for (const box of await Promise.all((await tabs.all()).map((t) => t.boundingBox()))) {
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height - 34);
  }
  await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
  // Text fields are 16px on touch screens, so iOS does not zoom in on focus.
  const size = await page.getByLabel('Choose date').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  // The last task can scroll fully clear of the tab bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const nav = (await page.getByRole('navigation', { name: 'Main' }).last().boundingBox())!;
  const lastTask = (await page.locator('ol > li').last().boundingBox())!;
  expect(lastTask.y + lastTask.height).toBeLessThanOrEqual(nav.y);
});

test('installed on the Home Screen: light theme gets a brand strip behind the white status bar text', async ({ page }) => {
  test.skip(!onIphone(), 'iPhone 17 only');
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
  await open(page);
  const strip = page.locator('.kp-statusbar');
  await expect(page.locator('html')).toHaveClass(/kp-standalone/);
  await expect(strip).toBeVisible();
  expect((await strip.boundingBox())!.height).toBe(62);
  expect(await strip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(79, 70, 229)');
  // Dark theme: the dark top bar already shows the white text, so no strip.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(strip).toBeHidden();
});

test('tapping the tab you are on scrolls back to the top', async ({ page }) => {
  test.skip(isWide(page), 'phone tab bar only');
  await open(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Today', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(h1(page)).toHaveText('Good evening, Kiran');
});

test('keyboard: 1–5 switch pages, / and Cmd/Ctrl+K open search, typing is left alone', async ({ page }) => {
  await open(page);
  await expect(h1(page)).toHaveText('Good evening, Kiran');
  for (const [key, heading] of [
    ['2', 'Schedule'],
    ['3', 'Study'],
    ['4', 'Progress'],
    ['5', 'More'],
    ['1', 'Good evening, Kiran'],
  ]) {
    await page.keyboard.press(key);
    await expect(h1(page)).toHaveText(heading);
  }

  await page.keyboard.press('/');
  await expect(h1(page)).toHaveText('Search');
  const field = page.getByLabel('Search everything');
  await expect(field).toBeFocused();
  // Keys typed into the field stay in the field.
  await page.keyboard.type('2n[');
  await expect(field).toHaveValue('2n[');
  await expect(h1(page)).toHaveText('Search');
  await field.blur();

  await page.keyboard.press('1');
  await expect(h1(page)).toHaveText('Good evening, Kiran');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(h1(page)).toHaveText('Search');
  await expect(page.getByLabel('Search everything')).toBeFocused();
});

test('keyboard: [ and ] flip days on Today, T jumps back, N opens Add task', async ({ page }) => {
  await open(page);
  await expect(page.getByText('Monday, October 5, 2026')).toBeVisible();
  await page.keyboard.press(']');
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await expect(page).toHaveURL(/date=2026-10-06/);
  await page.keyboard.press('[');
  await page.keyboard.press('[');
  await expect(page.getByText('Sunday, October 4, 2026')).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByText('Monday, October 5, 2026')).toBeVisible();
  await expect(h1(page)).toHaveText('Good evening, Kiran');

  // N opens Add task for the day being shown.
  await page.keyboard.press(']');
  await expect(page.getByText('Tuesday, October 6, 2026')).toBeVisible();
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'Add task' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Date')).toHaveValue('2026-10-06');
  // While a dialog is open the shortcuts are off.
  await dialog.getByRole('button', { name: 'Close' }).focus();
  await page.keyboard.press('2');
  await expect(h1(page)).not.toHaveText('Schedule');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // From another page, N goes to Today and opens Add task there (once — not again after a reload).
  await page.keyboard.press('3');
  await expect(h1(page)).toHaveText('Study');
  await page.keyboard.press('n');
  await expect(h1(page)).toHaveText('Good evening, Kiran');
  await expect(page.getByRole('dialog', { name: 'Add task' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(h1(page)).toHaveText('Good evening, Kiran');
  await expect(page.getByRole('dialog', { name: 'Add task' })).toHaveCount(0);
});

test('keyboard: ? shows the shortcuts list', async ({ page }) => {
  await open(page);
  await expect(h1(page)).toBeVisible();
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await expect(help.getByText('Jump to today')).toBeVisible();
  await expect(help.getByText('New task')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});

test('Mac sidebar: one lit item, shortcut hint opens the list, search field shows the key', async ({ page }) => {
  test.skip(!isWide(page), 'desktop sidebar only');
  await open(page, '/progress?tab=weekly');
  const sidebar = page.locator('aside');
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(sidebar.getByRole('link', { name: 'Weekly review' })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(sidebar.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');

  const hint = sidebar.getByRole('button', { name: /Press \? for shortcuts/ });
  await expect(hint).toBeVisible();
  await hint.click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');

  const search = page.getByRole('banner').getByRole('button', { name: 'Search' });
  await expect(search).toContainText(test.info().project.name === 'mac' ? '⌘K' : 'Ctrl K');
  await search.click();
  await expect(h1(page)).toHaveText('Search');
});

test('install tips on More: right steps for this device, hide for good', async ({ page }) => {
  await open(page, '/more');
  const card = page.getByRole('region', { name: 'Install on iPhone & Mac' });
  await expect(card).toBeVisible();
  const project = test.info().project.name;
  const steps = card.getByRole('list', { name: /Install steps for/ });
  if (project === 'iphone-17') await expect(steps).toContainText('Add to Home Screen');
  else await expect(steps).toContainText('Install');
  // The other devices' steps are one tap away.
  await card.getByText('Steps for your other devices').click();
  await expect(card.getByText('In the menu bar choose File → Add to Dock')).toBeVisible();

  await card.getByRole('button', { name: 'Hide install tips' }).click();
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('kiran-planner:ui:install-hint'))).toBe('dismissed');
  await page.reload();
  await expect(h1(page)).toHaveText('More');
  await expect(page.getByRole('region', { name: 'Install on iPhone & Mac' })).toHaveCount(0);
  // The More list itself is grouped.
  await expect(page.getByRole('heading', { name: 'Learning tracks' })).toBeVisible();
});

test('Chrome/Edge: "Install now" uses the browser prompt, and the tips go once installed', async ({ page }) => {
  await open(page, '/more');
  const card = page.getByRole('region', { name: 'Install on iPhone & Mac' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Install now' })).toHaveCount(0);
  // Chromium fires beforeinstallprompt when the app can be installed; stand in for it here.
  await page.evaluate(() => {
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { prompted: boolean }).prompted = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(e);
  });
  await card.getByRole('button', { name: 'Install now' }).click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(card.getByRole('button', { name: 'Install now' })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(card).toBeHidden();
});

test('install tips stay away inside the installed app', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
  await open(page, '/more');
  await expect(h1(page)).toHaveText('More');
  await expect(page.getByRole('region', { name: 'Install on iPhone & Mac' })).toHaveCount(0);
});

test('Home Screen / Dock metadata: manifest shortcuts and Apple meta tags', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return href ? await (await fetch(href)).json() : null;
  });
  expect(manifest).toMatchObject({ id: '/', display: 'standalone', orientation: 'any', short_name: 'Planner' });
  expect(manifest.display_override).toContain('standalone');
  expect(manifest.categories).toContain('productivity');
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  const shortcuts = manifest.shortcuts as { name: string; url: string; icons: unknown[] }[];
  expect(shortcuts.map((s) => [s.name, s.url])).toEqual([
    ['Today', '/#/'],
    ['Study timer', '/#/study'],
    ['Calendar', '/#/calendar'],
  ]);
  for (const s of shortcuts) expect(s.icons.length).toBeGreaterThan(0);

  const meta = (name: string) => page.locator(`meta[name="${name}"]`);
  await expect(meta('apple-mobile-web-app-capable')).toHaveAttribute('content', 'yes');
  await expect(meta('mobile-web-app-capable')).toHaveAttribute('content', 'yes');
  await expect(meta('apple-mobile-web-app-status-bar-style')).toHaveAttribute('content', 'black-translucent');
  await expect(meta('apple-mobile-web-app-title')).toHaveAttribute('content', 'Planner');
  await expect(meta('format-detection')).toHaveAttribute('content', 'telephone=no');
  await expect(meta('theme-color')).toHaveCount(2);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test('browser colour follows the app theme, even against the system setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '/settings');
  const colours = () => page.locator('meta[name="theme-color"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content')));
  await expect.poll(colours).toEqual(['#4f46e5', '#4f46e5']);
  await page.locator('label', { hasText: /^Dark$/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(colours).toEqual(['#020617', '#020617']);
  // A fixed choice is applied before first paint on the next launch too.
  await page.reload();
  await expect.poll(colours).toEqual(['#020617', '#020617']);
  await page.locator('label', { hasText: /^Light$/ }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect.poll(colours).toEqual(['#4f46e5', '#4f46e5']);
});
