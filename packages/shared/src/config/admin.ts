import { SECOND_MS } from './units';

export const ADMIN = {
  /** The admin tab reloads its lists (and the menu its pending badge) this often, in ms. */
  refreshIntervalMs: 30 * SECOND_MS,
  /** Longest ban reason, in characters. */
  banReasonMaxLength: 200,
  /** Audit entries listed by the admin tab (the most recent ones), in entries. */
  auditListSize: 100,
} as const;
