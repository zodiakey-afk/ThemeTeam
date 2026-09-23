import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import { validateError, validateSnapshot } from '../src/validators.mjs';
import schema from '../src/workspace-schema.json';
import errorSchema from '../src/error-schema.json';

describe('WB-CSP standalone validators', () => {
  it('matches the original error contract on valid and hostile inputs', () => {
    const original = new Ajv2020({ allErrors: false, strict: false }).compile(errorSchema);
    for (const value of [null, [], {}, { error: null }, { error: { code: 'conflict', message: 'conflict' } },
      { error: { code: 'conflict' } }, { error: { code: 400, message: 'bad' } },
      { error: { code: 'unknown', message: '<img onerror=alert(1)>' } },
      { error: { code: 'conflict', message: 'bad', extra: true } }]) {
      expect(validateError(value)).toBe(original(value));
    }
  });

  it('matches the original snapshot contract for malformed inputs', () => {
    const original = new Ajv2020({ allErrors: false, strict: false }).compile(schema);
    for (const value of [null, [], {}, false, 0, { agents: [] }, { tasks: 'bad' },
      { agents: [{ id: '__proto__', name: '<svg onload=alert(1)>' }] }]) {
      expect(validateSnapshot(value)).toBe(original(value));
    }
  });
});
