'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DualTimeDisplay } from '@/components/timezone/dual-time-display';
import { VotingButton } from './voting-button';
import { VotingSummary } from './voting-summary';
import { cn } from '@/lib/utils';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';

interface VotingTableProps {
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  editingGuestId: string | null;
  onAnswerChange?: (candidateId: string, status: VoteStatus | undefined) => void;
  editingAnswers?: Record<string, VoteStatus>;
  onGuestClick?: (guestId: string) => void;
  fixedCandidateId?: string;
}

export function VotingTable({
  candidates,
  guests,
  hostTimezone,
  editingGuestId,
  onAnswerChange,
  editingAnswers,
  onGuestClick,
  fixedCandidateId,
}: VotingTableProps) {
  const t = useTranslations('voting');

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">
              {t('summary')}
            </TableHead>
            {candidates.map((candidate) => (
              <TableHead
                key={candidate.id}
                className={cn(
                  'text-center min-w-[100px]',
                  fixedCandidateId === candidate.id && 'bg-green-50'
                )}
              >
                <DualTimeDisplay
                  utcDate={candidate.start}
                  hostTimezone={hostTimezone}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <VotingSummary candidates={candidates} guests={guests} />

          {guests.map((guest) => (
            <TableRow
              key={guest.id}
              className={cn(
                guest.id !== editingGuestId && onGuestClick && 'cursor-pointer hover:bg-muted/50',
                guest.id === editingGuestId && 'bg-blue-50'
              )}
              onClick={() => {
                if (guest.id !== editingGuestId && onGuestClick) {
                  onGuestClick(guest.id);
                }
              }}
            >
              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                {guest.name}
              </TableCell>
              {candidates.map((candidate) => {
                const answer =
                  guest.id === editingGuestId
                    ? editingAnswers?.[candidate.id]
                    : guest.answers.find(
                        (a) => a.candidateId === candidate.id
                      )?.status;

                return (
                  <TableCell
                    key={candidate.id}
                    className={cn(
                      'text-center',
                      fixedCandidateId === candidate.id && 'bg-green-50'
                    )}
                  >
                    {guest.id === editingGuestId ? (
                      <VotingButton
                        status={answer}
                        onChange={(status) =>
                          onAnswerChange?.(candidate.id, status)
                        }
                      />
                    ) : (
                      <span className={getStatusStyle(answer)}>
                        {getStatusLabel(answer, t)}
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getStatusStyle(status?: VoteStatus): string {
  switch (status) {
    case 'ok':
      return 'text-green-600 font-bold';
    case 'maybe':
      return 'text-yellow-600 font-bold';
    case 'ng':
      return 'text-red-600 font-bold';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusLabel(
  status: VoteStatus | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'ok':
      return t('ok');
    case 'maybe':
      return t('maybe');
    case 'ng':
      return t('ng');
    default:
      return t('noAnswer');
  }
}
