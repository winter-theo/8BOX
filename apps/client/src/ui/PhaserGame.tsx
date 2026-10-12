import { useEffect, useRef } from 'react';
import { isTouchMode } from '../device';
import { createGame } from '../phaser/createGame';

/** On a touch screen, a held finger must not open the browser's context menu over the game. */
function preventTouchContextMenu(event: Event): void {
  if (isTouchMode()) {
    event.preventDefault();
  }
}

/** Mounts the Phaser game; React and Phaser then only talk through the store and the event bus. */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const game = createGame(container);
    container.addEventListener('contextmenu', preventTouchContextMenu);
    return () => {
      container.removeEventListener('contextmenu', preventTouchContextMenu);
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-game" />;
}
