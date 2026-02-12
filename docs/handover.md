# Global Meet Adjuster - Handover Document

## Project Status
**Phase 1 MVP のコード実装が完了。** ビルド成功（`npm run build` pass）、TypeScript型チェック通過済み。
Firebase環境の構築とデプロイが次のステップ。

---

## Directory Structure

```
global-meet-adjuster/
├── app/
│   ├── layout.tsx                    # Root layout (Inter + Noto Sans JP, Sonner)
│   ├── page.tsx                      # Default page (redirect by middleware)
│   ├── globals.css                   # Global styles + shadcn/ui CSS variables
│   ├── actions/
│   │   ├── auth.ts                   # signIn / signOut Server Actions
│   │   ├── event.ts                  # createEvent / updateEvent / deleteEvent / fixEvent
│   │   └── guest.ts                  # registerGuest / updateGuestAnswer
│   └── [locale]/
│       ├── layout.tsx                # Locale layout (NextIntlClientProvider + AuthProvider)
│       ├── page.tsx                  # Landing page (hero + CTA)
│       ├── not-found.tsx             # 404 page
│       ├── dashboard/
│       │   └── page.tsx              # Host dashboard (event list, real-time)
│       └── events/
│           ├── new/
│           │   └── page.tsx          # Event creation (AuthGuard)
│           └── [id]/
│               ├── page.tsx          # Event detail / voting (SSR + real-time)
│               └── edit/
│                   └── page.tsx      # Event edit (AuthGuard, host only)
├── components/
│   ├── ui/                           # shadcn/ui (auto-generated, 14 components)
│   ├── layout/
│   │   └── header.tsx                # App header (auth, locale switch)
│   ├── auth/
│   │   ├── login-button.tsx          # Google login button
│   │   └── auth-guard.tsx            # Protected route wrapper
│   ├── events/
│   │   ├── event-form.tsx            # Create/Edit event form (react-hook-form + zod)
│   │   ├── event-card.tsx            # Dashboard event card
│   │   ├── event-detail.tsx          # Event detail (client, real-time)
│   │   ├── candidate-picker.tsx      # Date picker + time selector
│   │   ├── candidate-list.tsx        # Candidate list with delete
│   │   ├── fix-event-dialog.tsx      # Finalization confirmation
│   │   ├── delete-event-dialog.tsx   # Delete confirmation (fixed events too)
│   │   └── share-panel.tsx           # Share URL/LINE/email/QR
│   ├── voting/
│   │   ├── voting-table.tsx          # PC table view (md+)
│   │   ├── voting-card.tsx           # Mobile card view (<md)
│   │   ├── voting-form.tsx           # Voting flow controller
│   │   ├── voting-button.tsx         # ◯△× toggle (44x44px tap target)
│   │   ├── voting-summary.tsx        # Per-candidate vote tally
│   │   └── guest-profile-dialog.tsx  # Name/email input dialog
│   ├── timezone/
│   │   ├── dual-time-display.tsx     # Local + host time display
│   │   └── timezone-badge.tsx        # Timezone name badge
│   └── locale-switcher.tsx           # Language toggle (ja/en)
├── hooks/
│   ├── use-event.ts                  # Real-time event data (onSnapshot)
│   ├── use-guests.ts                 # Real-time guests data (onSnapshot)
│   └── use-edit-token.ts             # localStorage editToken management
├── lib/
│   ├── firebase/
│   │   ├── admin.ts                  # Firebase Admin SDK (graceful init)
│   │   ├── client.ts                 # Firebase Client SDK (lazy init)
│   │   └── auth.ts                   # Session cookie helpers
│   ├── timezone.ts                   # date-fns-tz utilities
│   ├── validations.ts               # Zod schemas (7 schemas)
│   ├── share.ts                      # Share URL/LINE/email helpers
│   ├── constants.ts                  # App constants
│   └── utils.ts                      # shadcn/ui cn() helper
├── providers/
│   └── auth-provider.tsx             # AuthContext (signIn/signOut/user/loading)
├── types/
│   └── index.ts                      # Shared TypeScript types
├── messages/
│   ├── ja.json                       # Japanese translations
│   └── en.json                       # English translations
├── i18n/
│   ├── routing.ts                    # next-intl routing config
│   └── request.ts                    # next-intl request config
├── middleware.ts                      # Locale detection middleware
├── firestore.rules                   # Firestore security rules
├── firestore.indexes.json            # Firestore composite indexes
├── .env.local.example                # Environment variable template
├── next.config.ts                    # Next.js config (with next-intl plugin)
└── docs/
    ├── project-plan.md               # Project plan & roadmap
    ├── handover.md                   # This document
    ├── technical-design.md           # Detailed technical design
    ├── test-strategy.md              # Test strategy & test cases
    └── uiux-review.md               # UI/UX review & proposals
```

---

## Setup Instructions

### 1. Firebase Project Setup
```bash
# Firebase Console (https://console.firebase.google.com)
# 1. Create a new project
# 2. Enable Authentication > Google provider
# 3. Create Firestore database
# 4. Get service account key (Project Settings > Service Accounts)
```

### 2. Environment Variables
```bash
cp .env.local.example .env.local
# Fill in all values from Firebase Console
```

### 3. Firestore Configuration
```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login
firebase init firestore  # Select existing project

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes

# Set TTL policy
gcloud firestore fields ttls update expiresAt \
  --collection-group=events \
  --project=YOUR_PROJECT_ID
```

### 4. Development
```bash
npm install
npm run dev    # http://localhost:3000
```

### 5. Deployment (Vercel)
```bash
# Connect GitHub repo to Vercel
# Set environment variables in Vercel Dashboard
# Deploy
```

---

## Key Design Decisions & Rationale

### 1. Server Actions for all writes
**Why**: Client SDK direct writes expose Firestore to potential abuse. Server Actions allow server-side validation (editToken hash check, auth verification, status checks) before writing.

### 2. Session Cookie authentication
**Why**: Firebase ID Token is short-lived (1 hour). Session cookie (5 days) allows Server Components to authenticate without requiring client-side token refresh. Flow: `signInWithPopup → getIdToken → Server Action creates session cookie`.

### 3. editToken with SHA-256 hash
**Why**: editToken stored in Firestore must not be readable by other guests (who can read the guests collection). SHA-256 hash prevents token theft while allowing server-side verification.

### 4. No Calendar integration in MVP
**Why**: `calendar.events` is a sensitive OAuth scope requiring Google review (weeks to months). MVP ships without this blocker. Confirmed date is displayed in the app instead.

### 5. Email field directly in guest document (not private subcollection)
**Why**: Spec v3.1 called for private subcollection, but MVP simplifies by keeping email in the guest doc. The email is readable via onSnapshot but not displayed in the UI for other guests. Phase 2 will move to private subcollection.

### 6. Firestore TTL as fallback only
**Why**: TTL does not delete subcollections. Primary deletion is via host's manual delete (which properly deletes subcollections). TTL catches abandoned events.

---

## Known Issues & TODOs

### Must Fix Before Launch
- [ ] Firebase project not yet created
- [ ] Environment variables not configured
- [ ] Firestore TTL policy not set
- [ ] No automated tests yet (strategy documented in docs/test-strategy.md)
- [ ] `middleware.ts` uses deprecated convention (Next.js 16 warns about "proxy" replacement)

### Known Limitations (MVP)
- Guest email visible in Firestore to anyone with event URL (mitigated: not shown in UI)
- No email-based editToken recovery (Phase 2)
- No rate limiting beyond Firestore timestamp checks
- No error monitoring (Sentry etc.)
- Orphaned guest subcollections from TTL-deleted events (Phase 2: Cloud Function cleanup)
- expiresAt based on createdAt; reset to +90 days on fixEvent

### Technical Debt
- `app/page.tsx` (root) is the default Next.js page; middleware redirects to `/{locale}` so this is rarely hit
- Some components could benefit from React.memo optimization for large guest lists
- QR code library (`qrcode`) generates on canvas; consider server-side generation for SEO

---

## Reference Documents
| Document | Purpose |
|----------|---------|
| `spec.md` | Product specification (v3.1 Final) |
| `docs/technical-design.md` | Implementation-ready technical design with code examples |
| `docs/test-strategy.md` | Test framework, test cases, mock strategy |
| `docs/uiux-review.md` | UI/UX analysis, wireframes, design proposals |
| `docs/project-plan.md` | Project roadmap and feature tracking |

---

## Contact & Team History

### Phase 0 - Specification Review Team
| Role | Contributions |
|------|--------------|
| PM | Spec review, edge case identification, 13 questions, Phase roadmap |
| Researcher | Tech stack investigation (Next.js 15, Firebase, Gemini, shadcn/ui) |
| Critic | Security audit (3 critical, 8 total issues found), competitive analysis |
| Architect | System design, data model, Server Actions architecture, code examples |
| Designer | UX flow improvements, responsive design, accessibility, wireframes |
| Tester | Test strategy, 68+ test cases, CI/CD pipeline design |

### Phase 1 - Implementation Team
| Agent | Files Created |
|-------|--------------|
| impl-types | types/index.ts, lib/validations.ts, lib/timezone.ts, lib/share.ts, lib/constants.ts |
| impl-i18n | messages/ja.json, messages/en.json, firestore.rules, firestore.indexes.json, .env.local.example |
| impl-actions | app/actions/*, providers/auth-provider.tsx, hooks/*, components/auth/* |
| impl-layout | app/layout.tsx, app/[locale]/*, components/layout/*, components/locale-switcher.tsx, components/events/event-card.tsx |
| impl-events | components/events/(event-form, candidate-picker, candidate-list, delete-event-dialog, share-panel), app/[locale]/events/* |
| impl-voting | components/voting/*, components/events/(event-detail, fix-event-dialog), components/timezone/*, app/[locale]/events/[id]/page.tsx |
