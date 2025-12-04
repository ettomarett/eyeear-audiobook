const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Merge multiple audio files into one
 */
async function mergeAudioFiles(chunkFiles, outputPath) {
  return new Promise((resolve, reject) => {
    if (chunkFiles.length === 0) {
      reject(new Error('No audio files to merge'));
      return;
    }

    // Sort files by chunk index to ensure correct order
    const sortedFiles = chunkFiles.sort((a, b) => {
      const indexA = parseInt(path.basename(a).match(/\d+/)[0]);
      const indexB = parseInt(path.basename(b).match(/\d+/)[0]);
      return indexA - indexB;
    });

    // Create a temporary file list for ffmpeg concat
    const concatFile = path.join(path.dirname(outputPath), 'concat_list.txt');
    const fileList = sortedFiles
      .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
      .join('\n');

    fs.writeFileSync(concatFile, fileList);

    // Use ffmpeg to concatenate files
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .audioCodec('copy') // Copy audio codec to avoid re-encoding
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Merging progress:', progress.percent + '%');
      })
      .on('end', () => {
        // Clean up concat file
        if (fs.existsSync(concatFile)) {
          fs.unlinkSync(concatFile);
        }
        resolve(outputPath);
      })
      .on('error', (error) => {
        // Clean up concat file on error
        if (fs.existsSync(concatFile)) {
          fs.unlinkSync(concatFile);
        }
        reject(error);
      })
      .save(outputPath);
  });
}

/**
 * Clean up chunk files after merging
 */
function cleanupChunkFiles(chunkFiles) {
  chunkFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.error(`Error deleting chunk file ${file}:`, error);
      }
    }
  });
}

module.exports = {
  mergeAudioFiles,
  cleanupChunkFiles,
};

