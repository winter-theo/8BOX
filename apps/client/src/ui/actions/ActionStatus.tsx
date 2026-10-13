import { INTERACTION } from '@8box/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clearFeedback, useActionsStore } from '../../store/actions';
import { feedbackText } from './labels';

/** The progress bar of the action in progress (an action that takes time), above the item bar. */
export function ActionProgress() {
  const { t } = useTranslation();
  const progress = useActionsStore((state) => state.progress);
  if (!progress) {
    return null;
  }
  return (
    <div className="action-progress" role="progressbar" aria-label={t('ui.actions.progress')}>
      {/* A CSS animation fills it: React does not re-render while it runs. */}
      <div
        key={progress.seq}
        className="action-progress-fill"
        style={{ animationDuration: `${progress.durationMs}ms` }}
      />
    </div>
  );
}

/** What an action tells the player (what was examined, why it was refused), for a few seconds. */
export function ActionFeedbackLine() {
  const { t } = useTranslation();
  const feedback = useActionsStore((state) => state.feedback);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = setTimeout(() => clearFeedback(feedback.seq), INTERACTION.feedbackMs);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!feedback) {
    return null;
  }
  return (
    <div key={feedback.seq} className="action-feedback" role="status">
      {feedbackText(t, feedback.message)}
    </div>
  );
}
