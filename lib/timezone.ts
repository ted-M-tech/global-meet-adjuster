import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ja, enUS } from 'date-fns/locale';
import type { Locale } from '@/types';

export const COMMON_TIMEZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Atlantic/Reykjavik',
  'Europe/London',
  'Europe/Paris',
  'Europe/Helsinki',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

const localeMap = {
  ja,
  en: enUS,
} as const;

/**
 * Detect browser timezone.
 * Must be called on client side only.
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a UTC date in a specific timezone.
 */
export function formatInTz(
  utcDate: Date,
  timezone: string,
  formatStr: string,
  locale: Locale = 'ja'
): string {
  return formatInTimeZone(utcDate, timezone, formatStr, {
    locale: localeMap[locale],
  });
}

/**
 * Format date for display in voting table.
 * Example (ja): "3/15 (土) 19:00"
 * Example (en): "Mar 15 (Sat) 7:00 PM"
 */
export function formatCandidateDate(
  utcDate: Date,
  timezone: string,
  locale: Locale = 'ja'
): string {
  const formatStr =
    locale === 'ja' ? 'M/d (EEE) HH:mm' : 'MMM d (EEE) h:mm a';
  return formatInTz(utcDate, timezone, formatStr, locale);
}

/**
 * Format full date for event detail view.
 * Example (ja): "2026年3月15日 (土) 19:00 - 20:00"
 * Example (en): "March 15, 2026 (Sat) 7:00 PM - 8:00 PM"
 */
export function formatCandidateDateFull(
  start: Date,
  end: Date,
  timezone: string,
  locale: Locale = 'ja'
): string {
  if (locale === 'ja') {
    const datePart = formatInTz(start, timezone, 'yyyy年M月d日 (EEE)', locale);
    const startTime = formatInTz(start, timezone, 'HH:mm', locale);
    const endTime = formatInTz(end, timezone, 'HH:mm', locale);
    return `${datePart} ${startTime} - ${endTime}`;
  }

  const datePart = formatInTz(start, timezone, 'MMMM d, yyyy (EEE)', locale);
  const startTime = formatInTz(start, timezone, 'h:mm a', locale);
  const endTime = formatInTz(end, timezone, 'h:mm a', locale);
  return `${datePart} ${startTime} - ${endTime}`;
}

/**
 * Get dual timezone display (guest local + host).
 */
export function formatDualTimezone(
  utcDate: Date,
  guestTz: string,
  hostTz: string,
  locale: Locale = 'ja'
): { guestTime: string; hostTime: string } {
  return {
    guestTime: formatCandidateDate(utcDate, guestTz, locale),
    hostTime: formatCandidateDate(utcDate, hostTz, locale),
  };
}

/**
 * Get a human-readable timezone name.
 * Example: "Asia/Tokyo" → "日本標準時 (JST)" or "Japan Standard Time (JST)"
 */
export function getTimezoneName(timezone: string, locale: Locale = 'ja'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    timeZone: timezone,
    timeZoneName: 'long',
  });
  const parts = formatter.formatToParts(new Date());
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || timezone;

  const shortFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  const shortParts = shortFormatter.formatToParts(new Date());
  const shortTz = shortParts.find((p) => p.type === 'timeZoneName')?.value || '';

  return `${tzName} (${shortTz})`;
}

/**
 * Get short timezone abbreviation.
 * Example: "America/Los_Angeles" → "PST", "Asia/Tokyo" → "JST"
 */
export function getTimezoneAbbr(timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  return fmt.formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value || timezone;
}
