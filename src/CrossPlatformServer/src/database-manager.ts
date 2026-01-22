import Database from 'better-sqlite3';
import { QueueJob, QueueStatus } from './types.js';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.createTables();
      console.log('Database initialized successfully');
    } catch (err) {
      throw err;
    }
  }

  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        parameters TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL,
        started_at DATETIME,
        completed_at DATETIME,
        error TEXT,
        retry_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_queue_jobs_device_id ON queue_jobs(device_id);
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_created_at ON queue_jobs(created_at);
    `;

    this.db.exec(sql);
  }

  async addJob(deviceId: string, deviceType: string, operation: string, parameters: any): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const paramsJson = JSON.stringify(parameters);

    const sql = `
      INSERT INTO queue_jobs (id, device_id, device_type, operation, parameters, status, created_at, retry_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const stmt = this.db.prepare(sql);
    stmt.run(jobId, deviceId, deviceType, operation, paramsJson, 'pending', new Date().toISOString(), 0);
    
    return jobId;
  }

  async getNextPendingJob(): Promise<QueueJob | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT id, device_id, device_type, operation, parameters, status, created_at, started_at, completed_at, error, retry_count
      FROM queue_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `;

    const stmt = this.db.prepare(sql);
    const row = stmt.get() as any;

    if (row) {
      return {
        id: row.id,
        deviceId: row.device_id,
        deviceType: row.device_type,
        operation: row.operation,
        status: row.status,
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        error: row.error,
        retryCount: row.retry_count,
        parameters: JSON.parse(row.parameters)
      };
    } else {
      return null;
    }
  }

  async updateJobStatus(jobId: string, status: string, error?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let sql = 'UPDATE queue_jobs SET status = ?';
    const params: any[] = [status];

    if (status === 'processing') {
      sql += ', started_at = ?';
      params.push(new Date().toISOString());
    } else if (status === 'completed' || status === 'failed') {
      sql += ', completed_at = ?';
      params.push(new Date().toISOString());
    }

    if (error) {
      sql += ', error = ?';
      params.push(error);
    }

    sql += ' WHERE id = ?';
    params.push(jobId);

    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  async getQueueStatus(): Promise<QueueStatus> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT 
        COUNT(*) as totalJobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingJobs,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processingJobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
        MAX(CASE WHEN status = 'completed' THEN completed_at ELSE NULL END) as lastProcessed
      FROM queue_jobs
    `;

    const stmt = this.db.prepare(sql);
    const row = stmt.get() as any;

    const avgSql = `
      SELECT AVG(JULIANDAY(completed_at) - JULIANDAY(started_at)) * 24 * 60 * 60 * 1000 as avgTime
      FROM queue_jobs 
      WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
    `;

    const avgStmt = this.db.prepare(avgSql);
    const avgRow = avgStmt.get() as any;

    return {
      totalJobs: row.totalJobs,
      pendingJobs: row.pendingJobs,
      processingJobs: row.processingJobs,
      completedJobs: row.completedJobs,
      failedJobs: row.failedJobs,
      lastProcessed: row.lastProcessed ? new Date(row.lastProcessed) : new Date(0),
      averageProcessingTime: avgRow?.avgTime || 0
    };
  }

  async getJobs(deviceId?: string, status?: string, limit: number = 100): Promise<QueueJob[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let sql = `
      SELECT id, device_id, device_type, operation, parameters, status, created_at, started_at, completed_at, error, retry_count
      FROM queue_jobs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (deviceId) {
      sql += ' AND device_id = ?';
      params.push(deviceId);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      deviceId: row.device_id,
      deviceType: row.device_type,
      operation: row.operation,
      status: row.status,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error,
      retryCount: row.retry_count,
      parameters: JSON.parse(row.parameters)
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}