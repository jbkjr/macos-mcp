/**
 * Message Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseAttributedBody, getMessageText, decodeTypedstreamLength } from './parser.js';

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

describe('decodeTypedstreamLength', () => {
  it('should decode single byte length (< 0x80)', () => {
    const blob = Buffer.from([0x50]); // 80 in decimal
    const result = decodeTypedstreamLength(blob, 0);
    expect(result.length).toBe(80);
    expect(result.bytesConsumed).toBe(1);
  });

  it('should decode u16 length (0x81 marker)', () => {
    // 0x81 followed by u16 little-endian: 300 = 0x012C -> bytes [0x2C, 0x01]
    const blob = Buffer.from([0x81, 0x2c, 0x01]);
    const result = decodeTypedstreamLength(blob, 0);
    expect(result.length).toBe(300);
    expect(result.bytesConsumed).toBe(3);
  });

  it('should decode u32 length (0x82 marker)', () => {
    // 0x82 followed by u32 little-endian: 70000 = 0x00011170 -> bytes [0x70, 0x11, 0x01, 0x00]
    const blob = Buffer.from([0x82, 0x70, 0x11, 0x01, 0x00]);
    const result = decodeTypedstreamLength(blob, 0);
    expect(result.length).toBe(70000);
    expect(result.bytesConsumed).toBe(5);
  });

  it('should handle position past buffer end', () => {
    const blob = Buffer.from([0x50]);
    const result = decodeTypedstreamLength(blob, 5);
    expect(result.length).toBe(0);
    expect(result.bytesConsumed).toBe(0);
  });

  it('should handle truncated u16 (not enough bytes)', () => {
    const blob = Buffer.from([0x81, 0x2c]); // Missing second byte
    const result = decodeTypedstreamLength(blob, 0);
    expect(result.length).toBe(0);
    expect(result.bytesConsumed).toBe(1);
  });

  it('should handle truncated u32 (not enough bytes)', () => {
    const blob = Buffer.from([0x82, 0x70, 0x11]); // Missing bytes
    const result = decodeTypedstreamLength(blob, 0);
    expect(result.length).toBe(0);
    expect(result.bytesConsumed).toBe(1);
  });
});

describe('parseAttributedBody with long messages', () => {
  it('should extract text with 255 characters (boundary case)', () => {
    const text = 'A'.repeat(255);
    const marker = Buffer.from('NSString');
    const lengthByte = Buffer.from([255]); // Single byte length
    const textBuffer = Buffer.from(text);
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthByte, textBuffer, padding]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
    expect(result.length).toBe(255);
  });

  it('should extract text with 300 characters (u16 encoding)', () => {
    const text = 'B'.repeat(300);
    const marker = Buffer.from('NSString');
    // u16 encoding: 0x81 followed by 300 (0x012C) in little-endian
    const lengthBytes = Buffer.from([0x81, 0x2c, 0x01]);
    const textBuffer = Buffer.from(text);
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthBytes, textBuffer, padding]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
    expect(result.length).toBe(300);
  });

  it('should extract text with 2500+ characters', () => {
    const text = 'C'.repeat(2500);
    const marker = Buffer.from('NSString');
    // u16 encoding: 0x81 followed by 2500 (0x09C4) in little-endian
    const lengthBytes = Buffer.from([0x81, 0xc4, 0x09]);
    const textBuffer = Buffer.from(text);
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthBytes, textBuffer, padding]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
    expect(result.length).toBe(2500);
  });

  it('should extract text with 70000+ characters (u32 encoding)', () => {
    const text = 'D'.repeat(70000);
    const marker = Buffer.from('NSString');
    // u32 encoding: 0x82 followed by 70000 in little-endian
    const lengthBytes = Buffer.from([0x82, 0x70, 0x11, 0x01, 0x00]);
    const textBuffer = Buffer.from(text);
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthBytes, textBuffer, padding]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
    expect(result.length).toBe(70000);
  });

  it('should extract NSMutableString with long text', () => {
    const text = 'E'.repeat(500);
    const marker = Buffer.from('NSMutableString');
    // u16 encoding: 0x81 followed by 500 (0x01F4) in little-endian
    const lengthBytes = Buffer.from([0x81, 0xf4, 0x01]);
    const textBuffer = Buffer.from(text);
    const padding = Buffer.from([0, 0, 0, 0, 0]);

    const blob = Buffer.concat([padding, marker, padding, lengthBytes, textBuffer, padding]);

    const result = parseAttributedBody(blob);
    expect(result).toBe(text);
    expect(result.length).toBe(500);
  });
});
