/**
 * Text chunking utility
 * Splits text into chunks of max 5,000 bytes (not characters)
 * Preserves word boundaries where possible
 */

function chunkText(text, maxBytes = 5000) {
  if (!text || text.length === 0) {
    return [];
  }

  // Use a very conservative limit to account for encoding differences
  // Google TTS counts bytes in UTF-8 encoding, so we need to be careful
  // Use 4800 bytes to ensure we never exceed 5000
  const safeMaxBytes = 4800; // 200 byte safety margin

  const chunks = [];
  const textBuffer = Buffer.from(text, 'utf8');
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < textBuffer.length) {
    // Calculate how many bytes we can take
    const remainingBytes = textBuffer.length - currentIndex;
    let chunkSize = Math.min(safeMaxBytes, remainingBytes);

    // If we're not at the end, try to find a word boundary
    if (currentIndex + chunkSize < textBuffer.length) {
      // Look for a space, newline, or punctuation near the end
      const searchStart = Math.max(0, chunkSize - 300); // Look back up to 300 bytes
      let bestBreak = chunkSize;

      for (let i = chunkSize; i >= searchStart; i--) {
        const byte = textBuffer[currentIndex + i];
        // Check for space (0x20), newline (0x0A), or carriage return (0x0D)
        if (byte === 0x20 || byte === 0x0A || byte === 0x0D) {
          bestBreak = i + 1; // Include the space/newline
          break;
        }
        // Check for common punctuation
        if (byte === 0x2E || byte === 0x21 || byte === 0x3F) { // . ! ?
          bestBreak = i + 1;
          break;
        }
      }

      chunkSize = bestBreak;
    }

    // Extract chunk and validate byte size
    let chunkText;
    let actualByteSize;
    let finalChunkSize = chunkSize;
    
    // Keep reducing until we're under the limit
    while (true) {
      const chunkBuffer = textBuffer.slice(currentIndex, currentIndex + finalChunkSize);
      chunkText = chunkBuffer.toString('utf8');
      actualByteSize = Buffer.from(chunkText, 'utf8').length;
      
      if (actualByteSize <= maxBytes) {
        break; // We're good!
      }
      
      // Too large, reduce by 10% and try again
      finalChunkSize = Math.floor(finalChunkSize * 0.9);
      if (finalChunkSize <= 0) {
        // Emergency fallback - take a very small chunk
        finalChunkSize = Math.min(1000, remainingBytes);
        const emergencyBuffer = textBuffer.slice(currentIndex, currentIndex + finalChunkSize);
        chunkText = emergencyBuffer.toString('utf8');
        actualByteSize = Buffer.from(chunkText, 'utf8').length;
        break;
      }
    }

    chunks.push({
      index: chunkIndex++,
      text: chunkText,
      byteSize: actualByteSize,
      startByte: currentIndex,
      endByte: currentIndex + finalChunkSize - 1,
    });

    currentIndex += finalChunkSize;

    currentIndex += chunkSize;
  }

  return chunks;
}

module.exports = { chunkText };

