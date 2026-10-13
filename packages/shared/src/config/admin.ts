import { SECOND_MS } from './units';

export const ADMIN = {
  /** The admin tab reloads its lists (and the menu its pending badge) this often, in ms. */
  refreshIntervalMs: 30 * SECOND_MS,
  /** Longest ban reason, in characters. */
  banReasonMaxLength: 200,
  /** Audit entries listed by the admin tab (the most recent ones), in entries. */
  auditListSize: 100,
  /** Reports listed by the admin tab (the open ones first, then the most recent), in reports. */
  reportListSize: 100,
  /** Shortest mute an admin can give, in minutes. */
  muteMinMinutes: 1,
  /** Longest mute an admin can give (30 days), in minutes. */
  muteMaxMinutes: 30 * 24 * 60,
  /** Mute lengths offered by the admin tab (5 min, 15 min, 1 h, 1 day), in minutes. */
  mutePresetsMinutes: [5, 15, 60, 24 * 60],
} as const;
