import { VIEW } from '@8box/shared';
import { type PointerEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { eventBus } from '../../game/events';
import { joystickDirection, knobOffset } from './joystickMath';

const RADIUS = VIEW.joystickRadiusPx;

/**
 * Virtual joystick: a large zone on the left of the screen. The stick appears under the thumb, follows it
 * within its radius and goes back home when released. It sends the same direction as the keyboard. The
 * knob moves through the DOM directly: React does not re-render at the pace of the thumb.
 */
export function Joystick() {
  const { t } = useTranslation();
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const touch = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const direction = useRef(0);

  const setDirection = (dir: number) => {
    if (dir !== direction.current) {
      direction.current = dir;
      eventBus.emit('input.direction', { dir });
    }
  };
  const release = () => {
    touch.current = null;
    base.current?.style.removeProperty('left');
    base.current?.style.removeProperty('top');
    knob.current?.style.removeProperty('transform');
    setDirection(0);
  };
  // Leaving the game (or the touch mode) must not leave the player walking.
  useEffect(
    () => () => {
      if (direction.current !== 0) {
        eventBus.emit('input.direction', { dir: 0 });
      }
    },
    [],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (touch.current) {
      return; // One thumb at a time.
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const zone = event.currentTarget.getBoundingClientRect();
    touch.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    if (base.current) {
      base.current.style.left = `${event.clientX - zone.left}px`;
      base.current.style.top = `${event.clientY - zone.top}px`;
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = touch.current;
    if (!start || event.pointerId !== start.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const offset = knobOffset(dx, dy, RADIUS);
    if (knob.current) {
      knob.current.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }
    setDirection(joystickDirection(dx, dy, RADIUS));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === touch.current?.pointerId) {
      release();
    }
  };

  return (
    <div
      className="joystick-zone"
      role="application"
      aria-label={t('ui.mobile.joystick')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={base} className="joystick-base">
        <div ref={knob} className="joystick-knob" />
      </div>
    </div>
  );
}
