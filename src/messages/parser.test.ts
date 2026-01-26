/**
 * Message Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseAttributedBody, getMessageText } from './parser.js';

describe('parseAttributedBody', () => {
  it('should return empty string for null input', () => {
    expect(parseAttributedBody(null)).toBe('');
  });

  it('should return empty string for empty buffer', () => {
    expect(parseAttributedBody(Buffer.from([]))).toBe('');
  });

  it('should extract text after NSString marker', () => {
    // Simulated typedstream with NSString marker followed by length byte and text
    // Use a longer text so length byte (32+) doesn't conflict with control characters
    const text = 'This is a longer test message that exceeds 32 characters';
    const marker = Buffer.from('NSString');
    const lengthByte = Buffer.from([text.length]);
    const textBuffer = Buffer.from(text);
    // Use null bytes for padding (not printable characters)
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([
      Buffer.from('streamtyped'),
      padding,
      marker,
      padding,
      lengthByte,
      textBuffer,
      padding, // trailing padding
    ]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
  });

  it('should handle buffer with no recognizable markers', () => {
    const randomData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(parseAttributedBody(randomData)).toBe('');
  });

  it('should extract longest printable region as fallback', () => {
    // Buffer with some printable text surrounded by non-printable bytes
    const text = 'This is a test message';
    const blob = Buffer.concat([
      Buffer.from([0, 1, 2, 3]),
      Buffer.from(text),
      Buffer.from([0, 0, 0]),
    ]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
  });
});

describe('getMessageText', () => {
  it('should prefer text column when available', () => {
    const result = getMessageText('Plain text', Buffer.from('Some blob data'));
    expect(result).toBe('Plain text');
  });

  it('should use text column even when attributedBody is null', () => {
    const result = getMessageText('Plain text', null);
    expect(result).toBe('Plain text');
  });

  it('should fall back to attributedBody when text is null', () => {
    // Use longer text so length byte doesn't conflict with control characters
    const text = 'This is the fallback text from the attributed body';
    const marker = Buffer.from('NSString');
    const lengthByte = Buffer.from([text.length]);
    const textBuffer = Buffer.from(text);
    // Use null bytes for padding (not printable characters)
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthByte, textBuffer, padding]);

    const result = getMessageText(null, blob);
    expect(result).toBe(text);
  });

  it('should fall back to attributedBody when text is empty', () => {
    // Use longer text so length byte doesn't conflict with control characters
    const text = 'Text extracted from the blob data structure';
    const marker = Buffer.from('NSString');
    const lengthByte = Buffer.from([text.length]);
    const textBuffer = Buffer.from(text);
    // Use null bytes for padding (not printable characters)
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthByte, textBuffer, padding]);

    const result = getMessageText('', blob);
    expect(result).toBe(text);
  });

  it('should return empty string when both are empty/null', () => {
    const result = getMessageText(null, null);
    expect(result).toBe('');
  });
});
