import { useSyncExternalStore } from 'react';
import { isTouchMode, onTouchModeChange } from '../device';

/** Whether the touch controls are shown; follows changes of the device's main pointer. */
export function useTouchMode(): boolean {
  return useSyncExternalStore(onTouchModeChange, isTouchMode);
}
