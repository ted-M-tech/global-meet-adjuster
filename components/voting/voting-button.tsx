'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VoteStatus } from '@/types';

interface VotingButtonProps {
  status: VoteStatus | undefined;
  onChange: (status: VoteStatus | undefined) => void;
}

const cycleOrder: (VoteStatus | undefined)[] = ['ok', 'maybe', 'ng', undefined];

export function VotingButton({ status, onChange }: VotingButtonProps) {
  const t = useTranslations('voting');

  const handleClick = () => {
    const currentIndex = cycleOrder.indexOf(status);
    const nextIndex = (currentIndex + 1) % cycleOrder.length;
    onChange(cycleOrder[nextIndex]);
  };

  const label = getLabel(status, t);
  const style = getStyle(status);

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'min-w-[44px] min-h-[44px] text-lg font-bold',
        style
      )}
      onClick={handleClick}
      aria-label={label}
    >
      {label}
    </Button>
  );
}

function getLabel(
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

function getStyle(status: VoteStatus | undefined): string {
  switch (status) {
    case 'ok':
      return 'border-green-500 bg-green-50 text-green-600 hover:bg-green-100';
    case 'maybe':
      return 'border-yellow-500 bg-yellow-50 text-yellow-600 hover:bg-yellow-100';
    case 'ng':
      return 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100';
    default:
      return 'text-muted-foreground';
  }
}
