'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatInTz, getBrowserTimezone } from '@/lib/timezone';
import type { Candidate, VoteStatus, Locale } from '@/types';
import type { CandidateVoteSummary } from '@/lib/voting-grid-utils';

interface CandidatePopoverProps {
  candidate: Candidate;
  hostTimezone: string;
  summary: CandidateVoteSummary;
  isEditing: boolean;
  myVote?: VoteStatus;
  onVote?: (candidateId: string, status: VoteStatus | undefined) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const statusStyle: Record<VoteStatus, string> = {
  ok: 'text-green-600 font-bold',
  maybe: 'text-yellow-600 font-bold',
  ng: 'text-red-600 font-bold',
};

const statusLabel: Record<VoteStatus, string> = {
  ok: '◯',
  maybe: '△',
  ng: '×',
};

const voteButtonConfig: { status: VoteStatus; labelKey: 'okLabel' | 'maybeLabel' | 'ngLabel'; activeClass: string }[] = [
  { status: 'ok', labelKey: 'okLabel', activeClass: 'border-green-500 bg-green-50 text-green-600' },
  { status: 'maybe', labelKey: 'maybeLabel', activeClass: 'border-yellow-500 bg-yellow-50 text-yellow-600' },
  { status: 'ng', labelKey: 'ngLabel', activeClass: 'border-red-500 bg-red-50 text-red-600' },
];

function formatTimeRange(candidate: Candidate, locale: Locale): string {
  const tz = getBrowserTimezone();
  const fmt = locale === 'ja' ? 'HH:mm' : 'h:mm a';
  const start = formatInTz(candidate.start, tz, fmt, locale);
  const end = formatInTz(candidate.end, tz, fmt, locale);
  return `${start} - ${end}`;
}

function formatDuration(candidate: Candidate): number {
  return Math.round((candidate.end.getTime() - candidate.start.getTime()) / (1000 * 60));
}

function formatDateHeader(candidate: Candidate, locale: Locale): string {
  const tz = getBrowserTimezone();
  const fmt = locale === 'ja' ? 'M/d (EEE)' : 'MMM d (EEE)';
  return formatInTz(candidate.start, tz, fmt, locale);
}

/** Shared popover content used by both hover and click modes */
function PopoverBody({
  candidate,
  hostTimezone,
  summary,
  isEditing,
  myVote,
  onVote,
  locale,
}: {
  candidate: Candidate;
  hostTimezone: string;
  summary: CandidateVoteSummary;
  isEditing: boolean;
  myVote?: VoteStatus;
  onVote?: (candidateId: string, status: VoteStatus | undefined) => void;
  locale: Locale;
}) {
  const t = useTranslations('voting');
  const durationMin = formatDuration(candidate);
  const timeRange = formatTimeRange(candidate, locale);
  const dateHeader = formatDateHeader(candidate, locale);

  const isSameTz = getBrowserTimezone() === hostTimezone;
  const hostTimeRange = !isSameTz
    ? `${formatInTz(candidate.start, hostTimezone, locale === 'ja' ? 'HH:mm' : 'h:mm a', locale)} - ${formatInTz(candidate.end, hostTimezone, locale === 'ja' ? 'HH:mm' : 'h:mm a', locale)}`
    : null;

  return (
    <>
      {/* Header: date + time range + duration */}
      <div className="px-3 pt-3 pb-2 border-b">
        <div className="text-sm text-muted-foreground">{dateHeader}</div>
        <div className="font-medium">
          {timeRange}
          <span className="text-sm text-muted-foreground ml-2">({t('durationMinutes', { count: durationMin })})</span>
        </div>
        {hostTimeRange && (
          <div className="text-sm text-muted-foreground">
            ({hostTimeRange})
          </div>
        )}
        {summary.isBest && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
            <Star className="h-3 w-3 fill-amber-500" />
            <span>{t('bestCandidate')}</span>
          </div>
        )}
      </div>

      {/* Summary badges */}
      <div className="px-3 py-2 border-b flex items-center gap-2 text-sm">
        <span className="text-green-600">{t('ok')}{summary.okCount}</span>
        <span className="text-yellow-600">{t('maybe')}{summary.maybeCount}</span>
        <span className="text-red-600">{t('ng')}{summary.ngCount}</span>
      </div>

      {/* Respondent list */}
      <div className="px-3 py-2 border-b max-h-40 overflow-y-auto">
        {summary.respondents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noResponses')}</p>
        ) : (
          <div className="space-y-1">
            {summary.respondents.map((r) => (
              <div
                key={r.guestId}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate mr-2">{r.name}</span>
                <span className={statusStyle[r.status]}>
                  {statusLabel[r.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voting buttons (editing mode only) */}
      {isEditing && onVote && (
        <div className="px-3 py-2 flex items-center gap-2">
          {voteButtonConfig.map(({ status, labelKey, activeClass }) => (
            <Button
              key={status}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'flex-1 text-xs',
                myVote === status && activeClass
              )}
              onClick={() => {
                onVote(candidate.id, myVote === status ? undefined : status);
              }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

export function CandidatePopover({
  candidate,
  hostTimezone,
  summary,
  isEditing,
  myVote,
  onVote,
  open,
  onOpenChange,
  children,
}: CandidatePopoverProps) {
  const locale = useLocale() as Locale;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <PopoverBody
          candidate={candidate}
          hostTimezone={hostTimezone}
          summary={summary}
          isEditing={isEditing}
          myVote={myVote}
          onVote={onVote}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}
