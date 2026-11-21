import { test, expect } from '@playwright/test';

const SAMPLE_BASE64_IMAGE =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

test.describe('Bangladesh Family Card Survey PWA (100% On-Device OCR)', () => {
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

    // Intercept GET /api/records with mock data so tests are isolated
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

  test('Page loads cleanly with zero console errors and correct Bengali title', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/ফ্যামিলি কার্ড সার্ভে/);
    await expect(page.locator('text=ফ্যামিলি কার্ড সার্ভে')).toBeVisible();
    await expect(page.locator('text=অনলাইন')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('Online Scan & Submit Flow (Local known name fallback & schema compliance)', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null;

    // Mock records POST
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, serial: 2 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Attach mock image via file input
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("গ্যালারি / ফাইল")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'nid-card.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(SAMPLE_BASE64_IMAGE.split(',')[1], 'base64'),
    });

    // Verify OCR populates fields
    await expect(page.locator('input#nidName')).toHaveValue('মোছাঃ রোকসানা খাতুন', { timeout: 10000 });
    await expect(page.locator('input#nidNumber')).toHaveValue('19902612345678901');

    // Fill area / para
    await page.locator('input#areaPara').fill('চর বাঘমারা');

    // Leave localKnownName empty -> should default to nidName
    await page.locator('input#localKnownName').fill('');
    await page.locator('textarea#notes').fill('জরুরি কার্ড প্রয়োজন');

    // Click submit
    await page.locator('button:has-text("সেভ ও ড্রাইভে আপলোড করুন")').click();

    // Verify submission toast
    await expect(page.locator('text=সফলভাবে ডাটাবেজ ও গুগল ড্রাইভে আপলোড হয়েছে!')).toBeVisible({ timeout: 8000 });

    // Assert Payload Schema
    expect(capturedPayload).not.toBeNull();
    const payload = capturedPayload as unknown as Record<string, unknown>;
    expect(payload.nidName).toBe('মোছাঃ রোকসানা খাতুন');
    expect(payload.nidNumber).toBe('19902612345678901');
    // localKnownName defaulted to nidName
    expect(payload.localKnownName).toBe('মোছাঃ রোকসানা খাতুন');
    expect(payload.areaPara).toBe('চর বাঘমারা');
    expect(payload.notes).toBe('জরুরি কার্ড প্রয়োজন');
    expect(payload.capturedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.capturedTimestamp).toBeTruthy();
    expect(typeof payload.mapsLink).toBe('string');
    expect(payload.imageBase64).toBeTruthy();

    // Ensure NO unauthorized fields
    expect(payload.nidNameEnglish).toBeUndefined();
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();

    // Verify areaPara stays preserved in input
    await expect(page.locator('input#areaPara')).toHaveValue('চর বাঘমারা');
  });

  test('Duplicate detection triggers confirmation modal', async ({ page }) => {
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (!body.forceDuplicate) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              duplicate: true,
              message: 'এই এনআইডি ইতিমধ্যে এন্ট্রি করা আছে।',
              existingSerial: '001',
              existingArea: 'দক্ষিণ পাড়া',
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, serial: 99 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Attach image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("গ্যালারি / ফাইল")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'nid-card.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(SAMPLE_BASE64_IMAGE.split(',')[1], 'base64'),
    });

    await page.locator('input#nidName').fill('করিম মিয়া');
    await page.locator('input#nidNumber').fill('19851234567890123');
    await page.locator('input#areaPara').fill('দক্ষিণ পাড়া');

    await page.locator('button:has-text("সেভ ও ড্রাইভে আপলোড করুন")').click();

    // Verify duplicate modal appears
    await expect(page.locator('text=ডুপ্লিকেট এনআইডি সতর্কতা')).toBeVisible();
    await expect(page.locator('text=আগের সিরিয়াল:')).toBeVisible();

    // Click "তবুও নতুন এন্ট্রি করুন"
    await page.locator('button:has-text("তবুও নতুন এন্ট্রি করুন")').click();
    await expect(page.locator('text=সফলভাবে ডাটাবেজ ও গুগল ড্রাইভে আপলোড হয়েছে!')).toBeVisible({ timeout: 8000 });
  });

  test('Offline Queue & Auto-Sync Flow (IndexedDB persistence & sync)', async ({ context, page }) => {
    await page.goto('/');

    // Go offline
    await context.setOffline(true);
    await expect(page.locator('text=অফলাইন — ডেটা ডিভাইসে সুরক্ষিত থাকবে')).toBeVisible({ timeout: 5000 });

    // Attach image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("গ্যালারি / ফাইল")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'nid-card.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(SAMPLE_BASE64_IMAGE.split(',')[1], 'base64'),
    });

    await page.locator('input#localKnownName').fill('হালিম চাচা (অফলাইন এন্ট্রি)');
    await page.locator('input#areaPara').fill('নদীভাঙন চর');

    // Submit while offline
    await page.locator('button:has-text("অফলাইন কিউতে সেভ করুন")').click();
    await expect(page.locator('text=অফলাইনে সংরক্ষিত হয়েছে!')).toBeVisible();

    // Navigate to Queue tab
    await page.locator('nav button:has-text("কিউ")').click();
    await expect(page.locator('text=হালিম চাচা (অফলাইন এন্ট্রি)')).toBeVisible();
    await expect(page.locator('text=ইন্টারনেটের জন্য কিউ হয়ে আছে')).toBeVisible();

    // Verify item is persisted in IndexedDB
    const idbItemCount = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('FamilyCardSurveyOfflineDB', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('pending_entries', 'readonly');
          const countReq = tx.objectStore('pending_entries').count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(0);
        };
        req.onerror = () => resolve(0);
      });
    });
    expect(idbItemCount).toBe(1);

    // Mock record upload for auto-sync
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, serial: 5 }),
        });
      } else {
        await route.continue();
      }
    });

    // Go back online
    await context.setOffline(false);
    await expect(page.locator('text=অনলাইন')).toBeVisible({ timeout: 8000 });

    // Trigger manual sync or wait for auto-sync
    const syncButton = page.locator('button:has-text("এখনই সিঙ্ক করুন")');
    if (await syncButton.isVisible()) {
      await syncButton.click();
    }

    // Verify queue clears
    await expect(page.locator('text=কোনো কিউ করা এন্ট্রি নেই')).toBeVisible({ timeout: 10000 });
  });

  test('Records list displays serials, search, area filter and copy NID', async ({ page }) => {
    await page.goto('/');

    // Navigate to Records tab
    await page.locator('nav button:has-text("তালিকা")').click();

    // Verify card rendered
    await expect(page.locator('text=#001')).toBeVisible();
    await expect(page.locator('text=ফাতেমা বেগম (করিমের মা)')).toBeVisible();
    await expect(page.locator('button:has-text("দক্ষিণ পাড়া")')).toBeVisible();

    // Search filter test
    await page.locator('input[placeholder*="খুঁজুন"]').fill('ফাতেমা');
    await expect(page.locator('text=#001')).toBeVisible();

    await page.locator('input[placeholder*="খুঁজুন"]').fill('অস্তিত্বহীন নাম');
    await expect(page.locator('text=কোনো রেকর্ড পাওয়া যায়নি')).toBeVisible();

    await page.locator('input[placeholder*="খুঁজুন"]').fill('');
    await expect(page.locator('text=#001')).toBeVisible();

    // Copy NID button
    await page.locator('button:has-text("কপি করুন")').first().click();
    await expect(page.locator('text=কপি হয়েছে!')).toBeVisible();
  });
});
