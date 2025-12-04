import React, { useState, useEffect, useRef } from 'react';
import './ProcessingStatus.css';

const API_BASE_URL = 'http://localhost:3001/api';

function ProcessingStatus({ apiBaseUrl, jobId, bookTitle, uploadedFilename, onComplete, onStatusUpdate, onExtractionComplete, extractionData, currentStep: parentCurrentStep }) {
  const [currentStep, setCurrentStep] = useState('idle'); // Start as 'idle' instead of 'extracting'
  const [progress, setProgress] = useState(0);
  const [backendStatus, setBackendStatus] = useState(''); // Track actual backend status for labels
  const [elapsedTime, setElapsedTime] = useState(0); // Elapsed time in seconds
  const [estimatedTime, setEstimatedTime] = useState(0); // Estimated total time in seconds
  const [error, setError] = useState(null);
  const [credentialsPath, setCredentialsPath] = useState('');
  const [extractionStarted, setExtractionStarted] = useState(false); // Track if extraction has been initiated
  const [generationStarted, setGenerationStarted] = useState(false); // Track if generation has been initiated
  const extractionInProgressRef = useRef(false);
  const generationInProgressRef = useRef(false);
  const previousJobIdRef = useRef(null);

  // Reset all state when jobId changes (new upload)
  useEffect(() => {
    if (jobId !== previousJobIdRef.current) {
      previousJobIdRef.current = jobId;
      // Reset all state for new job
      setCurrentStep('idle');
      setProgress(0);
      setBackendStatus('');
      setElapsedTime(0);
      setEstimatedTime(0);
      setError(null);
      setExtractionStarted(false);
      setGenerationStarted(false);
      extractionInProgressRef.current = false;
      generationInProgressRef.current = false;
    }
  }, [jobId]);

  // Use parent's currentStep to know when to start generation
  useEffect(() => {
    if (!jobId) return;

    // If parent says we're generating, but we haven't started yet
    if (parentCurrentStep === 'generating' && !generationInProgressRef.current && currentStep !== 'generating' && currentStep !== 'initializing' && currentStep !== 'complete') {
      generationInProgressRef.current = true;
      setGenerationStarted(true);
      setCurrentStep('generating');
      
      // Fetch text with retry logic (handles server restart)
      const fetchTextWithRetry = async (retries = 5, delay = 1000) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const res = await fetch(`http://localhost:3001/temp/${jobId}.txt`);
            if (!res.ok) {
              throw new Error(`Failed to fetch text: ${res.status}`);
            }
            return await res.text();
          } catch (err) {
            // Silently retry - don't log expected network errors
            if (attempt === retries) {
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };
      
      fetchTextWithRetry()
        .then(text => {
          startTTSGeneration(text);
        })
        .catch(err => {
          console.error('Failed to load text:', err.message);
          setError(`Failed to load text: ${err.message}. Please try again.`);
          generationInProgressRef.current = false;
        });
      return;
    }

    // If extractionData is provided, we're past extraction - wait for user to click Generate
    if (extractionData && parentCurrentStep !== 'generating') {
      return;
    }

    // If we're in extracting step, start extraction (only if not already started)
    if (parentCurrentStep === 'extracting') {
      if (!extractionStarted && !extractionInProgressRef.current) {
        extractionInProgressRef.current = true;
        setExtractionStarted(true);
        setCredentialsPath(null);
        extractText();
      }
    }
  }, [jobId, parentCurrentStep, extractionData, currentStep]);

  // New function to handle just text extraction
  const extractText = async () => {
    try {
      setCurrentStep('extracting');
      setProgress(10);

      const filename = uploadedFilename || `${jobId}.pdf`;
      const originalName = bookTitle ? `${bookTitle}.${uploadedFilename?.split('.').pop() || 'pdf'}` : null;
      
      let extractResponse;
      try {
        extractResponse = await fetch(`${apiBaseUrl}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename,
            jobId,
            originalName: originalName,
          }),
        });
      } catch (fetchError) {
        // Handle network errors - silently retry
        if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('ERR_CONNECTION_REFUSED')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          extractResponse = await fetch(`${apiBaseUrl}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename,
              jobId,
              originalName: originalName,
            }),
          });
        } else {
          throw fetchError;
        }
      }

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Text extraction failed');
      }

      const extractData = await extractResponse.json();
      setProgress(100);
      setCurrentStep('complete');
      
      // Notify parent component that extraction is complete
      if (onExtractionComplete) {
        setTimeout(() => {
          onExtractionComplete(extractData);
        }, 100);
      }
      extractionInProgressRef.current = false;
    } catch (err) {
      console.error('Extraction error:', err.message);
      setError(err.message);
      extractionInProgressRef.current = false;
    }
  };

  // Function to start TTS generation (called when user clicks Generate Speech)
  const startTTSGeneration = async (textContent) => {
    try {
      setCurrentStep('generating');
      setProgress(10);

      // Initialize TTS
      setCurrentStep('initializing');
      const initResponse = await fetch(`${apiBaseUrl}/tts/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialsPath: credentialsPath || null,
        }),
      });

      if (!initResponse.ok) {
        const initError = await initResponse.json().catch(() => ({}));
        throw new Error(initError.error || 'TTS initialization failed');
      }

      setProgress(30);

      // Generate TTS using long audio synthesis
      setCurrentStep('generating');
      setProgress(40);

      const generateResponse = await fetch(`${apiBaseUrl}/tts/generate-long`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          text: textContent,
          options: {
            voiceName: 'en-US-Chirp3-HD-Iapetus',
            languageCode: 'en-US',
            speakingRate: 1.0,
            pitch: 0.0,
          },
          metadata: {
            bookTitle: bookTitle || 'Untitled Book',
            uploadedFilename: uploadedFilename || null,
          },
        }),
      });

      if (!generateResponse.ok) {
        const generateError = await generateResponse.json().catch(() => ({}));
        throw new Error(generateError.error || 'TTS generation failed');
      }

      const generateData = await generateResponse.json();
      setProgress(50);

      // Poll for status updates
      let pollAttempts = 0;
      const maxPollAttempts = 600; // 10 minutes max (1 second intervals)
      
      const statusInterval = setInterval(async () => {
        pollAttempts++;
        
        // Stop polling after max attempts
        if (pollAttempts > maxPollAttempts) {
          clearInterval(statusInterval);
          setError('Status polling timed out. The audiobook may still be processing.');
          return;
        }
        
        try {
          let statusResponse;
          try {
            statusResponse = await fetch(`${apiBaseUrl}/tts/status/${jobId}`);
          } catch (fetchError) {
            // Handle network errors (connection refused, server restart, etc.)
            // Silently retry on next poll - don't log these transient errors
            const errorMsg = fetchError?.message || String(fetchError) || '';
            if (errorMsg.includes('Failed to fetch') || 
                errorMsg.includes('ERR_CONNECTION_REFUSED') || 
                errorMsg.includes('NetworkError') ||
                errorMsg.includes('Network request failed')) {
              // Silently retry on next poll - server might be restarting
              return;
            }
            // For other errors, just return and retry (don't throw to avoid uncaught promise)
            return;
          }
          
          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              // Job not found - might be completed but status lost after server restart
              // The backend should now check file system, but if still 404, wait a bit more
              if (pollAttempts < 10) {
                // Give it a few more tries in case file is still being written
                return;
              }
              // After 10 attempts, assume job is lost
              clearInterval(statusInterval);
              setError('Job status not found. The server may have restarted. Please try generating again.');
              return;
            }
            throw new Error(`Status check failed: ${statusResponse.status}`);
          }
          
          const status = await statusResponse.json();

          if (status.status === 'completed') {
            clearInterval(statusInterval);
            setProgress(100);
            setCurrentStep('complete');

            // Get the filename from status (backend provides it)
            let filename = status.filename || status.outputPath?.split('/').pop() || status.outputPath?.split('\\').pop() || `${jobId}.mp3`;
            const audioUrl = `http://localhost:3001/audio/${filename}`;
            
            // Wait a bit longer and verify file exists before calling onComplete
            setTimeout(async () => {
              // Verify file exists by trying to fetch it
              try {
                const testResponse = await fetch(audioUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                  onComplete(audioUrl);
                } else {
                  // File not found, try to get correct filename from status again
                  const retryStatusResponse = await fetch(`${apiBaseUrl}/tts/status/${jobId}`);
                  if (retryStatusResponse.ok) {
                    const retryStatus = await retryStatusResponse.json();
                    const correctFilename = retryStatus.filename || filename;
                    const correctUrl = `http://localhost:3001/audio/${correctFilename}`;
                    onComplete(correctUrl);
                  } else {
                    onComplete(audioUrl); // Fallback to original URL
                  }
                }
              } catch (verifyError) {
                // If verification fails, still try to load (might be a CORS issue)
                onComplete(audioUrl);
              }
            }, 1000); // Increased delay to 1 second
          } else if (status.status === 'error') {
            clearInterval(statusInterval);
            setError(status.error);
          } else {
            // Update progress - backend already calculates accurate progress (0-100)
            const realProgress = status.progress || 0;
            setProgress(realProgress);
            setBackendStatus(status.status || '');
            if (status.elapsed !== undefined) setElapsedTime(status.elapsed);
            if (status.estimated !== undefined) setEstimatedTime(status.estimated);
          }
        } catch (err) {
          // Don't stop polling on individual errors - silently retry
          if (pollAttempts > 10) {
            clearInterval(statusInterval);
            setError(`Failed to check status: ${err.message}`);
          }
        }
      }, 1000);

      return () => clearInterval(statusInterval);
    } catch (err) {
      setError(err.message);
      console.error('TTS generation error:', err);
    }
  };



  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getStepLabel = () => {
    switch (currentStep) {
      case 'extracting':
        return 'Extracting text from book...';
      case 'initializing':
        return 'Initializing TTS service...';
      case 'generating':
        // Use backend status for more accurate labels
        if (backendStatus === 'preparing') {
          return 'Preparing audio synthesis...';
        } else if (backendStatus === 'synthesizing') {
          return `Synthesizing audio... ${Math.round(progress)}%`;
        } else if (backendStatus === 'downloading') {
          return 'Downloading audio from cloud...';
        } else if (backendStatus === 'downloaded') {
          return 'Converting to MP3...';
        } else if (progress < 20) {
          return 'Starting audio synthesis...';
        } else if (progress < 90) {
          return `Synthesizing audio... ${Math.round(progress)}%`;
        } else {
          return 'Finalizing audiobook...';
        }
      case 'merging':
        return 'Merging audio files...';
      case 'complete':
        return 'Complete!';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="processing-status">
      <h2>Processing: {bookTitle}</h2>
      
      <div className="status-box">
        <div className="step-label">{getStepLabel()}</div>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">{Math.round(progress)}%</div>
        </div>

        {currentStep === 'generating' && (
          <div className="status-info">
            {progress < 20 ? (
              'Starting synthesis...'
            ) : elapsedTime > 0 && estimatedTime > 0 ? (
              <>
                <span className="time-info">
                  ⏱️ {formatTime(elapsedTime)} elapsed
                  {estimatedTime > elapsedTime && (
                    <> · ~{formatTime(estimatedTime - elapsedTime)} remaining</>
                  )}
                </span>
              </>
            ) : null}
          </div>
        )}

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProcessingStatus;

