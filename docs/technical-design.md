# Technical Design Document: Global Meet Adjuster

Based on spec.md v3 (Final). This document provides implementation-ready technical details for Phase 1 (MVP).

---

## 1. Directory Structure

```
global-meet-adjuster/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx                  # Locale layout (next-intl provider)
│   │   ├── page.tsx                    # Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Host dashboard (Server Component)
│   │   ├── events/
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Event creation form
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Event detail / voting (Server Component)
│   │   │       └── edit/
│   │   │           └── page.tsx        # Event edit (Host only)
│   │   └── not-found.tsx               # 404 page
│   ├── layout.tsx                      # Root layout (html, body, fonts)
│   ├── not-found.tsx                   # Global 404
│   └── actions/
│       ├── event.ts                    # Server Actions: event CRUD
│       ├── guest.ts                    # Server Actions: guest registration & voting
│       └── auth.ts                     # Server Actions: session management
├── components/
│   ├── ui/                             # shadcn/ui (auto-generated)
│   ├── layout/
│   │   ├── header.tsx                  # App header (auth, locale switch)
│   │   └── footer.tsx                  # App footer
│   ├── auth/
│   │   ├── login-button.tsx            # Google login button
│   │   └── auth-guard.tsx              # Protected route wrapper
│   ├── events/
│   │   ├── event-form.tsx              # Create/Edit event form
│   │   ├── event-card.tsx              # Dashboard event card
│   │   ├── event-detail.tsx            # Event detail (client, real-time)
│   │   ├── candidate-picker.tsx        # Date picker + time selector
│   │   ├── candidate-list.tsx          # Candidate list with reorder/delete
│   │   ├── fix-event-dialog.tsx        # Finalization confirmation dialog
│   │   ├── delete-event-dialog.tsx     # Delete confirmation dialog
│   │   └── share-panel.tsx             # Share URL/LINE/email/QR
│   ├── voting/
│   │   ├── voting-table.tsx            # PC table view
│   │   ├── voting-card.tsx             # Mobile card view
│   │   ├── voting-form.tsx             # Voting input form
│   │   ├── voting-button.tsx           # ◯△× toggle button
│   │   ├── voting-summary.tsx          # Per-candidate vote tally
│   │   └── guest-profile-dialog.tsx    # Name/email input dialog
│   ├── timezone/
│   │   ├── dual-time-display.tsx       # Local + host time display
│   │   └── timezone-badge.tsx          # Timezone indicator badge
│   └── locale-switcher.tsx             # Language toggle (ja/en)
├── hooks/
│   ├── use-auth.ts                     # Auth state hook
│   ├── use-event.ts                    # Real-time event data
│   ├── use-guests.ts                   # Real-time guests data
│   └── use-edit-token.ts              # localStorage editToken management
├── lib/
│   ├── firebase/
│   │   ├── admin.ts                    # Firebase Admin SDK singleton
│   │   ├── client.ts                   # Firebase Client SDK singleton
│   │   └── auth.ts                     # Auth helper functions
│   ├── timezone.ts                     # Timezone conversion utilities
│   ├── validations.ts                  # Zod schemas
│   ├── share.ts                        # Share URL helpers (LINE, mailto, QR)
│   └── constants.ts                    # App constants (durations, limits)
├── types/
│   └── index.ts                        # Shared TypeScript types
├── providers/
│   └── auth-provider.tsx               # AuthContext provider
├── messages/
│   ├── ja.json                         # Japanese translations
│   └── en.json                         # English translations
├── i18n/
│   ├── request.ts                      # next-intl request config
│   └── routing.ts                      # next-intl routing config
├── middleware.ts                        # next-intl middleware (locale detection)
├── public/
│   └── ...
├── firestore.rules                     # Firestore security rules
├── firestore.indexes.json              # Firestore composite indexes
├── .env.local.example                  # Environment variable template
├── next.config.ts                      # Next.js config (with next-intl plugin)
├── tailwind.config.ts
├── tsconfig.json
├── components.json                     # shadcn/ui config
└── package.json
```

---

## 2. Data Model & TypeScript Types

### 2.1 Shared Types

```typescript
// types/index.ts

// ============================================================
// Firestore Document Types
// ============================================================

export type VoteStatus = 'ok' | 'maybe' | 'ng';
export type EventStatus = 'planning' | 'fixed';
export type Duration = 30 | 60 | 90 | 120;
export type Locale = 'ja' | 'en';

export interface User {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  createdAt: Date;
}

export interface Candidate {
  id: string;
  start: Date;  // UTC
  end: Date;    // UTC
}

export interface EventDocument {
  id: string;
  hostId: string;
  title: string;
  description: string;
  duration: Duration;
  timezone: string;
  candidates: Candidate[];
  status: EventStatus;
  fixedCandidateId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Answer {
  candidateId: string;
  status: VoteStatus;
}

export interface GuestDocument {
  id: string;
  name: string;
  email?: string;
  editTokenHash: string;
  answers: Answer[];
  registeredAt: Date;
  updatedAt: Date;
}

// ============================================================
// Server Action Input/Output Types
// ============================================================

export interface CreateEventInput {
  title: string;
  description?: string;
  duration: Duration;
  timezone: string;
  candidates: { start: Date; end: Date }[];
}

export interface UpdateEventInput {
  eventId: string;
  title?: string;
  description?: string;
  duration?: Duration;
  candidatesToAdd?: { start: Date; end: Date }[];
  candidateIdsToRemove?: string[];
}

export interface RegisterGuestInput {
  eventId: string;
  name: string;
  email?: string;
  answers: Answer[];
}

export interface RegisterGuestResult {
  guestId: string;
  editToken: string;  // raw token for localStorage
}

export interface UpdateGuestAnswerInput {
  eventId: string;
  guestId: string;
  editToken: string;  // raw token from localStorage
  answers: Answer[];
}

export interface FixEventInput {
  eventId: string;
  candidateId: string;
}

// ============================================================
// Server Action Response Type
// ============================================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### 2.2 Zod Validation Schemas

```typescript
// lib/validations.ts
import { z } from 'zod';

export const DURATIONS = [30, 60, 90, 120] as const;

export const durationSchema = z.enum(['30', '60', '90', '120']).transform(Number) as z.ZodType<30 | 60 | 90 | 120>;

export const candidateSchema = z.object({
  start: z.coerce.date().refine(
    (date) => date > new Date(),
    { message: 'validation.pastDate' }  // i18n key
  ),
  end: z.coerce.date(),
});

export const createEventSchema = z.object({
  title: z.string()
    .min(1, { message: 'validation.required' })
    .max(100, { message: 'validation.maxLength' }),
  description: z.string().max(500).optional().default(''),
  duration: durationSchema,
  timezone: z.string().min(1),
  candidates: z.array(candidateSchema)
    .min(1, { message: 'validation.minCandidates' }),
});

export const updateEventSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  duration: durationSchema.optional(),
  candidatesToAdd: z.array(candidateSchema).optional(),
  candidateIdsToRemove: z.array(z.string()).optional(),
});

export const voteStatusSchema = z.enum(['ok', 'maybe', 'ng']);

export const answerSchema = z.object({
  candidateId: z.string().min(1),
  status: voteStatusSchema,
});

export const registerGuestSchema = z.object({
  eventId: z.string().min(1),
  name: z.string()
    .min(1, { message: 'validation.required' })
    .max(50, { message: 'validation.maxLength' }),
  email: z.string().email({ message: 'validation.invalidEmail' }).optional().or(z.literal('')),
  answers: z.array(answerSchema),
});

export const updateGuestAnswerSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1),
  editToken: z.string().uuid(),
  answers: z.array(answerSchema),
});

export const fixEventSchema = z.object({
  eventId: z.string().min(1),
  candidateId: z.string().min(1),
});

export const deleteEventSchema = z.object({
  eventId: z.string().min(1),
});
```

---

## 3. Server Actions Design

### 3.1 Session Management Utility

```typescript
// lib/firebase/auth.ts
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = '__session';
const SESSION_EXPIRY = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY,
  });
}

export async function getAuthUser(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    return await adminAuth.verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<DecodedIdToken> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
```

### 3.2 Event Actions

```typescript
// app/actions/event.ts
'use server';

import { randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth } from '@/lib/firebase/auth';
import {
  createEventSchema,
  updateEventSchema,
  fixEventSchema,
  deleteEventSchema,
} from '@/lib/validations';
import type { ActionResult, CreateEventInput, EventDocument } from '@/types';

export async function createEvent(
  input: CreateEventInput
): Promise<ActionResult<{ eventId: string }>> {
  try {
    const user = await requireAuth();
    const parsed = createEventSchema.parse(input);

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(
      now.toMillis() + 90 * 24 * 60 * 60 * 1000
    );

    const candidates = parsed.candidates.map((c) => ({
      id: randomUUID(),
      start: Timestamp.fromDate(c.start),
      end: Timestamp.fromDate(c.end),
    }));

    const eventRef = adminDb.collection('events').doc();
    await eventRef.set({
      hostId: user.uid,
      title: parsed.title,
      description: parsed.description || '',
      duration: parsed.duration,
      timezone: parsed.timezone,
      candidates,
      status: 'planning',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, data: { eventId: eventRef.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create event',
    };
  }
}

export async function updateEvent(
  input: unknown
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const parsed = updateEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);

    await adminDb.runTransaction(async (tx) => {
      const eventDoc = await tx.get(eventRef);
      if (!eventDoc.exists) throw new Error('Event not found');

      const event = eventDoc.data() as EventDocument;
      if (event.hostId !== user.uid) throw new Error('Unauthorized');
      if (event.status === 'fixed') throw new Error('Cannot edit fixed event');

      const updateData: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (parsed.title !== undefined) updateData.title = parsed.title;
      if (parsed.description !== undefined) updateData.description = parsed.description;

      // Handle duration change: recalculate all candidate end times
      if (parsed.duration !== undefined) {
        updateData.duration = parsed.duration;
        const currentCandidates = event.candidates;
        updateData.candidates = currentCandidates.map((c) => ({
          ...c,
          end: Timestamp.fromMillis(
            (c.start as unknown as Timestamp).toMillis() + parsed.duration! * 60 * 1000
          ),
        }));
      }

      // Remove candidates (and their answers from all guests)
      if (parsed.candidateIdsToRemove?.length) {
        const removeSet = new Set(parsed.candidateIdsToRemove);
        const currentCandidates = (updateData.candidates ?? event.candidates) as Array<{
          id: string;
          start: Timestamp;
          end: Timestamp;
        }>;
        updateData.candidates = currentCandidates.filter((c) => !removeSet.has(c.id));

        // Remove answers referencing deleted candidates
        const guestsSnap = await tx.get(
          adminDb.collection(`events/${parsed.eventId}/guests`)
        );
        for (const guestDoc of guestsSnap.docs) {
          const guest = guestDoc.data();
          const filteredAnswers = (guest.answers || []).filter(
            (a: { candidateId: string }) => !removeSet.has(a.candidateId)
          );
          if (filteredAnswers.length !== (guest.answers || []).length) {
            tx.update(guestDoc.ref, {
              answers: filteredAnswers,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // Add new candidates
      if (parsed.candidatesToAdd?.length) {
        const currentCandidates = (updateData.candidates ?? event.candidates) as unknown[];
        const duration = (parsed.duration ?? event.duration) as number;
        const newCandidates = parsed.candidatesToAdd.map((c) => ({
          id: randomUUID(),
          start: Timestamp.fromDate(c.start),
          end: Timestamp.fromDate(
            new Date(c.start.getTime() + duration * 60 * 1000)
          ),
        }));
        updateData.candidates = [...currentCandidates, ...newCandidates];
      }

      tx.update(eventRef, updateData);
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update event',
    };
  }
}

export async function deleteEvent(
  input: unknown
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const parsed = deleteEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = eventDoc.data()!;
    if (event.hostId !== user.uid) throw new Error('Unauthorized');
    if (event.status === 'fixed') throw new Error('Cannot delete fixed event');

    // Delete all guests in subcollection
    const guestsSnap = await adminDb
      .collection(`events/${parsed.eventId}/guests`)
      .get();

    const batch = adminDb.batch();
    for (const doc of guestsSnap.docs) {
      batch.delete(doc.ref);
    }
    batch.delete(eventRef);
    await batch.commit();

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete event',
    };
  }
}

export async function fixEvent(
  input: unknown
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const parsed = fixEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = eventDoc.data()!;
    if (event.hostId !== user.uid) throw new Error('Unauthorized');
    if (event.status === 'fixed') throw new Error('Event already fixed');

    // Verify candidateId exists
    const candidateExists = (event.candidates as Array<{ id: string }>).some(
      (c) => c.id === parsed.candidateId
    );
    if (!candidateExists) throw new Error('Invalid candidate ID');

    await eventRef.update({
      status: 'fixed',
      fixedCandidateId: parsed.candidateId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fix event',
    };
  }
}
```

### 3.3 Guest Actions

```typescript
// app/actions/guest.ts
'use server';

import { randomUUID, createHash } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { registerGuestSchema, updateGuestAnswerSchema } from '@/lib/validations';
import type {
  ActionResult,
  RegisterGuestInput,
  RegisterGuestResult,
  UpdateGuestAnswerInput,
} from '@/types';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerGuest(
  input: RegisterGuestInput
): Promise<ActionResult<RegisterGuestResult>> {
  try {
    const parsed = registerGuestSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = eventDoc.data()!;
    if (event.status === 'fixed') throw new Error('Event is already fixed');

    // Duplicate email check
    if (parsed.email) {
      const existingGuest = await adminDb
        .collection(`events/${parsed.eventId}/guests`)
        .where('email', '==', parsed.email)
        .limit(1)
        .get();

      if (!existingGuest.empty) {
        return {
          success: false,
          error: 'duplicateEmail',
        };
      }
    }

    // Validate candidateIds exist
    const validCandidateIds = new Set(
      (event.candidates as Array<{ id: string }>).map((c) => c.id)
    );
    for (const answer of parsed.answers) {
      if (!validCandidateIds.has(answer.candidateId)) {
        throw new Error('Invalid candidate ID in answers');
      }
    }

    const editToken = randomUUID();
    const editTokenHash = hashToken(editToken);

    const now = Timestamp.now();
    const guestRef = adminDb
      .collection(`events/${parsed.eventId}/guests`)
      .doc();

    await guestRef.set({
      name: parsed.name,
      email: parsed.email || null,
      editTokenHash,
      answers: parsed.answers,
      registeredAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      data: { guestId: guestRef.id, editToken },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register',
    };
  }
}

export async function updateGuestAnswer(
  input: UpdateGuestAnswerInput
): Promise<ActionResult> {
  try {
    const parsed = updateGuestAnswerSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = eventDoc.data()!;
    if (event.status === 'fixed') throw new Error('Event is already fixed');

    const guestRef = adminDb.doc(
      `events/${parsed.eventId}/guests/${parsed.guestId}`
    );
    const guestDoc = await guestRef.get();
    if (!guestDoc.exists) throw new Error('Guest not found');

    const guest = guestDoc.data()!;

    // Verify editToken
    const tokenHash = hashToken(parsed.editToken);
    if (guest.editTokenHash !== tokenHash) {
      throw new Error('Unauthorized: invalid edit token');
    }

    // Validate candidateIds
    const validCandidateIds = new Set(
      (event.candidates as Array<{ id: string }>).map((c) => c.id)
    );
    for (const answer of parsed.answers) {
      if (!validCandidateIds.has(answer.candidateId)) {
        throw new Error('Invalid candidate ID in answers');
      }
    }

    await guestRef.update({
      answers: parsed.answers,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update answer',
    };
  }
}
```

### 3.4 Auth Actions

```typescript
// app/actions/auth.ts
'use server';

import { cookies } from 'next/headers';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const SESSION_COOKIE_NAME = '__session';
const SESSION_EXPIRY = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function signIn(idToken: string): Promise<{ success: boolean }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRY / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Upsert user document
    const userRef = adminDb.doc(`users/${decoded.uid}`);
    await userRef.set(
      {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || '',
        photoURL: decoded.picture || '',
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
```

---

## 4. Authentication Flow

### 4.1 Architecture

```
[Browser]                              [Vercel (Server)]              [Firebase]
    |                                        |                            |
    |-- signInWithPopup(GoogleProvider) ---->|                            |
    |                                        |                            |
    |<---- Firebase ID Token ----------------|                            |
    |                                        |                            |
    |-- Server Action: signIn(idToken) ----->|                            |
    |                                        |-- verifyIdToken() -------->|
    |                                        |<-- DecodedIdToken ---------|
    |                                        |                            |
    |                                        |-- createSessionCookie() -->|
    |                                        |<-- session cookie ---------|
    |                                        |                            |
    |                                        |-- set httpOnly cookie      |
    |                                        |-- upsert /users/{uid}      |
    |<---- { success: true } ----------------|                            |
    |                                        |                            |
    |-- Subsequent requests (cookie auto) -->|                            |
    |                                        |-- verifySessionCookie() -->|
    |                                        |<-- DecodedIdToken ---------|
```

### 4.2 Client-Side Auth Provider

```tsx
// providers/auth-provider.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { signIn as serverSignIn, signOut as serverSignOut } from '@/app/actions/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
  }, []);

  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    await serverSignIn(idToken);
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
    await serverSignOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn: handleSignIn, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 4.3 Auth Guard Component

```tsx
// components/auth/auth-guard.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useLocale } from 'next-intl';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, router, locale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
```

---

## 5. Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: authenticated user can read/write their own document only
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Events:
    //   get (single doc by ID): anyone (URL-based access)
    //   list (collection query): authenticated host only, filtered by hostId
    //   write: denied (Admin SDK via Server Actions only)
    match /events/{eventId} {
      allow get: if true;
      allow list: if request.auth != null
                  && resource.data.hostId == request.auth.uid;
      allow create, update, delete: if false;

      // Guests:
      //   read: anyone (voting table display)
      //   write: denied (Admin SDK via Server Actions only)
      match /guests/{guestId} {
        allow read: if true;
        allow create, update, delete: if false;
      }
    }
  }
}
```

### Firestore Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "hostId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 6. i18n Design (next-intl)

### 6.1 Routing Configuration

```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ja', 'en'],
  defaultLocale: 'ja',
  localeDetection: true,
  localePrefix: 'always',
});
```

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'ja' | 'en')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### 6.2 Middleware

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(ja|en)/:path*'],
};
```

### 6.3 Next.js Config

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

### 6.4 Layout Integration

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/providers/auth-provider';
import { Header } from '@/components/layout/header';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ja' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AuthProvider>
        <Header />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
```

### 6.5 Translation Key Structure

```json
// messages/ja.json
{
  "common": {
    "appName": "Global Meet Adjuster",
    "loading": "読み込み中...",
    "save": "保存",
    "cancel": "キャンセル",
    "delete": "削除",
    "edit": "編集",
    "confirm": "確定",
    "back": "戻る",
    "copy": "コピー",
    "copied": "コピーしました"
  },
  "auth": {
    "loginWithGoogle": "Googleでログイン",
    "logout": "ログアウト",
    "loginRequired": "ログインが必要です"
  },
  "landing": {
    "title": "時差を超えて、会議をスムーズに",
    "subtitle": "タイムゾーンを自動変換する日程調整ツール",
    "cta": "無料で始める"
  },
  "dashboard": {
    "title": "イベント一覧",
    "empty": "イベントはまだありません",
    "createNew": "新しいイベントを作成",
    "status": {
      "planning": "調整中",
      "fixed": "確定済み"
    }
  },
  "event": {
    "create": {
      "title": "新しいイベントを作成",
      "eventTitle": "イベントタイトル",
      "eventTitlePlaceholder": "例: 週次定例ミーティング",
      "memo": "メモ",
      "memoPlaceholder": "補足情報があれば入力してください",
      "duration": "会議時間",
      "durationOptions": {
        "30": "30分",
        "60": "1時間",
        "90": "1.5時間",
        "120": "2時間"
      },
      "candidates": "候補日時",
      "addCandidate": "候補日を追加",
      "noCandidates": "候補日を1つ以上追加してください",
      "submit": "イベントを作成"
    },
    "edit": {
      "title": "イベントを編集",
      "removeCandidateWarning": "この候補日への回答も削除されます。よろしいですか？",
      "submit": "変更を保存"
    },
    "delete": {
      "title": "イベントを削除",
      "message": "このイベントと全ての回答が削除されます。この操作は取り消せません。",
      "confirm": "削除する"
    },
    "detail": {
      "hostTimezone": "主催者のタイムゾーン",
      "yourTimezone": "あなたのタイムゾーン",
      "fixedBanner": "この日程で確定しました",
      "confirmedDate": "確定日時"
    },
    "share": {
      "title": "イベントを共有",
      "copyUrl": "URLをコピー",
      "line": "LINEで共有",
      "email": "メールで共有",
      "qrCode": "QRコード"
    },
    "fix": {
      "title": "日程を確定",
      "message": "この日程で確定しますか？",
      "confirm": "確定する"
    }
  },
  "voting": {
    "newResponse": "新しく回答する",
    "editResponse": "回答を編集",
    "ok": "◯",
    "maybe": "△",
    "ng": "×",
    "noAnswer": "−",
    "summary": "集計",
    "guestName": "お名前",
    "guestNamePlaceholder": "山田太郎",
    "guestEmail": "メールアドレス（任意）",
    "guestEmailPlaceholder": "example@email.com",
    "submit": "回答を送信",
    "update": "回答を更新",
    "duplicateEmail": "このメールアドレスは既に登録されています。回答を編集する場合は、既存の回答をクリックしてください。"
  },
  "timezone": {
    "local": "ローカル時間",
    "host": "主催者時間"
  },
  "validation": {
    "required": "必須項目です",
    "maxLength": "文字数が上限を超えています",
    "pastDate": "過去の日時は選択できません",
    "minCandidates": "候補日を1つ以上追加してください",
    "invalidEmail": "有効なメールアドレスを入力してください"
  },
  "error": {
    "generic": "エラーが発生しました。もう一度お試しください。",
    "notFound": "イベントが見つかりません",
    "unauthorized": "権限がありません"
  }
}
```

```json
// messages/en.json
{
  "common": {
    "appName": "Global Meet Adjuster",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "confirm": "Confirm",
    "back": "Back",
    "copy": "Copy",
    "copied": "Copied!"
  },
  "auth": {
    "loginWithGoogle": "Sign in with Google",
    "logout": "Sign out",
    "loginRequired": "Please sign in to continue"
  },
  "landing": {
    "title": "Schedule meetings across time zones",
    "subtitle": "A scheduling tool with automatic timezone conversion",
    "cta": "Get started for free"
  },
  "dashboard": {
    "title": "My Events",
    "empty": "No events yet",
    "createNew": "Create new event",
    "status": {
      "planning": "Planning",
      "fixed": "Confirmed"
    }
  },
  "event": {
    "create": {
      "title": "Create New Event",
      "eventTitle": "Event Title",
      "eventTitlePlaceholder": "e.g., Weekly Team Standup",
      "memo": "Notes",
      "memoPlaceholder": "Add any additional details",
      "duration": "Meeting Duration",
      "durationOptions": {
        "30": "30 min",
        "60": "1 hour",
        "90": "1.5 hours",
        "120": "2 hours"
      },
      "candidates": "Candidate Dates",
      "addCandidate": "Add candidate date",
      "noCandidates": "Please add at least one candidate date",
      "submit": "Create Event"
    },
    "edit": {
      "title": "Edit Event",
      "removeCandidateWarning": "Responses for this date will also be removed. Continue?",
      "submit": "Save Changes"
    },
    "delete": {
      "title": "Delete Event",
      "message": "This event and all responses will be permanently deleted. This action cannot be undone.",
      "confirm": "Delete"
    },
    "detail": {
      "hostTimezone": "Host timezone",
      "yourTimezone": "Your timezone",
      "fixedBanner": "This date has been confirmed",
      "confirmedDate": "Confirmed date"
    },
    "share": {
      "title": "Share Event",
      "copyUrl": "Copy URL",
      "line": "Share via LINE",
      "email": "Share via Email",
      "qrCode": "QR Code"
    },
    "fix": {
      "title": "Confirm Date",
      "message": "Are you sure you want to confirm this date?",
      "confirm": "Confirm"
    }
  },
  "voting": {
    "newResponse": "Add your response",
    "editResponse": "Edit response",
    "ok": "◯",
    "maybe": "△",
    "ng": "×",
    "noAnswer": "−",
    "summary": "Summary",
    "guestName": "Your Name",
    "guestNamePlaceholder": "John Doe",
    "guestEmail": "Email (optional)",
    "guestEmailPlaceholder": "example@email.com",
    "submit": "Submit Response",
    "update": "Update Response",
    "duplicateEmail": "This email is already registered. Click your existing response to edit it."
  },
  "timezone": {
    "local": "Local time",
    "host": "Host time"
  },
  "validation": {
    "required": "This field is required",
    "maxLength": "Exceeds maximum character limit",
    "pastDate": "Cannot select a past date",
    "minCandidates": "Please add at least one candidate date",
    "invalidEmail": "Please enter a valid email address"
  },
  "error": {
    "generic": "An error occurred. Please try again.",
    "notFound": "Event not found",
    "unauthorized": "You are not authorized"
  }
}
```

---

## 7. Timezone Processing

### 7.1 Utility Functions

```typescript
// lib/timezone.ts
import { formatInTimeZone } from 'date-fns-tz';
import { ja, enUS } from 'date-fns/locale';
import type { Locale } from '@/types';

const localeMap = {
  ja,
  en: enUS,
} as const;

/**
 * Detect browser timezone.
 * Must be called on client side only.
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a UTC date in a specific timezone.
 */
export function formatInTz(
  utcDate: Date,
  timezone: string,
  formatStr: string,
  locale: Locale = 'ja'
): string {
  return formatInTimeZone(utcDate, timezone, formatStr, {
    locale: localeMap[locale],
  });
}

/**
 * Format date for display in voting table.
 * Example (ja): "3/15 (土) 19:00"
 * Example (en): "Mar 15 (Sat) 7:00 PM"
 */
export function formatCandidateDate(
  utcDate: Date,
  timezone: string,
  locale: Locale = 'ja'
): string {
  const formatStr =
    locale === 'ja' ? 'M/d (EEE) HH:mm' : 'MMM d (EEE) h:mm a';
  return formatInTz(utcDate, timezone, formatStr, locale);
}

/**
 * Format full date for event detail view.
 * Example (ja): "2026年3月15日 (土) 19:00 - 20:00"
 * Example (en): "March 15, 2026 (Sat) 7:00 PM - 8:00 PM"
 */
export function formatCandidateDateFull(
  start: Date,
  end: Date,
  timezone: string,
  locale: Locale = 'ja'
): string {
  if (locale === 'ja') {
    const datePart = formatInTz(start, timezone, 'yyyy年M月d日 (EEE)', locale);
    const startTime = formatInTz(start, timezone, 'HH:mm', locale);
    const endTime = formatInTz(end, timezone, 'HH:mm', locale);
    return `${datePart} ${startTime} - ${endTime}`;
  }

  const datePart = formatInTz(start, timezone, 'MMMM d, yyyy (EEE)', locale);
  const startTime = formatInTz(start, timezone, 'h:mm a', locale);
  const endTime = formatInTz(end, timezone, 'h:mm a', locale);
  return `${datePart} ${startTime} - ${endTime}`;
}

/**
 * Get dual timezone display (guest local + host).
 */
export function formatDualTimezone(
  utcDate: Date,
  guestTz: string,
  hostTz: string,
  locale: Locale = 'ja'
): { guestTime: string; hostTime: string } {
  return {
    guestTime: formatCandidateDate(utcDate, guestTz, locale),
    hostTime: formatCandidateDate(utcDate, hostTz, locale),
  };
}

/**
 * Get a human-readable timezone name.
 * Example: "Asia/Tokyo" → "日本標準時 (JST)" or "Japan Standard Time (JST)"
 */
export function getTimezoneName(timezone: string, locale: Locale = 'ja'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    timeZone: timezone,
    timeZoneName: 'long',
  });
  const parts = formatter.formatToParts(new Date());
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || timezone;

  const shortFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  const shortParts = shortFormatter.formatToParts(new Date());
  const shortTz = shortParts.find((p) => p.type === 'timeZoneName')?.value || '';

  return `${tzName} (${shortTz})`;
}
```

### 7.2 Dual Timezone Display Component

```tsx
// components/timezone/dual-time-display.tsx
'use client';

import { useLocale } from 'next-intl';
import { formatDualTimezone } from '@/lib/timezone';
import { getBrowserTimezone } from '@/lib/timezone';
import type { Locale } from '@/types';

interface DualTimeDisplayProps {
  utcDate: Date;
  hostTimezone: string;
}

export function DualTimeDisplay({ utcDate, hostTimezone }: DualTimeDisplayProps) {
  const locale = useLocale() as Locale;
  const guestTz = getBrowserTimezone();
  const { guestTime, hostTime } = formatDualTimezone(
    utcDate,
    guestTz,
    hostTimezone,
    locale
  );

  const isSameTimezone = guestTz === hostTimezone;

  return (
    <div>
      <span className="font-medium">{guestTime}</span>
      {!isSameTimezone && (
        <span className="text-sm text-muted-foreground ml-2">
          ({hostTime})
        </span>
      )}
    </div>
  );
}
```

---

## 8. Real-Time Data Hooks

### 8.1 useEvent Hook

```typescript
// hooks/use-event.ts
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { EventDocument, Candidate } from '@/types';

function convertTimestamp(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

function parseEvent(id: string, data: Record<string, unknown>): EventDocument {
  return {
    id,
    hostId: data.hostId as string,
    title: data.title as string,
    description: (data.description as string) || '',
    duration: data.duration as EventDocument['duration'],
    timezone: data.timezone as string,
    candidates: ((data.candidates as Array<Record<string, unknown>>) || []).map(
      (c) => ({
        id: c.id as string,
        start: convertTimestamp(c.start),
        end: convertTimestamp(c.end),
      })
    ),
    status: data.status as EventDocument['status'],
    fixedCandidateId: data.fixedCandidateId as string | undefined,
    expiresAt: convertTimestamp(data.expiresAt),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  };
}

interface UseEventReturn {
  event: EventDocument | null;
  loading: boolean;
  error: Error | null;
}

export function useEvent(eventId: string): UseEventReturn {
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'events', eventId),
      (snapshot) => {
        if (snapshot.exists()) {
          setEvent(parseEvent(snapshot.id, snapshot.data()));
        } else {
          setEvent(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [eventId]);

  return { event, loading, error };
}
```

### 8.2 useGuests Hook

```typescript
// hooks/use-guests.ts
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { GuestDocument, Answer } from '@/types';

function parseGuest(id: string, data: Record<string, unknown>): GuestDocument {
  return {
    id,
    name: data.name as string,
    email: (data.email as string) || undefined,
    editTokenHash: data.editTokenHash as string,
    answers: ((data.answers as Answer[]) || []),
    registeredAt:
      data.registeredAt instanceof Timestamp
        ? data.registeredAt.toDate()
        : new Date(data.registeredAt as string),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt as string),
  };
}

interface UseGuestsReturn {
  guests: GuestDocument[];
  loading: boolean;
  error: Error | null;
}

export function useGuests(eventId: string): UseGuestsReturn {
  const [guests, setGuests] = useState<GuestDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'events', eventId, 'guests'),
      (snapshot) => {
        const guestList = snapshot.docs.map((d) =>
          parseGuest(d.id, d.data())
        );
        setGuests(guestList);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [eventId]);

  return { guests, loading, error };
}
```

### 8.3 useEditToken Hook

```typescript
// hooks/use-edit-token.ts
'use client';

import { useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'gma_edit_token_';

function getStorageKey(eventId: string, guestId: string): string {
  return `${STORAGE_KEY_PREFIX}${eventId}_${guestId}`;
}

interface UseEditTokenReturn {
  getToken: (eventId: string, guestId: string) => string | null;
  saveToken: (eventId: string, guestId: string, token: string) => void;
  removeToken: (eventId: string, guestId: string) => void;
  findMyGuestId: (eventId: string, guestIds: string[]) => string | null;
}

export function useEditToken(): UseEditTokenReturn {
  const getToken = useCallback((eventId: string, guestId: string): string | null => {
    try {
      return localStorage.getItem(getStorageKey(eventId, guestId));
    } catch {
      return null;
    }
  }, []);

  const saveToken = useCallback(
    (eventId: string, guestId: string, token: string): void => {
      try {
        localStorage.setItem(getStorageKey(eventId, guestId), token);
      } catch {
        // localStorage unavailable (private browsing, quota exceeded)
      }
    },
    []
  );

  const removeToken = useCallback((eventId: string, guestId: string): void => {
    try {
      localStorage.removeItem(getStorageKey(eventId, guestId));
    } catch {
      // noop
    }
  }, []);

  const findMyGuestId = useCallback(
    (eventId: string, guestIds: string[]): string | null => {
      for (const guestId of guestIds) {
        if (getToken(eventId, guestId)) {
          return guestId;
        }
      }
      return null;
    },
    [getToken]
  );

  return { getToken, saveToken, removeToken, findMyGuestId };
}
```

---

## 9. Responsive Design: Table/Card Switching

### 9.1 Implementation Strategy

Use Tailwind CSS breakpoints with conditional rendering. The voting data renders as a table on `md+` screens and as a card list on smaller screens.

```tsx
// components/voting/voting-table.tsx
'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DualTimeDisplay } from '@/components/timezone/dual-time-display';
import { VotingButton } from './voting-button';
import { VotingSummary } from './voting-summary';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';

interface VotingTableProps {
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  editingGuestId: string | null;
  onAnswerChange?: (candidateId: string, status: VoteStatus) => void;
  editingAnswers?: Record<string, VoteStatus>;
}

export function VotingTable({
  candidates,
  guests,
  hostTimezone,
  editingGuestId,
  onAnswerChange,
  editingAnswers,
}: VotingTableProps) {
  const t = useTranslations('voting');

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">
              {t('summary')}
            </TableHead>
            {candidates.map((candidate) => (
              <TableHead key={candidate.id} className="text-center min-w-[100px]">
                <DualTimeDisplay
                  utcDate={candidate.start}
                  hostTimezone={hostTimezone}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Summary row */}
          <VotingSummary candidates={candidates} guests={guests} />

          {/* Guest rows */}
          {guests.map((guest) => (
            <TableRow key={guest.id}>
              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                {guest.name}
              </TableCell>
              {candidates.map((candidate) => {
                const answer = guest.id === editingGuestId
                  ? editingAnswers?.[candidate.id]
                  : guest.answers.find(
                      (a) => a.candidateId === candidate.id
                    )?.status;

                return (
                  <TableCell key={candidate.id} className="text-center">
                    {guest.id === editingGuestId ? (
                      <VotingButton
                        status={answer}
                        onChange={(status) =>
                          onAnswerChange?.(candidate.id, status)
                        }
                      />
                    ) : (
                      <span className={getStatusStyle(answer)}>
                        {getStatusLabel(answer, t)}
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getStatusStyle(status?: VoteStatus): string {
  switch (status) {
    case 'ok':
      return 'text-green-600 font-bold';
    case 'maybe':
      return 'text-yellow-600 font-bold';
    case 'ng':
      return 'text-red-600 font-bold';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusLabel(
  status: VoteStatus | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'ok':
      return t('ok');
    case 'maybe':
      return t('maybe');
    case 'ng':
      return t('ng');
    default:
      return t('noAnswer');
  }
}
```

```tsx
// components/voting/voting-card.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DualTimeDisplay } from '@/components/timezone/dual-time-display';
import { VotingButton } from './voting-button';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';

interface VotingCardProps {
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  editingGuestId: string | null;
  onAnswerChange?: (candidateId: string, status: VoteStatus) => void;
  editingAnswers?: Record<string, VoteStatus>;
}

export function VotingCard({
  candidates,
  guests,
  hostTimezone,
  editingGuestId,
  onAnswerChange,
  editingAnswers,
}: VotingCardProps) {
  const t = useTranslations('voting');

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const okCount = countStatus(guests, candidate.id, 'ok');
        const maybeCount = countStatus(guests, candidate.id, 'maybe');
        const ngCount = countStatus(guests, candidate.id, 'ng');

        return (
          <Card key={candidate.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DualTimeDisplay
                  utcDate={candidate.start}
                  hostTimezone={hostTimezone}
                />
              </CardTitle>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-green-600">
                  {t('ok')} {okCount}
                </Badge>
                <Badge variant="secondary" className="text-yellow-600">
                  {t('maybe')} {maybeCount}
                </Badge>
                <Badge variant="secondary" className="text-red-600">
                  {t('ng')} {ngCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {guests.map((guest) => {
                  const answer =
                    guest.id === editingGuestId
                      ? editingAnswers?.[candidate.id]
                      : guest.answers.find(
                          (a) => a.candidateId === candidate.id
                        )?.status;

                  return (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{guest.name}</span>
                      {guest.id === editingGuestId ? (
                        <VotingButton
                          status={answer}
                          onChange={(status) =>
                            onAnswerChange?.(candidate.id, status)
                          }
                        />
                      ) : (
                        <span className={getCardStatusStyle(answer)}>
                          {getCardStatusLabel(answer, t)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function countStatus(
  guests: GuestDocument[],
  candidateId: string,
  status: VoteStatus
): number {
  return guests.filter((g) =>
    g.answers.some(
      (a) => a.candidateId === candidateId && a.status === status
    )
  ).length;
}

function getCardStatusStyle(status?: VoteStatus): string {
  switch (status) {
    case 'ok': return 'text-green-600 font-bold text-sm';
    case 'maybe': return 'text-yellow-600 font-bold text-sm';
    case 'ng': return 'text-red-600 font-bold text-sm';
    default: return 'text-muted-foreground text-sm';
  }
}

function getCardStatusLabel(
  status: VoteStatus | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'ok': return t('ok');
    case 'maybe': return t('maybe');
    case 'ng': return t('ng');
    default: return t('noAnswer');
  }
}
```

### 9.2 Responsive Container

```tsx
// Usage in event detail page component:

// PC: table, Mobile: card
<div className="hidden md:block">
  <VotingTable
    candidates={event.candidates}
    guests={guests}
    hostTimezone={event.timezone}
    editingGuestId={editingGuestId}
    onAnswerChange={handleAnswerChange}
    editingAnswers={editingAnswers}
  />
</div>
<div className="md:hidden">
  <VotingCard
    candidates={event.candidates}
    guests={guests}
    hostTimezone={event.timezone}
    editingGuestId={editingGuestId}
    onAnswerChange={handleAnswerChange}
    editingAnswers={editingAnswers}
  />
</div>
```

---

## 10. Share Feature

### 10.1 Share Utilities

```typescript
// lib/share.ts

/**
 * Build the full shareable URL for an event.
 */
export function getEventShareUrl(eventId: string, locale: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/${locale}/events/${eventId}`;
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open LINE share dialog.
 * Uses LINE's URL scheme for mobile and share URL for desktop.
 */
export function shareLine(url: string, text: string): void {
  const encoded = encodeURIComponent(`${text}\n${url}`);
  window.open(
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'width=600,height=500'
  );
}

/**
 * Open mailto: link for email sharing.
 */
export function shareEmail(url: string, title: string, locale: string): void {
  const subject = encodeURIComponent(
    locale === 'ja'
      ? `日程調整: ${title}`
      : `Schedule: ${title}`
  );
  const body = encodeURIComponent(
    locale === 'ja'
      ? `以下のリンクから日程を回答してください:\n${url}`
      : `Please respond with your availability:\n${url}`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}
```

### 10.2 QR Code

Use `qrcode` package (lightweight, no external dependencies):

```bash
npm install qrcode @types/qrcode
```

```tsx
// components/events/share-panel.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, MessageCircle } from 'lucide-react';
import {
  getEventShareUrl,
  copyToClipboard,
  shareLine,
  shareEmail,
} from '@/lib/share';

interface SharePanelProps {
  eventId: string;
  eventTitle: string;
}

export function SharePanel({ eventId, eventTitle }: SharePanelProps) {
  const t = useTranslations('event.share');
  const locale = useLocale();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = getEventShareUrl(eventId, locale);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 200,
        margin: 2,
      });
    }
  }, [shareUrl]);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      toast({ description: t('copied') });
    }
  }, [shareUrl, toast, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t('copyUrl')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => shareLine(shareUrl, eventTitle)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {t('line')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => shareEmail(shareUrl, eventTitle, locale)}
          >
            <Mail className="mr-2 h-4 w-4" />
            {t('email')}
          </Button>
        </div>

        <div className="flex justify-center pt-2">
          <div className="text-center">
            <canvas ref={canvasRef} />
            <p className="text-sm text-muted-foreground mt-2">{t('qrCode')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 11. Firestore TTL Configuration

Firestore TTL policies automatically delete documents when the specified timestamp field value is in the past. This is managed via the Firebase console or `gcloud` CLI.

### 11.1 Setup

The `expiresAt` field on each `events` document is set to `createdAt + 90 days` at creation time.

```bash
# Set TTL policy via gcloud CLI
gcloud firestore fields ttls update expiresAt \
  --collection-group=events \
  --project=YOUR_PROJECT_ID
```

### 11.2 TTL Behavior

- Firestore checks the `expiresAt` field periodically (not exactly at the timestamp; typically within 24 hours).
- When the document is deleted, subcollections (`guests`) are **not** automatically deleted by TTL.
- To handle orphaned subcollections, use one of these approaches:

**Option A: Cloud Function (recommended for Phase 2)**

```typescript
// Firestore trigger to clean up subcollections when parent is deleted
// (Phase 2: when Cloud Functions are introduced)
export const onEventDeleted = onDocumentDeleted(
  'events/{eventId}',
  async (event) => {
    const db = getFirestore();
    const guestsSnap = await db
      .collection(`events/${event.params.eventId}/guests`)
      .get();
    const batch = db.batch();
    for (const doc of guestsSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
);
```

**Option B: Accept orphaned subcollections (MVP)**

For Phase 1, orphaned `guests` subcollections from TTL-deleted events are harmless. They have no parent document, so they cannot be queried through normal application paths. They will contribute minimal storage cost for events with ~20 guests.

### 11.3 Setting expiresAt in Event Creation

Already handled in the `createEvent` Server Action:

```typescript
const expiresAt = Timestamp.fromMillis(
  now.toMillis() + 90 * 24 * 60 * 60 * 1000 // 90 days
);
```

---

## 12. Deployment Configuration

### 12.1 Vercel Configuration

```json
// vercel.json (if needed; most config is automatic for Next.js)
{
  "framework": "nextjs"
}
```

### 12.2 Environment Variables (Vercel Dashboard)

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client + Server | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client + Server | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client + Server | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client + Server | Firebase storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client + Server | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client + Server | Firebase app ID |
| `NEXT_PUBLIC_BASE_URL` | Client + Server | App base URL (e.g., `https://meet.example.com`) |
| `FIREBASE_ADMIN_PROJECT_ID` | Server only | Admin SDK project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Server only | Admin SDK service account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server only | Admin SDK private key (PEM format) |

### 12.3 Firebase Admin SDK Initialization

```typescript
// lib/firebase/admin.ts
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Vercel stores the private key with literal \n — replace with actual newlines
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const app = getAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
```

### 12.4 Firebase Client SDK Initialization

```typescript
// lib/firebase/client.ts
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(firebaseConfig);
}

// Lazy initialization to avoid SSR issues
if (typeof window !== 'undefined') {
  app = getClientApp();
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
```

### 12.5 .env.local.example

```env
# .env.local.example

# Firebase Client SDK (public - exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Firebase Admin SDK (server-only - NEVER expose to client)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Phase 2
# GEMINI_API_KEY=
# GOOGLE_CALENDAR_CLIENT_ID=
# GOOGLE_CALENDAR_CLIENT_SECRET=
```

### 12.6 Constants

```typescript
// lib/constants.ts

export const DURATIONS = [30, 60, 90, 120] as const;

export const MAX_GUESTS_SOFT_LIMIT = 20;

export const TTL_DAYS = 90;

export const SESSION_COOKIE_NAME = '__session';
export const SESSION_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const EDIT_TOKEN_STORAGE_PREFIX = 'gma_edit_token_';
```
