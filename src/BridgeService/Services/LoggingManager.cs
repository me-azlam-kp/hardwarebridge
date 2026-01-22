using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Serilog;

namespace HardwareBridge.Services
{
    public interface ILoggingManager
    {
        Task<bool> InitializeAsync();
        void LogEvent(string eventName, string message, EventLogEntryType entryType = EventLogEntryType.Information);
        void LogToFile(string message, string category = "General");
        void LogToETW(string message, EventLevel level = EventLevel.Informational);
    }

    public class LoggingManager : ILoggingManager
    {
        private readonly ILogger<LoggingManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly string _eventSourceName;
        private readonly string _eventLogName;

        public LoggingManager(
            ILogger<LoggingManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _eventSourceName = "Hardware Bridge Service";
            _eventLogName = "Hardware Bridge";
        }

        public async Task<bool> InitializeAsync()
        {
            try
            {
                _logger.LogInformation("Initializing logging manager...");
                
                var config = _config.CurrentValue.Logging;
                
                // Ensure log directory exists
                if (config.EnableFile)
                {
                    var logDir = Path.GetFullPath(config.LogPath);
                    if (!Directory.Exists(logDir))
                    {
                        Directory.CreateDirectory(logDir);
                    }
                }

                // Create event log source if it doesn't exist
                if (config.EnableEventLog && !EventLog.SourceExists(_eventSourceName))
                {
                    try
                    {
                        EventLog.CreateEventSource(_eventSourceName, _eventLogName);
                        _logger.LogInformation("Event log source created: {SourceName}", _eventSourceName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create event log source, may require administrator privileges");
                    }
                }

                _logger.LogInformation("Logging manager initialized successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize logging manager");
                return false;
            }
        }

        public void LogEvent(string eventName, string message, EventLogEntryType entryType = EventLogEntryType.Information)
        {
            try
            {
                var config = _config.CurrentValue.Logging;
                
                if (!config.EnableEventLog)
                {
                    return;
                }

                EventLog.WriteEntry(_eventSourceName, message, entryType, 0);
                
                // Also log to Serilog
                switch (entryType)
                {
                    case EventLogEntryType.Error:
                        Serilog.Log.Error("{EventName}: {Message}", eventName, message);
                        break;
                    case EventLogEntryType.Warning:
                        Serilog.Log.Warning("{EventName}: {Message}", eventName, message);
                        break;
                    default:
                        Serilog.Log.Information("{EventName}: {Message}", eventName, message);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error writing to event log");
            }
        }

        public void LogToFile(string message, string category = "General")
        {
            try
            {
                var config = _config.CurrentValue.Logging;
                
                if (!config.EnableFile)
                {
                    return;
                }

                var logFile = Path.Combine(config.LogPath, $"hardware-bridge-{category}-{DateTime.Now:yyyy-MM-dd}.log");
                var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [{category}] {message}{Environment.NewLine}";
                
                File.AppendAllText(logFile, logEntry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error writing to log file");
            }
        }

        public void LogToETW(string message, EventLevel level = EventLevel.Informational)
        {
            try
            {
                var config = _config.CurrentValue.Logging;
                
                if (!config.EnableETW)
                {
                    return;
                }

                // This is a simplified ETW logging implementation
                // In a production environment, you would use a proper ETW provider
                
                var eventSource = new EventSource("HardwareBridge-Service");
                
                switch (level)
                {
                    case EventLevel.Critical:
                    case EventLevel.Error:
                        eventSource.Write("Error", new { Message = message, Level = level });
                        break;
                    case EventLevel.Warning:
                        eventSource.Write("Warning", new { Message = message, Level = level });
                        break;
                    default:
                        eventSource.Write("Information", new { Message = message, Level = level });
                        break;
                }
                
                eventSource.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error writing to ETW");
            }
        }
    }

    // Simple EventSource implementation for ETW logging
    public class EventSource : IDisposable
    {
        private readonly string _name;

        public EventSource(string name)
        {
            _name = name;
        }

        public void Write(string eventName, object data)
        {
            // In a real implementation, this would write to ETW
            // For now, we'll just log to the regular logger
            Serilog.Log.Information("ETW Event: {EventName} - {@Data}", eventName, data);
        }

        public void Dispose()
        {
            // Cleanup if needed
        }
    }

    public enum EventLevel
    {
        LogAlways = 0,
        Critical = 1,
        Error = 2,
        Warning = 3,
        Informational = 4,
        Verbose = 5
    }
}