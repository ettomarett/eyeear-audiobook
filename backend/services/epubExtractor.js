const epub = require('epub');
const path = require('path');

/**
 * Extract text from EPUB file
 */
async function extractTextFromEpub(filePath) {
  return new Promise((resolve, reject) => {
    const epubFile = new epub(filePath);

    epubFile.on('error', (error) => {
      reject(error);
    });

    epubFile.on('end', () => {
      const chapters = [];
      let processedCount = 0;
      const totalChapters = epubFile.flow.length;

      if (totalChapters === 0) {
        resolve('');
        return;
      }

      epubFile.flow.forEach((item) => {
        epubFile.getChapter(item.id, (error, text) => {
          processedCount++;

          if (error) {
            console.error(`Error reading chapter ${item.id}:`, error);
          } else {
            // Remove HTML tags and clean text
            const cleanText = text
              .replace(/<[^>]*>/g, ' ') // Remove HTML tags
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();

            if (cleanText.length > 0) {
              chapters.push(cleanText);
            }
          }

          // When all chapters are processed
          if (processedCount === totalChapters) {
            const fullText = chapters.join('\n\n');
            resolve(fullText);
          }
        });
      });
    });

    epubFile.parse();
  });
}

module.exports = { extractTextFromEpub };

