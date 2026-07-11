import { describe, it, expect, vi } from 'vitest';
import { emitSynthetic } from './fixtures/test-emitter.js';
import { collectReceived } from './fixtures/test-subscriber.js';

describe('BUS-01', () => {
  it('delivers a published signal to a subscriber with no direct import between them', () => {
    const handler = vi.fn();
    collectReceived(handler);
    emitSynthetic();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes the full published payload through detail — not just that it fired', () => {
    const handler = vi.fn();
    collectReceived(handler);
    emitSynthetic();
    expect(handler.mock.calls[0][0]).toEqual({
      type: 'touch_hesitation',
      targetSelector: 'confirm-cta',
      bbox: {},
      timestamp: expect.any(Number),
    });
  });
});
