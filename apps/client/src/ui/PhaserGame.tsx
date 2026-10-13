import { useEffect, useRef } from 'react';
import { createGame } from '../phaser/createGame';

/**
 * No browser context menu over the game: a right click opens the action menu, and on a touch screen a
 * held finger does.
 */
function preventContextMenu(event: Event): void {
  event.preventDefault();
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
    container.addEventListener('contextmenu', preventContextMenu);
    return () => {
      container.removeEventListener('contextmenu', preventContextMenu);
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-game" />;
}
