'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCandidateDateFull } from '@/lib/timezone';
import type { EventDocument, Locale } from '@/types';

interface EventCardProps {
  event: EventDocument;
}

export function EventCard({ event }: EventCardProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const fixedCandidate = event.fixedCandidateId
    ? event.candidates.find((c) => c.id === event.fixedCandidateId)
    : null;

  return (
    <Link href={`/${locale}/events/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-1">
              {event.title}
            </CardTitle>
            <Badge
              variant={event.status === 'fixed' ? 'default' : 'secondary'}
            >
              {t(`status.${event.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {fixedCandidate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatCandidateDateFull(
                    fixedCandidate.start,
                    fixedCandidate.end,
                    event.timezone,
                    locale
                  )}
                </span>
              </div>
            )}
            <div>
              {locale === 'ja'
                ? `候補日: ${event.candidates.length}件`
                : `${event.candidates.length} candidate(s)`}
            </div>
            <div className="text-xs">
              {event.createdAt.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
