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

    // spec.md v3.1: emailはguestsドキュメントに直接保存（private subcollectionへの分離はPhase 2）
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
