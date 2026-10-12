/**
 * Renders the art without the game: a sheet of every placeholder sprite and variant, and a piece of a
 * generated map drawn like the game does (ground variants, patches, edges, then objects sorted by Y).
 * Usage: pnpm tools:tiles [seed]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  baseContent,
  CHUNK_SIZE,
  type Chunk,
  chunkCoord,
  createSurfaceGenerator,
  loadContent,
  localCoord,
  parseSeed,
  tileIndex,
  tileOfCode,
  WORLD,
} from '@8box/shared';
import { PNG } from 'pngjs';
import { type GroundLookup, planGroundTile } from '../src/assets/groundArt';
import { objectVariant } from '../src/assets/objectArt';
import {
  MISSING_PLACEHOLDER,
  type Placeholder,
  pickVariant,
  placeholderFor,
  placeholderIds,
} from '../src/assets/placeholders';
import { objectAnchor } from '../src/phaser/depth';

const TILE = WORLD.tileSizePx;
/** Screen pixels per art pixel in the preview images. */
const SHEET_SCALE = 6;
const MAP_SCALE = 4;
/** Size of the map excerpt, in tiles. */
const MAP_WIDTH_TILES = 96;
const MAP_HEIGHT_TILES = 64;
/** Size of the close-up at the center of the excerpt, in tiles (shown without downscaling). */
const CLOSE_UP_WIDTH_TILES = 30;
const CLOSE_UP_HEIGHT_TILES = 20;
/** Spacing of the candidate excerpt centers, in tiles. */
const SEARCH_STEP_TILES = 48;
const BACKGROUND = [27, 27, 36] as const;

class Canvas {
  readonly png: PNG;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.png = new PNG({ width, height });
    for (let i = 0; i < width * height; i++) {
      this.png.data.set([...BACKGROUND, 255], i * 4);
    }
  }

  /** Draws a sprite variant with its top-left corner at (x, y), each art pixel as a scale × scale square. */
  sprite(placeholder: Placeholder, variant: number, x: number, y: number, scale: number): void {
    placeholder.draw((px, py, color) => {
      const rgb = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = x + px * scale + dx;
          const sy = y + py * scale + dy;
          if (sx >= 0 && sy >= 0 && sx < this.width && sy < this.height) {
            this.png.data.set([...rgb, 255], (sy * this.width + sx) * 4);
          }
        }
      }
    }, variant);
  }

  save(file: string): void {
    writeFileSync(file, PNG.sync.write(this.png));
  }
}

/** One row per sprite id (as tall as its sprite), one cell per variant. */
function renderSheet(file: string): void {
  const ids = placeholderIds();
  const placeholders = ids.map((id) => placeholderFor(id) ?? MISSING_PLACEHOLDER);
  const gap = 4;
  const cell = TILE * SHEET_SCALE + gap;
  const columns = Math.max(...placeholders.map((placeholder) => placeholder.weights.length));
  const rowHeights = placeholders.map((placeholder) => placeholder.height * SHEET_SCALE + gap);
  const height = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, gap);
  const canvas = new Canvas(columns * cell + gap, height);
  let y = gap;
  placeholders.forEach((placeholder, row) => {
    placeholder.weights.forEach((_, variant) => {
      canvas.sprite(placeholder, variant, gap + variant * cell, y, SHEET_SCALE);
    });
    y += rowHeights[row] ?? 0;
  });
  canvas.save(file);
  process.stdout.write(`sheet: ${ids.length} sprites → ${file}\n`);
}

function renderMap(seed: number, file: string): void {
  const content = loadContent(baseContent);
  const generator = createSurfaceGenerator({ seed, content });
  const chunks = new Map<string, Chunk>();
  const chunkAt = (cx: number, cy: number) => {
    const key = `${cx},${cy}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = generator.generateChunk(cx, cy);
      chunks.set(key, chunk);
    }
    return chunk;
  };
  const size = WORLD.layerSizeTiles;
  const lookup: GroundLookup = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return undefined;
    }
    const chunk = chunkAt(chunkCoord(x), chunkCoord(y));
    const index = tileIndex(localCoord(x), localCoord(y));
    return {
      ground: tileOfCode(content, chunk.ground[index] ?? 0)?.sprite,
      floor: tileOfCode(content, chunk.floor[index] ?? 0)?.sprite,
    };
  };

  const objectAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return undefined;
    }
    const chunk = chunkAt(chunkCoord(x), chunkCoord(y));
    return tileOfCode(content, chunk.object[tileIndex(localCoord(x), localCoord(y))] ?? 0)?.sprite;
  };

  // Pick the excerpt with the most kinds of ground, preferring the spawn on ties.
  let best = { x: Math.floor(generator.spawn.x), y: Math.floor(generator.spawn.y), score: -1 };
  for (let cy = SEARCH_STEP_TILES; cy < size - SEARCH_STEP_TILES; cy += SEARCH_STEP_TILES) {
    for (let cx = SEARCH_STEP_TILES; cx < size - SEARCH_STEP_TILES; cx += SEARCH_STEP_TILES) {
      const kinds = new Set<string | undefined>();
      for (let dy = -MAP_HEIGHT_TILES / 2; dy < MAP_HEIGHT_TILES / 2; dy += 4) {
        for (let dx = -MAP_WIDTH_TILES / 2; dx < MAP_WIDTH_TILES / 2; dx += 4) {
          kinds.add(lookup(cx + dx, cy + dy)?.ground);
        }
      }
      if (kinds.size > best.score) {
        best = { x: cx, y: cy, score: kinds.size };
      }
    }
  }

  const drawRegion = (
    center: { x: number; y: number },
    widthTiles: number,
    heightTiles: number,
    scale: number,
    out: string,
  ) => {
    const x0 = Math.floor(center.x - widthTiles / 2);
    const y0 = Math.floor(center.y - heightTiles / 2);
    const canvas = new Canvas(widthTiles * TILE * scale, heightTiles * TILE * scale);
    for (let ty = 0; ty < heightTiles; ty++) {
      for (let tx = 0; tx < widthTiles; tx++) {
        for (const draw of planGroundTile(x0 + tx, y0 + ty, lookup)) {
          const placeholder = placeholderFor(draw.sprite);
          if (placeholder) {
            const variant = pickVariant(placeholder, draw.variant);
            canvas.sprite(placeholder, variant, tx * TILE * scale, ty * TILE * scale, scale);
          }
        }
      }
    }
    // Objects row by row, top to bottom: the order of their depth in the game.
    for (let ty = 0; ty < heightTiles; ty++) {
      for (let tx = 0; tx < widthTiles; tx++) {
        const sprite = objectAt(x0 + tx, y0 + ty);
        const placeholder = sprite === undefined ? undefined : placeholderFor(sprite);
        if (placeholder) {
          const variant = pickVariant(placeholder, objectVariant(x0 + tx, y0 + ty));
          const anchor = objectAnchor(tx, ty);
          const left = (anchor.x - placeholder.width / 2) * scale;
          const top = (anchor.y - placeholder.height) * scale;
          canvas.sprite(placeholder, variant, left, top, scale);
        }
      }
    }
    canvas.save(out);
    process.stdout.write(
      `map: seed ${seed}, tiles (${x0}, ${y0}) to (${x0 + widthTiles}, ${y0 + heightTiles}) → ${out}\n`,
    );
  };
  drawRegion(best, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, MAP_SCALE, file);
  drawRegion(
    best,
    CLOSE_UP_WIDTH_TILES,
    CLOSE_UP_HEIGHT_TILES,
    MAP_SCALE,
    file.replace('.png', '-zoom.png'),
  );
  drawRegion(
    generator.spawn,
    CLOSE_UP_WIDTH_TILES,
    CLOSE_UP_HEIGHT_TILES,
    MAP_SCALE,
    file.replace('.png', '-spawn.png'),
  );
}

const seed = parseSeed(process.argv[2] ?? '8box');
renderSheet(resolve('tiles-sheet.png'));
renderMap(seed, resolve(`tiles-map-${seed}.png`));
process.stdout.write(`chunk size ${CHUNK_SIZE} tiles\n`);
