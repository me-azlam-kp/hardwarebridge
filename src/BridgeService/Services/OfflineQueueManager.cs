using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace HardwareBridge.Services
{
    public interface IOfflineQueueManager
    {
        Task<bool> InitializeAsync();
        Task<string> QueueJobAsync(string deviceId, string deviceType, string operation, Dictionary<string, object> parameters);
        Task<bool> ProcessNextJobAsync();
        Task<bool> CancelJobAsync(string jobId);
        Task<QueueStatus> GetStatusAsync();
        Task<List<QueueJob>> GetJobsAsync(string deviceId = null, string status = null, int limit = 100);
        Task<bool> RetryJobAsync(string jobId);
    }

    public class OfflineQueueManager : IOfflineQueueManager
    {
        private readonly ILogger<OfflineQueueManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly IServiceProvider _serviceProvider;
        private readonly SemaphoreSlim _processingSemaphore;
        private Timer _processingTimer;
        private bool _isInitialized;

        public OfflineQueueManager(
            ILogger<OfflineQueueManager> logger,
            IOptionsMonitor<ServiceConfiguration> config,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _config = config;
            _serviceProvider = serviceProvider;
            _processingSemaphore = new SemaphoreSlim(1, 1);
        }

        public async Task<bool> InitializeAsync()
        {
            try
            {
                _logger.LogInformation("Initializing offline queue manager...");
                
                var config = _config.CurrentValue.Queue;
                
                if (!config.EnableOfflineQueue)
                {
                    _logger.LogInformation("Offline queue is disabled");
                    return true;
                }

                // Ensure database directory exists
                var dbPath = Path.GetFullPath(config.DatabasePath);
                var dbDir = Path.GetDirectoryName(dbPath);
                if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
                {
                    Directory.CreateDirectory(dbDir);
                }

                // Create database connection string
                var connectionString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared";
                
                // Initialize database schema
                await InitializeDatabaseAsync(connectionString);
                
                // Start processing timer
                StartProcessingTimer();
                
                _isInitialized = true;
                _logger.LogInformation("Offline queue manager initialized successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize offline queue manager");
                return false;
            }
        }

        public async Task<string> QueueJobAsync(string deviceId, string deviceType, string operation, Dictionary<string, object> parameters)
        {
            try
            {
                if (!_isInitialized)
                {
                    throw new InvalidOperationException("Queue manager is not initialized");
                }

                var jobId = Guid.NewGuid().ToString();
                var parametersJson = JsonConvert.SerializeObject(parameters);
                
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        INSERT INTO QueueJobs (Id, DeviceId, DeviceType, Operation, Parameters, Status, CreatedAt, RetryCount)
                        VALUES (@Id, @DeviceId, @DeviceType, @Operation, @Parameters, @Status, @CreatedAt, @RetryCount)";
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@Id", jobId);
                        command.Parameters.AddWithValue("@DeviceId", deviceId);
                        command.Parameters.AddWithValue("@DeviceType", deviceType);
                        command.Parameters.AddWithValue("@Operation", operation);
                        command.Parameters.AddWithValue("@Parameters", parametersJson);
                        command.Parameters.AddWithValue("@Status", "pending");
                        command.Parameters.AddWithValue("@CreatedAt", DateTime.UtcNow);
                        command.Parameters.AddWithValue("@RetryCount", 0);
                        
                        await command.ExecuteNonQueryAsync();
                    }
                }

                _logger.LogInformation("Job queued: {JobId} for device {DeviceId}, operation {Operation}", 
                    jobId, deviceId, operation);
                
                return jobId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error queuing job for device {DeviceId}, operation {Operation}", deviceId, operation);
                throw;
            }
        }

        public async Task<bool> ProcessNextJobAsync()
        {
            await _processingSemaphore.WaitAsync();
            
            try
            {
                if (!_isInitialized)
                {
                    return false;
                }

                QueueJob job = null;
                
                // Get next pending job
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        SELECT Id, DeviceId, DeviceType, Operation, Parameters, Status, CreatedAt, StartedAt, CompletedAt, Error, RetryCount
                        FROM QueueJobs 
                        WHERE Status = 'pending' 
                        ORDER BY CreatedAt ASC 
                        LIMIT 1";
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                job = new QueueJob
                                {
                                    Id = reader.GetString(0),
                                    DeviceId = reader.GetString(1),
                                    DeviceType = reader.GetString(2),
                                    Operation = reader.GetString(3),
                                    Parameters = JsonConvert.DeserializeObject<Dictionary<string, object>>(reader.GetString(4)),
                                    Status = reader.GetString(5),
                                    CreatedAt = reader.GetDateTime(6),
                                    StartedAt = reader.IsDBNull(7) ? null : reader.GetDateTime(7),
                                    CompletedAt = reader.IsDBNull(8) ? null : reader.GetDateTime(8),
                                    Error = reader.IsDBNull(9) ? null : reader.GetString(9),
                                    RetryCount = reader.GetInt32(10)
                                };
                            }
                        }
                    }
                }

                if (job == null)
                {
                    return false; // No jobs to process
                }

                // Process the job
                await ProcessJobAsync(job);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing next job");
                return false;
            }
            finally
            {
                _processingSemaphore.Release();
            }
        }

        public async Task<bool> CancelJobAsync(string jobId)
        {
            try
            {
                using (var connection = await GetConnectionAsync())
                {
                    var sql = "UPDATE QueueJobs SET Status = @Status WHERE Id = @Id AND Status IN ('pending', 'processing')";
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@Id", jobId);
                        command.Parameters.AddWithValue("@Status", "cancelled");
                        
                        var rowsAffected = await command.ExecuteNonQueryAsync();
                        return rowsAffected > 0;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling job {JobId}", jobId);
                return false;
            }
        }

        public async Task<QueueStatus> GetStatusAsync()
        {
            try
            {
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        SELECT 
                            COUNT(*) as TotalJobs,
                            SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) as PendingJobs,
                            SUM(CASE WHEN Status = 'processing' THEN 1 ELSE 0 END) as ProcessingJobs,
                            SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as CompletedJobs,
                            SUM(CASE WHEN Status = 'failed' THEN 1 ELSE 0 END) as FailedJobs,
                            MAX(CASE WHEN Status = 'completed' THEN CompletedAt ELSE NULL END) as LastProcessed
                        FROM QueueJobs";
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                var status = new QueueStatus
                                {
                                    TotalJobs = reader.GetInt32(0),
                                    PendingJobs = reader.GetInt32(1),
                                    ProcessingJobs = reader.GetInt32(2),
                                    CompletedJobs = reader.GetInt32(3),
                                    FailedJobs = reader.GetInt32(4),
                                    LastProcessed = reader.IsDBNull(5) ? DateTime.MinValue : reader.GetDateTime(5)
                                };

                                // Calculate average processing time
                                var avgSql = "SELECT AVG(JULIANDAY(CompletedAt) - JULIANDAY(StartedAt)) * 24 * 60 * 60 * 1000 FROM QueueJobs WHERE Status = 'completed' AND StartedAt IS NOT NULL AND CompletedAt IS NOT NULL";
                                using (var avgCommand = new SqliteCommand(avgSql, connection))
                                {
                                    var avgResult = await avgCommand.ExecuteScalarAsync();
                                    status.AverageProcessingTime = avgResult != DBNull.Value ? Convert.ToDouble(avgResult) : 0;
                                }

                                return status;
                            }
                        }
                    }
                }

                return new QueueStatus();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting queue status");
                return new QueueStatus();
            }
        }

        public async Task<List<QueueJob>> GetJobsAsync(string deviceId = null, string status = null, int limit = 100)
        {
            try
            {
                var jobs = new List<QueueJob>();
                
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        SELECT Id, DeviceId, DeviceType, Operation, Parameters, Status, CreatedAt, StartedAt, CompletedAt, Error, RetryCount
                        FROM QueueJobs 
                        WHERE 1=1";
                    
                    var parameters = new List<SqliteParameter>();
                    
                    if (!string.IsNullOrEmpty(deviceId))
                    {
                        sql += " AND DeviceId = @DeviceId";
                        parameters.Add(new SqliteParameter("@DeviceId", deviceId));
                    }
                    
                    if (!string.IsNullOrEmpty(status))
                    {
                        sql += " AND Status = @Status";
                        parameters.Add(new SqliteParameter("@Status", status));
                    }
                    
                    sql += " ORDER BY CreatedAt DESC LIMIT @Limit";
                    parameters.Add(new SqliteParameter("@Limit", limit));
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        command.Parameters.AddRange(parameters.ToArray());
                        
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var job = new QueueJob
                                {
                                    Id = reader.GetString(0),
                                    DeviceId = reader.GetString(1),
                                    DeviceType = reader.GetString(2),
                                    Operation = reader.GetString(3),
                                    Parameters = JsonConvert.DeserializeObject<Dictionary<string, object>>(reader.GetString(4)),
                                    Status = reader.GetString(5),
                                    CreatedAt = reader.GetDateTime(6),
                                    StartedAt = reader.IsDBNull(7) ? null : reader.GetDateTime(7),
                                    CompletedAt = reader.IsDBNull(8) ? null : reader.GetDateTime(8),
                                    Error = reader.IsDBNull(9) ? null : reader.GetString(9),
                                    RetryCount = reader.GetInt32(10)
                                };
                                
                                jobs.Add(job);
                            }
                        }
                    }
                }

                return jobs;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting jobs");
                return new List<QueueJob>();
            }
        }

        public async Task<bool> RetryJobAsync(string jobId)
        {
            try
            {
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        UPDATE QueueJobs 
                        SET Status = 'pending', Error = NULL, StartedAt = NULL, CompletedAt = NULL, RetryCount = RetryCount + 1
                        WHERE Id = @Id AND Status IN ('failed', 'cancelled')";
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@Id", jobId);
                        
                        var rowsAffected = await command.ExecuteNonQueryAsync();
                        return rowsAffected > 0;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrying job {JobId}", jobId);
                return false;
            }
        }

        #region Private Methods

        private async Task InitializeDatabaseAsync(string connectionString)
        {
            try
            {
                using (var connection = new SqliteConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    var createTableSql = @"
                        CREATE TABLE IF NOT EXISTS QueueJobs (
                            Id TEXT PRIMARY KEY,
                            DeviceId TEXT NOT NULL,
                            DeviceType TEXT NOT NULL,
                            Operation TEXT NOT NULL,
                            Parameters TEXT NOT NULL,
                            Status TEXT NOT NULL DEFAULT 'pending',
                            CreatedAt DATETIME NOT NULL,
                            StartedAt DATETIME,
                            CompletedAt DATETIME,
                            Error TEXT,
                            RetryCount INTEGER DEFAULT 0
                        );
                        
                        CREATE INDEX IF NOT EXISTS IX_QueueJobs_DeviceId ON QueueJobs(DeviceId);
                        CREATE INDEX IF NOT EXISTS IX_QueueJobs_Status ON QueueJobs(Status);
                        CREATE INDEX IF NOT EXISTS IX_QueueJobs_CreatedAt ON QueueJobs(CreatedAt);";
                    
                    using (var command = new SqliteCommand(createTableSql, connection))
                    {
                        await command.ExecuteNonQueryAsync();
                    }
                }
                
                _logger.LogInformation("Database initialized successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing database");
                throw;
            }
        }

        private async Task<SqliteConnection> GetConnectionAsync()
        {
            var config = _config.CurrentValue.Queue;
            var dbPath = Path.GetFullPath(config.DatabasePath);
            var connectionString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared";
            
            var connection = new SqliteConnection(connectionString);
            await connection.OpenAsync();
            return connection;
        }

        private void StartProcessingTimer()
        {
            var config = _config.CurrentValue.Queue;
            
            _processingTimer = new Timer(async _ =>
            {
                try
                {
                    await ProcessNextJobAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in processing timer");
                }
            }, null, config.RetryInterval, config.RetryInterval);
            
            _logger.LogInformation("Processing timer started with interval {Interval}", config.RetryInterval);
        }

        private async Task ProcessJobAsync(QueueJob job)
        {
            try
            {
                _logger.LogInformation("Processing job {JobId} for device {DeviceId}, operation {Operation}", 
                    job.Id, job.DeviceId, job.Operation);
                
                // Update job status to processing
                await UpdateJobStatusAsync(job.Id, "processing", null);
                
                // Process the job based on device type and operation
                var success = await ExecuteJobAsync(job);
                
                if (success)
                {
                    await UpdateJobStatusAsync(job.Id, "completed", null);
                    _logger.LogInformation("Job completed successfully: {JobId}", job.Id);
                }
                else
                {
                    // Check if we should retry
                    var config = _config.CurrentValue.Queue;
                    if (job.RetryCount < config.MaxRetryAttempts)
                    {
                        await UpdateJobStatusAsync(job.Id, "pending", "Job failed, will retry");
                        _logger.LogWarning("Job failed, will retry: {JobId} (attempt {Attempt})", job.Id, job.RetryCount + 1);
                    }
                    else
                    {
                        await UpdateJobStatusAsync(job.Id, "failed", "Max retry attempts reached");
                        _logger.LogError("Job failed after max retries: {JobId}", job.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing job {JobId}", job.Id);
                await UpdateJobStatusAsync(job.Id, "failed", ex.Message);
            }
        }

        private async Task<bool> ExecuteJobAsync(QueueJob job)
        {
            try
            {
                // This is where you would implement the actual job execution logic
                // For now, we'll just simulate success
                await Task.Delay(100); // Simulate some work
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing job {JobId}", job.Id);
                return false;
            }
        }

        private async Task UpdateJobStatusAsync(string jobId, string status, string error)
        {
            try
            {
                using (var connection = await GetConnectionAsync())
                {
                    var sql = @"
                        UPDATE QueueJobs 
                        SET Status = @Status, Error = @Error";
                    
                    var parameters = new List<SqliteParameter>
                    {
                        new SqliteParameter("@Status", status),
                        new SqliteParameter("@Error", error ?? (object)DBNull.Value)
                    };
                    
                    if (status == "processing")
                    {
                        sql += ", StartedAt = @StartedAt";
                        parameters.Add(new SqliteParameter("@StartedAt", DateTime.UtcNow));
                    }
                    else if (status == "completed" || status == "failed")
                    {
                        sql += ", CompletedAt = @CompletedAt";
                        parameters.Add(new SqliteParameter("@CompletedAt", DateTime.UtcNow));
                    }
                    
                    sql += " WHERE Id = @Id";
                    parameters.Add(new SqliteParameter("@Id", jobId));
                    
                    using (var command = new SqliteCommand(sql, connection))
                    {
                        command.Parameters.AddRange(parameters.ToArray());
                        await command.ExecuteNonQueryAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating job status for {JobId}", jobId);
            }
        }

        public void Dispose()
        {
            _processingTimer?.Dispose();
            _processingSemaphore?.Dispose();
        }
        #endregion
    }
}