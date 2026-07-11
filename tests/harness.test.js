import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessPath = resolve(__dirname, '../test-harness/index.html');

describe('TEST-01', () => {
  it('exposes exactly the 7 locked data-heed selectors from CONTRACT.md', () => {
    const html = readFileSync(harnessPath, 'utf-8');
    const window = new Window();
    const document = window.document;
    document.write(html);

    const elements = document.querySelectorAll('[data-heed]');
    expect(elements.length).toBe(7);
  });
});
