'use client';

import { useCallback } from 'react';
import { EDIT_TOKEN_STORAGE_PREFIX } from '@/lib/constants';

function getStorageKey(eventId: string, guestId: string): string {
  return `${EDIT_TOKEN_STORAGE_PREFIX}${eventId}_${guestId}`;
}

interface UseEditTokenReturn {
  getToken: (eventId: string, guestId: string) => string | null;
  saveToken: (eventId: string, guestId: string, token: string) => void;
  removeToken: (eventId: string, guestId: string) => void;
  findMyGuestId: (eventId: string, guestIds: string[]) => string | null;
}

export function useEditToken(): UseEditTokenReturn {
  const getToken = useCallback((eventId: string, guestId: string): string | null => {
    try {
      return localStorage.getItem(getStorageKey(eventId, guestId));
    } catch {
      return null;
    }
  }, []);

  const saveToken = useCallback(
    (eventId: string, guestId: string, token: string): void => {
      try {
        localStorage.setItem(getStorageKey(eventId, guestId), token);
      } catch {
        // localStorage unavailable (private browsing, quota exceeded)
      }
    },
    []
  );

  const removeToken = useCallback((eventId: string, guestId: string): void => {
    try {
      localStorage.removeItem(getStorageKey(eventId, guestId));
    } catch {
      // noop
    }
  }, []);

  const findMyGuestId = useCallback(
    (eventId: string, guestIds: string[]): string | null => {
      for (const guestId of guestIds) {
        if (getToken(eventId, guestId)) {
          return guestId;
        }
      }
      return null;
    },
    [getToken]
  );

  return { getToken, saveToken, removeToken, findMyGuestId };
}
