import { type Chunk, VIEW, WORLD } from '@8box/shared';
import * as Phaser from 'phaser';
import { AssetRegistry } from '../../assets/registry';
import { gameClient } from '../../game/client';
import { content } from '../../game/content';
import { eventBus } from '../../game/events';
import { DebugCamera } from '../DebugCamera';
import { atlasFromScene } from '../world/atlasFromScene';
import { GroundLayer } from '../world/GroundLayer';
import { ObjectLayer } from '../world/ObjectLayer';
import { SpriteTextures } from '../world/SpriteTextures';

const TILE_PX = WORLD.tileSizePx;
const WORLD_PX = WORLD.layerSizeTiles * TILE_PX;

/** The game world: ground and objects of the streamed chunks, and the camera. */
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
    const showChunk = (chunk: Chunk) => {
      ground.show(chunk);
      objects.show(chunk);
    };
    const camera = this.cameras.main;
    camera.setZoom(VIEW.defaultZoom);
    camera.setBounds(0, 0, WORLD_PX, WORLD_PX);
    camera.centerOn(WORLD_PX / 2, WORLD_PX / 2);

    for (const chunk of gameClient.chunks.all()) {
      showChunk(chunk);
    }
    const unsubscribe = [
      eventBus.on('chunk.loaded', ({ chunk }) => showChunk(chunk)),
      eventBus.on('chunk.changed', ({ chunk }) => showChunk(chunk)),
      eventBus.on('chunk.unloaded', ({ layer, cx, cy }) => {
        ground.hide(layer, cx, cy);
        objects.hide(layer, cx, cy);
      }),
      eventBus.on('player.spawned', ({ position }) => {
        camera.centerOn(position.x * TILE_PX, position.y * TILE_PX);
      }),
    ];

    const emitView = () => {
      eventBus.emit('view.changed', {
        w: Math.max(1, Math.round(this.scale.width)),
        h: Math.max(1, Math.round(this.scale.height)),
        zoom: camera.zoom,
      });
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, emitView);
    emitView();

    if (import.meta.env.DEV) {
      this.debugCamera = new DebugCamera(this, emitView);
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      for (const off of unsubscribe) {
        off();
      }
      this.scale.off(Phaser.Scale.Events.RESIZE, emitView);
      ground.destroy();
      objects.destroy();
      textures.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  override update(_time: number, deltaMs: number): void {
    this.debugCamera?.update(deltaMs);
  }
}
