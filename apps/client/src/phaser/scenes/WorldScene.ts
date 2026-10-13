import { type Chunk, DEBUG } from '@8box/shared';
import * as Phaser from 'phaser';
import { shareRegistryWithIcons } from '../../assets/itemIcons';
import { AssetRegistry } from '../../assets/registry';
import { gameClient } from '../../game/client';
import { content } from '../../game/content';
import { eventBus } from '../../game/events';
import { ActionInput } from '../ActionInput';
import { CameraController } from '../CameraController';
import { DebugCamera } from '../DebugCamera';
import { InventoryKeys } from '../InventoryKeys';
import { LongPress } from '../LongPress';
import { MovementKeys } from '../MovementKeys';
import { AimHighlight } from '../world/AimHighlight';
import { atlasFromScene } from '../world/atlasFromScene';
import { ChatBubbles } from '../world/ChatBubbles';
import { DamageBars } from '../world/DamageBars';
import { EntityLayer } from '../world/EntityLayer';
import { GroundItems } from '../world/GroundItems';
import { GroundLayer } from '../world/GroundLayer';
import { LocalPlayer } from '../world/LocalPlayer';
import { NameLabels } from '../world/NameLabels';
import { ObjectLayer } from '../world/ObjectLayer';
import { RemotePlayers } from '../world/RemotePlayers';
import { SpriteTextures } from '../world/SpriteTextures';

/** The game world: ground and objects of the streamed chunks, entities sorted with them, and the camera. */
export class WorldScene extends Phaser.Scene {
  /** What runs every frame; set by `create`. */
  private onFrame: ((timeMs: number, deltaMs: number) => void) | undefined;

  constructor() {
    super('world');
  }

  create(): void {
    const registry = new AssetRegistry(atlasFromScene(this));
    shareRegistryWithIcons(registry);
    const ground = new GroundLayer(this, registry, content, gameClient.chunks);
    const textures = new SpriteTextures(this.textures, registry);
    const objects = new ObjectLayer(this, textures, content);
    const entities = new EntityLayer(this, textures);
    const localPlayer = new LocalPlayer(entities);
    const labels = new NameLabels(this);
    const remotePlayers = new RemotePlayers(entities, labels);
    const groundItems = new GroundItems(this, textures, content);
    const bubbles = new ChatBubbles(this, (entity) => entities.image(entity));
    const aim = new AimHighlight(this);
    const damageBars = new DamageBars(this);
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
    const longPress = new LongPress(this);
    const inventoryKeys = new InventoryKeys(this, eventBus);
    const actionInput = new ActionInput(this, eventBus);
    // Dev mode: F2 frees the camera from the player (the player stands still meanwhile).
    const debugCamera = import.meta.env.DEV
      ? new DebugCamera(this, camera, (active) => {
          movementKeys.setEnabled(!active);
          if (!active && playerSprite) {
            camera.follow(playerSprite);
          }
        })
      : undefined;
    this.onFrame = (timeMs, deltaMs) => {
      debugCamera?.update(deltaMs);
      // The player of this client, where the prediction puts it; the camera follows it.
      const remotes = gameClient.remoteViews();
      remotePlayers.update(remotes, timeMs);
      groundItems.update(remotes);
      const sprite = localPlayer.update(gameClient.localView(), timeMs);
      actionInput.update();
      aim.update(gameClient.interaction.aimedTile());
      if (sprite !== playerSprite) {
        playerSprite = sprite;
        if (sprite && !debugCamera?.isActive) {
          camera.follow(sprite);
        }
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
    const unsubscribe = [
      eventBus.on('chunk.loaded', ({ chunk }) => showChunk(chunk)),
      eventBus.on('tile.changed', ({ chunk, x, y, slot }) => {
        damageBars.clearTile(chunk.layer, x, y);
        if (slot === 'object') {
          objects.updateTile(chunk, x, y);
        } else {
          ground.updateTile(chunk.layer, x, y);
        }
      }),
      eventBus.on('tile.damaged', ({ layer, x, y, hp, maxHp }) =>
        damageBars.show(layer, x, y, hp, maxHp),
      ),
      eventBus.on('chunk.unloaded', ({ layer, cx, cy }) => {
        damageBars.clearChunk(layer, cx, cy);
        ground.hide(layer, cx, cy);
        objects.hide(layer, cx, cy);
      }),
      eventBus.on('chat.said', ({ entity, text }) => bubbles.say(entity, text)),
    ];

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.onFrame = undefined;
      for (const off of unsubscribe) {
        off();
      }
      camera.destroy();
      movementKeys.destroy();
      longPress.destroy();
      inventoryKeys.destroy();
      actionInput.destroy();
      aim.destroy();
      damageBars.destroy();
      debugCamera?.destroy();
      ground.destroy();
      objects.destroy();
      entities.destroy();
      groundItems.destroy();
      labels.destroy();
      bubbles.destroy();
      textures.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  override update(time: number, deltaMs: number): void {
    this.onFrame?.(time, deltaMs);
  }
}
