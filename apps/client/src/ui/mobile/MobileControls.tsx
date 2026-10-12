import { useTranslation } from 'react-i18next';
import { eventBus, type TouchButton } from '../../game/events';
import { Joystick } from './Joystick';

const BUTTONS: readonly { button: TouchButton; label: string }[] = [
  { button: 'use', label: 'ui.mobile.use' },
  { button: 'action', label: 'ui.mobile.action' },
  { button: 'inventory', label: 'ui.mobile.inventory' },
];

/**
 * Touch controls in landscape: the joystick on the left, the buttons on the right, and room kept at the
 * bottom for the item bar (step 14).
 */
export function MobileControls() {
  const { t } = useTranslation();
  return (
    <div className="mobile-controls">
      <Joystick />
      <div className="touch-buttons">
        {BUTTONS.map(({ button, label }) => (
          <button
            key={button}
            type="button"
            className={`touch-button touch-button--${button}`}
            onPointerDown={() => eventBus.emit('input.button', { button })}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="hotbar-slot" aria-hidden="true" />
    </div>
  );
}
