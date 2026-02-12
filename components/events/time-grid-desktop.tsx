'use client';

import { useEffect, useRef } from 'react';
import { useTimeGridDrag } from '@/hooks/use-time-grid-drag';
import { cn } from '@/lib/utils';

interface TimeGridDesktopProps {
  selectedDates: Date[];
  selectionMap: Map<string, string>;
  dayKeys: string[];
  onAdd: (dayKey: string, startSlot: number, endSlot: number) => void;
  onRemove: (id: string) => void;
  formatDayHeader: (date: Date) => string;
  isPastSlot: (dayKey: string, slot: number) => boolean;
}

const TOTAL_SLOTS = 48;
const SLOT_HEIGHT = 28;
const INITIAL_SCROLL_SLOT = 16; // 8:00 - scroll a bit above 9:00

function formatTimeLabel(slot: number): string {
  const h = Math.floor(slot / 2);
  return `${String(h).padStart(2, '0')}:00`;
}

export function TimeGridDesktop({
  selectedDates,
  selectionMap,
  dayKeys,
  onAdd,
  onRemove,
  formatDayHeader,
  isPastSlot,
}: TimeGridDesktopProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragPreview, handleCellMouseDown, handleCellMouseEnter, isDragging } =
    useTimeGridDrag({ selectionMap, onAdd, onRemove });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = INITIAL_SCROLL_SLOT * SLOT_HEIGHT;
    }
  }, []);

  if (selectedDates.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'overflow-y-auto overflow-x-auto max-h-[500px] border rounded-md',
        isDragging && 'select-none'
      )}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `56px repeat(${selectedDates.length}, minmax(80px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="sticky top-0 left-0 z-30 bg-background border-b border-r" />
        {selectedDates.map((date, i) => (
          <div
            key={`header-${dayKeys[i]}`}
            className="sticky top-0 z-20 bg-background border-b px-1 py-2 text-center text-xs font-medium truncate"
          >
            {formatDayHeader(date)}
          </div>
        ))}

        {/* Time slots */}
        {Array.from({ length: TOTAL_SLOTS }).flatMap((_, slot) => [
          <div
            key={`time-${slot}`}
            className={cn(
              'sticky left-0 z-10 bg-background border-r text-[11px] text-muted-foreground pr-2 flex items-start justify-end',
              slot % 2 === 0 && 'border-t border-t-border/40'
            )}
            style={{ height: SLOT_HEIGHT }}
          >
            {slot % 2 === 0 && (
              <span className={slot > 0 ? '-translate-y-1/2' : 'translate-y-0.5'}>{formatTimeLabel(slot)}</span>
            )}
          </div>,
          ...dayKeys.map((dayKey) => {
            const cellKey = `${dayKey}:${slot}`;
            const candidateId = selectionMap.get(cellKey);
            const isSelected = !!candidateId;
            const past = isPastSlot(dayKey, slot);

            const isPreview =
              dragPreview &&
              dragPreview.dayKey === dayKey &&
              slot >= dragPreview.startSlot &&
              slot < dragPreview.endSlot;

            // Block start/end detection for rounded corners
            const prevId = selectionMap.get(`${dayKey}:${slot - 1}`);
            const nextId = selectionMap.get(`${dayKey}:${slot + 1}`);
            const isBlockStart = isSelected && prevId !== candidateId;
            const isBlockEnd = isSelected && nextId !== candidateId;

            return (
              <div
                key={cellKey}
                className={cn(
                  'border-r relative',
                  slot % 2 === 0
                    ? 'border-t border-t-border/40'
                    : 'border-t border-t-border/15',
                  past && 'bg-muted/40 cursor-not-allowed',
                  !isSelected && !isPreview && !past && 'cursor-pointer hover:bg-accent/50'
                )}
                style={{ height: SLOT_HEIGHT }}
                onMouseDown={(e) =>
                  !past && handleCellMouseDown(dayKey, slot, e)
                }
                onMouseEnter={() => handleCellMouseEnter(dayKey, slot)}
              >
                {isSelected && (
                  <div
                    className={cn(
                      'absolute inset-x-0.5 bg-primary/25 border border-primary/40',
                      isBlockStart ? 'top-0 rounded-t-sm' : 'top-0 -top-px border-t-0',
                      isBlockEnd ? 'bottom-0 rounded-b-sm' : 'bottom-0 -bottom-px border-b-0'
                    )}
                  />
                )}
                {isPreview && !isSelected && (
                  <div className="absolute inset-x-0.5 inset-y-0 bg-primary/10 rounded-sm" />
                )}
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
}
