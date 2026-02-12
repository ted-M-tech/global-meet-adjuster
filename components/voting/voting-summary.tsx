'use client';

import { useTranslations } from 'next-intl';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';

interface VotingSummaryProps {
  candidates: Candidate[];
  guests: GuestDocument[];
}

function countStatus(
  guests: GuestDocument[],
  candidateId: string,
  status: VoteStatus
): number {
  return guests.filter((g) =>
    g.answers.some(
      (a) => a.candidateId === candidateId && a.status === status
    )
  ).length;
}

function getBestCandidateId(
  candidates: Candidate[],
  guests: GuestDocument[]
): string | null {
  if (guests.length === 0) return null;

  let bestId: string | null = null;
  let bestOk = -1;

  for (const candidate of candidates) {
    const okCount = countStatus(guests, candidate.id, 'ok');
    if (okCount > bestOk) {
      bestOk = okCount;
      bestId = candidate.id;
    }
  }

  return bestOk > 0 ? bestId : null;
}

export function VotingSummary({ candidates, guests }: VotingSummaryProps) {
  const t = useTranslations('voting');
  const bestCandidateId = getBestCandidateId(candidates, guests);

  return (
    <TableRow className="bg-muted/50 font-medium">
      <TableCell className="sticky left-0 bg-muted/50 z-10">
        {t('summary')}
      </TableCell>
      {candidates.map((candidate) => {
        const okCount = countStatus(guests, candidate.id, 'ok');
        const maybeCount = countStatus(guests, candidate.id, 'maybe');
        const ngCount = countStatus(guests, candidate.id, 'ng');
        const isBest = candidate.id === bestCandidateId;

        return (
          <TableCell
            key={candidate.id}
            className={cn(
              'text-center',
              isBest && 'bg-green-50 ring-2 ring-green-300 ring-inset'
            )}
          >
            <div className="flex items-center justify-center gap-1.5 text-sm">
              <span className="text-green-600">{t('ok')}{okCount}</span>
              <span className="text-yellow-600">{t('maybe')}{maybeCount}</span>
              <span className="text-red-600">{t('ng')}{ngCount}</span>
            </div>
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export { countStatus, getBestCandidateId };
