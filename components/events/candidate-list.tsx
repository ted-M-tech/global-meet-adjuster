'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCandidateDateFull } from '@/lib/timezone';
import { getBrowserTimezone } from '@/lib/timezone';
import type { Candidate, Locale } from '@/types';

interface CandidateListProps {
  candidates: Candidate[];
  onRemove: (id: string) => void;
  timezone?: string;
}

export function CandidateList({ candidates, onRemove, timezone }: CandidateListProps) {
  const t = useTranslations('event.create');
  const locale = useLocale() as Locale;
  const tz = timezone || getBrowserTimezone();

  const sorted = useMemo(
    () => [...candidates].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [candidates]
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t('noCandidates')}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sorted.map((candidate) => (
        <li
          key={candidate.id}
          className="flex items-center justify-between rounded-md border px-3 py-2"
        >
          <span className="text-sm">
            {formatCandidateDateFull(candidate.start, candidate.end, tz, locale)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onRemove(candidate.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
