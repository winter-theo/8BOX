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
import { LocalPlayer } from '../world/LocalPlayer';
import { ObjectLayer } from '../world/ObjectLayer';
import { SpriteTextures } from '../world/SpriteTextures';

/** The game world: ground and objects of the streamed chunks, entities sorted with them, and the camera. */
export class WorldScene extends Phaser.Scene {
  private debugCamera: DebugCamera | undefined;
  private localPlayer: LocalPlayer | undefined;

  constructor() {
    super('world');
  }

  create(): void {
    const registry = new AssetRegistry(atlasFromScene(this));
    const ground = new GroundLayer(this, registry, content, gameClient.chunks);
    const textures = new SpriteTextures(this.textures, registry);
    const objects = new ObjectLayer(this, textures, content);
    const entities = new EntityLayer(this, textures);
    const localPlayer = new LocalPlayer(entities);
    this.localPlayer = localPlayer;
    let playerSprite: Phaser.GameObjects.Image | undefined;
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
    const movementKeys = new MovementKeys((dir) => eventBus.emit('input.direction', { dir }));
    // Dev mode: F2 frees the camera from the player (the player stands still meanwhile).
    const debugCamera = import.meta.env.DEV
      ? new DebugCamera(this, camera, (active) => {
          movementKeys.setEnabled(!active);
          if (!active && playerSprite) {
            camera.follow(playerSprite);
          }
        })
      : undefined;
    this.debugCamera = debugCamera;
    const spawnPlayer = (entity: number, position: { x: number; y: number }) => {
      playerSprite = localPlayer.spawn(entity, position);
      if (!debugCamera?.isActive) {
        camera.follow(playerSprite);
      }
    };
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
    if (gameClient.player) {
      spawnPlayer(gameClient.player.entity, gameClient.player);
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
      eventBus.on('player.spawned', ({ entity, position }) => spawnPlayer(entity, position)),
      eventBus.on('player.moved', ({ x, y, facing }) =>
        localPlayer.move(x, y, facing, this.time.now),
      ),
      eventBus.on('player.despawned', () => {
        localPlayer.remove();
        playerSprite = undefined;
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
      debugCamera?.destroy();
      ground.destroy();
      objects.destroy();
      entities.destroy();
      textures.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  override update(time: number, deltaMs: number): void {
    this.debugCamera?.update(deltaMs);
    this.localPlayer?.update(time);
  }
}
