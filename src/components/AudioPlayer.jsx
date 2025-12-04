import React, { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import './AudioPlayer.css';

const API_BASE_URL = 'http://localhost:3001/api';

function AudioPlayer({ audioUrl, bookTitle, bookId, onReset }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const soundRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);
  const bookmarksSaveTimeoutRef = useRef(null);

  // Load bookmarks from server
  useEffect(() => {
    if (bookId) {
      loadBookmarksFromServer();
    }
  }, [bookId]);

  // Save bookmarks to server when they change (debounced)
  useEffect(() => {
    if (bookId && bookmarks.length >= 0) {
      // Debounce saving to avoid too many requests
      if (bookmarksSaveTimeoutRef.current) {
        clearTimeout(bookmarksSaveTimeoutRef.current);
      }
      bookmarksSaveTimeoutRef.current = setTimeout(() => {
        saveBookmarksToServer();
      }, 500);
    }
    
    return () => {
      if (bookmarksSaveTimeoutRef.current) {
        clearTimeout(bookmarksSaveTimeoutRef.current);
      }
    };
  }, [bookmarks, bookId]);

  const loadBookmarksFromServer = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bookmarks/${bookId}`);
      if (response.ok) {
        const data = await response.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (err) {
      console.error('Failed to load bookmarks from server:', err);
      // Fall back to localStorage
      const localKey = `eyeear-bookmarks-${bookId}`;
      const localBookmarks = localStorage.getItem(localKey);
      if (localBookmarks) {
        try {
          setBookmarks(JSON.parse(localBookmarks));
        } catch (e) {
          console.error('Failed to parse local bookmarks:', e);
        }
      }
    }
  };

  const saveBookmarksToServer = async () => {
    if (!bookId) return;
    
    try {
      await fetch(`${API_BASE_URL}/bookmarks/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks }),
      });
    } catch (err) {
      console.error('Failed to save bookmarks to server:', err);
      // Fall back to localStorage
      const localKey = `eyeear-bookmarks-${bookId}`;
      localStorage.setItem(localKey, JSON.stringify(bookmarks));
    }
  };

  useEffect(() => {
    if (!audioUrl) return;

    setIsLoading(true);
    setLoadError(null);

    // Clean up previous sound
    if (soundRef.current) {
      soundRef.current.unload();
    }

    const sound = new Howl({
      src: [audioUrl],
      html5: true,
      preload: true,
      format: ['mp3', 'wav'], // Explicitly specify formats
      xhr: {
        method: 'GET',
        headers: {},
        withCredentials: false,
      },
      onload: () => {
        // Audio loaded successfully
        setDuration(sound.duration());
        setIsLoading(false);
      },
      onloaderror: (id, error) => {
        console.error('Audio load error:', error, 'URL:', audioUrl);
        // Howler error codes: 0=unknown, 1=decode, 2=network, 3=decode, 4=network
        let errorMsg = 'Failed to load audio file. ';
        if (error === 2 || error === 4) {
          errorMsg += 'Network error - please check if the file exists at the server.';
        } else if (error === 1 || error === 3) {
          errorMsg += 'Audio format error - file may be corrupted.';
        } else {
          errorMsg += `Error code: ${error}`;
        }
        setLoadError(errorMsg);
        setIsLoading(false);
      },
      onplay: () => {
        setIsPlaying(true);
        // Start updating current time
        timeUpdateIntervalRef.current = setInterval(() => {
          setCurrentTime(sound.seek() || 0);
        }, 100);
      },
      onpause: () => {
        setIsPlaying(false);
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
      },
      onend: () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
      },
      onstop: () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
      },
    });

    soundRef.current = sound;
    sound.volume(volume);
    sound.rate(playbackRate);

    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.rate(playbackRate);
    }
  }, [playbackRate]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  const togglePlayPause = () => {
    if (!soundRef.current || isLoading) return;

    if (isPlaying) {
      soundRef.current.pause();
    } else {
      soundRef.current.play();
    }
  };

  const handleSeek = (e) => {
    if (!soundRef.current || isLoading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * duration;

    soundRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const skipBackward = () => {
    if (!soundRef.current || isLoading) return;
    const newTime = Math.max(0, currentTime - 10);
    soundRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    if (!soundRef.current || isLoading) return;
    const newTime = Math.min(duration, currentTime + 10);
    soundRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const addBookmark = () => {
    const note = bookmarkNote.trim() || `Bookmark at ${formatTime(currentTime)}`;
    const newBookmark = {
      id: Date.now(),
      time: currentTime,
      note: note,
      createdAt: new Date().toISOString(),
    };
    setBookmarks([...bookmarks, newBookmark].sort((a, b) => a.time - b.time));
    setBookmarkNote('');
    setShowAddBookmark(false);
  };

  const deleteBookmark = (id) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const jumpToBookmark = (time) => {
    if (!soundRef.current || isLoading) return;
    soundRef.current.seek(time);
    setCurrentTime(time);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="audio-player-container">
      <div className="audio-player-header">
        <h2 className="book-title">{bookTitle || 'Audiobook'}</h2>
        {onReset && (
          <button className="reset-btn" onClick={onReset} title="Generate Another Book">
            ↻ New Book
          </button>
        )}
      </div>

      {isLoading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading audio...</p>
        </div>
      )}

      {loadError && (
        <div className="error-state">
          <p>⚠️ {loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && (
        <>
          <div className="timeline-container" onClick={handleSeek}>
            <div className="timeline-track">
              <div
                className="timeline-progress"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* Bookmark markers on timeline */}
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="timeline-bookmark-marker"
                  style={{ left: `${duration > 0 ? (bookmark.time / duration) * 100 : 0}%` }}
                  title={`${bookmark.note} (${formatTime(bookmark.time)})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToBookmark(bookmark.time);
                  }}
                />
              ))}
              <div
                className="timeline-handle"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="time-display">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="total-time">{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="controls-row">
            <button
              className="skip-btn"
              onClick={skipBackward}
              disabled={isLoading}
              aria-label="Skip backward 10 seconds"
              title="Skip -10s"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 3C17.15 3 21.08 6.03 22.47 10.22L20.1 11C19.05 7.81 16.04 5.5 12.5 5.5C10.54 5.5 8.77 6.22 7.38 7.38L10 10H3V3L5.6 5.6C7.45 4 9.85 3 12.5 3M10 12V22H8V14H6V12H10M18 14V20C18 21.11 17.11 22 16 22H14C12.9 22 12 21.11 12 20V14C12 12.9 12.9 12 14 12H16C17.11 12 18 12.9 18 14M14 14V20H16V14H14Z"/>
              </svg>
            </button>

            <button
              className="play-pause-btn"
              onClick={togglePlayPause}
              disabled={isLoading}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              className="skip-btn"
              onClick={skipForward}
              disabled={isLoading}
              aria-label="Skip forward 10 seconds"
              title="Skip +10s"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 3C6.85 3 2.92 6.03 1.53 10.22L3.9 11C4.95 7.81 7.96 5.5 11.5 5.5C13.46 5.5 15.23 6.22 16.62 7.38L14 10H21V3L18.4 5.6C16.55 4 14.15 3 11.5 3M10 12V22H8V14H6V12H10M18 14V20C18 21.11 17.11 22 16 22H14C12.9 22 12 21.11 12 20V14C12 12.9 12.9 12 14 12H16C17.11 12 18 12.9 18 14M14 14V20H16V14H14Z"/>
              </svg>
            </button>

            <div className="control-group">
              <label className="control-label">
                <span>Speed</span>
                <select
                  className="speed-select"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                >
                  {speedOptions.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="control-group volume-group">
              <label className="control-label">
                <span>Volume</span>
                <div className="volume-control-wrapper">
                  <input
                    type="range"
                    className="volume-slider"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                  />
                  <span className="volume-value">{Math.round(volume * 100)}%</span>
                </div>
              </label>
            </div>
          </div>

          {/* Bookmark Section */}
          <div className="bookmark-section">
            <div className="bookmark-actions">
              <button
                className="bookmark-add-btn"
                onClick={() => setShowAddBookmark(!showAddBookmark)}
                title="Add bookmark at current position"
              >
                🔖 Add Bookmark
              </button>
              <button
                className={`bookmark-toggle-btn ${showBookmarks ? 'active' : ''}`}
                onClick={() => setShowBookmarks(!showBookmarks)}
              >
                📑 Bookmarks {bookmarks.length > 0 && `(${bookmarks.length})`}
              </button>
            </div>

            {showAddBookmark && (
              <div className="bookmark-add-form">
                <input
                  type="text"
                  className="bookmark-note-input"
                  placeholder="Add a note (optional)..."
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
                  autoFocus
                />
                <div className="bookmark-form-actions">
                  <span className="bookmark-time-preview">
                    at {formatTime(currentTime)}
                  </span>
                  <button className="bookmark-save-btn" onClick={addBookmark}>
                    Save
                  </button>
                  <button 
                    className="bookmark-cancel-btn" 
                    onClick={() => {
                      setShowAddBookmark(false);
                      setBookmarkNote('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showBookmarks && (
              <div className="bookmarks-list">
                {bookmarks.length === 0 ? (
                  <div className="no-bookmarks">
                    No bookmarks yet. Add one to save your place!
                  </div>
                ) : (
                  bookmarks.map((bookmark) => (
                    <div 
                      key={bookmark.id} 
                      className="bookmark-item"
                      onClick={() => jumpToBookmark(bookmark.time)}
                    >
                      <div className="bookmark-marker" style={{ 
                        left: `${(bookmark.time / duration) * 100}%` 
                      }} />
                      <div className="bookmark-info">
                        <span className="bookmark-time">{formatTime(bookmark.time)}</span>
                        <span className="bookmark-note">{bookmark.note}</span>
                      </div>
                      <button
                        className="bookmark-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBookmark(bookmark.id);
                        }}
                        title="Delete bookmark"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AudioPlayer;
