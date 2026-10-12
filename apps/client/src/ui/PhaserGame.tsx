import { useEffect, useRef } from 'react';
import { createGame } from '../phaser/createGame';

/** Mounts the Phaser game; React and Phaser then only talk through the store and the event bus. */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const game = createGame(container);
    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="phaser-game" />;
}
