import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Candidate, GuestDocument, VoteStatus } from '@/types';
import { countStatus, getBestCandidateId } from '@/components/voting/voting-summary';

// ============================================================
// Constants
// ============================================================

export const TOTAL_SLOTS = 48;
export const DESKTOP_SLOT_HEIGHT = 36;
export const MOBILE_SLOT_HEIGHT = 44;
export const INITIAL_SCROLL_SLOT = 16; // 8:00

// ============================================================
// Time formatting
// ============================================================

export function formatTimeLabel(slot: number): string {
  const h = Math.floor(slot / 2);
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Format a UTC date as a day key (YYYY-MM-DD) in the given timezone.
 */
export function formatDayKeyInTz(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Convert a UTC date to a slot index (0-47) in the given timezone.
 * Each slot represents 30 minutes.
 */
export function dateToSlot(date: Date, timezone: string): number {
  const hours = parseInt(formatInTimeZone(date, timezone, 'H'), 10);
  const minutes = parseInt(formatInTimeZone(date, timezone, 'm'), 10);
  return hours * 2 + Math.floor(minutes / 30);
}

// ============================================================
// Day grouping
// ============================================================

export function groupCandidatesByDay(
  candidates: Candidate[],
  timezone: string
): Map<string, Candidate[]> {
  const map = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const startDay = formatDayKeyInTz(c.start, timezone);
    const endDay = formatDayKeyInTz(c.end, timezone);

    if (startDay === endDay) {
      const arr = map.get(startDay) || [];
      arr.push(c);
      map.set(startDay, arr);
    } else {
      // Day-crossing candidate: split into two entries
      const arr1 = map.get(startDay) || [];
      arr1.push(c);
      map.set(startDay, arr1);

      const arr2 = map.get(endDay) || [];
      arr2.push(c);
      map.set(endDay, arr2);
    }
  }
  return map;
}

export function getUniqueDayKeys(
  candidates: Candidate[],
  timezone: string
): string[] {
  const keys = new Set<string>();
  for (const c of candidates) {
    keys.add(formatDayKeyInTz(c.start, timezone));
    const endDay = formatDayKeyInTz(c.end, timezone);
    if (endDay !== formatDayKeyInTz(c.start, timezone)) {
      keys.add(endDay);
    }
  }
  return Array.from(keys).sort();
}

// ============================================================
// Secondary timezone labels
// ============================================================

/**
 * Generate time labels for a secondary timezone.
 * For each hour slot (every 2 slots), compute the corresponding time
 * in the secondary timezone.
 */
export function getSecondaryTimeLabels(
  dayKey: string,
  primaryTz: string,
  secondaryTz: string
): string[] {
  const [year, month, day] = dayKey.split('-').map(Number);
  const labels: string[] = [];
  for (let slot = 0; slot < TOTAL_SLOTS; slot += 2) {
    const hour = slot / 2;
    const localDate = new Date(year, month - 1, day, hour, 0, 0);
    const utcDate = fromZonedTime(localDate, primaryTz);
    labels.push(formatInTimeZone(utcDate, secondaryTz, 'HH:mm'));
  }
  return labels;
}

// ============================================================
// Band color logic
// ============================================================

export interface BandColorClasses {
  bg: string;
  border: string;
  text: string;
}

export function getBandColorClasses(
  okCount: number,
  totalGuests: number,
  isBest: boolean
): BandColorClasses {
  if (isBest && okCount > 0) {
    return {
      bg: 'bg-green-200',
      border: 'border-green-400',
      text: 'text-green-800',
    };
  }
  if (totalGuests > 0 && okCount / totalGuests > 0.6) {
    return {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
    };
  }
  if (okCount > 0) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
    };
  }
  return {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-600',
  };
}

// ============================================================
// Band layout (for overlapping candidates)
// ============================================================

export interface LayoutBand {
  candidate: Candidate;
  dayKey: string;
  startSlot: number;
  endSlot: number;
  column: number;
  totalColumns: number;
}

export function layoutBands(
  candidates: Candidate[],
  timezone: string
): LayoutBand[] {
  const dayGroups = groupCandidatesByDay(candidates, timezone);
  const result: LayoutBand[] = [];

  for (const [dayKey, dayCandidates] of dayGroups) {
    // Compute slot ranges for each candidate on this day
    const ranges = dayCandidates.map((c) => {
      const startDay = formatDayKeyInTz(c.start, timezone);
      const endDay = formatDayKeyInTz(c.end, timezone);

      let startSlot: number;
      let endSlot: number;

      if (startDay === endDay) {
        startSlot = dateToSlot(c.start, timezone);
        endSlot = dateToSlot(c.end, timezone);
      } else if (dayKey === startDay) {
        // First day of day-crossing candidate
        startSlot = dateToSlot(c.start, timezone);
        endSlot = TOTAL_SLOTS;
      } else {
        // Second day of day-crossing candidate
        startSlot = 0;
        endSlot = dateToSlot(c.end, timezone);
      }

      // Ensure minimum 1 slot height
      if (endSlot <= startSlot) endSlot = startSlot + 1;

      return { candidate: c, dayKey, startSlot, endSlot };
    });

    // Sort by start slot
    ranges.sort((a, b) => a.startSlot - b.startSlot);

    // Assign columns for overlapping bands
    const columns: { endSlot: number }[] = [];
    for (const range of ranges) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].endSlot <= range.startSlot) {
          columns[col].endSlot = range.endSlot;
          result.push({ ...range, column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        const col = columns.length;
        columns.push({ endSlot: range.endSlot });
        result.push({ ...range, column: col, totalColumns: 0 });
      }
    }

    // Update totalColumns for all bands in this day
    const totalCols = columns.length;
    for (const band of result) {
      if (band.dayKey === dayKey && band.totalColumns === 0) {
        band.totalColumns = totalCols;
      }
    }
  }

  return result;
}

// ============================================================
// Helpers for popover data
// ============================================================

export interface CandidateVoteSummary {
  okCount: number;
  maybeCount: number;
  ngCount: number;
  isBest: boolean;
  respondents: { guestId: string; name: string; status: VoteStatus }[];
}

export function getCandidateVoteSummary(
  candidateId: string,
  candidates: Candidate[],
  guests: GuestDocument[]
): CandidateVoteSummary {
  const realGuests = guests.filter((g) => g.id !== '__new__');
  const okCount = countStatus(realGuests, candidateId, 'ok');
  const maybeCount = countStatus(realGuests, candidateId, 'maybe');
  const ngCount = countStatus(realGuests, candidateId, 'ng');
  const bestId = getBestCandidateId(candidates, realGuests);

  const respondents: CandidateVoteSummary['respondents'] = [];
  for (const guest of realGuests) {
    const answer = guest.answers.find((a) => a.candidateId === candidateId);
    if (answer) {
      respondents.push({
        guestId: guest.id,
        name: guest.name,
        status: answer.status,
      });
    }
  }

  return {
    okCount,
    maybeCount,
    ngCount,
    isBest: candidateId === bestId,
    respondents,
  };
}
