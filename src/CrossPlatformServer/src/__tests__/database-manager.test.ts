import { DatabaseManager } from '../database-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DatabaseManager', () => {
  const testDbPath = path.join(__dirname, 'test-queue.db');
  let dbManager: DatabaseManager;

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    // Close database and clean up
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialize', () => {
    it('should initialize database successfully', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });

    it('should create database file', async () => {
      await dbManager.initialize();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });
  });

  describe('addJob', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should add a job and return job ID', async () => {
      const jobId = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test' });
      expect(jobId).toBeDefined();
      expect(jobId.startsWith('job_')).toBe(true);
    });

    it('should create unique job IDs', async () => {
      const jobId1 = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test1' });
      const jobId2 = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test2' });
      expect(jobId1).not.toBe(jobId2);
    });
  });

  describe('getNextPendingJob', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should return null when no jobs exist', async () => {
      const job = await dbManager.getNextPendingJob();
      expect(job).toBeNull();
    });

    it('should return the oldest pending job', async () => {
      await dbManager.addJob('printer_1', 'printer', 'print', { data: 'first' });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await dbManager.addJob('printer_2', 'printer', 'print', { data: 'second' });

      const job = await dbManager.getNextPendingJob();
      expect(job).not.toBeNull();
      expect(job?.deviceId).toBe('printer_1');
    });

    it('should return job with correct properties', async () => {
      await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test', format: 'raw' });
      const job = await dbManager.getNextPendingJob();

      expect(job).not.toBeNull();
      expect(job?.id).toBeDefined();
      expect(job?.deviceId).toBe('printer_1');
      expect(job?.deviceType).toBe('printer');
      expect(job?.operation).toBe('print');
      expect(job?.status).toBe('pending');
      expect(job?.createdAt).toBeInstanceOf(Date);
      expect(job?.retryCount).toBe(0);
      expect(job?.parameters).toEqual({ data: 'test', format: 'raw' });
    });
  });

  describe('updateJobStatus', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should update job to processing status', async () => {
      const jobId = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test' });
      await dbManager.updateJobStatus(jobId, 'processing');

      const jobs = await dbManager.getJobs(undefined, 'processing');
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('processing');
      expect(jobs[0].startedAt).toBeDefined();
    });

    it('should update job to completed status', async () => {
      const jobId = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test' });
      await dbManager.updateJobStatus(jobId, 'completed');

      const jobs = await dbManager.getJobs(undefined, 'completed');
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('completed');
      expect(jobs[0].completedAt).toBeDefined();
    });

    it('should update job to failed status with error', async () => {
      const jobId = await dbManager.addJob('printer_1', 'printer', 'print', { data: 'test' });
      await dbManager.updateJobStatus(jobId, 'failed', 'Printer offline');

      const jobs = await dbManager.getJobs(undefined, 'failed');
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('failed');
      expect(jobs[0].error).toBe('Printer offline');
    });
  });

  describe('getQueueStatus', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should return empty queue status', async () => {
      const status = await dbManager.getQueueStatus();
      expect(status.totalJobs).toBe(0);
      // SQL SUM returns null for empty tables, so check for null or 0
      expect(status.pendingJobs ?? 0).toBe(0);
      expect(status.processingJobs ?? 0).toBe(0);
      expect(status.completedJobs ?? 0).toBe(0);
      expect(status.failedJobs ?? 0).toBe(0);
    });

    it('should return correct job counts', async () => {
      // Add jobs with different statuses
      const job1 = await dbManager.addJob('p1', 'printer', 'print', {});
      const job2 = await dbManager.addJob('p2', 'printer', 'print', {});
      const job3 = await dbManager.addJob('p3', 'printer', 'print', {});
      const job4 = await dbManager.addJob('p4', 'printer', 'print', {});

      await dbManager.updateJobStatus(job1, 'processing');
      await dbManager.updateJobStatus(job2, 'completed');
      await dbManager.updateJobStatus(job3, 'failed', 'Error');
      // job4 remains pending

      const status = await dbManager.getQueueStatus();
      expect(status.totalJobs).toBe(4);
      expect(status.pendingJobs).toBe(1);
      expect(status.processingJobs).toBe(1);
      expect(status.completedJobs).toBe(1);
      expect(status.failedJobs).toBe(1);
    });
  });

  describe('getJobs', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should return empty array when no jobs', async () => {
      const jobs = await dbManager.getJobs();
      expect(jobs).toEqual([]);
    });

    it('should return all jobs', async () => {
      await dbManager.addJob('p1', 'printer', 'print', {});
      await dbManager.addJob('p2', 'printer', 'print', {});
      await dbManager.addJob('p3', 'printer', 'print', {});

      const jobs = await dbManager.getJobs();
      expect(jobs.length).toBe(3);
    });

    it('should filter by deviceId', async () => {
      await dbManager.addJob('printer_1', 'printer', 'print', {});
      await dbManager.addJob('printer_2', 'printer', 'print', {});
      await dbManager.addJob('printer_1', 'printer', 'print', {});

      const jobs = await dbManager.getJobs('printer_1');
      expect(jobs.length).toBe(2);
      jobs.forEach(job => expect(job.deviceId).toBe('printer_1'));
    });

    it('should filter by status', async () => {
      const job1 = await dbManager.addJob('p1', 'printer', 'print', {});
      await dbManager.addJob('p2', 'printer', 'print', {});

      await dbManager.updateJobStatus(job1, 'completed');

      const completedJobs = await dbManager.getJobs(undefined, 'completed');
      expect(completedJobs.length).toBe(1);

      const pendingJobs = await dbManager.getJobs(undefined, 'pending');
      expect(pendingJobs.length).toBe(1);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        await dbManager.addJob(`p${i}`, 'printer', 'print', {});
      }

      const jobs = await dbManager.getJobs(undefined, undefined, 5);
      expect(jobs.length).toBe(5);
    });

    it('should order by createdAt descending', async () => {
      await dbManager.addJob('p1', 'printer', 'print', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      await dbManager.addJob('p2', 'printer', 'print', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      await dbManager.addJob('p3', 'printer', 'print', {});

      const jobs = await dbManager.getJobs();
      expect(jobs[0].deviceId).toBe('p3'); // Most recent first
      expect(jobs[2].deviceId).toBe('p1'); // Oldest last
    });
  });

  describe('close', () => {
    it('should close database without error', async () => {
      await dbManager.initialize();
      expect(() => dbManager.close()).not.toThrow();
    });

    it('should be safe to call close multiple times', async () => {
      await dbManager.initialize();
      dbManager.close();
      expect(() => dbManager.close()).not.toThrow();
    });
  });
});
