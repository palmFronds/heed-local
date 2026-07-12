import { describe, it, expect } from 'vitest';
import { init } from '../src/index.js';
import demoConfig from '../config/demo-platform.json';

describe('init() orchestrator', () => {
  it('returns { config, publish, subscribe } on valid config', () => {
    const result = init(demoConfig);
    expect(result.config).toBe(demoConfig);
    expect(typeof result.publish).toBe('function');
    expect(typeof result.subscribe).toBe('function');
  });

  it('hard-fails (throws) on invalid config before exposing any bus interface', () => {
    let result;
    let threw = false;
    try {
      result = init({ platformId: 'x' });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(result).toBeUndefined();
  });
});
