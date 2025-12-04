/**
 * Rate limiter for TTS API calls
 * Enforces 200 requests per minute for Chirp 3 HD voices
 */

class RateLimiter {
  constructor(maxRequestsPerMinute = 200) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.requestTimes = [];
    this.queue = [];
    this.processing = false;
  }

  async waitForSlot() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests outside the 1-minute window
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);

    // If we're under the limit, proceed immediately
    if (this.requestTimes.length < this.maxRequestsPerMinute) {
      this.requestTimes.push(now);
      return;
    }

    // Calculate wait time until the oldest request expires
    const oldestRequest = this.requestTimes[0];
    const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer

    // Wait until we can make another request
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Remove expired requests and add current request
    this.requestTimes = this.requestTimes.filter(time => time > Date.now() - 60000);
    this.requestTimes.push(Date.now());
  }

  async executeWithRetry(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForSlot();
        return await fn();
      } catch (error) {
        if (error.response && error.response.status === 429) {
          // Rate limit exceeded - exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          console.log(`Rate limit hit, waiting ${backoffTime}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
  }
}

module.exports = RateLimiter;

