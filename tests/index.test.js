import { describe, it, expect } from 'vitest';
import { init, initDemo } from '../src/index.js';
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

// RED (Wave 0, Phase 5): initDemo() currently ignores any argument passed to
// it and always uses the bundled demoConfig unmodified -- D-01's "harness
// fetches then injects into config before init" has no code path to do the
// injecting yet (05-RESEARCH.md Pitfall 2, Architecture Pattern 1). These
// cases are RED until Plan 05-0x adds the optional overrides parameter.
describe('initDemo(overrides)', () => {
  // A valid {W1,b1,W2,b2} fixture mirroring admin/weights.js's shape
  // (05-RESEARCH.md Code Examples) -- hand-authored inline, independent of
  // the generated admin/weights.js module.
  const OVERRIDE_WEIGHTS = {
    W1: [
      [0.5, -0.3, 0.2, 0.1],
      [-0.4, 0.6, -0.1, 0.3],
      [0.2, 0.1, -0.5, 0.4],
      [-0.1, 0.2, 0.3, -0.6],
    ],
    b1: [0.1, -0.2, 0.05, 0.0],
    W2: [
      [0.3, -0.2, 0.5, 0.1],
      [-0.1, 0.4, 0.2, -0.3],
      [0.2, 0.1, -0.4, 0.5],
      [0.4, -0.3, 0.1, 0.2],
    ],
    b2: [0.0, 0.1, -0.1, 0.05],
  };

  it('initDemo override injects the given weights into config.inference.weights before init runs', () => {
    const withOverride = initDemo({ weights: OVERRIDE_WEIGHTS });
    expect(withOverride.config.inference.weights).toEqual(OVERRIDE_WEIGHTS);

    // A bare initDemo() call (no argument) must NOT carry any injected
    // weights -- proving the override is additive/opt-in, not a permanent
    // mutation of the shared bundled demoConfig object.
    const bare = initDemo();
    expect(bare.config.inference.weights).toBeUndefined();
  });

  it('cold-start fallback: initDemo() and initDemo({}) do not throw and leave weights unset', () => {
    expect(() => initDemo()).not.toThrow();
    expect(() => initDemo({})).not.toThrow();

    const noArg = initDemo();
    expect(noArg.config.inference.weights).toBeUndefined();

    const emptyOverrides = initDemo({});
    expect(emptyOverrides.config.inference.weights).toBeUndefined();
  });
});
