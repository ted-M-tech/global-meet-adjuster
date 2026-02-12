import { notFound } from 'next/navigation';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { EventDetail } from '@/components/events/event-detail';
import type { EventDocument, Candidate } from '@/types';

interface EventPageProps {
  params: Promise<{ locale: string; id: string }>;
}

function convertTimestamp(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

async function getEvent(id: string): Promise<EventDocument | null> {
  try {
    if (!adminDb) return null;
    const doc = await adminDb.doc(`events/${id}`).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      id: doc.id,
      hostId: data.hostId as string,
      title: data.title as string,
      description: (data.description as string) || '',
      duration: data.duration as EventDocument['duration'],
      timezone: data.timezone as string,
      candidates: ((data.candidates as Array<Record<string, unknown>>) || []).map(
        (c): Candidate => ({
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
  } catch {
    return null;
  }
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return <EventDetail initialEvent={event} />;
}
