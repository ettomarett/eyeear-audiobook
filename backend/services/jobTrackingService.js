/**
 * Job Tracking Service
 * Persists job metadata including GCS URIs and operation names
 * Enables recovery of audiobooks that completed after app shutdown
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const JOBS_FILE = path.join(os.homedir(), '.eyeear', 'jobs.json');

// Ensure directory exists
function ensureJobsDir() {
  const dir = path.dirname(JOBS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load all tracked jobs
 */
function loadJobs() {
  ensureJobsDir();
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const data = fs.readFileSync(JOBS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading jobs:', error);
  }
  return {};
}

/**
 * Save jobs to file
 */
function saveJobs(jobs) {
  ensureJobsDir();
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error('Error saving jobs:', error);
  }
}

/**
 * Track a new job - called when synthesis starts
 */
function trackJob(jobInfo) {
  const {
    jobId,
    bookTitle,
    characterCount,
    uploadedFilename,
    operationName,
    gcsOutputUri,
    bucketName,
    outputFileName,
    status = 'started',
    startedAt = new Date().toISOString(),
  } = jobInfo;

  const jobs = loadJobs();
  
  jobs[jobId] = {
    jobId,
    bookTitle,
    characterCount,
    uploadedFilename,
    operationName,
    gcsOutputUri,
    bucketName,
    outputFileName,
    status,
    startedAt,
    updatedAt: new Date().toISOString(),
  };

  saveJobs(jobs);
  console.log(`Job tracked: ${jobId} - ${bookTitle}`);
  
  return jobs[jobId];
}

/**
 * Update job status
 */
function updateJobStatus(jobId, updates) {
  const jobs = loadJobs();
  
  if (!jobs[jobId]) {
    console.warn(`Job ${jobId} not found for update`);
    return null;
  }

  jobs[jobId] = {
    ...jobs[jobId],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveJobs(jobs);
  return jobs[jobId];
}

/**
 * Mark job as completed
 */
function markJobCompleted(jobId, localPath, filename) {
  return updateJobStatus(jobId, {
    status: 'completed',
    localPath,
    filename,
    completedAt: new Date().toISOString(),
  });
}

/**
 * Mark job as downloaded (removed from GCS)
 */
function markJobDownloaded(jobId) {
  return updateJobStatus(jobId, {
    status: 'downloaded',
    gcsCleanedUp: true,
  });
}

/**
 * Mark job as error
 */
function markJobError(jobId, errorMessage) {
  return updateJobStatus(jobId, {
    status: 'error',
    error: errorMessage,
  });
}

/**
 * Get job by ID
 */
function getJob(jobId) {
  const jobs = loadJobs();
  return jobs[jobId] || null;
}

/**
 * Get all jobs with a specific status
 */
function getJobsByStatus(status) {
  const jobs = loadJobs();
  return Object.values(jobs).filter(job => job.status === status);
}

/**
 * Get all pending/in-progress jobs (for recovery)
 */
function getRecoverableJobs() {
  const jobs = loadJobs();
  const recoverableStatuses = ['started', 'synthesizing', 'completed_on_gcs'];
  return Object.values(jobs).filter(job => recoverableStatuses.includes(job.status));
}

/**
 * Delete a job record (after successful download and cleanup)
 */
function deleteJob(jobId) {
  const jobs = loadJobs();
  if (jobs[jobId]) {
    delete jobs[jobId];
    saveJobs(jobs);
    console.log(`Job deleted: ${jobId}`);
  }
}

/**
 * Clean up old completed jobs (older than 7 days)
 */
function cleanupOldJobs() {
  const jobs = loadJobs();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    if (job.status === 'downloaded' || job.status === 'error') {
      const updatedAt = new Date(job.updatedAt || job.startedAt);
      if (updatedAt < sevenDaysAgo) {
        delete jobs[jobId];
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    saveJobs(jobs);
    console.log(`Cleaned up ${cleaned} old job records`);
  }
}

module.exports = {
  trackJob,
  updateJobStatus,
  markJobCompleted,
  markJobDownloaded,
  markJobError,
  getJob,
  getJobsByStatus,
  getRecoverableJobs,
  deleteJob,
  cleanupOldJobs,
  loadJobs,
};

