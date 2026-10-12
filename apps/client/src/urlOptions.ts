/** Longest simulated latency accepted in the URL, in ms. */
const MAX_SIMULATED_LAG_MS = 2000;

/** Simulated round trip latency asked by `?lag=150` in a URL query, in ms (0 = none). */
export function lagFromQuery(search: string): number {
  const value = new URLSearchParams(search).get('lag');
  return value !== null && /^\d+$/.test(value) ? Math.min(Number(value), MAX_SIMULATED_LAG_MS) : 0;
}

/** Whether `?touch=1` in a URL query asks for the touch controls (to try them on a PC). */
export function touchFromQuery(search: string): boolean {
  return new URLSearchParams(search).get('touch') === '1';
}
