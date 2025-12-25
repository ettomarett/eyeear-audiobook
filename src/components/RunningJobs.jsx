import React, { useState, useEffect } from 'react';
import './RunningJobs.css';

const API_BASE_URL = 'http://localhost:3003/api';

// SVG Icons
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);

function RunningJobs({ onJobComplete }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch running jobs on mount and periodically
  useEffect(() => {
    fetchRunningJobs();
    
    const interval = setInterval(fetchRunningJobs, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRunningJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/recovery/tracked-jobs`);
      if (response.ok) {
        const data = await response.json();
        
        // Filter for only running jobs (not downloaded or error)
        const runningJobs = Object.values(data.jobs || {}).filter(job => 
          job.status === 'started' || 
          job.status === 'synthesizing' || 
          job.status === 'downloading'
        );
        
        // Check for newly completed jobs
        const prevJobIds = jobs.map(j => j.jobId);
        const completedJobs = Object.values(data.jobs || {}).filter(job =>
          job.status === 'downloaded' && prevJobIds.includes(job.jobId)
        );
        
        if (completedJobs.length > 0 && onJobComplete) {
          completedJobs.forEach(job => onJobComplete(job));
        }
        
        setJobs(runningJobs);
      }
    } catch (err) {
      console.error('Error fetching running jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgressDisplay = (job) => {
    if (job.status === 'downloading') {
      return 'Downloading...';
    }
    if (job.status === 'synthesizing') {
      // Map progress from 20-90 to 0-100
      const progress = job.progress || 20;
      const displayProgress = progress < 20 ? 0 : Math.round(((progress - 20) / 70) * 100);
      return `${displayProgress}%`;
    }
    return 'Starting...';
  };

  const getProgressPercent = (job) => {
    if (job.status === 'downloading') return 95;
    if (job.status === 'synthesizing') {
      return job.progress || 20;
    }
    return 10;
  };

  return (
    <div className="running-jobs">
      <div className="running-jobs-header">
        <PlayIcon />
        <h3>Running Jobs</h3>
        {jobs.length > 0 && <span className="job-count">{jobs.length}</span>}
      </div>
      
      {loading ? (
        <div className="running-jobs-loading">
          <span className="loading-spinner"></span>
          Checking for running jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="running-jobs-empty">
          <p>No audiobooks are currently being generated.</p>
          <p className="empty-hint">Upload a book below to start generating an audiobook. You can leave this page while it's processing — your audiobook will appear in the <strong>Library</strong> once complete.</p>
        </div>
      ) : (
        <>
          <p className="running-jobs-tip">
            💡 You can leave this page safely. Your audiobook will appear in the <strong>Library</strong> once complete.
          </p>

          <div className="jobs-list">
            {jobs.map((job) => (
              <div key={job.jobId} className="job-item">
                <div className="job-info">
                  <div className="job-title">{job.bookTitle || 'Untitled'}</div>
                  <div className="job-meta">
                    {job.characterCount && (
                      <span>{job.characterCount.toLocaleString()} chars</span>
                    )}
                    <span className="job-status">
                      <ClockIcon /> {getProgressDisplay(job)}
                    </span>
                  </div>
                </div>
                <div className="job-progress">
                  <div className="job-progress-bar">
                    <div 
                      className="job-progress-fill"
                      style={{ width: `${getProgressPercent(job)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default RunningJobs;

