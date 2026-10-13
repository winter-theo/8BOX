import { type Chunk, DEBUG, VIEW } from '@8box/shared';
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
import { CombatEffects } from '../world/CombatEffects';
import { DamageBars } from '../world/DamageBars';
import { EntityLayer } from '../world/EntityLayer';
import { GroundItems } from '../world/GroundItems';
import { GroundLayer } from '../world/GroundLayer';
import { LightLayer } from '../world/LightLayer';
import { LocalPlayer } from '../world/LocalPlayer';
import { NameLabels } from '../world/NameLabels';
import { ObjectLayer } from '../world/ObjectLayer';
import { RemotePlayers } from '../world/RemotePlayers';
import { RoofLayer } from '../world/RoofLayer';
import { SpriteTextures } from '../world/SpriteTextures';

/**
 * The game world: ground and objects of the streamed chunks, entities sorted with them, the roofs of the
 * rooms over them, the darkness of the night over everything, and the camera.
 */
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
    const objects = new ObjectLayer(this, textures, content, gameClient.chunks);
    const roofs = new RoofLayer(this, textures, VIEW.roofFadeMs);
    const light = new LightLayer(this, content);
    const entities = new EntityLayer(this, textures);
    const localPlayer = new LocalPlayer(entities);
    const labels = new NameLabels(this);
    const remotePlayers = new RemotePlayers(entities, labels);
    const groundItems = new GroundItems(this, textures, content);
    const bubbles = new ChatBubbles(this, (entity) => entities.image(entity));
    const aim = new AimHighlight(this);
    const damageBars = new DamageBars(this);
    const combat = new CombatEffects(this, textures, content, (entity) => entities.image(entity));
    let playerSprite: Phaser.GameObjects.Image | undefined;
    const showChunk = (chunk: Chunk) => {
      ground.show(chunk);
      objects.show(chunk);
      roofs.show(chunk);
      light.show(chunk);
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
      const view = gameClient.localView();
      const sprite = localPlayer.update(view, timeMs);
      // Swings, blinking characters and damage numbers, over the characters just moved.
      combat.update(performance.now());
      // The roof of the room where the player stands fades out.
      roofs.update(gameClient.localRoom(view), deltaMs);
      // Day and night: the darkness, the halos of the lights and the glow around the player.
      light.update(gameClient.worldTime(), view);
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
          light.updateTile(chunk, x, y);
        } else {
          ground.updateTile(chunk.layer, x, y);
        }
      }),
      eventBus.on('tile.meta', ({ chunk, x, y }) => {
        objects.updateTile(chunk, x, y);
        roofs.updateTile(chunk, x, y);
      }),
      eventBus.on('tile.damaged', ({ layer, x, y, hp, maxHp }) =>
        damageBars.show(layer, x, y, hp, maxHp),
      ),
      eventBus.on('chunk.unloaded', ({ layer, cx, cy }) => {
        damageBars.clearChunk(layer, cx, cy);
        ground.hide(layer, cx, cy);
        objects.hide(layer, cx, cy);
        roofs.hide(layer, cx, cy);
        light.hide(layer, cx, cy);
      }),
      eventBus.on('chat.said', ({ entity, text }) => bubbles.say(entity, text)),
      eventBus.on('combat.swing', ({ entity, facing, item }) =>
        combat.swing(entity, facing, item, performance.now()),
      ),
      eventBus.on('combat.damaged', ({ entity, amount }) =>
        combat.damaged(entity, amount, performance.now()),
      ),
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
      combat.destroy();
      debugCamera?.destroy();
      ground.destroy();
      objects.destroy();
      roofs.destroy();
      light.destroy();
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
