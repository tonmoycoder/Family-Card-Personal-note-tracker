import { NextRequest, NextResponse } from 'next/server';

const BANGLA_TO_ENGLISH_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

function normalizeDigits(input: string): string {
  return input
    .replace(/[০-৯]/g, (d) => BANGLA_TO_ENGLISH_DIGITS[d] || d)
    .replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'সার্ভারে GEMINI_API_KEY সেট করা নেই।' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType = 'image/jpeg' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'কোনো ছবি পাওয়া যায়নি।' },
        { status: 400 }
      );
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are an expert OCR system specialized in Bangladesh National ID (NID) cards (both Smart NID cards and older laminated NID cards).
Extract ONLY these fields and return valid JSON:
- nidName: Exact Bengali name written after "নাম:" in Unicode Bengali script. Read the actual Bengali letters accurately with all juktakshar (যুক্তবর্ণ). If Bengali name is missing/unreadable, fall back to English name.
- nidNumber: The 10-digit, 13-digit, or 17-digit NID number after "NID No" or "ID NO:". Convert any Bengali digits to standard English digits with NO spaces.
- detectedAddressArea: If village/para/ward (ঠিকানা / গ্রাম / রাস্তা / পাড়া) is visible, extract it in Bengali; otherwise return empty string.
- confidence: "high", "medium", or "low".
- warning: Short Bengali note if blurry, cut off, or not an NID card; otherwise empty string.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: cleanBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              nidName: { type: 'STRING' },
              nidNumber: { type: 'STRING' },
              detectedAddressArea: { type: 'STRING' },
              confidence: { type: 'STRING' },
              warning: { type: 'STRING' },
            },
            required: ['nidName', 'nidNumber', 'detectedAddressArea', 'confidence', 'warning'],
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, error: `Gemini API ত্রুটি (${response.status})`, details: errText },
        { status: response.status }
      );
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'ছবি থেকে লেখা পড়া যায়নি। পরিষ্কার আলোতে আবার তুলুন।' },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(rawText);
    return NextResponse.json({
      success: true,
      data: {
        nidName: (parsed.nidName || '').trim(),
        nidNumber: normalizeDigits(parsed.nidNumber || ''),
        detectedAddressArea: (parsed.detectedAddressArea || '').trim(),
        confidence: parsed.confidence || 'medium',
        warning: (parsed.warning || '').trim(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'অজানা ত্রুটি ঘটেছে।';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
