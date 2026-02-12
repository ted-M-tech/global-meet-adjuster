'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { LayoutBand, BandColorClasses } from '@/lib/voting-grid-utils';
import type { VoteStatus } from '@/types';

interface CandidateBandProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  band: LayoutBand;
  slotHeight: number;
  colorClasses: BandColorClasses;
  okCount: number;
  maybeCount: number;
  ngCount: number;
  isBest: boolean;
  isFixed: boolean;
  myVote?: VoteStatus;
  isEditing: boolean;
}

const voteLabels: Record<VoteStatus, string> = {
  ok: '◯',
  maybe: '△',
  ng: '×',
};

const voteColors: Record<VoteStatus, string> = {
  ok: 'bg-green-500 text-white',
  maybe: 'bg-yellow-500 text-white',
  ng: 'bg-red-500 text-white',
};

export const CandidateBand = forwardRef<HTMLButtonElement, CandidateBandProps>(
  function CandidateBand(
    {
      band,
      slotHeight,
      colorClasses,
      okCount,
      maybeCount,
      ngCount,
      isBest,
      isFixed,
      myVote,
      isEditing,
      className,
      style,
      ...props
    },
    ref
  ) {
    const t = useTranslations('voting');
    const top = band.startSlot * slotHeight;
    const height = (band.endSlot - band.startSlot) * slotHeight;
    const widthPercent = 100 / band.totalColumns;
    const leftPercent = band.column * widthPercent;
    const isCompact = height < slotHeight * 3;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'absolute rounded-md border text-left transition-all',
          'hover:brightness-95 cursor-pointer',
          colorClasses.bg,
          colorClasses.border,
          colorClasses.text,
          isFixed && 'border-green-500 border-2',
          isEditing && myVote && 'ring-2 ring-blue-400',
          className
        )}
        style={{
          top,
          height: Math.max(height, slotHeight),
          left: `calc(${leftPercent}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
          ...style,
        }}
        {...props}
      >
        <div className={cn('px-2 py-1 overflow-hidden h-full', isCompact ? 'flex items-center gap-1.5' : 'space-y-1')}>
          {/* Vote summary */}
          <div className="flex items-center gap-1.5 text-xs leading-tight flex-shrink-0">
            {isFixed && <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
            <span className="text-green-600 font-medium">{t('ok')}{okCount}</span>
            <span className="text-yellow-600 font-medium">{t('maybe')}{maybeCount}</span>
            <span className="text-red-600 font-medium">{t('ng')}{ngCount}</span>
          </div>

          {/* My vote badge (editing mode) */}
          {isEditing && myVote && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0',
              voteColors[myVote]
            )}>
              {voteLabels[myVote]}
            </span>
          )}
        </div>
      </button>
    );
  }
);
