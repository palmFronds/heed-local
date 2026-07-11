import { publish } from '../../src/bus.js';

export function emitSynthetic() {
  publish('signal:detected', {
    type: 'touch_hesitation',
    targetSelector: 'confirm-cta',
    bbox: {},
    timestamp: Date.now(),
  });
}
