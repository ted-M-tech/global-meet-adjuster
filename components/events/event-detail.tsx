'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CheckCircle, Edit, Lock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '@/hooks/use-event';
import { useGuests } from '@/hooks/use-guests';
import { useAuth } from '@/providers/auth-provider';
import { VotingForm } from '@/components/voting/voting-form';
import { TimezoneBadge } from '@/components/timezone/timezone-badge';
import { FixEventDialog } from '@/components/events/fix-event-dialog';
import { DeleteEventDialog } from '@/components/events/delete-event-dialog';
import { formatCandidateDateFull, getBrowserTimezone, getTimezoneName } from '@/lib/timezone';
import { HOST_TOKEN_STORAGE_PREFIX } from '@/lib/constants';
import type { EventDocument, Locale } from '@/types';

interface EventDetailProps {
  initialEvent: EventDocument;
}

export function EventDetail({ initialEvent }: EventDetailProps) {
  const t = useTranslations('event.detail');
  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user } = useAuth();

  const { event: realtimeEvent } = useEvent(initialEvent.id);
  const { guests } = useGuests(initialEvent.id);

  const event = realtimeEvent || initialEvent;
  const isFixed = event.status === 'fixed';

  // Check host status: authenticated user OR guest host with token
  const [isHost, setIsHost] = useState(false);
  useEffect(() => {
    const isAuthHost = !!user && user.uid === event.hostId;
    const hostToken = localStorage.getItem(`${HOST_TOKEN_STORAGE_PREFIX}${event.id}`);
    setIsHost(isAuthHost || !!hostToken);
  }, [user, event.hostId, event.id]);

  const fixedCandidate = isFixed
    ? event.candidates.find((c) => c.id === event.fixedCandidateId)
    : null;

  const [showFixDialog, setShowFixDialog] = useState(false);

  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const defaultSecondaryTz = browserTz !== event.timezone ? event.timezone : null;
  const [secondaryTz, setSecondaryTz] = useState<string | null>(defaultSecondaryTz);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Fixed banner */}
      {isFixed && fixedCandidate && (
        <Card className="border-green-400 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">{t('fixedBanner')}</p>
              <p className="text-sm text-green-700">
                {t('confirmedDate')}:{' '}
                {formatCandidateDateFull(
                  fixedCandidate.start,
                  fixedCandidate.end,
                  event.timezone,
                  locale
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            {event.description && (
              <p className="text-muted-foreground">{event.description}</p>
            )}
          </div>
          <Badge variant={isFixed ? 'default' : 'secondary'}>
            {isFixed ? (
              <>
                <Lock className="mr-1 h-3 w-3" />
                {tDashboard('status.fixed')}
              </>
            ) : (
              tDashboard('status.planning')
            )}
          </Badge>
        </div>

        {/* Timezone info */}
        <div className="flex flex-wrap gap-2">
          <TimezoneBadge
            timezone={event.timezone}
            label={t('hostTimezone')}
          />
          <TimezoneBadge
            timezone={getBrowserTimezone()}
            label={t('yourTimezone')}
          />
        </div>
      </div>

      {/* Host actions */}
      {isHost && (
        <div className="flex flex-wrap gap-2">
          {!isFixed && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/${locale}/events/${event.id}/edit`)}
              >
                <Edit className="mr-1 h-4 w-4" />
                {t('editEvent')}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowFixDialog(true)}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {tCommon('confirm')}
              </Button>
            </>
          )}
          <DeleteEventDialog
            eventId={event.id}
            eventStatus={event.status}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
                {tCommon('delete')}
              </Button>
            }
          />
        </div>
      )}

      {/* Voting section */}
      <VotingForm
        eventId={event.id}
        candidates={event.candidates}
        guests={guests}
        hostTimezone={event.timezone}
        isFixed={isFixed}
        fixedCandidateId={event.fixedCandidateId}
        secondaryTz={secondaryTz}
        onSecondaryTzChange={setSecondaryTz}
      />

      {/* Fix event dialog */}
      {isHost && (
        <FixEventDialog
          open={showFixDialog}
          onOpenChange={setShowFixDialog}
          eventId={event.id}
          candidates={event.candidates}
          hostTimezone={event.timezone}
        />
      )}
    </div>
  );
}
