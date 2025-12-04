const fs = require('fs');
const path = require('path');

/**
 * Cleanup utility for temporary files
 */

function cleanupJobFiles(jobId, tempDir, outputDir) {
  try {
    // Clean up temp files for this job
    const jobTempDir = path.join(tempDir, jobId);
    if (fs.existsSync(jobTempDir)) {
      const files = fs.readdirSync(jobTempDir);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(jobTempDir, file));
        } catch (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      });
      try {
        fs.rmdirSync(jobTempDir);
      } catch (err) {
        console.error(`Error deleting directory ${jobTempDir}:`, err);
      }
    }

    // Clean up text file
    const textFile = path.join(tempDir, `${jobId}.txt`);
    if (fs.existsSync(textFile)) {
      try {
        fs.unlinkSync(textFile);
      } catch (err) {
        console.error(`Error deleting text file:`, err);
      }
    }

    // Clean up uploaded file (optional - might want to keep for retry)
    // const uploadedFile = path.join(tempDir, `${jobId}.*`);
    // This would require glob pattern matching
    
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

function cleanupOldFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
  // Clean up files older than maxAgeMs (default 24 hours)
  try {
    if (!fs.existsSync(directory)) {
      return;
    }

    const files = fs.readdirSync(directory);
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          if (stats.isDirectory()) {
            // Recursively clean directory
            cleanupOldFiles(filePath, maxAgeMs);
            fs.rmdirSync(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
      } catch (err) {
        console.error(`Error cleaning up file ${file}:`, err);
      }
    });
  } catch (error) {
    console.error('Cleanup old files error:', error);
  }
}

module.exports = {
  cleanupJobFiles,
  cleanupOldFiles,
};

