'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getBrowserTimezone, formatInTz, getTimezoneAbbr } from '@/lib/timezone';
import {
  TOTAL_SLOTS,
  DESKTOP_SLOT_HEIGHT,
  formatTimeLabel,
  getUniqueDayKeys,
  layoutBands,
  getBandColorClasses,
  getCandidateVoteSummary,
  getSecondaryTimeLabels,
} from '@/lib/voting-grid-utils';
import { CandidateBand } from './candidate-band';
import { CandidatePopover } from './candidate-popover';
import type { Candidate, GuestDocument, VoteStatus, Locale } from '@/types';

interface VotingTimeGridProps {
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  editingGuestId: string | null;
  onAnswerChange?: (candidateId: string, status: VoteStatus | undefined) => void;
  editingAnswers?: Record<string, VoteStatus>;
  fixedCandidateId?: string;
  isFixed: boolean;
  secondaryTz?: string | null;
}

const HEADER_HEIGHT = 36;

export function VotingTimeGrid({
  candidates,
  guests,
  hostTimezone,
  editingGuestId,
  onAnswerChange,
  editingAnswers,
  fixedCandidateId,
  isFixed,
  secondaryTz,
}: VotingTimeGridProps) {
  const t = useTranslations('voting');
  const locale = useLocale() as Locale;
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const dayKeys = useMemo(() => getUniqueDayKeys(candidates, browserTz), [candidates, browserTz]);
  const bands = useMemo(() => layoutBands(candidates, browserTz), [candidates, browserTz]);
  const realGuests = useMemo(() => guests.filter((g) => g.id !== '__new__'), [guests]);
  const isEditing = editingGuestId !== null;

  const primaryTzAbbr = useMemo(() => getTimezoneAbbr(browserTz), [browserTz]);
  const secondaryTzAbbr = useMemo(
    () => (secondaryTz ? getTimezoneAbbr(secondaryTz) : null),
    [secondaryTz]
  );
  const secondaryLabels = useMemo(
    () =>
      secondaryTz && dayKeys.length > 0
        ? getSecondaryTimeLabels(dayKeys[0], browserTz, secondaryTz)
        : null,
    [secondaryTz, dayKeys, browserTz]
  );

  useEffect(() => {
    const firstBand = document.querySelector('[data-first-band]');
    if (firstBand) {
      firstBand.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">{t('noCandidates')}</p>
    );
  }

  const formatDayHeader = (dayKey: string) => {
    const [year, month, day] = dayKey.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return formatInTz(date, browserTz, locale === 'ja' ? 'M/d (EEE)' : 'MMM d (EEE)', locale);
  };

  return (
    <div>
      {isEditing && (
        <p className="text-sm text-muted-foreground mb-2">{t('tapToVote')}</p>
      )}
      <div className="overflow-x-auto border rounded-md">
        <div className="flex min-w-fit">
          {/* Time label column */}
          <div className="w-14 flex-shrink-0 sticky left-0 z-10 bg-background">
            {/* Header with TZ abbreviation */}
            <div
              className="border-b border-r text-[10px] text-muted-foreground flex items-center justify-center"
              style={{ height: HEADER_HEIGHT }}
            >
              {primaryTzAbbr}
            </div>
            {/* Time labels */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
              <div
                key={`time-${slot}`}
                className={cn(
                  'border-r text-[11px] text-muted-foreground pr-2 flex items-start justify-end',
                  slot % 2 === 0 && 'border-t border-t-border/40'
                )}
                style={{ height: DESKTOP_SLOT_HEIGHT }}
              >
                {slot % 2 === 0 && (
                  <span className="-translate-y-1/2">{formatTimeLabel(slot)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayKeys.map((dayKey) => {
            const dayBands = bands.filter((b) => b.dayKey === dayKey);

            return (
              <div key={dayKey} className="flex-1 min-w-[100px]">
                {/* Day header */}
                <div
                  className="sticky top-0 z-20 bg-background border-b px-1 text-center text-xs font-medium truncate flex items-center justify-center"
                  style={{ height: HEADER_HEIGHT }}
                >
                  {formatDayHeader(dayKey)}
                </div>

                {/* Slots + bands container */}
                <div className="relative">
                  {/* Background slot cells */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
                    <div
                      key={`${dayKey}:${slot}`}
                      className={cn(
                        'border-r',
                        slot % 2 === 0
                          ? 'border-t border-t-border/40'
                          : 'border-t border-t-border/15'
                      )}
                      style={{ height: DESKTOP_SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Candidate bands (absolutely positioned) */}
                  {dayBands.map((band, bandIndex) => {
                    const summary = getCandidateVoteSummary(
                      band.candidate.id,
                      candidates,
                      realGuests
                    );
                    const colors = getBandColorClasses(
                      summary.okCount,
                      realGuests.length,
                      summary.isBest
                    );
                    const bandIsFixed = band.candidate.id === fixedCandidateId;
                    const myVote = editingAnswers?.[band.candidate.id];
                    const popoverKey = `${dayKey}-${band.candidate.id}`;
                    const isFirstBand = dayKey === dayKeys[0] && bandIndex === 0;

                    return (
                      <CandidatePopover
                        key={popoverKey}
                        candidate={band.candidate}
                        hostTimezone={hostTimezone}
                        summary={summary}
                        isEditing={isEditing && !isFixed}
                        myVote={myVote}
                        onVote={onAnswerChange}
                        open={openPopover === popoverKey}
                        onOpenChange={(open) =>
                          setOpenPopover(open ? popoverKey : null)
                        }
                      >
                        <CandidateBand
                          band={band}
                          slotHeight={DESKTOP_SLOT_HEIGHT}
                          colorClasses={colors}
                          okCount={summary.okCount}
                          maybeCount={summary.maybeCount}
                          ngCount={summary.ngCount}
                          isBest={summary.isBest}
                          isFixed={bandIsFixed}
                          myVote={myVote}
                          isEditing={isEditing}
                          {...(isFirstBand && { 'data-first-band': true })}
                        />
                      </CandidatePopover>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Secondary TZ label column (right side) */}
          {secondaryTz && secondaryLabels && (
            <div className="w-14 flex-shrink-0">
              {/* Header with TZ abbreviation */}
              <div
                className="border-b border-l text-[10px] text-muted-foreground flex items-center justify-center"
                style={{ height: HEADER_HEIGHT }}
              >
                {secondaryTzAbbr}
              </div>
              {/* Secondary time labels */}
              {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
                <div
                  key={`sec-${slot}`}
                  className={cn(
                    'border-l text-[11px] text-muted-foreground pl-2 flex items-start justify-start',
                    slot % 2 === 0 && 'border-t border-t-border/40'
                  )}
                  style={{ height: DESKTOP_SLOT_HEIGHT }}
                >
                  {slot % 2 === 0 && (
                    <span className="-translate-y-1/2">
                      {secondaryLabels[slot / 2]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
