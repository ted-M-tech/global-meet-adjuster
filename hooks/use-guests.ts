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
    answers: (data.answers as Answer[]) || [],
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
