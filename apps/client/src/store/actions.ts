import type { ActionReason, ActionSubject, ActionTarget } from '@8box/shared';
import { tileThing } from '@8box/shared';
import { create } from 'zustand';

/** What a label or a message names: a tile or an item (content id, translated), or a player. */
export type SubjectName = { content: string } | { player: string } | { self: true };

/** One line of the action menu. */
export interface MenuEntry {
  /** Action id. */
  id: string;
  labelKey: string;
  name: SubjectName;
  target: ActionTarget;
  /** Why it cannot be done (greyed); null when it can. */
  reason: ActionReason | null;
}

export interface ActionMenu {
  /** The tile it is about. */
  x: number;
  y: number;
  /** Where to show it, in CSS pixels. */
  left: number;
  top: number;
  entries: MenuEntry[];
}

/** What the player is told after an action (a short message on screen). */
export type ActionFeedback =
  | { kind: 'examined'; name: SubjectName; count?: number }
  | { kind: 'refused'; reason: ActionReason }
  | { kind: 'cancelled' }
  | { kind: 'nothing' };

interface ActionsState {
  /** The open action menu (right click, long press). */
  menu: ActionMenu | null;
  /** The action in progress (it takes time): a progress bar; `seq` grows with each one. */
  progress: { id: string; durationMs: number; seq: number } | null;
  /** The last message; `seq` grows with each one, so the same message shows again. */
  feedback: { seq: number; message: ActionFeedback } | null;
}

const initialState: ActionsState = { menu: null, progress: null, feedback: null };

/** Written by the GameClient (what the server answers) and the action menu (closing it). */
export const useActionsStore = create<ActionsState>()(() => initialState);

let lastSeq = 0;

export function showFeedback(message: ActionFeedback): void {
  useActionsStore.setState({ feedback: { seq: ++lastSeq, message } });
}

/** Hides message `seq` (a newer one stays). */
export function clearFeedback(seq: number): void {
  useActionsStore.setState((state) => (state.feedback?.seq === seq ? { feedback: null } : state));
}

export function showProgress(id: string, durationMs: number): void {
  useActionsStore.setState({ progress: { id, durationMs, seq: ++lastSeq } });
}

/** Ends the progress bar of action `id` (another action's bar stays). */
export function endProgress(id: string): void {
  useActionsStore.setState((state) => (state.progress?.id === id ? { progress: null } : state));
}

export function closeActionMenu(): void {
  useActionsStore.setState({ menu: null });
}

/** Forgets everything (the player left the world). */
export function clearActions(): void {
  useActionsStore.setState(initialState);
}

/** How a label names a subject: by the content id of the tile or item, or by the player's name. */
export function nameOf(subject: ActionSubject): SubjectName {
  switch (subject.kind) {
    case 'tile':
      return { content: tileThing(subject.tiles) ?? '' };
    case 'entity':
      if (subject.name !== undefined) {
        return { player: subject.name };
      }
      return { content: subject.item ?? '' };
    case 'self':
      return { self: true };
  }
}
