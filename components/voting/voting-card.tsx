'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DualTimeDisplay } from '@/components/timezone/dual-time-display';
import { VotingButton } from './voting-button';
import { cn } from '@/lib/utils';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';

interface VotingCardProps {
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  editingGuestId: string | null;
  onAnswerChange?: (candidateId: string, status: VoteStatus | undefined) => void;
  editingAnswers?: Record<string, VoteStatus>;
  onGuestClick?: (guestId: string) => void;
  fixedCandidateId?: string;
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

export function VotingCard({
  candidates,
  guests,
  hostTimezone,
  editingGuestId,
  onAnswerChange,
  editingAnswers,
  onGuestClick,
  fixedCandidateId,
}: VotingCardProps) {
  const t = useTranslations('voting');

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const okCount = countStatus(guests, candidate.id, 'ok');
        const maybeCount = countStatus(guests, candidate.id, 'maybe');
        const ngCount = countStatus(guests, candidate.id, 'ng');
        const isFixed = fixedCandidateId === candidate.id;

        return (
          <Card
            key={candidate.id}
            className={cn(isFixed && 'border-green-400 bg-green-50')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DualTimeDisplay
                  utcDate={candidate.start}
                  hostTimezone={hostTimezone}
                />
              </CardTitle>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-green-600">
                  {t('ok')} {okCount}
                </Badge>
                <Badge variant="secondary" className="text-yellow-600">
                  {t('maybe')} {maybeCount}
                </Badge>
                <Badge variant="secondary" className="text-red-600">
                  {t('ng')} {ngCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {guests.map((guest) => {
                  const answer =
                    guest.id === editingGuestId
                      ? editingAnswers?.[candidate.id]
                      : guest.answers.find(
                          (a) => a.candidateId === candidate.id
                        )?.status;

                  return (
                    <div
                      key={guest.id}
                      className={cn(
                        'flex items-center justify-between',
                        guest.id !== editingGuestId && onGuestClick && 'cursor-pointer hover:bg-muted/50 rounded px-2 py-1',
                        guest.id === editingGuestId && 'bg-blue-50 rounded px-2 py-1'
                      )}
                      onClick={() => {
                        if (guest.id !== editingGuestId && onGuestClick) {
                          onGuestClick(guest.id);
                        }
                      }}
                    >
                      <span className="text-sm">{guest.name}</span>
                      {guest.id === editingGuestId ? (
                        <VotingButton
                          status={answer}
                          onChange={(status) =>
                            onAnswerChange?.(candidate.id, status)
                          }
                        />
                      ) : (
                        <span className={getCardStatusStyle(answer)}>
                          {getCardStatusLabel(answer, t)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getCardStatusStyle(status?: VoteStatus): string {
  switch (status) {
    case 'ok':
      return 'text-green-600 font-bold text-sm';
    case 'maybe':
      return 'text-yellow-600 font-bold text-sm';
    case 'ng':
      return 'text-red-600 font-bold text-sm';
    default:
      return 'text-muted-foreground text-sm';
  }
}

function getCardStatusLabel(
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
