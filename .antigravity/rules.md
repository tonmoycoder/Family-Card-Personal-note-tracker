# Project Rules: Bangladesh Family Card Excluded-Household Field Survey PWA

## 1. TypeScript & Code Quality
- TypeScript strict mode enabled: zero `any`, zero unused variables.
- Pure modular code with explicit typing across all models, hooks, and API routes.

## 2. Security & Credentials
- NEVER expose `GEMINI_API_KEY` or `APPS_SCRIPT_URL` to client components.
- No `NEXT_PUBLIC_` prefixes on secrets.
- All external service calls (Gemini Vision OCR, Google Apps Script) MUST route through server-side Next.js Route Handlers (`/api/*`).

## 3. 100% Natural Bengali (বাংলা) UI
- All user-facing UI text, buttons, labels, placeholders, toasts, modal dialogs, and error messages MUST be 100% clean, natural Bengali (বাংলা).
- NO Banglish or untranslated English strings in UI.
- Use Hind Siliguri font (`next/font/google`) for clear readability.

## 4. Mobile-First Outdoor Fieldwork UX
- Designed specifically for field volunteers surveying households in bright outdoor environments.
- High contrast, emerald/teal civic-tech palette, crisp cards, soft borders.
- Minimum 48px tap targets for easy touch interaction on mobile devices.
- Sticky bottom navigation bar with live badges.
- Clear visual feedback, loading indicators, and scanning animations.
- Adhere to `better-layout` guidelines: 4px/8px spacing rhythm, card visual islands, responsive harmony.

## 5. Offline-First & Zero Data Loss
- If internet drops before, during, or after survey entry, records MUST automatically persist to IndexedDB.
- Background sync must seamlessly retry uploading queued items as soon as connectivity is restored.
- Never lose survey data due to app refresh, browser close, or network failure.
