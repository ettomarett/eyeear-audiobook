import React, { useState, useEffect } from 'react';
import AudioPlayer from './AudioPlayer';
import './History.css';

const API_BASE_URL = 'http://localhost:3003/api';

function History({ onSelectBook }) {
  const [history, setHistory] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [editingBookId, setEditingBookId] = useState(null);
  const [editingBookTitle, setEditingBookTitle] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    loadHistory();
    loadFolders();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) {
        throw new Error('Failed to load library');
      }
      const data = await response.json();
      setHistory(data);
      setError(null);
    } catch (err) {
      console.error('Error loading library:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/folders`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const handleImportAudiobook = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    setImporting(true);
    setImportProgress(0);

    try {
      const formData = new FormData();
      formData.append('audioFile', file);
      
      // Extract title from filename (without extension)
      const bookTitle = file.name.replace(/\.[^/.]+$/, '');
      formData.append('bookTitle', bookTitle);

      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setImportProgress(progress);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          console.log('Import successful:', response);
          loadHistory(); // Refresh the library
          setImporting(false);
          setImportProgress(0);
        } else {
          const errorResponse = JSON.parse(xhr.responseText);
          throw new Error(errorResponse.error || 'Import failed');
        }
      };

      xhr.onerror = () => {
        setError('Network error during import');
        setImporting(false);
        setImportProgress(0);
      };

      xhr.open('POST', `${API_BASE_URL}/history/import`);
      xhr.send(formData);

    } catch (err) {
      console.error('Error importing audiobook:', err);
      setError(err.message);
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleBookClick = (book) => {
    const audioUrl = `http://localhost:3003/audio/${book.filename}`;
    setSelectedBook({
      ...book,
      audioUrl,
    });
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this audiobook?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/history/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete');
      }

      setHistory(history.filter(book => book.id !== id));
      
      if (selectedBook && selectedBook.id === id) {
        setSelectedBook(null);
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
      loadHistory();
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL audiobooks? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to clear library');
      }

      setHistory([]);
      setSelectedBook(null);
    } catch (err) {
      console.error('Error clearing library:', err);
      alert('Failed to clear library: ' + err.message);
      loadHistory();
    }
  };

  const handleDownload = async (book, e) => {
    e.stopPropagation();
    try {
      const audioUrl = `http://localhost:3003/audio/${book.filename}`;
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.bookTitle || 'audiobook'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading:', err);
      alert('Failed to download: ' + err.message);
    }
  };

  const handleRenameStart = (book, e) => {
    e.stopPropagation();
    setEditingBookId(book.id);
    setEditingBookTitle(book.bookTitle || '');
  };

  const handleRenameSubmit = async (bookId) => {
    if (!editingBookTitle.trim()) {
      setEditingBookId(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/history/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookTitle: editingBookTitle.trim() }),
      });

      if (response.ok) {
        setHistory(history.map(book => 
          book.id === bookId ? { ...book, bookTitle: editingBookTitle.trim() } : book
        ));
      }
    } catch (err) {
      console.error('Error renaming book:', err);
    }
    setEditingBookId(null);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setShowNewFolder(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (response.ok) {
        const folder = await response.json();
        setFolders([...folders, folder]);
        setNewFolderName('');
        setShowNewFolder(false);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this folder? Books inside will be moved to "Uncategorized".')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFolders(folders.filter(f => f.id !== folderId));
        if (currentFolder === folderId) {
          setCurrentFolder(null);
        }
        loadHistory();
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  const handleRenameFolderStart = (folder, e) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleRenameFolderSubmit = async (folderId) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });

      if (response.ok) {
        setFolders(folders.map(f => 
          f.id === folderId ? { ...f, name: editingFolderName.trim() } : f
        ));
      }
    } catch (err) {
      console.error('Error renaming folder:', err);
    }
    setEditingFolderId(null);
  };

  const handleMoveToFolder = async (bookId, folderId, e) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(`${API_BASE_URL}/history/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId }),
      });

      if (response.ok) {
        setHistory(history.map(book => 
          book.id === bookId ? { ...book, folderId } : book
        ));
      }
    } catch (err) {
      console.error('Error moving book:', err);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatCharacterCount = (count) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Filter books by current folder
  const filteredBooks = currentFolder 
    ? history.filter(book => book.folderId === currentFolder)
    : history.filter(book => !book.folderId);

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading-spinner">Loading library...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-container">
        <div className="error-message">Error loading library: {error}</div>
        <button onClick={loadHistory} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Library
        </h2>
        <div className="history-actions">
          {/* Hidden file input for import */}
          <input
            type="file"
            id="import-audiobook-input"
            accept=".mp3,.wav,.m4a,.ogg,.flac,.aac"
            style={{ display: 'none' }}
            onChange={handleImportAudiobook}
          />
          <button 
            onClick={() => document.getElementById('import-audiobook-input').click()} 
            className="import-btn" 
            title="Import local audiobook"
            disabled={importing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            {importing ? `Importing ${importProgress}%` : 'Import'}
          </button>
          <button onClick={() => setShowNewFolder(true)} className="new-folder-btn" title="New Folder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
            New Folder
          </button>
          <button onClick={loadHistory} className="refresh-btn" title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
          {history.length > 0 && !selectedBook && (
            <button onClick={handleClearAll} className="clear-all-btn" title="Delete All">
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="new-folder-form">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
          />
          <button onClick={handleCreateFolder} className="save-btn">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="cancel-btn">Cancel</button>
        </div>
      )}

      {/* Folders Section */}
      <div className="folders-section">
        <div 
          className={`folder-item ${currentFolder === null ? 'active' : ''}`}
          onClick={() => setCurrentFolder(null)}
        >
          <svg className="folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span className="folder-name">Uncategorized</span>
          <span className="folder-count">{history.filter(b => !b.folderId).length}</span>
        </div>
        {folders.map(folder => (
          <div 
            key={folder.id}
            className={`folder-item ${currentFolder === folder.id ? 'active' : ''}`}
            onClick={() => setCurrentFolder(folder.id)}
          >
            <svg className="folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            {editingFolderId === folder.id ? (
              <input
                type="text"
                className="folder-name-input"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onBlur={() => handleRenameFolderSubmit(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolderSubmit(folder.id);
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="folder-name">{folder.name}</span>
            )}
            <span className="folder-count">{history.filter(b => b.folderId === folder.id).length}</span>
            <div className="folder-actions">
              <button 
                className="folder-edit-btn" 
                onClick={(e) => handleRenameFolderStart(folder, e)}
                title="Rename"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button 
                className="folder-delete-btn" 
                onClick={(e) => handleDeleteFolder(folder.id, e)}
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedBook ? (
        <div className="history-player-section">
          <button 
            className="back-btn" 
            onClick={() => setSelectedBook(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Library
          </button>
          <AudioPlayer 
            audioUrl={selectedBook.audioUrl} 
            bookTitle={selectedBook.bookTitle}
            bookId={selectedBook.id}
            onReset={() => setSelectedBook(null)}
          />
        </div>
      ) : (
        <>
          {filteredBooks.length === 0 ? (
            <div className="empty-history">
              {currentFolder ? (
                <p>This folder is empty.</p>
              ) : (
                <>
                  <p>No audiobooks generated yet.</p>
                  <p>Upload a PDF, EPUB, or TXT file to create your first audiobook!</p>
                </>
              )}
            </div>
          ) : (
            <div className="history-list">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="history-item"
                  onClick={() => handleBookClick(book)}
                >
                  <div className="history-item-content">
                    <div className="history-item-main">
                      {editingBookId === book.id ? (
                        <input
                          type="text"
                          className="title-edit-input"
                          value={editingBookTitle}
                          onChange={(e) => setEditingBookTitle(e.target.value)}
                          onBlur={() => handleRenameSubmit(book.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(book.id);
                            if (e.key === 'Escape') setEditingBookId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <h3 className="history-item-title">{book.bookTitle}</h3>
                      )}
                      <div className="history-item-meta">
                        <span className="history-item-date">
                          {formatDate(book.createdAt)}
                        </span>
                        {book.characterCount > 0 && (
                          <span className="history-item-chars">
                            {formatCharacterCount(book.characterCount)} chars
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="history-item-actions">
                      {/* Move to folder dropdown */}
                      {folders.length > 0 && (
                        <select
                          className="move-folder-select"
                          value={book.folderId || ''}
                          onChange={(e) => handleMoveToFolder(book.id, e.target.value || null, e)}
                          onClick={(e) => e.stopPropagation()}
                          title="Move to folder"
                        >
                          <option value="" disabled>📁 Move to folder...</option>
                          <option value="">— Uncategorized</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
                      <button
                        className="rename-btn"
                        onClick={(e) => handleRenameStart(book, e)}
                        title="Rename"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        className="download-btn"
                        onClick={(e) => handleDownload(book, e)}
                        title="Download"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDelete(book.id, e)}
                        title="Delete"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default History;
