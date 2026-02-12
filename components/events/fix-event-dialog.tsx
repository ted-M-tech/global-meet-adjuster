'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCandidateDateFull } from '@/lib/timezone';
import { fixEvent } from '@/app/actions/event';
import type { Candidate, Locale } from '@/types';

interface FixEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  candidates: Candidate[];
  hostTimezone: string;
}

export function FixEventDialog({
  open,
  onOpenChange,
  eventId,
  candidates,
  hostTimezone,
}: FixEventDialogProps) {
  const t = useTranslations('event.fix');
  const tCommon = useTranslations('common');
  const tError = useTranslations('error');
  const locale = useLocale() as Locale;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedId) return;

    setLoading(true);
    try {
      const result = await fixEvent({ eventId, candidateId: selectedId });
      if (!result.success) {
        toast.error(tError('generic'));
        return;
      }
      onOpenChange(false);
    } catch {
      toast.error(tError('generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('message')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4 max-h-[300px] overflow-y-auto">
          {candidates.map((candidate) => (
            <Button
              key={candidate.id}
              type="button"
              variant={selectedId === candidate.id ? 'default' : 'outline'}
              className="justify-start text-left h-auto py-3"
              onClick={() => setSelectedId(candidate.id)}
            >
              {formatCandidateDateFull(
                candidate.start,
                candidate.end,
                hostTimezone,
                locale
              )}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || loading}
          >
            {loading ? '...' : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
