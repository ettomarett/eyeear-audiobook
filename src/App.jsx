import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ProcessingStatus from './components/ProcessingStatus';
import ExtractionPreview from './components/ExtractionPreview';
import AudioPlayer from './components/AudioPlayer';
import History from './components/History';
import Settings from './components/Settings';
import PriceEstimator from './components/PriceEstimator';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [currentView, setCurrentView] = useState('upload'); // 'upload' or 'history'
  const [currentStep, setCurrentStep] = useState('upload'); // upload, extracting, preview, generating, complete
  const [jobId, setJobId] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [uploadedFilename, setUploadedFilename] = useState(null);
  const [extractionData, setExtractionData] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  const handleUploadComplete = (uploadData) => {
    setJobId(uploadData.jobId);
    setBookTitle(uploadData.originalName.replace(/\.[^/.]+$/, ''));
    setUploadedFilename(uploadData.filename);
    setCurrentStep('extracting');
  };

  const handleExtractionComplete = (extractData) => {
    // Extraction complete, moving to preview
    setExtractionData(extractData);
    setCurrentStep('preview');
  };

  const handleGenerateSpeech = async () => {
    if (!extractionData) return;
    
    // Move to generating step - ProcessingStatus will fetch text and start generation
    setCurrentStep('generating');
  };

  const handleProcessingComplete = (audioFileUrl) => {
    setAudioUrl(audioFileUrl);
    setCurrentStep('complete');
  };

  const handleCancel = () => {
    setCurrentStep('upload');
    setJobId(null);
    setBookTitle('');
    setUploadedFilename(null);
    setExtractionData(null);
    setAudioUrl(null);
  };

  const handleNewBook = () => {
    setCurrentStep('upload');
    setJobId(null);
    setBookTitle('');
    setUploadedFilename(null);
    setExtractionData(null);
    setAudioUrl(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>EyeEar Audiobook Generator</h1>
        <p>Convert PDF/EPUB/TXT books to audiobooks using Google Cloud TTS</p>
        <nav className="app-nav">
          <button
            className={`nav-btn ${currentView === 'upload' ? 'active' : ''}`}
            onClick={() => {
              // Reset all state when clicking New Book
              setCurrentView('upload');
              setCurrentStep('upload');
              setJobId(null);
              setBookTitle('');
              setUploadedFilename(null);
              setExtractionData(null);
              setAudioUrl(null);
            }}
          >
            New Book
          </button>
          <button
            className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            📚 Library
          </button>
          <button
            className={`nav-btn ${currentView === 'price' ? 'active' : ''}`}
            onClick={() => setCurrentView('price')}
          >
            💰 Price
          </button>
          <button
            className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {currentView === 'settings' ? (
          <Settings />
        ) : currentView === 'price' ? (
          <PriceEstimator />
        ) : currentView === 'history' ? (
          <History onSelectBook={(book) => {
            setAudioUrl(book.audioUrl);
            setBookTitle(book.bookTitle);
            setCurrentView('upload');
            setCurrentStep('complete');
          }} />
        ) : (
          <>
            {currentStep === 'upload' && (
              <FileUpload
                apiBaseUrl={API_BASE_URL}
                onUploadComplete={handleUploadComplete}
              />
            )}

        {(currentStep === 'extracting' || currentStep === 'generating') && (
          <ProcessingStatus
            apiBaseUrl={API_BASE_URL}
            jobId={jobId}
            bookTitle={bookTitle}
            uploadedFilename={uploadedFilename}
            onComplete={handleProcessingComplete}
            onExtractionComplete={handleExtractionComplete}
            extractionData={extractionData}
            currentStep={currentStep}
          />
        )}

        {currentStep === 'preview' && extractionData && (
          <ExtractionPreview
            bookTitle={bookTitle}
            characterCount={extractionData.textLength}
            onGenerateSpeech={handleGenerateSpeech}
            onCancel={handleCancel}
          />
        )}

        {currentStep === 'complete' && audioUrl && (
          <div className="complete-section">
            <div className="success-badge">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Audiobook Ready!</h2>
            </div>
            <AudioPlayer audioUrl={audioUrl} bookTitle={bookTitle} onReset={handleNewBook} />
          </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;

