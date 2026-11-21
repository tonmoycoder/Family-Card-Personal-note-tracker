import { NextRequest, NextResponse } from 'next/server';

async function safeParseAppsScriptResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<!DOCTYPE html>') || text.includes('ServiceLogin')) {
      throw new Error(
        'Apps Script পারমিশন ত্রুটি: ডিপ্লয়মেন্টে "Who has access" অপশনটি "Anyone" সেট করা আছে কি না চেক করুন।'
      );
    }
    throw new Error(`Apps Script থেকে অপ্রত্যাশিত রেসপন্স এসেছে (HTTP ${res.status})।`);
  }
}

export async function GET() {
  try {
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return NextResponse.json(
        { success: false, error: 'সার্ভারে APPS_SCRIPT_URL সেট করা নেই।' },
        { status: 500 }
      );
    }

    const res = await fetch(scriptUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
    });

    const data = await safeParseAppsScriptResponse(res);
    const normalizedRecords = data.records || data.data || [];
    return NextResponse.json(
      {
        ...data,
        data: normalizedRecords,
        records: normalizedRecords,
      },
      { status: res.ok ? 200 : res.status }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ডেটা লোড করা যায়নি।';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return NextResponse.json(
        { success: false, error: 'সার্ভারে APPS_SCRIPT_URL সেট করা নেই।' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    const data = await safeParseAppsScriptResponse(res);
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'সেভ করা যায়নি।';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
