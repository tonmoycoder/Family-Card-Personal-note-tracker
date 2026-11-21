---
name: qa-mobile
description: Run TypeScript check, ESLint, production build, and Playwright mobile 390x844 QA suite.
---

# Mobile QA & Regression Verification

Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Start local server and verify on Playwright mobile viewport (390x844): zero console/page errors, zero infinite `/api/records` loops, 0px vertical layout shift, removable area chips, sorting/date filters, sync-delete modal, and clickable Maps/Drive links.
