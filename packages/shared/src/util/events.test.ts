import { describe, expect, it } from 'vitest';
import { TypedEmitter } from './events';

type TestEvents = {
  joined: { name: string };
  ticked: number;
};

describe('TypedEmitter', () => {
  it('delivers payloads synchronously, in subscription order', () => {
    const emitter = new TypedEmitter<TestEvents>();
    const calls: string[] = [];
    emitter.on('joined', ({ name }) => calls.push(`a:${name}`));
    emitter.on('joined', ({ name }) => calls.push(`b:${name}`));

    emitter.emit('joined', { name: 'Ana' });

    expect(calls).toEqual(['a:Ana', 'b:Ana']);
  });

  it('only calls listeners of the emitted event', () => {
    const emitter = new TypedEmitter<TestEvents>();
    const ticks: number[] = [];
    emitter.on('ticked', (tick) => ticks.push(tick));

    emitter.emit('joined', { name: 'Ana' });
    emitter.emit('ticked', 3);

    expect(ticks).toEqual([3]);
  });

  it('unsubscribes with the returned function or off()', () => {
    const emitter = new TypedEmitter<TestEvents>();
    const ticks: number[] = [];
    const listener = (tick: number) => ticks.push(tick);
    const unsubscribe = emitter.on('ticked', (tick) => ticks.push(tick * 10));
    emitter.on('ticked', listener);

    unsubscribe();
    emitter.off('ticked', listener);
    emitter.emit('ticked', 1);

    expect(ticks).toEqual([]);
    expect(emitter.listenerCount('ticked')).toBe(0);
  });

  it('calls a once() listener a single time', () => {
    const emitter = new TypedEmitter<TestEvents>();
    const ticks: number[] = [];
    emitter.once('ticked', (tick) => ticks.push(tick));

    emitter.emit('ticked', 1);
    emitter.emit('ticked', 2);

    expect(ticks).toEqual([1]);
  });

  it('lets a listener unsubscribe another one during dispatch', () => {
    const emitter = new TypedEmitter<TestEvents>();
    const calls: string[] = [];
    let unsubscribeB = () => {};
    emitter.on('ticked', () => {
      calls.push('a');
      unsubscribeB();
    });
    unsubscribeB = emitter.on('ticked', () => calls.push('b'));

    emitter.emit('ticked', 1);
    emitter.emit('ticked', 2);

    // The current dispatch still reaches b (snapshot), the next one does not.
    expect(calls).toEqual(['a', 'b', 'a']);
  });
});
