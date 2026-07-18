import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config.js';
import schema from '../config/schema.json';
import demoConfig from '../config/demo-platform.json';

describe('CFG-01', () => {
  it('validates the demo platform config cleanly without throwing', () => {
    expect(() => validateConfig(demoConfig, schema)).not.toThrow();
  });

  it('returns the config unchanged when valid', () => {
    const result = validateConfig(demoConfig, schema);
    expect(result).toBe(demoConfig);
  });

  it('resolves all seven CONTRACT.md data-heed selectors verbatim', () => {
    const { selectors, completionSelector } = demoConfig;
    expect(selectors.amountInput).toBe('[data-heed="amount-input"]');
    expect(selectors.feeRow).toBe('[data-heed="fee-row"]');
    expect(selectors.minReceivedRow).toBe('[data-heed="min-received-row"]');
    expect(selectors.proceedCta).toBe('[data-heed="proceed-cta"]');
    expect(selectors.confirmCta).toBe('[data-heed="confirm-cta"]');
    expect(selectors.backBtn).toBe('[data-heed="back-btn"]');
    expect(completionSelector).toBe('[data-heed="flow-complete"]');
  });
});

describe('array type validation', () => {
  const arraySchema = { type: 'object', properties: { activeScreens: { type: 'array' } } };

  it('does not throw when an array value is validated against a { type: "array" } schema node', () => {
    expect(() =>
      validateConfig({ activeScreens: ['/swap', '/confirm'] }, arraySchema)
    ).not.toThrow();
  });

  it('hard-fails (throws) when a string is validated against a { type: "array" } schema node', () => {
    expect(() => validateConfig({ activeScreens: '/swap' }, arraySchema)).toThrow(
      /expected type "array"/
    );
  });

  it('hard-fails (throws) when a number is validated against a { type: "array" } schema node', () => {
    expect(() => validateConfig({ activeScreens: 42 }, arraySchema)).toThrow(
      /expected type "array"/
    );
  });

  it('hard-fails (throws) when a plain object is validated against a { type: "array" } schema node', () => {
    expect(() => validateConfig({ activeScreens: { foo: 'bar' } }, arraySchema)).toThrow(
      /expected type "array"/
    );
  });
});

describe('CFG-02', () => {
  it('hard-fails (throws) when required top-level fields are missing', () => {
    expect(() => validateConfig({ platformId: 'x' }, schema)).toThrow();
  });

  it('hard-fails (throws) when a field has the wrong type', () => {
    const badConfig = {
      platformId: 'x',
      completionSelector: '[data-heed="flow-complete"]',
      selectors: 'not-an-object',
    };
    expect(() => validateConfig(badConfig, schema)).toThrow();
  });

  it('never silently degrades — no partial/defaulted config is returned on failure', () => {
    let result;
    let threw = false;
    try {
      result = validateConfig({}, schema);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(result).toBeUndefined();
  });
});
