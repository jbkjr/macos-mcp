/**
 * Strict Tool Inputs
 * Unknown keys are refused rather than stripped: a stripped key looks like
 * success to the caller while the change it asked for never happens.
 */

import { z } from 'zod';

export function strictObject<S extends z.ZodRawShape>(shape: S) {
  const allowed = Object.keys(shape).join(', ') || '(none)';
  return z.strictObject(shape, {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? `Unknown parameter(s): ${issue.keys.join(', ')}. Allowed: ${allowed}.`
        : undefined,
  });
}
