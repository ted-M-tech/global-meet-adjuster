import { notFound, redirect } from 'next/navigation';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { EventForm } from '@/components/events/event-form';
import type { EventDocument, Candidate } from '@/types';

interface EditEventPageProps {
  params: Promise<{ locale: string; id: string }>;
}

function convertTimestamp(ts: unknown): Date {
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return (ts as Timestamp).toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { locale, id } = await params;

  if (!adminDb) {
    notFound();
  }

  const eventDoc = await adminDb.doc(`events/${id}`).get();
  if (!eventDoc.exists) {
    notFound();
  }

  const data = eventDoc.data()!;

  if (data.status === 'fixed') {
    redirect(`/${locale}/events/${id}`);
  }

  const candidates: Candidate[] = ((data.candidates as Array<Record<string, unknown>>) || []).map(
    (c) => ({
      id: c.id as string,
      start: convertTimestamp(c.start),
      end: convertTimestamp(c.end),
    })
  );

  const event: EventDocument = {
    id: eventDoc.id,
    hostId: data.hostId as string,
    title: data.title as string,
    description: (data.description as string) || '',
    duration: data.duration as EventDocument['duration'],
    timezone: data.timezone as string,
    candidates,
    status: data.status as EventDocument['status'],
    fixedCandidateId: data.fixedCandidateId as string | undefined,
    expiresAt: convertTimestamp(data.expiresAt),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  };

  return <EventForm mode="edit" event={event} />;
}
