import { type Chunk, DEBUG } from '@8box/shared';
import * as Phaser from 'phaser';
import { AssetRegistry } from '../../assets/registry';
import { gameClient } from '../../game/client';
import { content } from '../../game/content';
import { eventBus } from '../../game/events';
import { CameraController } from '../CameraController';
import { DebugCamera } from '../DebugCamera';
import { MovementKeys } from '../MovementKeys';
import { atlasFromScene } from '../world/atlasFromScene';
import { EntityLayer } from '../world/EntityLayer';
import { GroundLayer } from '../world/GroundLayer';
import { ObjectLayer } from '../world/ObjectLayer';
import { SpriteTextures } from '../world/SpriteTextures';

/** The game world: ground and objects of the streamed chunks, entities sorted with them, and the camera. */
export class WorldScene extends Phaser.Scene {
  private debugCamera: DebugCamera | undefined;

  constructor() {
    super('world');
  }

  create(): void {
    const registry = new AssetRegistry(atlasFromScene(this));
    const ground = new GroundLayer(this, registry, content, gameClient.chunks);
    const textures = new SpriteTextures(this.textures, registry);
    const objects = new ObjectLayer(this, textures, content);
    const entities = new EntityLayer(this, textures);
    const showChunk = (chunk: Chunk) => {
      ground.show(chunk);
      objects.show(chunk);
    };
    const emitView = () => {
      eventBus.emit('view.changed', {
        w: Math.max(1, Math.round(this.scale.width)),
        h: Math.max(1, Math.round(this.scale.height)),
        zoom: camera.zoom,
      });
    };
    const camera = new CameraController(this, emitView);
    emitView();
    const debugCamera = import.meta.env.DEV ? new DebugCamera(this, entities, camera) : undefined;
    this.debugCamera = debugCamera;
    const movementKeys = new MovementKeys((dir) => eventBus.emit('input.direction', { dir }));
    if (import.meta.env.DEV) {
      this.time.addEvent({
        delay: DEBUG.fpsSampleIntervalMs,
        loop: true,
        callback: () =>
          eventBus.emit('debug.stats', {
            fps: Math.round(this.game.loop.actualFps),
            zoom: camera.zoom,
            objects: objects.counts.shown,
          }),
      });
    }

    for (const chunk of gameClient.chunks.all()) {
      showChunk(chunk);
    }
    const unsubscribe = [
      eventBus.on('chunk.loaded', ({ chunk }) => showChunk(chunk)),
      eventBus.on('tile.changed', ({ chunk, x, y, slot }) => {
        if (slot === 'object') {
          objects.updateTile(chunk, x, y);
        } else {
          ground.updateTile(chunk.layer, x, y);
        }
      }),
      eventBus.on('chunk.unloaded', ({ layer, cx, cy }) => {
        ground.hide(layer, cx, cy);
        objects.hide(layer, cx, cy);
      }),
      eventBus.on('player.spawned', ({ position }) => {
        // The player is not drawn before step 07: the view (or the dev test character) goes to the spawn.
        if (debugCamera) {
          debugCamera.moveTo(position);
        } else {
          camera.centerOn(position);
        }
      }),
    ];

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      for (const off of unsubscribe) {
        off();
      }
      camera.destroy();
      movementKeys.destroy();
      ground.destroy();
      objects.destroy();
      entities.destroy();
      textures.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  override update(_time: number, deltaMs: number): void {
    this.debugCamera?.update(deltaMs);
  }
}
