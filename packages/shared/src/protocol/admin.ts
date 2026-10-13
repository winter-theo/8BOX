import { z } from 'zod';
import { ADMIN } from '../config/admin';
import type { ChatChannel } from './messages';

// The admin HTTP API (`/admin/*`): request bodies validated by the server (zod), answers typed.

/** Where a player stands on the whitelist. */
export type PlayerStatus = 'pending' | 'approved' | 'denied' | 'banned';
export type PlayerRole = 'player' | 'admin';

/** What an admin can do to a player; each one is written to the audit log. */
export const ADMIN_ACTIONS = ['approve', 'deny', 'ban', 'unban', 'kick', 'mute', 'unmute'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Body of `POST /admin/players/:id/ban`. */
export const banBodySchema = z.strictObject({
  reason: z.string().trim().min(1).max(ADMIN.banReasonMaxLength),
});
export type BanBody = z.infer<typeof banBodySchema>;

/** Body of `POST /admin/players/:id/mute`: how long the player cannot chat. */
export const muteBodySchema = z.strictObject({
  minutes: z.number().int().min(ADMIN.muteMinMinutes).max(ADMIN.muteMaxMinutes),
});
export type MuteBody = z.infer<typeof muteBodySchema>;

/** A player as the admin tab lists it. Dates are ISO strings. */
export interface AdminPlayer {
  id: number;
  /** Null until the player picks a name. */
  name: string | null;
  email: string | null;
  status: PlayerStatus;
  role: PlayerRole;
  banReason: string | null;
  /** End of the mute the admin gave (the player cannot chat until then); null when never muted. */
  mutedUntil: string | null;
  /** Connected right now: playing, or waiting for approval. */
  online: boolean;
  /** First sign-in (the date of the request, for a pending player). */
  createdAt: string;
  /** Last save of the character while playing; null if never played. */
  lastSeenAt: string | null;
}

/** One line of the audit log. */
export interface AdminAuditEntry {
  id: number;
  at: string;
  action: AdminAction;
  adminId: number;
  adminName: string | null;
  targetId: number;
  targetName: string | null;
  /** Ban reason. */
  reason: string | null;
  /** Length of a mute, in minutes. */
  minutes: number | null;
}

/** A chat line kept with a report: what the reporter saw. */
export interface ReportContextLine {
  /** Server clock when said, in ms since 1970. */
  ts: number;
  channel: ChatChannel;
  from: string;
  /** Private line: who it was for. */
  to?: string;
  /** As the reporter saw it (filtered). */
  text: string;
}

/** `open` until the admin deals with it: `resolved` (acted on) or `dismissed` (nothing to do). */
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** What the admin does with an open report: `resolve` it (acted on) or `dismiss` it. */
export const REPORT_ACTIONS = ['resolve', 'dismiss'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** A report as the admin tab lists it. Dates are ISO strings. */
export interface AdminReport {
  id: number;
  at: string;
  reporterId: number;
  reporterName: string | null;
  targetId: number;
  targetName: string | null;
  reason: string;
  /** The last chat lines the reporter saw, the oldest first. */
  context: ReportContextLine[];
  status: ReportStatus;
  /** The admin who resolved or dismissed it, and when. */
  handledByName: string | null;
  handledAt: string | null;
}

/** `GET /admin/me`: answered for admins only (403 otherwise), for the menu link and its badge. */
export interface AdminMe {
  pendingCount: number;
  openReportCount: number;
}

/** `GET /admin/players` (pending requests are the `pending` ones). */
export interface AdminPlayersResponse {
  players: AdminPlayer[];
}

/** `GET /admin/reports`: the open ones first, then the most recent. */
export interface AdminReportsResponse {
  reports: AdminReport[];
}

/** `GET /admin/audit`: the most recent first. */
export interface AdminAuditResponse {
  entries: AdminAuditEntry[];
}

/** Why an admin request was refused. */
export type AdminError =
  /** 401: no session token, or an invalid one. */
  | 'unauthorized'
  /** 403: signed in, but not an admin. */
  | 'forbidden'
  /** No such player. */
  | 'notFound'
  /** Admins cannot act on themselves… */
  | 'self'
  /** …nor on another admin. */
  | 'targetIsAdmin'
  /** The action does not fit the player's status (approve someone already approved…). */
  | 'wrongStatus'
  /** Kick: the player is not in the game. */
  | 'notOnline'
  /** Invalid body (ban reason empty or too long, mute length out of range). */
  | 'invalidBody'
  /** The report is not open any more (or does not exist). */
  | 'reportClosed';

/** Answer of a refused admin request (status 400, 401, 403, 404 or 409). */
export interface AdminErrorResponse {
  error: AdminError;
}
