'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Duration } from '@/types';

interface CandidatePickerProps {
  duration: Duration;
  onAdd: (start: Date, end: Date) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 15, 30, 45];

export function CandidatePicker({ duration, onAdd }: CandidatePickerProps) {
  const t = useTranslations('event.create');
  const locale = useLocale();
  const [date, setDate] = useState<Date | undefined>();
  const [hour, setHour] = useState<string>('9');
  const [minute, setMinute] = useState<string>('0');
  const [open, setOpen] = useState(false);

  const handleAdd = useCallback(() => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(parseInt(hour), parseInt(minute), 0, 0);

    const now = new Date();
    if (start <= now) return;

    const end = new Date(start.getTime() + duration * 60 * 1000);
    onAdd(start, end);
    setDate(undefined);
    setOpen(false);
  }, [date, hour, minute, duration, onAdd]);

  const isPastDate = useCallback((d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }, []);

  const isValidSelection = date && !isPastDate(date);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button">
          <Plus className="mr-2 h-4 w-4" />
          {t('addCandidate')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={isPastDate}
            locale={locale === 'ja' ? ja : enUS}
          />
          <div className="flex items-center gap-2 mt-3 px-1">
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hours.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">:</span>
            <Select value={minute} onValueChange={setMinute}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {String(m).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={!isValidSelection}
              className="ml-auto"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('addCandidate')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
