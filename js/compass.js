// Device heading: reads the orientation sensor where available, smooths it, and
// reports degrees clockwise from true/magnetic north. Falls back to null heading
// (north-up mode) when there is no sensor or permission is denied.

import { angleDelta } from './geo.js';

const SMOOTHING = 0.25; // exponential moving average factor per event

export class Compass {
  constructor(onChange) {
    this.onChange = onChange; // (headingDegrees|null, mode: 'live'|'north-up') => void
    this.heading = null;
    this.mode = 'north-up';
    this._gotEvent = false;
    this._handler = (e) => this._onEvent(e);
  }

  // iOS 13+ requires an explicit permission request from a user gesture.
  static needsPermission() {
    return (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    );
  }

  static isLikelyMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)); // iPadOS
  }

  // Returns true if live compass events started arriving, false → north-up.
  async start() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      this._setNorthUp();
      return false;
    }
    if (Compass.needsPermission()) {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          this._setNorthUp();
          return false;
        }
      } catch {
        this._setNorthUp();
        return false;
      }
    }
    // Prefer absolute orientation (Android/Chrome); plain event covers iOS,
    // whose events carry webkitCompassHeading.
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', this._handler);
    }
    window.addEventListener('deviceorientation', this._handler);

    // If no usable event shows up quickly (desktop), settle into north-up.
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this._gotEvent) this._setNorthUp();
        resolve(this._gotEvent);
      }, 1500);
    });
  }

  stop() {
    window.removeEventListener('deviceorientationabsolute', this._handler);
    window.removeEventListener('deviceorientation', this._handler);
  }

  _setNorthUp() {
    this.mode = 'north-up';
    this.heading = null;
    this.onChange(null, 'north-up');
  }

  _onEvent(e) {
    let raw = null;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      raw = e.webkitCompassHeading; // iOS: already clockwise from north
    } else if (e.absolute === true || e.type === 'deviceorientationabsolute') {
      if (typeof e.alpha === 'number' && e.alpha !== null) {
        raw = (360 - e.alpha) % 360; // alpha is counterclockwise
      }
    }
    if (raw === null) return;

    // Compensate for screen rotation (landscape phones).
    const screenAngle =
      (screen.orientation && typeof screen.orientation.angle === 'number')
        ? screen.orientation.angle
        : (typeof window.orientation === 'number' ? window.orientation : 0);
    raw = (raw + screenAngle + 360) % 360;

    this._gotEvent = true;
    this.mode = 'live';
    if (this.heading === null) {
      this.heading = raw;
    } else {
      this.heading = (this.heading + SMOOTHING * angleDelta(this.heading, raw) + 360) % 360;
    }
    this.onChange(this.heading, 'live');
  }
}

// Rotates elements to a target angle without the 359→0 "spin around" glitch
// (continuous unbounded angle, shortest arc), animated as a damped spring so
// the needle overshoots and settles like a real magnetized needle.
export class SmoothRotator {
  constructor(el, { stiffness = 0.09, damping = 0.82 } = {}) {
    this.el = el;
    this.angle = 0;
    this.target = 0;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this._raf = null;
    this._instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  set(targetDeg) {
    this.target += angleDelta(((this.target % 360) + 360) % 360, ((targetDeg % 360) + 360) % 360);
    if (this._instant) {
      this.angle = this.target;
      this.el.style.transform = `rotate(${this.angle}deg)`;
      return;
    }
    if (this._raf === null) this._raf = requestAnimationFrame(() => this._tick());
  }

  _tick() {
    this.velocity += (this.target - this.angle) * this.stiffness;
    this.velocity *= this.damping;
    this.angle += this.velocity;
    if (Math.abs(this.velocity) < 0.02 && Math.abs(this.target - this.angle) < 0.05) {
      this.angle = this.target;
      this.velocity = 0;
      this._raf = null;
    } else {
      this._raf = requestAnimationFrame(() => this._tick());
    }
    this.el.style.transform = `rotate(${this.angle}deg)`;
  }
}
