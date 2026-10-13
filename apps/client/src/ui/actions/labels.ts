import { contentNameKey } from '@8box/shared';
import type { TFunction } from 'i18next';
import type { ActionFeedback, SubjectName } from '../../store/actions';

/** The name shown for a subject: the translated name of a tile or an item, or a player's name. */
export function subjectLabel(t: TFunction, name: SubjectName): string {
  if ('player' in name) {
    return name.player;
  }
  if ('self' in name) {
    return t('ui.actions.self');
  }
  return t(contentNameKey(name.content));
}

/** The message shown after an action. */
export function feedbackText(t: TFunction, feedback: ActionFeedback): string {
  switch (feedback.kind) {
    case 'examined':
      if ('player' in feedback.name) {
        return t('ui.actions.examinedPlayer', { name: feedback.name.player });
      }
      if (feedback.count !== undefined && feedback.count > 1) {
        return t('ui.actions.examinedPile', {
          name: subjectLabel(t, feedback.name),
          count: feedback.count,
        });
      }
      return t('ui.actions.examined', { name: subjectLabel(t, feedback.name) });
    case 'refused':
      return t(`ui.actions.reason.${feedback.reason}`);
    case 'cancelled':
      return t('ui.actions.cancelled');
    case 'nothing':
      return t('ui.actions.nothing');
    case 'craftRefused':
      return t(`ui.crafting.reason.${feedback.reason}`, {
        station: feedback.station === undefined ? '' : t(contentNameKey(feedback.station)),
      });
    case 'craftCancelled':
      return t('ui.crafting.cancelled');
    case 'craftDone':
      return t('ui.crafting.done');
    case 'respawnSet':
      return t('ui.actions.respawnSet');
    case 'broken':
      return t('ui.actions.broken', { name: t(contentNameKey(feedback.item)) });
  }
}
