import { subscribe } from '../../src/bus.js';

export function collectReceived(onReceive) {
  return subscribe('signal:detected', onReceive);
}
