'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ja, enUS } from 'date-fns/locale';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { TimeGridDesktop } from './time-grid-desktop';
import { TimeGridMobile } from './time-grid-mobile';
import type { Candidate, Duration } from '@/types';

interface TimeGridPickerProps {
  candidates: Candidate[];
  duration: Duration;
  onAdd: (start: Date, end: Date) => void;
  onRemove: (id: string) => void;
}

// --- Utilities ---

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function slotToDate(day: Date, slotIndex: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(slotIndex / 2), (slotIndex % 2) * 30, 0, 0);
  return d;
}

function buildSelectionMap(candidates: Candidate[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of candidates) {
    const dayKey = formatDayKey(c.start);
    const startSlot =
      c.start.getHours() * 2 + Math.floor(c.start.getMinutes() / 30);

    const endDayKey = formatDayKey(c.end);
    let endSlot: number;
    if (endDayKey === dayKey) {
      endSlot =
        c.end.getHours() * 2 + Math.floor(c.end.getMinutes() / 30);
    } else {
      endSlot = 48;
    }

    for (let s = startSlot; s < endSlot; s++) {
      map.set(`${dayKey}:${s}`, c.id);
    }
  }
  return map;
}

// --- Component ---

export function TimeGridPicker({
  candidates,
  duration,
  onAdd,
  onRemove,
}: TimeGridPickerProps) {
  const t = useTranslations('event.create');
  const locale = useLocale();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const selectionMap = useMemo(() => buildSelectionMap(candidates), [candidates]);

  // Sort selected dates chronologically
  const sortedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );

  const dayKeys = useMemo(
    () => sortedDates.map((d) => formatDayKey(d)),
    [sortedDates]
  );

  // Auto-add dates from existing candidates
  useEffect(() => {
    const candidateDayKeys = new Set(
      candidates.map((c) => formatDayKey(c.start))
    );

    setSelectedDates((prev) => {
      const existingKeys = new Set(prev.map((d) => formatDayKey(d)));
      const missing = [...candidateDayKeys].filter(
        (dk) => !existingKeys.has(dk)
      );
      if (missing.length === 0) return prev;

      const newDates = missing.map((dk) => {
        const c = candidates.find((c) => formatDayKey(c.start) === dk)!;
        const d = new Date(c.start);
        d.setHours(0, 0, 0, 0);
        return d;
      });
      return [...prev, ...newDates];
    });
  }, [candidates]);

  // Past date check for calendar
  const isPastDate = useCallback((d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }, []);

  // Past slot check for grid cells
  const isPastSlot = useCallback((dayKey: string, slot: number) => {
    const now = new Date();
    const todayKey = formatDayKey(now);
    if (dayKey !== todayKey) return false;
    const currentSlot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
    return slot <= currentSlot;
  }, []);

  // Calendar multi-select handler
  const handleDatesChange = useCallback(
    (dates: Date[] | undefined) => {
      const newDates = dates || [];

      // Block removal of dates that have candidates
      const removedDates = selectedDates.filter(
        (sd) => !newDates.some((nd) => formatDayKey(nd) === formatDayKey(sd))
      );
      for (const rd of removedDates) {
        const rdKey = formatDayKey(rd);
        const hasCandidates = candidates.some(
          (c) => formatDayKey(c.start) === rdKey
        );
        if (hasCandidates) {
          toast.warning(t('timeGrid.hasCandidate'));
          return;
        }
      }

      // Sort chronologically
      newDates.sort((a, b) => a.getTime() - b.getTime());

      // If a date was added, navigate to it on mobile
      if (newDates.length > selectedDates.length) {
        const addedDate = newDates.find(
          (nd) =>
            !selectedDates.some(
              (sd) => formatDayKey(sd) === formatDayKey(nd)
            )
        );
        if (addedDate) {
          const idx = newDates.findIndex(
            (d) => formatDayKey(d) === formatDayKey(addedDate)
          );
          setActiveDayIndex(idx);
        }
      } else if (newDates.length < selectedDates.length) {
        setActiveDayIndex((prev) =>
          Math.min(prev, Math.max(0, newDates.length - 1))
        );
      }

      setSelectedDates(newDates);
    },
    [selectedDates, candidates, t]
  );

  // Convert grid slot selection to Date range and validate
  const handleGridAdd = useCallback(
    (dayKey: string, startSlot: number, endSlot: number) => {
      const day = sortedDates.find((d) => formatDayKey(d) === dayKey);
      if (!day) return;

      const start = slotToDate(day, startSlot);
      const end = slotToDate(day, endSlot);

      // Past time check
      if (start <= new Date()) {
        toast.warning(t('timeGrid.pastTime'));
        return;
      }

      // Overlap check
      const hasOverlap = candidates.some(
        (c) => start < c.end && end > c.start
      );
      if (hasOverlap) {
        toast.warning(t('timeGrid.overlap'));
        return;
      }

      onAdd(start, end);
    },
    [sortedDates, candidates, onAdd, t]
  );

  // Format day header based on locale
  const formatDayHeader = useCallback(
    (date: Date) => {
      return format(date, locale === 'ja' ? 'M/d (EEE)' : 'MMM d (EEE)', {
        locale: locale === 'ja' ? ja : enUS,
      });
    },
    [locale]
  );

  return (
    <div className="space-y-3">
      <div className="md:flex md:gap-6">
        {/* Calendar */}
        <div className="shrink-0">
          <Calendar
            mode="multiple"
            selected={sortedDates}
            onSelect={handleDatesChange}
            disabled={isPastDate}
            locale={locale === 'ja' ? ja : enUS}
          />
        </div>

        {/* Desktop grid */}
        <div className="hidden md:block flex-1 min-w-0">
          {sortedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t('timeGrid.selectDates')}
            </p>
          ) : (
            <TimeGridDesktop
              selectedDates={sortedDates}
              selectionMap={selectionMap}
              dayKeys={dayKeys}
              onAdd={handleGridAdd}
              onRemove={onRemove}
              formatDayHeader={formatDayHeader}
              isPastSlot={isPastSlot}
            />
          )}
        </div>
      </div>

      {/* Mobile grid */}
      <div className="md:hidden">
        {sortedDates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('timeGrid.selectDates')}
          </p>
        ) : (
          <TimeGridMobile
            selectedDates={sortedDates}
            selectionMap={selectionMap}
            dayKeys={dayKeys}
            duration={duration}
            activeDayIndex={activeDayIndex}
            onDayChange={setActiveDayIndex}
            onAdd={handleGridAdd}
            onRemove={onRemove}
            formatDayHeader={formatDayHeader}
            isPastSlot={isPastSlot}
          />
        )}
      </div>
    </div>
  );
}
