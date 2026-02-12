'use client';

import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { getTimezoneName } from '@/lib/timezone';
import type { Locale } from '@/types';

interface TimezoneBadgeProps {
  timezone: string;
  label?: string;
}

export function TimezoneBadge({ timezone, label }: TimezoneBadgeProps) {
  const locale = useLocale() as Locale;
  const name = getTimezoneName(timezone, locale);

  return (
    <Badge variant="outline" className="font-normal">
      {label && <span className="mr-1">{label}:</span>}
      {name}
    </Badge>
  );
}
