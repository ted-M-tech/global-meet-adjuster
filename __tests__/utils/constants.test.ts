import { describe, it, expect } from 'vitest';
import {
  DURATIONS,
  MAX_GUESTS_SOFT_LIMIT,
  TTL_DAYS,
  EDIT_TOKEN_STORAGE_PREFIX,
  HOST_TOKEN_STORAGE_PREFIX,
} from '@/lib/constants';

describe('constants', () => {
  it('DURATIONS contains expected values in ascending order', () => {
    expect(DURATIONS).toEqual([30, 60, 90, 120]);
    for (let i = 1; i < DURATIONS.length; i++) {
      expect(DURATIONS[i]).toBeGreaterThan(DURATIONS[i - 1]);
    }
  });

  it('MAX_GUESTS_SOFT_LIMIT is a positive number', () => {
    expect(MAX_GUESTS_SOFT_LIMIT).toBeGreaterThan(0);
    expect(MAX_GUESTS_SOFT_LIMIT).toBe(20);
  });

  it('TTL_DAYS is 90', () => {
    expect(TTL_DAYS).toBe(90);
  });

  it('EDIT_TOKEN_STORAGE_PREFIX is a non-empty string', () => {
    expect(typeof EDIT_TOKEN_STORAGE_PREFIX).toBe('string');
    expect(EDIT_TOKEN_STORAGE_PREFIX.length).toBeGreaterThan(0);
  });

  it('HOST_TOKEN_STORAGE_PREFIX is a non-empty string', () => {
    expect(typeof HOST_TOKEN_STORAGE_PREFIX).toBe('string');
    expect(HOST_TOKEN_STORAGE_PREFIX.length).toBeGreaterThan(0);
  });
});
