'use server';

import { randomUUID, createHash } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  createEventSchema,
  updateEventSchema,
  fixEventSchema,
  deleteEventSchema,
} from '@/lib/validations';
import { TTL_DAYS } from '@/lib/constants';
import type { ActionResult, CreateEventInput, EventDocument } from '@/types';

const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function verifyHostToken(
  event: Record<string, unknown>,
  hostEditToken?: string
): void {
  if (!hostEditToken || !event.hostEditTokenHash) {
    throw new Error('Unauthorized');
  }
  const tokenHash = hashToken(hostEditToken);
  if (tokenHash !== event.hostEditTokenHash) {
    throw new Error('Unauthorized');
  }
}

export async function createEvent(
  input: CreateEventInput
): Promise<ActionResult<{ eventId: string; hostEditToken: string }>> {
  try {
    const parsed = createEventSchema.parse(input);

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + TTL_MS);

    const candidates = parsed.candidates.map((c) => ({
      id: randomUUID(),
      start: Timestamp.fromDate(c.start),
      end: Timestamp.fromDate(c.end),
    }));

    const eventRef = adminDb.collection('events').doc();
    const hostEditToken = randomUUID();
    const hostEditTokenHash = hashToken(hostEditToken);

    await eventRef.set({
      hostId: `guest_${eventRef.id}`,
      hostName: parsed.hostName || '',
      hostEditTokenHash,
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

    return {
      success: true,
      data: { eventId: eventRef.id, hostEditToken },
    };
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
    const parsed = updateEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);

    await adminDb.runTransaction(async (tx) => {
      const eventDoc = await tx.get(eventRef);
      if (!eventDoc.exists) throw new Error('Event not found');

      const event = eventDoc.data() as EventDocument;
      if (event.status === 'fixed') throw new Error('Cannot edit fixed event');

      verifyHostToken(eventDoc.data()!, parsed.hostEditToken);

      const updateData: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (parsed.title !== undefined) updateData.title = parsed.title;
      if (parsed.description !== undefined) updateData.description = parsed.description;

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

      if (parsed.candidateIdsToRemove?.length) {
        const removeSet = new Set(parsed.candidateIdsToRemove);
        const currentCandidates = (updateData.candidates ?? event.candidates) as Array<{
          id: string;
          start: Timestamp;
          end: Timestamp;
        }>;
        updateData.candidates = currentCandidates.filter((c) => !removeSet.has(c.id));

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
    const parsed = deleteEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    verifyHostToken(eventDoc.data()!, parsed.hostEditToken);

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
    const parsed = fixEventSchema.parse(input);

    const eventRef = adminDb.doc(`events/${parsed.eventId}`);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = eventDoc.data()!;
    verifyHostToken(event, parsed.hostEditToken);

    if (event.status === 'fixed') throw new Error('Event already fixed');

    const candidateExists = (event.candidates as Array<{ id: string }>).some(
      (c) => c.id === parsed.candidateId
    );
    if (!candidateExists) throw new Error('Invalid candidate ID');

    const now = Timestamp.now();
    const newExpiresAt = Timestamp.fromMillis(now.toMillis() + TTL_MS);

    await eventRef.update({
      status: 'fixed',
      fixedCandidateId: parsed.candidateId,
      expiresAt: newExpiresAt,
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
