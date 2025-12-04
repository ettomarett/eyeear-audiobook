import React, { useState, useEffect } from 'react';
import AudioPlayer from './AudioPlayer';
import './History.css';

const API_BASE_URL = 'http://localhost:3001/api';

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

  const handleBookClick = (book) => {
    const audioUrl = `http://localhost:3001/audio/${book.filename}`;
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
      const audioUrl = `http://localhost:3001/audio/${book.filename}`;
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
    if (!window.confirm('Delete this folder? Books inside will be moved to "All Books".')) {
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
        <h2>📚 Library</h2>
        <div className="history-actions">
          <button onClick={() => setShowNewFolder(true)} className="new-folder-btn" title="New Folder">
            📁+
          </button>
          <button onClick={loadHistory} className="refresh-btn" title="Refresh">
            ↻
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
          <span className="folder-icon">📚</span>
          <span className="folder-name">Uncategorized</span>
          <span className="folder-count">{history.filter(b => !b.folderId).length}</span>
        </div>
        {folders.map(folder => (
          <div 
            key={folder.id}
            className={`folder-item ${currentFolder === folder.id ? 'active' : ''}`}
            onClick={() => setCurrentFolder(folder.id)}
          >
            <span className="folder-icon">📁</span>
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
                ✏️
              </button>
              <button 
                className="folder-delete-btn" 
                onClick={(e) => handleDeleteFolder(folder.id, e)}
                title="Delete"
              >
                ×
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
            ← Back to Library
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
                          <option value="">📁 Move...</option>
                          <option value="">Uncategorized</option>
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
                        ✏️
                      </button>
                      <button
                        className="download-btn"
                        onClick={(e) => handleDownload(book, e)}
                        title="Download"
                      >
                        ⬇️
                      </button>
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDelete(book.id, e)}
                        title="Delete"
                      >
                        ×
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
