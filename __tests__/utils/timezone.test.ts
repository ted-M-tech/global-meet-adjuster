import { describe, it, expect, vi } from 'vitest';
import {
  formatInTz,
  formatCandidateDate,
  formatCandidateDateFull,
  formatDualTimezone,
  getBrowserTimezone,
  getTimezoneName,
} from '@/lib/timezone';

describe('formatInTz', () => {
  it('formats UTC date in JST (Asia/Tokyo, +9)', () => {
    // 2026-03-15 10:00 UTC → 2026-03-15 19:00 JST
    const utcDate = new Date('2026-03-15T10:00:00Z');
    const result = formatInTz(utcDate, 'Asia/Tokyo', 'HH:mm');
    expect(result).toBe('19:00');
  });

  it('formats with negative offset (America/New_York)', () => {
    // 2026-03-15 10:00 UTC → 2026-03-15 06:00 EDT (DST active in March)
    const utcDate = new Date('2026-03-15T10:00:00Z');
    const result = formatInTz(utcDate, 'America/New_York', 'HH:mm');
    expect(result).toBe('06:00');
  });

  it('handles date boundary crossing', () => {
    // 2026-03-15 23:00 UTC → 2026-03-16 08:00 JST
    const utcDate = new Date('2026-03-15T23:00:00Z');
    const result = formatInTz(utcDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    expect(result).toBe('2026-03-16 08:00');
  });

  it('uses en locale when specified', () => {
    const utcDate = new Date('2026-03-15T10:00:00Z');
    const result = formatInTz(utcDate, 'Asia/Tokyo', 'EEEE', 'en');
    expect(result).toBe('Sunday');
  });
});

describe('formatCandidateDate', () => {
  const utcDate = new Date('2026-03-15T10:00:00Z');

  it('formats in Japanese locale', () => {
    const result = formatCandidateDate(utcDate, 'Asia/Tokyo', 'ja');
    // 19:00 JST, March 15 is Sunday
    expect(result).toMatch(/3\/15/);
    expect(result).toMatch(/19:00/);
  });

  it('formats in English locale', () => {
    const result = formatCandidateDate(utcDate, 'Asia/Tokyo', 'en');
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/7:00 PM/);
  });
});

describe('formatCandidateDateFull', () => {
  const start = new Date('2026-03-15T10:00:00Z');
  const end = new Date('2026-03-15T11:00:00Z');

  it('formats full date range in Japanese', () => {
    const result = formatCandidateDateFull(start, end, 'Asia/Tokyo', 'ja');
    expect(result).toContain('2026年3月15日');
    expect(result).toContain('19:00');
    expect(result).toContain('20:00');
    expect(result).toContain(' - ');
  });

  it('formats full date range in English', () => {
    const result = formatCandidateDateFull(start, end, 'Asia/Tokyo', 'en');
    expect(result).toContain('March 15, 2026');
    expect(result).toContain('7:00 PM');
    expect(result).toContain('8:00 PM');
    expect(result).toContain(' - ');
  });
});

describe('formatDualTimezone', () => {
  it('returns both guest and host times', () => {
    const utcDate = new Date('2026-03-15T10:00:00Z');
    const result = formatDualTimezone(utcDate, 'America/New_York', 'Asia/Tokyo', 'ja');
    expect(result).toHaveProperty('guestTime');
    expect(result).toHaveProperty('hostTime');
    // Guest (New York) and Host (Tokyo) should differ
    expect(result.guestTime).not.toBe(result.hostTime);
  });
});

describe('getBrowserTimezone', () => {
  it('returns a timezone string from Intl', () => {
    // jsdom provides Intl
    const result = getBrowserTimezone();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getTimezoneName', () => {
  it('returns long name with short abbreviation for Asia/Tokyo', () => {
    const result = getTimezoneName('Asia/Tokyo', 'ja');
    // Should contain something like "日本標準時 (JST)"
    expect(result).toContain('(');
    expect(result).toContain(')');
  });

  it('returns English name for en locale', () => {
    const result = getTimezoneName('Asia/Tokyo', 'en');
    expect(result).toContain('(');
    expect(result).toContain(')');
  });
});
