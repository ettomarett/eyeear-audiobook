const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../../output');

/**
 * Save metadata for an audio file
 */
function saveMetadata(jobId, metadata) {
  try {
    const metadataPath = path.join(OUTPUT_DIR, `${jobId}.metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving metadata:', error);
    return false;
  }
}

/**
 * Load metadata for a jobId
 */
function loadMetadata(jobId) {
  try {
    const metadataPath = path.join(OUTPUT_DIR, `${jobId}.metadata.json`);
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading metadata:', error);
    return null;
  }
}

/**
 * Find metadata by checking for files that start with jobId
 */
function findMetadataByJobId(jobId) {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return null;
    }

    // First try direct metadata file
    const directMetadata = loadMetadata(jobId);
    if (directMetadata) {
      return directMetadata;
    }

    // Look for audio files matching the jobId pattern
    const files = fs.readdirSync(OUTPUT_DIR);
    const matchingFile = files.find(file => 
      file.startsWith(jobId) && (file.endsWith('.mp3') || file.endsWith('.wav'))
    );

    if (matchingFile) {
      // If no metadata file exists, the file was created before metadata system
      // Return basic info (but ideally metadata should always exist)
      const filePath = path.join(OUTPUT_DIR, matchingFile);
      const stats = fs.statSync(filePath);
      
      return {
        jobId,
        status: 'completed',
        progress: 100,
        filename: matchingFile,
        outputPath: filePath,
        metadata: {
          bookTitle: 'Untitled Book',
          characterCount: 0,
        },
        createdAt: stats.birthtime.toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding metadata:', error);
    return null;
  }
}

/**
 * Delete metadata file
 */
function deleteMetadata(jobId) {
  try {
    const metadataPath = path.join(OUTPUT_DIR, `${jobId}.metadata.json`);
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting metadata:', error);
    return false;
  }
}

module.exports = {
  saveMetadata,
  loadMetadata,
  findMetadataByJobId,
  deleteMetadata,
};

