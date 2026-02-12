'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { EventDocument } from '@/types';

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
