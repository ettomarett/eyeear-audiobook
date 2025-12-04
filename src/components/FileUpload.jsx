import React, { useState, useRef } from 'react';
import './FileUpload.css';

function FileUpload({ apiBaseUrl, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext !== 'pdf' && ext !== 'epub' && ext !== 'txt') {
        setError('Only PDF, EPUB, and TXT files are allowed');
        return;
      }
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onUploadComplete({
            jobId: response.jobId,
            filename: response.filename,
            originalName: response.originalName,
          });
        } else {
          const errorResponse = JSON.parse(xhr.responseText);
          setError(errorResponse.error || 'Upload failed');
          setUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Network error during upload');
        setUploading(false);
      });

      xhr.open('POST', `${apiBaseUrl}/upload`);
      xhr.send(formData);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <div className="upload-box">
        <div className="upload-icon">📚</div>
        <h2>Upload Book File</h2>
        <p>Select a PDF, EPUB, or TXT file to convert to audiobook</p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.epub,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button
          className="select-file-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          Choose File
        </button>

        {file && (
          <div className="file-info">
            <p className="file-name">{file.name}</p>
            <p className="file-size">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p>{Math.round(progress)}% uploaded</p>
          </div>
        )}

        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </button>
      </div>
    </div>
  );
}

export default FileUpload;

