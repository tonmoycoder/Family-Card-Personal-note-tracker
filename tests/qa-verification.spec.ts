import { test, expect } from '@playwright/test';

// Sample 20x20 red/blue canvas data URL as a real color image
const SAMPLE_COLOR_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACYGaoCRgUYGGBlowlBQUFBG8v9/A2NTA8b/DAYGhmcgA41GDRk1ZNRAbAaOmv/ffwA2pBfRjF8RrwAAAABJRU5ErkJggg==';

test.describe('Mobile QA & Anti-Regression Suite (390x844)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock for on-device OCR so tests don't download 15MB traineddata
    await page.addInitScript(() => {
      (window as unknown as { __MOCK_NID_SCAN__: (img: string) => Promise<unknown> }).__MOCK_NID_SCAN__ =
        async () => {
          return {
            nidName: 'মোছাঃ রোকসানা খাতুন',
            nidNumber: '19902612345678901',
            confidence: 'high',
            warning: '',
            rawText: 'নাম\nমোছাঃ রোকসানা খাতুন\nNID No\n19902612345678901',
          };
        };
    });

    // Intercept GET /api/records with mock data
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            total: 2,
            records: [
              {
                Serial: 1,
                Date: '2026-11-22',
                Timestamp: '01:30:00 AM',
                NID_Name: 'মোছাঃ ফাতেমা বেগম',
                NID_Number: '19851234567890123',
                Local_Known_Name: 'ফাতেমা বেগম (করিমের মা)',
                Area_Para: 'দক্ষিণ পাড়া',
                Maps_Link: 'https://www.google.com/maps?q=23.8103,90.4125',
                Image_Drive_Link: 'https://drive.google.com/file/d/test1/view',
                Notes: 'বয়স্ক ভাতা পান না',
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  // QA CHECK 1: Zero console errors & Zero unhandled page errors
  test('QA Check 1: Zero console errors and zero page errors across all views', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check tabs
    await page.locator('nav button:has-text("তালিকা")').click();
    await expect(page.locator('text=#001')).toBeVisible();

    await page.locator('nav button:has-text("কিউ")').click();
    await expect(page.locator('text=কোনো কিউ করা এন্ট্রি নেই')).toBeVisible();

    await page.locator('nav button:has-text("সার্ভে")').click();
    await expect(page.locator('button:has-text("সেভ ও ড্রাইভে আপলোড করুন")')).toBeVisible();

    expect(errors).toEqual([]);
  });

  // QA CHECK 2: Zero Infinite Sync Loops & Network Storms
  test('QA Check 2: Zero infinite sync loops (GET /api/records <= 1, no sync flashing)', async ({ page }) => {
    let getRecordsCount = 0;
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'GET') {
        getRecordsCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, total: 1, records: [] }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Wait 5 full seconds
    await page.waitForTimeout(5000);

    // Initial records load should happen at most once (or 0 since Survey tab is active by default)
    expect(getRecordsCount).toBeLessThanOrEqual(1);

    // "সিঙ্ক চলছে..." MUST NEVER be visible when offline queue is empty!
    const syncInProgressText = page.locator('text=সিঙ্ক চলছে...');
    await expect(syncInProgressText).not.toBeVisible();
  });

  // QA CHECK 3: Zero Layout Shift (CLS = 0)
  test('QA Check 3: Form inputs remain perfectly stable without bouncing (delta = 0px)', async ({ page }) => {
    await page.goto('/');

    // Measure initial top position of NID Name input
    const initialBox = await page.locator('input#nidName').boundingBox();
    expect(initialBox).not.toBeNull();
    const initialTop = initialBox!.y;

    // Observe layout over 4 seconds while GPS and online hooks run
    await page.waitForTimeout(4000);

    const postBox = await page.locator('input#nidName').boundingBox();
    expect(postBox).not.toBeNull();
    const postTop = postBox!.y;

    // Vertical delta MUST be 0 (no layout jumps)
    const delta = Math.abs(postTop - initialTop);
    expect(delta).toBe(0);
  });

  // QA CHECK 4: Real Photo Upload & Manual Fallback Guarantee
  test('QA Check 4: Color photo preview visible (naturalWidth > 0) & manual entry sent in payload', async ({
    page,
  }) => {
    let capturedPayload: Record<string, unknown> | null = null;

    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, serial: 10 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Upload real color image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("গ্যালারি / ফাইল")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'real-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(SAMPLE_COLOR_IMAGE.split(',')[1], 'base64'),
    });

    // Check preview is rendered and has positive natural dimensions
    const imgLocator = page.locator('img[alt="এনআইডি প্রিভিউ"]');
    await expect(imgLocator).toBeVisible({ timeout: 5000 });
    const isImageValid = await imgLocator.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    });
    expect(isImageValid).toBe(true);

    // User fills manual data
    await page.locator('input#nidName').fill('মোছাঃ আমেনা খাতুন');
    await page.locator('input#nidNumber').fill('19921234567890123');
    await page.locator('input#localKnownName').fill('আমেনা বুজি');
    await page.locator('input#areaPara').fill('পশ্চিম পাড়া');
    await page.locator('textarea#notes').fill('জরুরি প্রয়োজন');

    // Submit form
    await page.locator('button:has-text("সেভ ও ড্রাইভে আপলোড করুন")').click();

    // Verify success banner/toast
    await expect(page.locator('text=সফলভাবে ডাটাবেজ ও গুগল ড্রাইভে আপলোড হয়েছে!')).toBeVisible({ timeout: 8000 });

    // Verify captured payload
    expect(capturedPayload).not.toBeNull();
    const payload = capturedPayload as unknown as Record<string, unknown>;
    expect(payload.nidName).toBe('মোছাঃ আমেনা খাতুন');
    expect(payload.nidNumber).toBe('19921234567890123');
    expect(payload.localKnownName).toBe('আমেনা বুজি');
    expect(payload.areaPara).toBe('পশ্চিম পাড়া');
    expect(payload.notes).toBe('জরুরি প্রয়োজন');
    expect(payload.imageBase64).toBeTruthy();
  });

  // QA CHECK 5: Offline Queue Persistence & Single-Shot Auto-Sync
  test('QA Check 5: Offline queue persistence in IndexedDB and single-shot auto-sync', async ({
    context,
    page,
  }) => {
    let postSyncCount = 0;
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') {
        postSyncCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, serial: 11 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Simulate offline
    await context.setOffline(true);
    await expect(page.locator('text=অফলাইন — ডেটা ডিভাইসে সুরক্ষিত থাকবে')).toBeVisible();

    // Upload image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("গ্যালারি / ফাইল")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'nid.png',
      mimeType: 'image/png',
      buffer: Buffer.from(SAMPLE_COLOR_IMAGE.split(',')[1], 'base64'),
    });

    await page.locator('input#localKnownName').fill('আব্দুর রহিম');
    await page.locator('input#nidName').fill('আব্দুর রহিম');
    await page.locator('input#nidNumber').fill('19801234567890123');
    await page.locator('input#areaPara').fill('পূর্ব পাড়া');

    // Submit offline
    await page.locator('button:has-text("অফলাইন কিউতে সেভ করুন")').click();
    await expect(page.locator('text=অফলাইনে সংরক্ষিত হয়েছে!')).toBeVisible();

    // Go to Queue tab and verify
    await page.locator('nav button:has-text("কিউ")').click();
    await expect(page.locator('text=আব্দুর রহিম')).toBeVisible();

    // Reconnect online
    await context.setOffline(false);
    await expect(page.locator('text=অনলাইন')).toBeVisible({ timeout: 5000 });

    // Trigger sync
    const syncBtn = page.locator('button:has-text("এখনই সিঙ্ক করুন")');
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
    }

    // Verify queue cleared
    await expect(page.locator('text=কোনো কিউ করা এন্ট্রি নেই')).toBeVisible({ timeout: 10000 });
    expect(postSyncCount).toBe(1);
  });

  // QA CHECK 6: Mobile Visual Geometry (390x844)
  test('QA Check 6: Fixed mobile geometry (header=56px, nav=64px, networkBar=44px)', async ({ page }) => {
    await page.goto('/');

    // Check Header height (h-14 = 56px)
    const headerBox = await page.locator('header').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeCloseTo(56, 1);

    // Check Bottom Nav height (h-16 = 64px)
    const navBox = await page.locator('nav').boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.height).toBeCloseTo(64, 1);

    // Check Network status bar height (h-11 = 44px)
    const networkBar = page.locator('div[role="status"]');
    const netBox = await networkBar.boundingBox();
    expect(netBox).not.toBeNull();
    expect(netBox!.height).toBeCloseTo(44, 1);
  });
});
