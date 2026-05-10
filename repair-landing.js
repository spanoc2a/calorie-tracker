const fs = require('fs');

// The landing page was originally UTF-8 but got corrupted:
// Each byte was read as CP1252 char, then re-saved as UTF-8 (double-encoded).
// Fix: for each char in the corrupted UTF-8 string,
//   1. Map it back to its CP1252 byte value
//   2. Then decode that byte as CP1252 → Unicode code point
//   3. Re-encode as UTF-8

// CP1252 byte 0x00-0x7F = same as Unicode
// CP1252 byte 0x80-0x9F = special chars (mapped below)
// CP1252 byte 0xA0-0xFF = same as Latin-1 (= Unicode code point)

const cp1252Codepoints = {
  0x80: 0x20AC, // €
  0x81: 0xFFFD, // undefined → replacement
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8D: 0xFFFD,
  0x8E: 0x017D, // Ž
  0x8F: 0xFFFD,
  0x90: 0xFFFD,
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9D: 0xFFFD,
  0x9E: 0x017E, // ž
  0x9F: 0x0178, // Ÿ
};

// Reverse map: Unicode codepoint → CP1252 byte (for 0x80-0x9F range only)
const unicodeToCp1252Byte = {};
for (const [byte, cp] of Object.entries(cp1252Codepoints)) {
  if (cp !== 0xFFFD) unicodeToCp1252Byte[cp] = parseInt(byte);
}

// Convert CP1252 byte → Unicode codepoint
function cp1252ByteToCodepoint(byte) {
  if (byte < 0x80) return byte;
  if (byte >= 0x80 && byte <= 0x9F) return cp1252Codepoints[byte] || 0xFFFD;
  return byte; // 0xA0-0xFF = same as Latin-1 = Unicode
}

// Read the CURRENT file (which still has double-encoded corruption from before our previous fix)
// Actually let's re-read from disk to check current state
const currentBuf = fs.readFileSync('app/landing/page.js');
const currentStr = currentBuf.toString('utf8'); // Will throw/mangle if invalid UTF-8

// Check if file is currently valid UTF-8 or partially fixed
// The current file may have been partially fixed by previous run
// Let's check for corruptions
const hasAe = currentStr.includes('Ã©');
const hasAslash = currentStr.includes('Ã');
const hasInvalid = currentBuf.includes(Buffer.from([0x80])); // bare 0x80 byte
console.log('Current state - has Ã©:', hasAe, '| has Ã:', hasAslash, '| has bare 0x80 byte:', hasInvalid);
console.log('First 100 bytes hex:', currentBuf.slice(12622, 12642).toString('hex'));

// The previous fix mapped unicode chars to CP1252 bytes but didn't fully convert to UTF-8.
// So the file now has raw CP1252 bytes embedded in otherwise-UTF-8 content.
// We need to: for each byte in the file,
// - If valid UTF-8 sequence: check if the resulting codepoint is a "corrupted" double-encoded char
// - If invalid (raw CP1252 byte 0x80-0x9F): treat as CP1252, decode to unicode, encode as UTF-8

// Actually it's complex because mixing. Let's just re-read the original corrupted string.
// But wait, our previous fix WROTE the file. So the file is now partially fixed.

// New approach: re-do the fix from the WRITTEN file's actual content.
// The file was written with Buffer.from(bytes) where bytes included raw 0x80-0x9F values.
// These bytes are invalid UTF-8. Let's read the file as binary and re-process.

const rawBytes = Array.from(currentBuf); // raw byte array
const result = [];
let i = 0;

while (i < rawBytes.length) {
  const b = rawBytes[i];

  if (b < 0x80) {
    // ASCII: copy as-is
    result.push(String.fromCodePoint(b));
    i++;
  } else if (b >= 0x80 && b <= 0x9F) {
    // Raw CP1252 special byte (left by previous fix): convert to proper Unicode
    const cp = cp1252ByteToCodepoint(b);
    result.push(String.fromCodePoint(cp));
    i++;
  } else if (b >= 0xC0 && b <= 0xDF && i + 1 < rawBytes.length && (rawBytes[i+1] & 0xC0) === 0x80) {
    // Valid 2-byte UTF-8 sequence
    const cp = ((b & 0x1F) << 6) | (rawBytes[i+1] & 0x3F);
    // Check if this is a "corrupted" codepoint that should be a raw byte
    if (unicodeToCp1252Byte[cp] !== undefined) {
      // This is a double-encoded CP1252 special char - convert back
      const cpByte = unicodeToCp1252Byte[cp];
      const originalCp = cp1252ByteToCodepoint(cpByte);
      result.push(String.fromCodePoint(originalCp));
    } else if (cp <= 0xFF) {
      // Latin-1 codepoint that was double-encoded from a single byte
      // The original byte was 'cp', which is a direct Latin-1 value
      // But was it double-encoded from a byte, or was it actually a 2-byte char?
      // Heuristic: if it's U+0080-U+00BF it's likely a mistakenly double-encoded byte
      // But U+00C0+ are actual Latin-1 chars that might legitimately be in the text
      // For our file: all accented chars (é, è, à, ê, etc.) are in U+00C0-U+00FF range
      // and they WERE double-encoded. So decode them.
      result.push(String.fromCodePoint(cp));
    } else {
      // Real 2-byte UTF-8 char (e.g., Turkish chars, Greek, etc.)
      result.push(String.fromCodePoint(cp));
    }
    i += 2;
  } else if (b >= 0xE0 && b <= 0xEF && i + 2 < rawBytes.length && (rawBytes[i+1] & 0xC0) === 0x80 && (rawBytes[i+2] & 0xC0) === 0x80) {
    // Valid 3-byte UTF-8 sequence
    const cp = ((b & 0x0F) << 12) | ((rawBytes[i+1] & 0x3F) << 6) | (rawBytes[i+2] & 0x3F);
    if (cp === 0x20AC) {
      // € - this IS the real € from double-encoding of 0x80
      result.push('€');
    } else {
      result.push(String.fromCodePoint(cp));
    }
    i += 3;
  } else if (b >= 0xF0 && b <= 0xF7 && i + 3 < rawBytes.length) {
    // Valid 4-byte UTF-8 sequence (emoji)
    const cp = ((b & 0x07) << 18) | ((rawBytes[i+1] & 0x3F) << 12) | ((rawBytes[i+2] & 0x3F) << 6) | (rawBytes[i+3] & 0x3F);
    result.push(String.fromCodePoint(cp));
    i += 4;
  } else {
    // Invalid byte: skip it or use replacement
    console.log('Skipping invalid byte', b.toString(16), 'at position', i);
    i++;
  }
}

const fixedStr = result.join('');
const fixedBuf = Buffer.from(fixedStr, 'utf8');

// Validate
console.log('\nAfter fix:');
console.log('Has Ã©:', fixedStr.includes('Ã©'));
console.log('Has é:', fixedStr.includes('é'));
console.log('Has ✓:', fixedStr.includes('✓'));
const sIdx = fixedStr.indexOf('Carence');
if (sIdx > -1) console.log('Sample:', fixedStr.slice(sIdx - 5, sIdx + 40));
const sIdx2 = fixedStr.indexOf('trust');
if (sIdx2 > -1) console.log('Trust sample:', fixedStr.slice(sIdx2 - 10, sIdx2 + 60));

// Write
fs.writeFileSync('app/landing/page.js', fixedBuf);
console.log('\nFile written. Size:', fixedBuf.length, 'bytes');
