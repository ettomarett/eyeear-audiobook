import React, { useState, useEffect } from 'react';
import './Recovery.css';

const API_BASE_URL = '/api';

// SVG Icons
const CloudIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6M1 20v-6h6"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
  </svg>
);


function Recovery() {
  const [recoverable, setRecoverable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Scan for recoverable audiobooks on mount
  useEffect(() => {
    scanForRecoverable();
  }, []);

  const scanForRecoverable = async () => {
    setScanning(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/recovery/scan`);
      if (!response.ok) {
        throw new Error('Failed to scan for recoverable audiobooks');
      }
      const data = await response.json();
      setRecoverable(data.recoverable || []);
    } catch (err) {
      console.error('Error scanning for recoverable audiobooks:', err);
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const downloadRecoverable = async (item, uniqueId) => {
    setDownloadingId(uniqueId);
    setDownloadProgress(0);
    setError(null);

    try {
      const gcsFileName = item.gcsFileName || item.outputFileName;
      const response = await fetch(`${API_BASE_URL}/recovery/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gcsFileName: gcsFileName,
          jobId: item.jobId,
          bookTitle: item.bookTitle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download');
      }

      const data = await response.json();
      
      // Remove only this specific item from recoverable list using the unique gcsFileName
      setRecoverable(prev => prev.filter(r => {
        const rFileName = r.gcsFileName || r.outputFileName;
        return rFileName !== gcsFileName;
      }));

      alert(`Successfully recovered: ${data.bookTitle || data.filename}`);
    } catch (err) {
      console.error('Error downloading recoverable:', err);
      setError(`Failed to download: ${err.message}`);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const deleteFromGCS = async (item, uniqueId) => {
    const gcsFileName = item.gcsFileName || item.outputFileName;
    const displayName = item.bookTitle || parseBookTitleFromFilename(gcsFileName) || gcsFileName;
    
    if (!confirm(`Delete "${displayName}" from cloud storage? This cannot be undone.`)) {
      return;
    }

    setDownloadingId(uniqueId); // Use to disable buttons during delete

    try {
      const response = await fetch(`${API_BASE_URL}/recovery/gcs-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gcsFileName: gcsFileName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete from GCS');
      }

      // Remove only this specific item using the unique gcsFileName
      setRecoverable(prev => prev.filter(r => {
        const rFileName = r.gcsFileName || r.outputFileName;
        return rFileName !== gcsFileName;
      }));
    } catch (err) {
      console.error('Error deleting from GCS:', err);
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Parse a readable title from the GCS filename
  const parseBookTitleFromFilename = (filename) => {
    if (!filename) return null;
    // Remove path prefix like 'output/'
    let name = filename.replace(/^output\//, '');
    // Remove extension
    name = name.replace(/\.(wav|mp3)$/, '');
    // Remove timestamp suffix (e.g., _1764895805736)
    name = name.replace(/_\d{13,}$/, '');
    // If it's just a UUID, return null to use fallback
    if (/^[a-f0-9-]{36}$/i.test(name)) {
      return null;
    }
    return name;
  };

  const getStatusBadge = (item) => {
    // All items in recovery are "found in cloud" - ready to download
    // In-progress items are now shown in the Running Jobs section on New Book page
    if (item.source === 'tracked' && item.bookTitle && item.bookTitle !== 'Untitled Book') {
      return <span className="recovery-status-badge tracked">☁️ Tracked - Ready to Download</span>;
    }
    return <span className="recovery-status-badge untracked">☁️ Found in Cloud</span>;
  };

  return (
    <div className="recovery-container">
      <div className="recovery-header">
        <div className="recovery-title">
          <CloudIcon />
          <h2>Cloud Recovery</h2>
        </div>
        <p className="recovery-description">
          Recover audiobooks that completed on Google Cloud while the app was closed or your PC was off.
          These files exist in cloud storage but haven't been downloaded to your Library yet.
        </p>
        <button 
          className="recovery-scan-btn"
          onClick={scanForRecoverable}
          disabled={scanning}
        >
          <RefreshIcon />
          {scanning ? 'Scanning...' : 'Scan Cloud Storage'}
        </button>
      </div>

      {error && (
        <div className="recovery-error">
          {error}
        </div>
      )}

      {scanning && (
        <div className="recovery-scanning">
          <div className="recovery-spinner"></div>
          <p>Scanning cloud storage for recoverable audiobooks...</p>
        </div>
      )}

      {!scanning && recoverable.length === 0 && (
        <div className="recovery-empty">
          <CloudIcon />
          <p>No recoverable audiobooks found.</p>
          <small>All your audiobooks are either downloaded or there are none in cloud storage.</small>
        </div>
      )}

      {recoverable.length > 0 && (
        <div className="recovery-list">
          <h3>Found {recoverable.length} recoverable audiobook{recoverable.length !== 1 ? 's' : ''}</h3>
          
          {recoverable.map((item, index) => {
            // Create a unique ID using gcsFileName (most reliable) or combination
            const uniqueId = item.gcsFileName || item.outputFileName || `${item.jobId}_${index}`;
            const isDownloading = downloadingId === uniqueId;
            
            // Get display title - prefer tracked bookTitle, fall back to filename parsing
            const displayTitle = item.bookTitle && item.bookTitle !== 'Untitled Book' && !item.bookTitle.startsWith('Recovered')
              ? item.bookTitle
              : parseBookTitleFromFilename(item.gcsFileName || item.outputFileName) || `Audiobook ${index + 1}`;
            
            return (
              <div key={uniqueId} className="recovery-item">
                <div className="recovery-item-info">
                  <div className="recovery-item-title">
                    {displayTitle}
                  </div>
                  <div className="recovery-item-meta">
                    {item.size && <span>{formatBytes(item.size)}</span>}
                    {item.created && <span>{formatDate(item.created)}</span>}
                    {item.characterCount && <span>{item.characterCount.toLocaleString()} chars</span>}
                  </div>
                  {getStatusBadge(item)}
                </div>
                
                <div className="recovery-item-actions">
                  <button 
                    className="recovery-btn download"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDownloading) {
                        downloadRecoverable(item, uniqueId);
                      }
                    }}
                    disabled={isDownloading || downloadingId !== null}
                  >
                    {isDownloading ? (
                      <>
                        <span className="btn-spinner"></span>
                        {downloadProgress > 0 ? `${downloadProgress}%` : 'Downloading...'}
                      </>
                    ) : (
                      <>
                        <DownloadIcon /> Download to Library
                      </>
                    )}
                  </button>
                  <button 
                    className="recovery-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFromGCS(item, uniqueId);
                    }}
                    disabled={isDownloading || downloadingId !== null}
                    title="Delete from cloud storage"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="recovery-info">
        <h4>How This Works</h4>
        <ul>
          <li><span className="status-indicator found">●</span> <strong>Found in Cloud</strong> — Completed audiobook waiting in Google Cloud Storage. Download to add to your Library.</li>
        </ul>
        <p className="recovery-tip">
          <strong>Why are files here?</strong> If you closed the app or your PC turned off during synthesis, 
          Google Cloud TTS continued running in the background. Those completed files end up here, 
          ready for you to download.
        </p>
        <p className="recovery-tip">
          <strong>Note:</strong> To see currently running jobs, check the <strong>New Book</strong> tab.
        </p>
        
        <div className="storage-pricing-info">
          <h4>💰 Cloud Storage Costs</h4>
          <p>
            Files stored in Google Cloud Storage (us-east1) cost approximately <strong>$0.02 per GB per month</strong> (~$0.0007/GB/day).
          </p>
          <table className="pricing-table">
            <thead>
              <tr>
                <th>File Size</th>
                <th>Cost per Day</th>
                <th>Cost per Month</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>100 MB</td>
                <td>~$0.00007</td>
                <td>~$0.002</td>
              </tr>
              <tr>
                <td>1 GB</td>
                <td>~$0.0007</td>
                <td>~$0.02</td>
              </tr>
              <tr>
                <td>10 GB</td>
                <td>~$0.007</td>
                <td>~$0.20</td>
              </tr>
            </tbody>
          </table>
          <p className="pricing-tip">
            <strong>💡 Tip:</strong> Delete files you don't need to avoid ongoing storage charges. 
            Download important audiobooks to your local Library, then delete them from cloud storage.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Recovery;

