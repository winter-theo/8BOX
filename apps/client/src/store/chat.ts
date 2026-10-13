import {
  CHAT,
  type ChatChannel,
  type ChatLineMessage,
  type ChatNotice,
  type ChatNoticeMessage,
} from '@8box/shared';
import { create } from 'zustand';

/** A chat line received from the server (said nearby, or private). */
export interface ChatLineEntry {
  id: number;
  kind: 'line';
  channel: ChatChannel;
  from: string;
  /** Private line: who it was for. */
  to?: string;
  text: string;
  /** Server clock, in ms since 1970. */
  ts: number;
  /** Said by the player of this client. */
  own: boolean;
}

/** What the server told the player about their own line (muted, unknown player…). */
export interface ChatNoticeEntry {
  id: number;
  kind: 'notice';
  notice: ChatNotice;
  name?: string;
  /** `muted`: end of the mute, in ms since 1970. */
  until?: number;
}

export type ChatEntry = ChatLineEntry | ChatNoticeEntry;

interface ChatState {
  /** The last `CHAT.historySize` entries, the oldest first. */
  entries: ChatEntry[];
  /** The other player of the last private line: who the Private tab answers. */
  partner: string | null;
  /** The panel is open: always on a computer, after the chat button on a phone. */
  open: boolean;
  tab: ChatChannel;
  /** Id of the last entry read in each tab. */
  readUpTo: Record<ChatChannel, number>;
}

const initialState: ChatState = {
  entries: [],
  partner: null,
  open: false,
  tab: 'proximity',
  readUpTo: { proximity: 0, private: 0 },
};

/**
 * The chat panel's state. The GameClient adds what the server sends; the UI opens the panel, picks a
 * tab and marks lines as read.
 */
export const useChatStore = create<ChatState>()(() => initialState);

let nextId = 1;

function add(entry: ChatEntry, changes: Partial<ChatState> = {}): void {
  useChatStore.setState((state) => ({
    ...changes,
    entries: [...state.entries, entry].slice(-CHAT.historySize),
  }));
}

/** A chat line arrived; `ownName` is the name of the player of this client. */
export function receiveChatLine(message: ChatLineMessage, ownName: string | undefined): void {
  const own = message.from === ownName;
  const { t: _, entity: __, ...line } = message;
  const partner = message.channel === 'private' ? (own ? message.to : message.from) : undefined;
  add({ ...line, id: nextId++, kind: 'line', own }, partner ? { partner } : {});
}

export function receiveChatNotice(message: ChatNoticeMessage): void {
  const { t: _, ...notice } = message;
  add({ ...notice, id: nextId++, kind: 'notice' });
}

/** Forgets the chat (the player left the game). */
export function clearChat(): void {
  useChatStore.setState(initialState);
}

/** Lines of a tab not read yet; the player's own lines are never unread. */
export function unreadCount(state: ChatState, channel: ChatChannel): number {
  return state.entries.filter(
    (entry) =>
      entry.kind === 'line' &&
      !entry.own &&
      entry.channel === channel &&
      entry.id > state.readUpTo[channel],
  ).length;
}

/** What a tab shows: its lines, and every notice. */
export function entriesOf(entries: readonly ChatEntry[], channel: ChatChannel): ChatEntry[] {
  return entries.filter((entry) => entry.kind === 'notice' || entry.channel === channel);
}

/** Marks the lines of a tab as read, up to entry `upTo`. */
export function markRead(channel: ChatChannel, upTo: number): void {
  useChatStore.setState((state) =>
    state.readUpTo[channel] >= upTo ? state : { readUpTo: { ...state.readUpTo, [channel]: upTo } },
  );
}
