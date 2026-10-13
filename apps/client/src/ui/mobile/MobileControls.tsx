import { useTranslation } from 'react-i18next';
import { eventBus, type TouchButton } from '../../game/events';
import { unreadCount, useChatStore } from '../../store/chat';
import { FullscreenButton } from './FullscreenButton';
import { Joystick } from './Joystick';

const BUTTONS: readonly { button: TouchButton; label: string }[] = [
  { button: 'use', label: 'ui.mobile.use' },
  { button: 'action', label: 'ui.mobile.action' },
  { button: 'inventory', label: 'ui.mobile.inventory' },
  { button: 'craft', label: 'ui.mobile.craft' },
];

/** Opens the chat on the tab that has unread lines, when the current one has none. */
function openChat(): void {
  const state = useChatStore.getState();
  const other = state.tab === 'proximity' ? 'private' : 'proximity';
  const tab =
    unreadCount(state, state.tab) === 0 && unreadCount(state, other) > 0 ? other : state.tab;
  useChatStore.setState({ open: true, tab });
}

/** Opens the chat panel; shows how many lines were not read yet. */
function ChatButton() {
  const { t } = useTranslation();
  const unread = useChatStore(
    (state) => unreadCount(state, 'proximity') + unreadCount(state, 'private'),
  );
  return (
    <button type="button" className="touch-button touch-button--chat" onClick={openChat}>
      {t('ui.mobile.chat')}
      {unread > 0 && <span className="badge">{unread}</span>}
    </button>
  );
}

/**
 * Touch controls in landscape: the joystick on the left, the buttons (and the chat) on the right, room
 * kept at the bottom for the item bar (`Hotbar`), and a full screen button.
 */
export function MobileControls() {
  const { t } = useTranslation();
  const chatOpen = useChatStore((state) => state.open);
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
        {!chatOpen && <ChatButton />}
      </div>
      <FullscreenButton />
    </div>
  );
}
