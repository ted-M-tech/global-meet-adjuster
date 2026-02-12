import { describe, it, expect } from 'vitest';
import { countStatus, getBestCandidateId } from '@/components/voting/voting-summary';
import type { Candidate, GuestDocument } from '@/types';

const makeGuest = (
  id: string,
  answers: { candidateId: string; status: 'ok' | 'maybe' | 'ng' }[]
): GuestDocument => ({
  id,
  name: `Guest ${id}`,
  editTokenHash: 'hash',
  answers,
  registeredAt: new Date(),
  updatedAt: new Date(),
});

const candidates: Candidate[] = [
  { id: 'c1', start: new Date('2026-03-15T10:00:00Z'), end: new Date('2026-03-15T11:00:00Z') },
  { id: 'c2', start: new Date('2026-03-16T10:00:00Z'), end: new Date('2026-03-16T11:00:00Z') },
];

describe('countStatus', () => {
  const guests = [
    makeGuest('g1', [
      { candidateId: 'c1', status: 'ok' },
      { candidateId: 'c2', status: 'ng' },
    ]),
    makeGuest('g2', [
      { candidateId: 'c1', status: 'ok' },
      { candidateId: 'c2', status: 'maybe' },
    ]),
    makeGuest('g3', [
      { candidateId: 'c1', status: 'ng' },
      { candidateId: 'c2', status: 'ok' },
    ]),
  ];

  it('counts ok status correctly', () => {
    expect(countStatus(guests, 'c1', 'ok')).toBe(2);
    expect(countStatus(guests, 'c2', 'ok')).toBe(1);
  });

  it('counts maybe status correctly', () => {
    expect(countStatus(guests, 'c1', 'maybe')).toBe(0);
    expect(countStatus(guests, 'c2', 'maybe')).toBe(1);
  });

  it('counts ng status correctly', () => {
    expect(countStatus(guests, 'c1', 'ng')).toBe(1);
    expect(countStatus(guests, 'c2', 'ng')).toBe(1);
  });

  it('returns 0 for non-existent candidate', () => {
    expect(countStatus(guests, 'c99', 'ok')).toBe(0);
  });
});

describe('getBestCandidateId', () => {
  it('returns candidate with most ok votes', () => {
    const guests = [
      makeGuest('g1', [
        { candidateId: 'c1', status: 'ok' },
        { candidateId: 'c2', status: 'ng' },
      ]),
      makeGuest('g2', [
        { candidateId: 'c1', status: 'ok' },
        { candidateId: 'c2', status: 'ok' },
      ]),
    ];
    // c1: 2 ok, c2: 1 ok
    expect(getBestCandidateId(candidates, guests)).toBe('c1');
  });

  it('returns null when no guests', () => {
    expect(getBestCandidateId(candidates, [])).toBeNull();
  });

  it('returns null when all votes are ng', () => {
    const guests = [
      makeGuest('g1', [
        { candidateId: 'c1', status: 'ng' },
        { candidateId: 'c2', status: 'ng' },
      ]),
    ];
    expect(getBestCandidateId(candidates, guests)).toBeNull();
  });

  it('returns first candidate when tied on ok count', () => {
    const guests = [
      makeGuest('g1', [
        { candidateId: 'c1', status: 'ok' },
        { candidateId: 'c2', status: 'ok' },
      ]),
    ];
    // Both have 1 ok — c1 is encountered first
    expect(getBestCandidateId(candidates, guests)).toBe('c1');
  });
});
