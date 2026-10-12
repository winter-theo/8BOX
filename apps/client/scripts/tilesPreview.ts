/**
 * Renders the ground art without the game: a sheet of every placeholder sprite and variant, and a piece
 * of a generated map drawn exactly like the game does (variants, patches, edges).
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
import {
  MISSING_PLACEHOLDER,
  type Placeholder,
  pickVariant,
  placeholderFor,
  placeholderIds,
} from '../src/assets/placeholders';

const TILE = WORLD.tileSizePx;
/** Screen pixels per art pixel in the preview images. */
const SHEET_SCALE = 6;
const MAP_SCALE = 4;
/** Size of the map excerpt, in tiles. */
const MAP_WIDTH_TILES = 96;
const MAP_HEIGHT_TILES = 64;
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

/** One row per sprite id, one cell per variant. */
function renderSheet(file: string): void {
  const ids = placeholderIds();
  const cell = TILE * SHEET_SCALE + 4;
  const columns = Math.max(...ids.map((id) => placeholderFor(id)?.weights.length ?? 1));
  const canvas = new Canvas(columns * cell + 4, ids.length * cell + 4);
  ids.forEach((id, row) => {
    const placeholder = placeholderFor(id) ?? MISSING_PLACEHOLDER;
    placeholder.weights.forEach((_, variant) => {
      canvas.sprite(placeholder, variant, 4 + variant * cell, 4 + row * cell, SHEET_SCALE);
    });
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

  const x0 = best.x - MAP_WIDTH_TILES / 2;
  const y0 = best.y - MAP_HEIGHT_TILES / 2;
  const canvas = new Canvas(
    MAP_WIDTH_TILES * TILE * MAP_SCALE,
    MAP_HEIGHT_TILES * TILE * MAP_SCALE,
  );
  for (let ty = 0; ty < MAP_HEIGHT_TILES; ty++) {
    for (let tx = 0; tx < MAP_WIDTH_TILES; tx++) {
      for (const draw of planGroundTile(x0 + tx, y0 + ty, lookup)) {
        const placeholder = placeholderFor(draw.sprite);
        if (!placeholder) {
          continue;
        }
        const variant = pickVariant(placeholder, draw.variant);
        canvas.sprite(
          placeholder,
          variant,
          tx * TILE * MAP_SCALE,
          ty * TILE * MAP_SCALE,
          MAP_SCALE,
        );
      }
    }
  }
  canvas.save(file);
  process.stdout.write(
    `map: seed ${seed}, tiles (${x0}, ${y0}) to (${x0 + MAP_WIDTH_TILES}, ${y0 + MAP_HEIGHT_TILES}) → ${file}\n`,
  );
}

const seed = parseSeed(process.argv[2] ?? '8box');
renderSheet(resolve('tiles-sheet.png'));
renderMap(seed, resolve(`tiles-map-${seed}.png`));
process.stdout.write(`chunk size ${CHUNK_SIZE} tiles\n`);
