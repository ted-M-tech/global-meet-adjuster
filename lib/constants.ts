export const DURATIONS = [30, 60, 90, 120] as const;

export const MAX_GUESTS_SOFT_LIMIT = 20;

export const TTL_DAYS = 90;

export const SESSION_COOKIE_NAME = '__session';
export const SESSION_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const EDIT_TOKEN_STORAGE_PREFIX = 'gma_edit_token_';
export const HOST_TOKEN_STORAGE_PREFIX = 'gma_host_token_';
