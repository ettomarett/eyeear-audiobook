const pdf = require('pdf-parse');
const fs = require('fs');
const { extractTextFromScannedPDF } = require('./ocrService');

/**
 * Extract text from PDF file
 * Tries text extraction first, falls back to OCR for scanned PDFs
 */
async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    // Check if PDF has extractable text
    if (data.text && data.text.trim().length > 100) {
      // Has sufficient text, use it
      return data.text;
    } else {
      // Likely a scanned PDF, use OCR
      console.log('PDF appears to be scanned, using OCR...');
      return await extractTextFromScannedPDF(filePath);
    }
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Fallback to OCR
    console.log('Falling back to OCR...');
    return await extractTextFromScannedPDF(filePath);
  }
}

module.exports = { extractTextFromPdf };

