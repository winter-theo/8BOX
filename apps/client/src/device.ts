import { touchFromQuery } from './urlOptions';

/** A phone or tablet: its main pointer is a finger. */
const COARSE_POINTER = '(pointer: coarse)';

/** Dev only: `?touch=1` in the page URL shows the touch controls on a PC. */
const FORCED = import.meta.env.DEV && touchFromQuery(window.location.search);

/** Whether the game is played by touch (virtual joystick, buttons, long press). */
export function isTouchMode(): boolean {
  return FORCED || window.matchMedia(COARSE_POINTER).matches;
}

/** Calls `listener` when the touch mode changes (a tablet docking a mouse…); returns the unsubscribe. */
export function onTouchModeChange(listener: (touch: boolean) => void): () => void {
  const query = window.matchMedia(COARSE_POINTER);
  const onChange = () => listener(isTouchMode());
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
