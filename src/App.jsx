import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ProcessingStatus from './components/ProcessingStatus';
import ExtractionPreview from './components/ExtractionPreview';
import AudioPlayer from './components/AudioPlayer';
import History from './components/History';
import Settings from './components/Settings';
import PriceEstimator from './components/PriceEstimator';
import Recovery from './components/Recovery';
import RunningJobs from './components/RunningJobs';
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Book
          </button>
          <button
            className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Library
          </button>
          <button
            className={`nav-btn ${currentView === 'price' ? 'active' : ''}`}
            onClick={() => setCurrentView('price')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Price
          </button>
          <button
            className={`nav-btn ${currentView === 'recovery' ? 'active' : ''}`}
            onClick={() => setCurrentView('recovery')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
            </svg>
            Recovery
          </button>
          <button
            className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-4.242 0L5.636 18.364m12.728 0l-4.243-4.243m-4.242 0L5.636 5.636"></path>
            </svg>
            Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {currentView === 'settings' ? (
          <Settings />
        ) : currentView === 'price' ? (
          <PriceEstimator />
        ) : currentView === 'recovery' ? (
          <Recovery />
        ) : currentView === 'history' ? (
          <History onSelectBook={(book) => {
            setAudioUrl(book.audioUrl);
            setBookTitle(book.bookTitle);
            setCurrentView('upload');
            setCurrentStep('complete');
          }} />
        ) : (
          <div className="new-book-page">
            {/* Running Jobs - Always visible on New Book tab */}
            <RunningJobs />

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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

