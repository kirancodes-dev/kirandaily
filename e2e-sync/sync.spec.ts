import { expect, test, type Browser, type Page } from '@playwright/test';

// Uses the real clock (a faked one would make the emulator's sign-in tokens look
// expired or not yet valid). The tasks are ticked on the plan's first day, which is
// in the past, so the time-lock always allows them; that day has wake up, gym,
// breakfast and sleep like every other day.
const DAY = '/#/?date=2026-10-05';

async function newDevice(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/#/settings');
  return { context, page };
}

/**
 * Signs in to the Auth emulator as a Google user. (The real "Sign in with Google"
 * popup needs apis.google.com, which this test sandbox cannot reach.)
 */
async function signIn(page: Page, email: string): Promise<string> {
  await page.goto('/#/settings');
  await page.waitForFunction(() => '__kpEmulatorSignIn' in window, null, { timeout: 20_000 });
  await page.evaluate((e) => (window as unknown as { __kpEmulatorSignIn: (e: string) => Promise<unknown> }).__kpEmulatorSignIn(e), email);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(email)).toBeVisible();
  return email;
}

async function tick(page: Page, title: string) {
  await page.goto(DAY);
  // Keyboard, so a reminder toast over the list can't take the tap.
  const box = page.getByRole('checkbox', { name: `Mark ${title} done` });
  await box.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: `Mark ${title} not done` })).toBeChecked();
}

async function expectDone(page: Page, titles: string[]) {
  await page.goto(DAY);
  for (const t of titles) await expect(page.getByRole('checkbox', { name: `Mark ${t} not done` })).toBeChecked({ timeout: 20_000 });
}

async function expectSynced(page: Page) {
  await expect(page.getByRole('link', { name: 'Synced to cloud' })).toBeVisible({ timeout: 20_000 });
}

test('two devices stay in sync, including offline edits', async ({ browser }) => {
  // Laptop: has data, signs in first → uploads.
  const laptop = await newDevice(browser);
  await tick(laptop.page, 'Gym');
  const email = await signIn(laptop.page, 'kiran.sync@example.com');
  await expectSynced(laptop.page);

  // Phone: fresh install, same Google account → downloads.
  const phone = await newDevice(browser);
  await signIn(phone.page, email);
  await expectDone(phone.page, ['Gym']);

  // Live: phone change appears on the laptop without reloading.
  await tick(phone.page, 'Wake up');
  await expectSynced(phone.page);
  await laptop.page.goto(DAY);
  await expect(laptop.page.getByRole('checkbox', { name: 'Mark Wake up not done' })).toBeChecked({ timeout: 20_000 });

  // v1.1 data (profile, calendar, reminder settings) syncs too, through its own 'ext' document.
  await phone.page.goto('/#/settings');
  await phone.page.getByLabel('Remind me').selectOption('15');
  await expectSynced(phone.page);
  await laptop.page.goto('/#/settings');
  await expect(laptop.page.getByLabel('Remind me')).toHaveValue('15', { timeout: 20_000 });

  // Offline on the laptop while the phone keeps working → both edits survive.
  await laptop.context.setOffline(true);
  await tick(laptop.page, 'Bath + breakfast');
  await expect(laptop.page.getByRole('link', { name: 'Offline — will sync later' })).toBeVisible({ timeout: 20_000 });
  await tick(phone.page, 'Sleep');
  await expectSynced(phone.page);
  await laptop.context.setOffline(false);
  const all = ['Gym', 'Wake up', 'Bath + breakfast', 'Sleep'];
  await expectDone(laptop.page, all);
  await expectSynced(laptop.page);
  await expectDone(phone.page, all);

  // Reload keeps the session and the data.
  await phone.page.reload();
  await expectDone(phone.page, all);
  await phone.page.goto('/#/settings');
  await expect(phone.page.getByText(email)).toBeVisible();

  await laptop.context.close();
  await phone.context.close();
});

test('a device with its own data is asked before merging', async ({ browser }) => {
  const laptop = await newDevice(browser);
  await tick(laptop.page, 'Gym');
  const email = await signIn(laptop.page, 'kiran.merge@example.com');
  await expectSynced(laptop.page);

  const phone = await newDevice(browser);
  await tick(phone.page, 'Sleep');
  await phone.page.goto('/#/settings');
  await phone.page.evaluate((e) => (window as unknown as { __kpEmulatorSignIn: (e: string) => Promise<unknown> }).__kpEmulatorSignIn(e), email).catch(() => undefined);
  await expect(phone.page.getByRole('heading', { name: 'Your data is in two places' })).toBeVisible({ timeout: 20_000 });
  await phone.page.getByRole('button', { name: /Merge both/ }).click();
  await expectDone(phone.page, ['Gym', 'Sleep']);
  await expectDone(laptop.page, ['Gym', 'Sleep']);

  await laptop.context.close();
  await phone.context.close();
});
