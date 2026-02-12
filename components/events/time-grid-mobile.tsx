'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useTimeGridTouch } from '@/hooks/use-time-grid-touch';
import { cn } from '@/lib/utils';

interface TimeGridMobileProps {
  selectedDates: Date[];
  selectionMap: Map<string, string>;
  dayKeys: string[];
  duration: number;
  activeDayIndex: number;
  onDayChange: (index: number) => void;
  onAdd: (dayKey: string, startSlot: number, endSlot: number) => void;
  onRemove: (id: string) => void;
  formatDayHeader: (date: Date) => string;
  isPastSlot: (dayKey: string, slot: number) => boolean;
}

const TOTAL_SLOTS = 48;
const SLOT_HEIGHT = 44;
const INITIAL_SCROLL_SLOT = 16;

function formatTimeLabel(slot: number): string {
  const h = Math.floor(slot / 2);
  return `${String(h).padStart(2, '0')}:00`;
}

export function TimeGridMobile({
  selectedDates,
  selectionMap,
  dayKeys,
  duration,
  activeDayIndex,
  onDayChange,
  onAdd,
  onRemove,
  formatDayHeader,
  isPastSlot,
}: TimeGridMobileProps) {
  const t = useTranslations('event.create.timeGrid');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { handleCellClick } = useTimeGridTouch({
    selectionMap,
    duration,
    onAdd,
    onRemove,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = INITIAL_SCROLL_SLOT * SLOT_HEIGHT;
    }
  }, [activeDayIndex]);

  if (selectedDates.length === 0) {
    return null;
  }

  const safeIndex = Math.min(activeDayIndex, selectedDates.length - 1);
  const activeDate = selectedDates[safeIndex];
  const activeDayKey = dayKeys[safeIndex];

  return (
    <div>
      {/* Day navigator */}
      <div className="flex items-center justify-between py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={safeIndex === 0}
          onClick={() => onDayChange(safeIndex - 1)}
          aria-label={t('prevDay')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {formatDayHeader(activeDate)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={safeIndex >= selectedDates.length - 1}
          onClick={() => onDayChange(safeIndex + 1)}
          aria-label={t('nextDay')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[60vh] border rounded-md"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: '56px 1fr',
          }}
        >
          {Array.from({ length: TOTAL_SLOTS }).flatMap((_, slot) => {
            const cellKey = `${activeDayKey}:${slot}`;
            const candidateId = selectionMap.get(cellKey);
            const isSelected = !!candidateId;
            const past = isPastSlot(activeDayKey, slot);

            const prevId = selectionMap.get(`${activeDayKey}:${slot - 1}`);
            const nextId = selectionMap.get(`${activeDayKey}:${slot + 1}`);
            const isBlockStart = isSelected && prevId !== candidateId;
            const isBlockEnd = isSelected && nextId !== candidateId;

            return [
              <div
                key={`time-${slot}`}
                className={cn(
                  'border-r text-xs text-muted-foreground pr-2 flex items-start justify-end',
                  slot % 2 === 0 && 'border-t border-t-border/40'
                )}
                style={{ height: SLOT_HEIGHT }}
              >
                {slot % 2 === 0 && (
                  <span className={slot > 0 ? '-translate-y-1/2' : 'translate-y-0.5'}>
                    {formatTimeLabel(slot)}
                  </span>
                )}
              </div>,
              <div
                key={cellKey}
                className={cn(
                  'relative',
                  slot % 2 === 0
                    ? 'border-t border-t-border/40'
                    : 'border-t border-t-border/15',
                  past && 'bg-muted/40',
                  !isSelected && !past && 'active:bg-accent/50'
                )}
                style={{ height: SLOT_HEIGHT }}
                onClick={() => !past && handleCellClick(activeDayKey, slot)}
              >
                {isSelected && (
                  <div
                    className={cn(
                      'absolute inset-x-1 bg-primary/25 border border-primary/40',
                      isBlockStart
                        ? 'top-0 rounded-t-sm'
                        : 'top-0 -top-px border-t-0',
                      isBlockEnd
                        ? 'bottom-0 rounded-b-sm'
                        : 'bottom-0 -bottom-px border-b-0'
                    )}
                  />
                )}
              </div>,
            ];
          })}
        </div>
      </div>
    </div>
  );
}
