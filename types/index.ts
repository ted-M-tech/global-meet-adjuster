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
