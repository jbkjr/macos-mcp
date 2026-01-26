/**
 * Message Parser
 * Parses attributedBody blob from macOS Ventura+ messages
 *
 * The attributedBody column contains an NSMutableAttributedString serialized
 * in Apple's typedstream format. This parser extracts the text content.
 */

/**
 * Decode a typedstream variable-length integer
 *
 * Apple's typedstream format uses variable-length encoding for string lengths:
 * - < 0x80: Single byte length
 * - 0x81: Following 2 bytes = u16 (little-endian)
 * - 0x82: Following 4 bytes = u32 (little-endian)
 *
 * @param blob - The buffer to read from
 * @param pos - Position in the buffer
 * @returns Object with decoded length and bytes consumed
 */
export function decodeTypedstreamLength(
  blob: Buffer,
  pos: number
): { length: number; bytesConsumed: number } {
  if (pos >= blob.length) return { length: 0, bytesConsumed: 0 };

  const firstByte = blob[pos];

  if (firstByte < 0x80) {
    return { length: firstByte, bytesConsumed: 1 };
  }

  switch (firstByte) {
    case 0x81: {
      // u16 little-endian
      if (pos + 2 >= blob.length) return { length: 0, bytesConsumed: 1 };
      const length = blob[pos + 1] | (blob[pos + 2] << 8);
      return { length, bytesConsumed: 3 };
    }
    case 0x82: {
      // u32 little-endian
      if (pos + 4 >= blob.length) return { length: 0, bytesConsumed: 1 };
      return { length: blob.readUInt32LE(pos + 1), bytesConsumed: 5 };
    }
    default:
      // Treat unknown markers as single-byte length
      return { length: firstByte, bytesConsumed: 1 };
  }
}

/**
 * Extract text from attributedBody blob
 *
 * macOS Ventura+ stores message text in the attributedBody column as a binary
 * plist containing an NSMutableAttributedString. The text is typically stored
 * after an "NSString" marker in the stream.
 *
 * @param blob - The raw attributedBody buffer
 * @returns Extracted text or empty string if parsing fails
 */
export function parseAttributedBody(blob: Buffer | null): string {
  if (!blob || blob.length === 0) {
    return '';
  }

  try {
    // Strategy 1: Look for NSString marker followed by length-prefixed string
    // The typedstream format often has: ...NSString<length_byte><string_data>...
    const nsStringMarker = Buffer.from('NSString');
    let markerIndex = blob.indexOf(nsStringMarker);

    if (markerIndex !== -1) {
      // Skip past the marker and look for the string
      let pos = markerIndex + nsStringMarker.length;

      // Skip any null bytes or metadata between marker and content
      while (pos < blob.length && (blob[pos] === 0 || blob[pos] < 32)) {
        pos++;
      }

      // Check for a length byte (or multi-byte length)
      if (pos < blob.length) {
        const { length: possibleLength, bytesConsumed } = decodeTypedstreamLength(blob, pos);

        // If it looks like a reasonable string length
        if (possibleLength > 0 && possibleLength < 100000 && pos + bytesConsumed + possibleLength <= blob.length) {
          const extracted = blob.subarray(pos + bytesConsumed, pos + bytesConsumed + possibleLength).toString('utf8');
          // Verify it looks like text (printable characters)
          if (isPrintableText(extracted)) {
            return extracted;
          }
        }
      }
    }

    // Strategy 2: Look for "NSMutableString" marker
    const nsMutableMarker = Buffer.from('NSMutableString');
    markerIndex = blob.indexOf(nsMutableMarker);

    if (markerIndex !== -1) {
      let pos = markerIndex + nsMutableMarker.length;
      while (pos < blob.length && (blob[pos] === 0 || blob[pos] < 32)) {
        pos++;
      }

      if (pos < blob.length) {
        const { length: possibleLength, bytesConsumed } = decodeTypedstreamLength(blob, pos);
        if (possibleLength > 0 && possibleLength < 100000 && pos + bytesConsumed + possibleLength <= blob.length) {
          const extracted = blob.subarray(pos + bytesConsumed, pos + bytesConsumed + possibleLength).toString('utf8');
          if (isPrintableText(extracted)) {
            return extracted;
          }
        }
      }
    }

    // Strategy 3: Look for streamtyped header and extract text after it
    // The streamtyped format has a header followed by the actual content
    const streamHeader = Buffer.from('streamtyped');
    if (blob.indexOf(streamHeader) !== -1) {
      // Try to find printable text regions in the blob
      const text = extractPrintableRegions(blob);
      if (text.length > 0) {
        return text;
      }
    }

    // Strategy 4: Fallback - try to extract any reasonable text
    const fallbackText = extractPrintableRegions(blob);
    if (fallbackText.length > 0) {
      return fallbackText;
    }

    return '';
  } catch {
    // If parsing fails, return empty string
    return '';
  }
}

/**
 * Check if a string contains mostly printable characters
 */
function isPrintableText(str: string): boolean {
  if (!str || str.length === 0) return false;

  let printableCount = 0;
  for (const char of str) {
    const code = char.charCodeAt(0);
    // Printable ASCII, common unicode, newlines, tabs
    if ((code >= 32 && code <= 126) || code > 127 || code === 10 || code === 13 || code === 9) {
      printableCount++;
    }
  }

  // At least 80% should be printable
  return printableCount / str.length >= 0.8;
}

/**
 * Extract contiguous regions of printable text from a buffer
 */
function extractPrintableRegions(blob: Buffer): string {
  const regions: string[] = [];
  let regionStart = -1;

  for (let i = 0; i < blob.length; i++) {
    const byte = blob[i];
    // Check if this is a printable ASCII character or valid UTF-8 start
    const isPrintable =
      (byte >= 32 && byte <= 126) || // printable ASCII
      byte === 10 ||
      byte === 13 ||
      byte === 9 || // newline, carriage return, tab
      (byte >= 192 && byte <= 247); // UTF-8 multibyte start

    if (isPrintable) {
      if (regionStart === -1) {
        regionStart = i;
      }
    } else if (regionStart !== -1) {
      // End of printable region
      const region = blob.subarray(regionStart, i).toString('utf8');
      if (region.length >= 2 && isPrintableText(region)) {
        regions.push(region);
      }
      regionStart = -1;
    }
  }

  // Handle final region
  if (regionStart !== -1) {
    const region = blob.subarray(regionStart).toString('utf8');
    if (region.length >= 2 && isPrintableText(region)) {
      regions.push(region);
    }
  }

  // Find the longest region that looks like actual message content
  // (not metadata like "NSString", "NSMutableAttributedString", etc.)
  const filteredRegions = regions.filter(
    (r) =>
      r.length >= 2 &&
      !r.startsWith('NS') &&
      !r.startsWith('streamtyped') &&
      !r.includes('NSString') &&
      !r.includes('NSMutableAttributedString')
  );

  if (filteredRegions.length > 0) {
    // Return the longest filtered region
    return filteredRegions.reduce((a, b) => (a.length > b.length ? a : b));
  }

  return '';
}

/**
 * Get message text, preferring the text column but falling back to attributedBody
 */
export function getMessageText(textColumn: string | null, attributedBody: Buffer | null): string {
  // Prefer the plain text column if available
  if (textColumn && textColumn.trim().length > 0) {
    return textColumn;
  }

  // Fall back to parsing attributedBody (macOS Ventura+)
  return parseAttributedBody(attributedBody);
}
