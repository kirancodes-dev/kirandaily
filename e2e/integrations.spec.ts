import { expect, test, type Page } from '@playwright/test';

// GitHub + LeetCode cards. The sandbox has no internet, so every API is mocked with page.route.
// Monday, October 5, 2026, 7:45 PM in India.
const NOW = new Date('2026-10-05T19:45:00+05:30');
const HOUR = 60 * 60 * 1000;

// The service worker would sit between the page and page.route.
test.use({ serviceWorkers: 'block' });

const GH_USER = 'https://api.github.com/users/kiran-dev';
const GH_REPOS = `${GH_USER}/repos?sort=pushed&per_page=5`;
const GH_EVENTS = `${GH_USER}/events/public?per_page=100`;
const GH_GRAPH = 'https://github-contributions-api.jogruber.de/v4/kiran-dev?y=last';
const ALFA_SOLVED = 'https://alfa-leetcode-api.onrender.com/kiran_lc/solved';
const ALFA_CALENDAR = 'https://alfa-leetcode-api.onrender.com/kiran_lc/calendar';
const FAISAL = 'https://leetcode-api-faisalshohag.vercel.app/kiran_lc';
const HEROKU = 'https://leetcode-stats-api.herokuapp.com/kiran_lc';

type Reply = { status?: number; body?: unknown; delayMs?: number } | 'abort';

function isoDaysAgo(n: number): string {
  const d = new Date(Date.UTC(2026, 9, 5 - n));
  return d.toISOString().slice(0, 10);
}

/** One year of contributions with a pattern (busy weekdays, quiet Sundays) – 2026-10-05 has 4. */
function contributionDays() {
  return Array.from({ length: 366 }, (_, i) => {
    const n = 365 - i;
    const count = n % 7 === 6 ? 0 : (n * 3) % 5;
    return { date: isoDaysAgo(n), count: n === 0 ? 4 : count, level: 1 };
  });
}
const DAYS = contributionDays();
const TOTAL = DAYS.reduce((s, d) => s + d.count, 0);

/** 2026-10-05 and 2026-10-04 as LeetCode day buckets (UTC midnight, unix seconds). */
const OCT5 = Date.UTC(2026, 9, 5) / 1000;
const OCT4 = Date.UTC(2026, 9, 4) / 1000;

const DEFAULTS: Record<string, Reply> = {
  [GH_USER]: {
    body: {
      login: 'kiran-dev',
      name: 'Kiran Dev',
      avatar_url: 'https://avatars.githubusercontent.com/u/9?v=4',
      html_url: 'https://github.com/kiran-dev',
      public_repos: 12,
      followers: 34,
      following: 5,
    },
  },
  [GH_REPOS]: {
    body: [
      { name: 'kiran-planner', html_url: 'https://github.com/kiran-dev/kiran-planner', description: 'My daily planner PWA', language: 'TypeScript', stargazers_count: 3, pushed_at: '2026-10-05T08:00:00Z' },
      { name: 'dsa-practice', html_url: 'https://github.com/kiran-dev/dsa-practice', description: null, language: 'Java', stargazers_count: 0, pushed_at: '2026-10-02T08:00:00Z' },
    ],
  },
  [GH_GRAPH]: { body: { total: { lastYear: TOTAL }, contributions: DAYS } },
  [GH_EVENTS]: { body: [] },
  [ALFA_SOLVED]: { body: { solvedProblem: 142, easySolved: 80, mediumSolved: 50, hardSolved: 12 } },
  [ALFA_CALENDAR]: { body: { submissionCalendar: JSON.stringify({ [OCT4]: 5, [OCT5]: 3 }) } },
  [FAISAL]: { body: { totalSolved: 140, easySolved: 79, mediumSolved: 49, hardSolved: 12, ranking: 123456, submissionCalendar: { [OCT5]: 6 } } },
  [HEROKU]: { status: 503 },
};

async function mockApis(page: Page, overrides: Record<string, Reply> = {}) {
  const table: Record<string, Reply> = { ...DEFAULTS, ...overrides };
  const calls: string[] = [];
  await page.route(
    /^https:\/\/(api\.github\.com|github-contributions-api\.jogruber\.de|alfa-leetcode-api\.onrender\.com|leetcode-api-faisalshohag\.vercel\.app|leetcode-stats-api\.herokuapp\.com)\//,
    async (route) => {
      const url = route.request().url();
      calls.push(url);
      const reply = table[url] ?? { status: 404, body: { message: 'Not Found' } };
      if (reply === 'abort') return route.abort('internetdisconnected');
      if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
      await route.fulfill({
        status: reply.status ?? 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(reply.body ?? {}),
      });
    },
  );
  // A 1×1 PNG for the GitHub avatar.
  await page.route('https://avatars.githubusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    }),
  );
  return {
    calls,
    set: (patch: Record<string, Reply>) => Object.assign(table, patch),
  };
}

async function open(page: Page, hash: string) {
  await page.clock.install({ time: NOW });
  await page.goto(`/#${hash}`);
}

async function connect(page: Page, cardTestId: string, label: string, value: string) {
  const card = page.getByTestId(cardTestId);
  await card.getByLabel(label).fill(value);
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  return card;
}

test('connect GitHub and LeetCode on the profile and see real numbers and graphs', async ({ page }) => {
  await mockApis(page);
  await open(page, '/profile');
  await expect(page.getByRole('heading', { name: 'Coding profiles' })).toBeVisible();
  await expect(page.getByText('Stats come from public APIs; nothing is stored except a cache on this device.')).toBeVisible();

  // Bad input is caught before anything is requested.
  const gh = page.getByTestId('github-card');
  await gh.getByLabel('GitHub username').fill('kiran dev');
  await gh.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(gh.getByRole('alert')).toContainText('doesn’t look like a GitHub username');

  // A pasted profile link works.
  await connect(page, 'github-card', 'GitHub username', 'https://github.com/kiran-dev');
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(gh.getByRole('link', { name: /@kiran-dev/ })).toHaveAttribute('href', 'https://github.com/kiran-dev');
  await expect(gh.getByText(`${TOTAL.toLocaleString('en-US')}`, { exact: true })).toBeVisible();
  await expect(gh.getByText('contributions in the last year')).toBeVisible();
  await expect(gh.locator('dd').first()).toHaveText('12');
  const graph = gh.getByRole('group', { name: /^GitHub contributions, last 12 months:/ });
  await expect(graph).toBeVisible();
  await expect(gh.locator('rect[data-date="2026-10-05"]')).toHaveAttribute('data-count', '4');
  await expect(gh.getByText('Today · 4 contributions')).toBeVisible();
  // The newest week is in view (the graph scrolls sideways on phones).
  const atEnd = await graph.evaluate((el) => Math.abs(el.scrollLeft + el.clientWidth - el.scrollWidth) <= 2);
  expect(atEnd).toBe(true);
  // Keyboard: focus the graph and step back one day.
  await graph.focus();
  await page.keyboard.press('ArrowUp');
  await expect(gh.getByText(/^Yesterday · \d+ contributions?$/)).toBeVisible();
  // Touch: previous/next-day buttons (44 px), and a tap in the gap between squares picks the nearest one.
  await gh.getByRole('button', { name: 'Next day' }).click();
  await expect(gh.getByText('Today · 4 contributions')).toBeVisible();
  await expect(gh.getByRole('button', { name: 'Next day' })).toBeDisabled();
  await gh.getByRole('button', { name: 'Previous day' }).click();
  await expect(gh.getByText(/^Yesterday · \d+ contributions?$/)).toBeVisible();
  await gh.getByRole('button', { name: 'Previous day' }).click();
  await expect(gh.getByText(/^Sat, Oct 3 · \d+ contributions?$/)).toBeVisible();
  const oct4 = gh.locator('rect[data-date="2026-10-04"]');
  const [x, y] = await Promise.all([oct4.getAttribute('x'), oct4.getAttribute('y')]);
  await graph.locator('svg').click({ position: { x: Number(x) + 6, y: Number(y) - 1.5 } });
  await expect(gh.getByText(/^Yesterday · \d+ contributions?$/)).toBeVisible();
  const loginBox = await gh.getByRole('link', { name: /@kiran-dev/ }).boundingBox();
  expect(loginBox!.height).toBeGreaterThanOrEqual(44);
  const repo = gh.getByRole('link', { name: /kiran-planner/ });
  await expect(repo).toHaveAttribute('href', 'https://github.com/kiran-dev/kiran-planner');
  await expect(repo).toHaveAttribute('target', '_blank');
  await expect(repo).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(gh.locator('img')).toHaveAttribute('src', 'https://avatars.githubusercontent.com/u/9?v=4');
  await expect(gh.getByText('Updated just now')).toBeVisible();
  // Only the state is announced, not the age that changes every minute.
  await expect(gh.getByRole('status')).toHaveText('Updated');

  const lc = await connect(page, 'leetcode-card', 'LeetCode username', '@kiran_lc');
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');
  const bars = lc.getByRole('list', { name: 'Solved by difficulty' });
  await expect(bars).toContainText('Easy80 · 56%');
  await expect(bars).toContainText('Medium50 · 35%');
  // 56.3 / 35.2 / 8.5 – rounded so the three add up to 100%.
  await expect(bars).toContainText('Hard12 · 9%');
  await expect(lc.getByText('Today: 3 submissions')).toBeVisible();
  await expect(lc.getByRole('group', { name: /^LeetCode submissions, last 12 months: 8 submissions/ })).toBeVisible();
  await expect(lc.getByText('via alfa-leetcode-api')).toBeVisible();
  await expect(lc.getByRole('link', { name: /Open LeetCode profile/ })).toHaveAttribute('href', 'https://leetcode.com/u/kiran_lc/');

  // The usernames are saved to the profile (survive a reload) and the page never scrolls sideways.
  await page.reload();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('LeetCode on the DSA page falls back to the next provider and compares with the app log', async ({ page }) => {
  const api = await mockApis(page, { [ALFA_SOLVED]: { status: 503 }, [ALFA_CALENDAR]: { status: 503 } });
  await open(page, '/dsa');
  const card = page.getByTestId('leetcode-dsa-card');
  await expect(card.getByText('Connect LeetCode to see your real solved count')).toBeVisible();
  await connect(page, 'leetcode-dsa-card', 'LeetCode username', 'kiran_lc');
  await expect(card.getByText('solved', { exact: true })).toBeVisible();
  await expect(card.getByText('140', { exact: true })).toBeVisible();
  await expect(card.getByText('Today: 6 submissions')).toBeVisible();
  await expect(card.getByText('You logged 0 in the app')).toBeVisible();
  expect(api.calls).toContain(ALFA_SOLVED);
  expect(api.calls).toContain(FAISAL);
  expect(api.calls).not.toContain(HEROKU);

  // Logging a problem in the app updates the comparison.
  await page.getByRole('button', { name: /^One more .+ problem$/ }).first().click();
  await expect(card.getByText('You logged 1 in the app')).toBeVisible();

  // The profile shows the same (cached) data with the provider's ranking – no new requests.
  const before = api.calls.length;
  await page.goto('/#/profile');
  const lc = page.getByTestId('leetcode-card');
  await expect(lc.getByText('Rank #123,456')).toBeVisible();
  await expect(lc.getByText('via leetcode-api-faisalshohag')).toBeVisible();
  expect(api.calls.length).toBe(before);
});

test('slow first load shows a loading state, not an error', async ({ page }) => {
  await mockApis(page, { [ALFA_SOLVED]: { ...(DEFAULTS[ALFA_SOLVED] as object), delayMs: 4500 } });
  await open(page, '/profile');
  const lc = await connect(page, 'leetcode-card', 'LeetCode username', 'kiran_lc');
  await expect(lc.getByText('Loading your LeetCode stats…')).toBeVisible();
  await expect(lc.getByText(/Waking up the free LeetCode stats service/)).toBeVisible({ timeout: 6000 });
  await expect(lc.getByRole('alert')).toHaveCount(0);
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142', { timeout: 10_000 });
});

test('errors show a retry button that recovers', async ({ page }) => {
  const api = await mockApis(page, { [GH_USER]: { status: 500 }, [GH_REPOS]: { status: 500 }, [GH_GRAPH]: { status: 500 }, [GH_EVENTS]: { status: 500 } });
  await open(page, '/profile');
  const gh = await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await expect(gh.getByRole('alert')).toContainText('GitHub answered with an error (500). Try again later.');
  api.set({ [GH_USER]: DEFAULTS[GH_USER], [GH_REPOS]: DEFAULTS[GH_REPOS], [GH_GRAPH]: DEFAULTS[GH_GRAPH] });
  await gh.getByRole('button', { name: 'Retry' }).click();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(gh.getByRole('alert')).toHaveCount(0);

  // A rate limit is explained in plain words.
  api.set({ [GH_USER]: { status: 403 } });
  await gh.getByRole('button', { name: 'Refresh GitHub stats' }).click();
  await expect(gh.getByText(/Couldn’t refresh: GitHub is getting too many requests right now/)).toBeVisible();
  await expect(gh.getByText('Kiran Dev')).toBeVisible(); // the old data stays
});

test('GitHub graph falls back to recent push events', async ({ page }) => {
  await mockApis(page, {
    [GH_GRAPH]: { status: 502 },
    [GH_EVENTS]: {
      body: [
        { type: 'PushEvent', created_at: '2026-10-05T05:00:00Z', payload: { size: 2 } },
        { type: 'PushEvent', created_at: '2026-10-01T05:00:00Z', payload: { size: 1 } },
        { type: 'WatchEvent', created_at: '2026-10-04T05:00:00Z', payload: {} },
      ],
    },
  });
  // The avatar fails to load too: a GitHub icon stands in, never a broken image.
  await page.route('https://avatars.githubusercontent.com/**', (route) => route.abort());
  await open(page, '/profile');
  const gh = await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await expect(gh.getByText('commits · recent activity (last 90 days)')).toBeVisible();
  await expect(gh.locator('img')).toHaveCount(0);
  await expect(gh.getByRole('group', { name: /^GitHub commits, last 90 days: 3 commits/ })).toBeVisible();
  await expect(gh.getByText('Today · 2 commits')).toBeVisible();
});

test('cached stats show after a reload while the network is failing', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/profile');
  await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await connect(page, 'leetcode-card', 'LeetCode username', 'kiran_lc');
  const gh = page.getByTestId('github-card');
  const lc = page.getByTestId('leetcode-card');
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');

  // Within 6 hours the cache is used as-is: no requests at all.
  const before = api.calls.length;
  await page.clock.fastForward(2 * HOUR);
  await page.reload();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(gh.getByText('Updated 2 h ago')).toBeVisible();
  expect(api.calls.length).toBe(before);

  // Later, with the network down: the refresh fails but the cached data stays.
  for (const url of Object.keys(DEFAULTS)) api.set({ [url]: 'abort' });
  await page.clock.fastForward(5 * HOUR);
  await page.reload();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(gh.getByText(`${TOTAL.toLocaleString('en-US')}`, { exact: true })).toBeVisible();
  await expect(gh.getByText(/Couldn’t refresh: Couldn’t reach GitHub\. Check your internet connection\. Showing data from 7 h ago\./)).toBeVisible();
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');
  await expect(lc.getByText(/Couldn’t refresh: .*Showing data from 7 h ago\./)).toBeVisible();
  expect(api.calls.length).toBeGreaterThan(before);
});

test('change and disconnect a username, with undo', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/profile');
  const gh = await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await gh.getByRole('button', { name: 'Change GitHub username' }).click();
  await expect(gh.getByLabel('GitHub username')).toHaveValue('kiran-dev');
  await gh.getByRole('button', { name: 'Disconnect GitHub' }).click();
  await expect(gh.getByText('Connect your GitHub to see your contribution graph')).toBeVisible();
  // Nothing of the disconnected account stays on the device…
  const cacheKeys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kiran-planner:cache:github:')));
  expect(await cacheKeys()).toEqual([]);
  // …and Undo brings it back at once, without asking GitHub again.
  const before = api.calls.length;
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(gh.getByText('Updated just now')).toBeVisible();
  expect(await cacheKeys()).toEqual(['kiran-planner:cache:github:kiran-dev']);
  expect(api.calls.length).toBe(before);
});

test('Refresh, then switching apps and back, still shows the new numbers', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/dsa');
  const card = await connect(page, 'leetcode-dsa-card', 'LeetCode username', 'kiran_lc');
  await expect(card.getByText('Today: 3 submissions')).toBeVisible();

  // Solved two more; the free API is slow. Tap Refresh, switch to LeetCode, come back.
  api.set({
    [ALFA_SOLVED]: { body: { solvedProblem: 144, easySolved: 81, mediumSolved: 51, hardSolved: 12 }, delayMs: 1500 },
    [ALFA_CALENDAR]: { body: { submissionCalendar: JSON.stringify({ [OCT4]: 5, [OCT5]: 5 }) }, delayMs: 1500 },
  });
  await card.getByRole('button', { name: 'Refresh LeetCode stats' }).click();
  await expect(card.getByRole('button', { name: 'Refreshing LeetCode stats' })).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByText('Today: 5 submissions')).toBeVisible();
  await expect(card.getByText('144', { exact: true })).toBeVisible();
  await expect(card.getByText('Updated just now')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Refresh LeetCode stats' })).toBeVisible();
});

test('a page left open refreshes by itself after 6 hours', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/profile');
  const gh = await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await expect(gh.locator('dd').nth(1)).toHaveText('34');
  api.set({ [GH_USER]: { body: { ...(DEFAULTS[GH_USER] as { body: object }).body, followers: 35 } } });
  await page.clock.fastForward(5 * HOUR);
  await expect(gh.getByText('Updated 5 h ago')).toBeVisible();
  await expect(gh.locator('dd').nth(1)).toHaveText('34');
  await page.clock.fastForward(HOUR + 5000);
  await expect(gh.locator('dd').nth(1)).toHaveText('35');
  await expect(gh.getByText('Updated just now')).toBeVisible();
});

test('when only the graph and repos fail, the old ones stay (marked) and are retried soon', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/profile');
  const gh = await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await expect(gh.locator('rect[data-date="2026-10-05"]')).toHaveAttribute('data-count', '4');

  // 7 hours later (spent on another page) the graph service, the events and the repo list are down; the profile works.
  await page.goto('/#/notes');
  api.set({ [GH_GRAPH]: { status: 500 }, [GH_EVENTS]: { status: 500 }, [GH_REPOS]: { status: 500 } });
  api.set({ [GH_USER]: { body: { ...(DEFAULTS[GH_USER] as { body: object }).body, followers: 99 } } });
  await page.clock.fastForward(7 * HOUR);
  await page.goto('/#/profile');
  await expect(gh.locator('dd').nth(1)).toHaveText('99');
  await expect(gh.getByText('Updated just now')).toBeVisible();
  await expect(gh.getByText('Couldn’t refresh the graph – showing it from 7 h ago.')).toBeVisible();
  await expect(gh.getByText('Couldn’t refresh the repositories – showing them from 7 h ago.')).toBeVisible();
  await expect(gh.getByText(`${TOTAL.toLocaleString('en-US')}`, { exact: true })).toBeVisible();
  await expect(gh.locator('rect[data-date="2026-10-05"]')).toHaveAttribute('data-count', '4');
  // It's now Oct 6 (2:45 AM): the old copy knows nothing about today.
  await expect(gh.getByText('Today · no data')).toBeVisible();
  await expect(gh.getByRole('link', { name: /kiran-planner/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kiran-planner:cache:github:kiran-dev')!).data);
  expect(saved.calendar.source).toBe('contributions');
  expect(saved.repos).toHaveLength(2);

  // Within 30 minutes nothing is asked again; after that it retries and the notes go away.
  const before = api.calls.length;
  await page.reload();
  await expect(gh.getByText('Couldn’t refresh the graph – showing it from 7 h ago.')).toBeVisible();
  expect(api.calls.length).toBe(before);
  api.set({ [GH_GRAPH]: DEFAULTS[GH_GRAPH], [GH_REPOS]: DEFAULTS[GH_REPOS] });
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(gh.getByText(/Couldn’t refresh the graph/)).toHaveCount(0);
  await expect(gh.getByText(/Couldn’t refresh the repositories/)).toHaveCount(0);
  await expect(gh.getByText('Today · 0 contributions')).toBeVisible();
  expect(api.calls.length).toBeGreaterThan(before);
});

test('offline: cached stats with their age, and nothing is requested', async ({ page }) => {
  const api = await mockApis(page);
  await open(page, '/profile');
  await connect(page, 'github-card', 'GitHub username', 'kiran-dev');
  await connect(page, 'leetcode-card', 'LeetCode username', 'kiran_lc');
  const gh = page.getByTestId('github-card');
  const lc = page.getByTestId('leetcode-card');
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');

  // Seven hours later on another page (no stats card there to refresh), then offline.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false }));
  await page.goto('/#/notes');
  await page.clock.fastForward(7 * HOUR);
  await page.reload();
  await page.goto('/#/profile');
  const before = api.calls.length;
  await expect(gh.getByText('Offline · Updated 7 h ago')).toBeVisible();
  await expect(lc.getByText('Offline · Updated 7 h ago')).toBeVisible();
  await expect(gh.getByText('Kiran Dev')).toBeVisible();
  await expect(lc.getByTestId('leetcode-total')).toHaveText('142');
  await gh.getByRole('button', { name: 'Refresh GitHub stats' }).click();
  await expect(gh.getByText('Offline · Updated 7 h ago')).toBeVisible();
  expect(api.calls.length).toBe(before);
});
