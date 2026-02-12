import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditToken } from '@/hooks/use-edit-token';

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe('useEditToken', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it('saveToken stores token and getToken retrieves it', () => {
    const { result } = renderHook(() => useEditToken());

    act(() => {
      result.current.saveToken('event-1', 'guest-1', 'token-abc');
    });

    expect(result.current.getToken('event-1', 'guest-1')).toBe('token-abc');
  });

  it('getToken returns null for non-existent token', () => {
    const { result } = renderHook(() => useEditToken());
    expect(result.current.getToken('event-1', 'guest-99')).toBeNull();
  });

  it('removeToken deletes a stored token', () => {
    const { result } = renderHook(() => useEditToken());

    act(() => {
      result.current.saveToken('event-1', 'guest-1', 'token-abc');
    });
    expect(result.current.getToken('event-1', 'guest-1')).toBe('token-abc');

    act(() => {
      result.current.removeToken('event-1', 'guest-1');
    });
    expect(result.current.getToken('event-1', 'guest-1')).toBeNull();
  });

  it('findMyGuestId returns guestId that has a token', () => {
    const { result } = renderHook(() => useEditToken());

    act(() => {
      result.current.saveToken('event-1', 'guest-2', 'token-xyz');
    });

    expect(
      result.current.findMyGuestId('event-1', ['guest-1', 'guest-2', 'guest-3'])
    ).toBe('guest-2');
  });

  it('findMyGuestId returns null when no guest has a token', () => {
    const { result } = renderHook(() => useEditToken());
    expect(
      result.current.findMyGuestId('event-1', ['guest-1', 'guest-2'])
    ).toBeNull();
  });

  it('handles localStorage errors gracefully', () => {
    // Replace with a throwing storage
    const throwingStorage = createMockStorage();
    vi.mocked(throwingStorage.getItem).mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    vi.mocked(throwingStorage.setItem).mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useEditToken());

    // Should not throw
    act(() => {
      result.current.saveToken('event-1', 'guest-1', 'token');
    });
    expect(result.current.getToken('event-1', 'guest-1')).toBeNull();
  });
});
