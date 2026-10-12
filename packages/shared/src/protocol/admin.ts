import { z } from 'zod';
import { ADMIN } from '../config/admin';

// The admin HTTP API (`/admin/*`): request bodies validated by the server (zod), answers typed.

/** Where a player stands on the whitelist. */
export type PlayerStatus = 'pending' | 'approved' | 'denied' | 'banned';
export type PlayerRole = 'player' | 'admin';

/** What an admin can do to a player; each one is written to the audit log. */
export const ADMIN_ACTIONS = ['approve', 'deny', 'ban', 'unban', 'kick'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Body of `POST /admin/players/:id/ban`. */
export const banBodySchema = z.strictObject({
  reason: z.string().trim().min(1).max(ADMIN.banReasonMaxLength),
});
export type BanBody = z.infer<typeof banBodySchema>;

/** A player as the admin tab lists it. Dates are ISO strings. */
export interface AdminPlayer {
  id: number;
  /** Null until the player picks a name. */
  name: string | null;
  email: string | null;
  status: PlayerStatus;
  role: PlayerRole;
  banReason: string | null;
  /** In the game right now. */
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
}

/** `GET /admin/me`: answered for admins only (403 otherwise), for the menu link and its badge. */
export interface AdminMe {
  pendingCount: number;
}

/** `GET /admin/players` (pending requests are the `pending` ones). */
export interface AdminPlayersResponse {
  players: AdminPlayer[];
}

/** `GET /admin/audit`: the most recent first. */
export interface AdminAuditResponse {
  entries: AdminAuditEntry[];
}

/** Why an admin action was refused. */
export type AdminError =
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
  /** Invalid body (ban reason empty or too long). */
  | 'invalidBody';

/** Answer of a refused admin action (status 400, 404 or 409). */
export interface AdminErrorResponse {
  error: AdminError;
}
