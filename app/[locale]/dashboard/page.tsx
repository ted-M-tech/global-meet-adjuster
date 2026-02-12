'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/providers/auth-provider';
import { AuthGuard } from '@/components/auth/auth-guard';
import { EventCard } from '@/components/events/event-card';
import { Button } from '@/components/ui/button';
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

function DashboardContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'events'),
      where('hostId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map((doc) =>
        parseEvent(doc.id, doc.data())
      );
      setEvents(eventList);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsub;
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <Button onClick={() => router.push(`/${locale}/events/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.createNew')}
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">{t('dashboard.empty')}</p>
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/events/new`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('dashboard.createNew')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
