'use-strict';

import http from 'http';
import https from 'https';

import Logger from '../../services/logger/logger.service.js';

const DEFAULT_INTERVAL = 1;
const REQUEST_TIMEOUT = 5000;

// Uses the motion detection of a camera (or any other device) as motion source by polling a status url.
// Motion is detected when the response matches the configured pattern, it is reset by the motion timeout.
export default class MotionPolling {
  constructor(cameraName, motionPolling, handler) {
    this.log = Logger.log;
    this.cameraName = cameraName;
    this.handler = handler;

    this.url = motionPolling.url;
    this.interval = (motionPolling.interval > 0 ? motionPolling.interval : DEFAULT_INTERVAL) * 1000;

    this.lastError = null;
    this.timeout = null;
    this.stopped = false;

    try {
      // only the host is logged, the url can contain credentials
      this.host = new URL(this.url).host;

      if (!motionPolling.match) {
        throw new Error('no match pattern configured');
      }

      this.pattern = new RegExp(motionPolling.match);
    } catch (error) {
      this.log.error(`Motion polling: ${error.message}`, cameraName, 'Homebridge');
      return;
    }

    this.log.info(`Polling ${this.host} for motion`, cameraName);
    this.poll();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timeout);
  }

  async poll() {
    try {
      const body = await this.request();

      if (this.lastError) {
        this.log.info('Motion polling is working again', this.cameraName);
        this.lastError = null;
      }

      if (this.pattern.test(body)) {
        await this.handler.handle('motion', this.cameraName, true, false);
      }
    } catch (error) {
      // log every error only once, the url is polled continuously
      if (error.message !== this.lastError) {
        this.log.warn(`Motion polling: ${error.message}`, this.cameraName, 'Homebridge');
        this.lastError = error.message;
      }
    }

    if (!this.stopped) {
      this.timeout = setTimeout(() => this.poll(), this.interval);
    }
  }

  request() {
    return new Promise((resolve, reject) => {
      // cameras often use self-signed certificates
      const client = this.url.startsWith('https:') ? https : http;
      const request = client.get(this.url, { timeout: REQUEST_TIMEOUT, rejectUnauthorized: false }, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`request failed (HTTP ${response.statusCode})`));
          }
        });
      });

      request.on('timeout', () => request.destroy(new Error('not reachable (timeout)')));
      request.on('error', reject);
    });
  }
}
