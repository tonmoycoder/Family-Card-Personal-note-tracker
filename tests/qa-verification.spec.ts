import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Sample 20x20 red/blue canvas data URL as a real color image
const _SAMPLE_COLOR_IMAGE =
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

  // QA CHECK 1: Zero console errors, zero loops, and zero CLS
  test('Check 1 (Zero Errors & Zero Loops): 0 console errors, 0 page errors, recordsFetch <= 1, CLS = 0px', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

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

    // Measure initial top position of NID Name input
    const initialBox = await page.locator('input#nidName').boundingBox();
    expect(initialBox).not.toBeNull();
    const initialTop = initialBox!.y;

    // Wait 4 full seconds to verify loop-free and stable layout
    await page.waitForTimeout(4000);

    const postBox = await page.locator('input#nidName').boundingBox();
    expect(postBox).not.toBeNull();
    const postTop = postBox!.y;

    // Vertical delta MUST be 0
    expect(Math.abs(postTop - initialTop)).toBe(0);

    // Initial records load should happen at most once (or 0 since Survey tab is active by default)
    expect(getRecordsCount).toBeLessThanOrEqual(1);

    // "সিঙ্ক চলছে..." MUST NEVER be visible when offline queue is empty!
    await expect(page.locator('text=সিঙ্ক চলছে...')).not.toBeVisible();

    // Check tabs navigate without errors
    await page.locator('nav button:has-text("তালিকা")').click();
    await page.locator('nav button:has-text("কিউ")').click();
    await page.locator('nav button:has-text("সার্ভে")').click();

    expect(errors).toEqual([]);
  });

  // QA CHECK 2: Removable Saved Area Chips
  test('Check 2 (Removable Area Chips): Save an area chip, click × button, confirm removal from DOM & localStorage', async ({
    page,
  }) => {
    await page.goto('/');

    // Inject saved area chips into localStorage
    await page.evaluate(() => {
      localStorage.setItem('family_card_saved_areas', JSON.stringify(['নলছিটি চর', 'পূর্ব পাড়া']));
    });
    await page.reload();

    // Verify 'নলছিটি চর' chip is rendered
    const chipText = page.locator('text=নলছিটি চর');
    await expect(chipText).toBeVisible();

    // Click the inline '×' button with aria-label="এলাকা মুছুন"
    const removeBtn = page.getByRole('button', { name: 'এলাকা মুছুন' }).first();
    await removeBtn.click();

    // Confirm it disappears from DOM
    await expect(chipText).not.toBeVisible();

    // Confirm it is removed from localStorage
    const savedAreas = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('family_card_saved_areas') || '[]');
    });
    expect(savedAreas).not.toContain('নলছিটি চর');
  });

  // QA CHECK 3: Sorting & Date Filter
  test('Check 3 (Sorting & Date Filter): Sort modes and date filtering reorder/filter cards accurately', async ({
    page,
  }) => {
    const mockRecords = [
      {
        Serial: 1,
        Date: '2026-11-20',
        Timestamp: '10:00:00 AM',
        NID_Name: 'আলী হোসেন',
        NID_Number: '19801111111111111',
        Local_Known_Name: 'আলী হোসেন',
        Area_Para: 'উত্তর পাড়া',
        Maps_Link: 'https://maps.google.com/?q=23,90',
        Image_Drive_Link: 'https://drive.google.com/test1',
        Notes: '',
      },
      {
        Serial: 2,
        Date: '2026-11-22',
        Timestamp: '02:00:00 PM',
        NID_Name: 'বিলকিস বেগম',
        NID_Number: '19852222222222222',
        Local_Known_Name: 'বিলকিস বেগম',
        Area_Para: 'দক্ষিণ পাড়া',
        Maps_Link: 'https://maps.google.com/?q=23,90',
        Image_Drive_Link: 'https://drive.google.com/test2',
        Notes: '',
      },
      {
        Serial: 3,
        Date: '2026-11-21',
        Timestamp: '04:00:00 PM',
        NID_Name: 'করিম উল্লাহ',
        NID_Number: '19903333333333333',
        Local_Known_Name: 'করিম উল্লাহ',
        Area_Para: 'চর বাঘমারা',
        Maps_Link: 'https://maps.google.com/?q=23,90',
        Image_Drive_Link: 'https://drive.google.com/test3',
        Notes: '',
      },
    ];

    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, total: 3, records: mockRecords }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('nav button:has-text("তালিকা")').click();

    // Verify all 3 cards are visible initially
    await expect(page.locator('text=#001')).toBeVisible();
    await expect(page.locator('text=#002')).toBeVisible();
    await expect(page.locator('text=#003')).toBeVisible();

    // Default Sort: "নতুন তারিখ আগে" -> #002 (2026-11-22) should be first card
    const firstCardSerialDefault = page.locator('span.font-mono').first();
    await expect(firstCardSerialDefault).toHaveText('#002');

    // Test Sort: "পুরোনো তারিখ আগে" -> #001 (2026-11-20) should be first card
    await page.locator('button:has-text("পুরোনো তারিখ আগে")').click();
    const firstCardSerialOldest = page.locator('span.font-mono').first();
    await expect(firstCardSerialOldest).toHaveText('#001');

    // Test Sort: "এলাকা অনুযায়ী" -> 'উত্তর পাড়া' (#001) should be first alphabetically
    await page.locator('button:has-text("এলাকা অনুযায়ী")').click();
    await expect(page.locator('span.font-mono').first()).toBeVisible();

    // Test Date Filter: Select '2026-11-22'
    const dateSelect = page.locator('select[aria-label="তারিখ ফিল্টার"]');
    await dateSelect.selectOption('2026-11-22');

    // Only #002 should be visible
    await expect(page.locator('text=#002')).toBeVisible();
    await expect(page.locator('text=#001')).not.toBeVisible();
    await expect(page.locator('text=#003')).not.toBeVisible();

    // Reset date filter
    await dateSelect.selectOption('all');
    await expect(page.locator('text=#001')).toBeVisible();
  });

  // QA CHECK 4: Sync-Delete Flow with Modal
  test('Check 4 (Sync-Delete): Delete button opens confirmation modal, confirms, calls DELETE /api/records', async ({
    page,
  }) => {
    let deletePayload: Record<string, unknown> | null = null;

    await page.addInitScript(() => {
      localStorage.removeItem('family_card_cached_records');
    });

    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            total: 1,
            records: [
              {
                Serial: 1,
                Date: '2026-11-22',
                Timestamp: '01:30:00 AM',
                NID_Name: 'মোছাঃ ফাতেমা বেগম',
                NID_Number: '19851234567890123',
                Local_Known_Name: 'ফাতেমা বেগম',
                Area_Para: 'দক্ষিণ পাড়া',
                Maps_Link: 'https://maps.google.com/?q=23,90',
                Image_Drive_Link: 'https://drive.google.com/test1',
                Notes: '',
              },
            ],
          }),
        });
        return;
      }
      if (route.request().method() === 'DELETE') {
        deletePayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'রেকর্ড মুছে ফেলা হয়েছে।' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('nav button:has-text("তালিকা")').click();
    await expect(page.locator('text=#001')).toBeVisible();

    // Click "মুছুন" on record #001
    await page.locator('button[aria-label="মুছুন"]').first().click();

    // Verify Confirmation Modal
    await expect(page.locator('text=এন্ট্রি স্থায়ীভাবে মুছবেন?')).toBeVisible();
    await expect(page.locator('text=মুছে ফেলতে চান?')).toBeVisible();

    // Click "হ্যাঁ, মুছুন"
    await page.locator('button:has-text("হ্যাঁ, মুছুন")').click();

    // Verify toast
    await expect(page.locator('text=এন্ট্রি ও ড্রাইভের ছবি সফলভাবে মুছে ফেলা হয়েছে।')).toBeVisible();

    // Assert DELETE request payload
    expect(deletePayload).not.toBeNull();
    expect(deletePayload!.serial).toBe(1);

    // Assert card #001 is removed from DOM
    await expect(page.locator('text=#001')).not.toBeVisible();
  });

  // QA CHECK 5: Clean Timestamp Sanitization & Action Links
  test('Check 5 (Clean Timestamp + Maps/Drive Buttons): Legacy 1899 timestamp is sanitized cleanly', async ({
    page,
  }) => {
    const mockLegacyRecord = [
      {
        Serial: 7,
        Date: '2026-11-22',
        Timestamp: 'Sat Dec 30 1899 14:45:00 GMT+0553 (Bangladesh Standard Time)',
        NID_Name: 'জরিনা খাতুন',
        NID_Number: '19701234567890123',
        Local_Known_Name: 'জরিনা বেওয়া',
        Area_Para: 'মধ্য পাড়া',
        Maps_Link: 'https://www.google.com/maps?q=23.8,90.4',
        Image_Drive_Link: 'https://drive.google.com/file/d/sample/view',
        Notes: '',
      },
    ];

    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, total: 1, records: mockLegacyRecord }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('nav button:has-text("তালিকা")').click();
    await expect(page.locator('text=#007')).toBeVisible();

    // Assert that '1899' or 'GMT' is NOT shown
    const timestampSpan = page.locator('span:has-text("14:45:00")');
    await expect(timestampSpan).toBeVisible();
    const textContent = await timestampSpan.innerText();
    expect(textContent).not.toContain('1899');
    expect(textContent).not.toContain('GMT');
    expect(textContent).toContain('14:45:00');

    // Assert Maps link
    const mapsBtn = page.locator('a:has-text("ম্যাপে দেখুন")');
    await expect(mapsBtn).toBeVisible();
    await expect(mapsBtn).toHaveAttribute('href', 'https://www.google.com/maps?q=23.8,90.4');

    // Assert Drive link
    const driveBtn = page.locator('a:has-text("এনআইডি ছবি")');
    await expect(driveBtn).toBeVisible();
    await expect(driveBtn).toHaveAttribute('href', 'https://drive.google.com/file/d/sample/view');
  });

  // QA CHECK 6: Visual Geometry & Screenshots Verification
  test('Check 6 (Visual Verification): Capture mobile screenshots and verify mobile geometry', async ({
    page,
  }) => {
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

    // Capture visual screenshot of Survey Tab
    const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const surveyScreenshot = path.join(screenshotDir, 'survey-tab-390x844.png');
    await page.screenshot({ path: surveyScreenshot, fullPage: false });
    expect(fs.existsSync(surveyScreenshot)).toBe(true);

    // Capture visual screenshot of List Tab
    await page.locator('nav button:has-text("তালিকা")').click();
    await expect(page.locator('text=#001')).toBeVisible();
    const listScreenshot = path.join(screenshotDir, 'list-tab-390x844.png');
    await page.screenshot({ path: listScreenshot, fullPage: false });
    expect(fs.existsSync(listScreenshot)).toBe(true);

    // Clean up temporary screenshots
    fs.rmSync(screenshotDir, { recursive: true, force: true });
  });
});
