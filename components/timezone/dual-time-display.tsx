'use client';

import { useLocale } from 'next-intl';
import { formatDualTimezone, getBrowserTimezone } from '@/lib/timezone';
import type { Locale } from '@/types';

interface DualTimeDisplayProps {
  utcDate: Date;
  hostTimezone: string;
}

export function DualTimeDisplay({ utcDate, hostTimezone }: DualTimeDisplayProps) {
  const locale = useLocale() as Locale;
  const guestTz = getBrowserTimezone();
  const { guestTime, hostTime } = formatDualTimezone(
    utcDate,
    guestTz,
    hostTimezone,
    locale
  );

  const isSameTimezone = guestTz === hostTimezone;

  return (
    <div>
      <span className="font-medium">{guestTime}</span>
      {!isSameTimezone && (
        <span className="text-sm text-muted-foreground ml-2">
          ({hostTime})
        </span>
      )}
    </div>
  );
}
