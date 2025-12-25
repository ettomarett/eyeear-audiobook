/**
 * Utility functions for managing file handles in IndexedDB
 * Used for File System Access API to persist file access across sessions
 */

/**
 * Retrieves a stored file handle from IndexedDB
 * @param {string} handleKey - The key used to store the handle (typically bookId)
 * @returns {Promise<FileSystemFileHandle|null>} The file handle or null if not found
 */
export const getStoredFileHandle = async (handleKey) => {
  try {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not available');
      return null;
    }

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('eyeear-file-handles', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles', { keyPath: 'bookId' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['handles'], 'readonly');
      const store = tx.objectStore('handles');
      const req = store.get(handleKey); // bookId === handleKey
      
      req.onsuccess = () => resolve(req.result?.fileHandle ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error retrieving file handle from IndexedDB:', err);
    return null;
  }
};

