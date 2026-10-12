/**
 * Exports the generated surface as a PNG (1 pixel = 1 tile), to check the generation without the game.
 * Usage: pnpm tools:map [seed] [file.png]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { baseContent, CONFIG, LAYER, loadContent, parseSeed } from '@8box/shared';
import { PNG } from 'pngjs';
import { randomSeed } from '../world/seed';
import { World } from '../world/World';

type Rgb = readonly [number, number, number];

/** Map colors by tile id; the object of a tile hides its ground. */
const COLORS: Record<string, Rgb> = {
  'base:grass': [104, 170, 76],
  'base:dirt': [146, 108, 70],
  'base:sand': [228, 212, 152],
  'base:shallow_water': [96, 164, 222],
  'base:deep_water': [38, 86, 164],
  'base:oak_tree': [28, 88, 40],
  'base:berry_bush': [176, 48, 84],
  'base:tall_grass': [150, 206, 96],
  'base:flowers': [244, 204, 64],
};
const UNKNOWN: Rgb = [255, 0, 255];
const SPAWN: Rgb = [255, 255, 255];
/** Half-size of the spawn marker, in pixels. */
const SPAWN_MARK_RADIUS = 2;

const [seedArg, fileArg] = process.argv.slice(2);
const seed = seedArg === undefined ? randomSeed() : parseSeed(seedArg);
const file = resolve(fileArg ?? `map-${seed}.png`);

const content = loadContent(baseContent);
const start = performance.now();
const world = World.generate({ seed, content, layerSizeTiles: CONFIG.world.layerSizeTiles });
const generationMs = performance.now() - start;

const size = world.layerSizeTiles;
const png = new PNG({ width: size, height: size });
const counts = new Map<string, number>();
const paint = (x: number, y: number, [r, g, b]: Rgb) => {
  const offset = (y * size + x) * 4;
  png.data[offset] = r;
  png.data[offset + 1] = g;
  png.data[offset + 2] = b;
  png.data[offset + 3] = 255;
};

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const ground = world.getTile(LAYER.surface, x, y, 'ground');
    const object = world.getTile(LAYER.surface, x, y, 'object');
    for (const tile of [ground, object]) {
      if (tile) {
        counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
      }
    }
    const shown = object ?? ground;
    paint(x, y, (shown && COLORS[shown.id]) ?? UNKNOWN);
  }
}
const spawnX = Math.floor(world.spawn.x);
const spawnY = Math.floor(world.spawn.y);
for (let d = -SPAWN_MARK_RADIUS; d <= SPAWN_MARK_RADIUS; d++) {
  paint(spawnX + d, spawnY, SPAWN);
  paint(spawnX, spawnY + d, SPAWN);
}

writeFileSync(file, PNG.sync.write(png));

const lines = [
  `seed ${seed}: ${size} × ${size} tiles generated in ${Math.round(generationMs)} ms`,
  ...[...counts]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, count]) => `  ${id.padEnd(20)} ${((count / (size * size)) * 100).toFixed(1)} %`),
  `map written to ${file}`,
];
process.stdout.write(`${lines.join('\n')}\n`);
