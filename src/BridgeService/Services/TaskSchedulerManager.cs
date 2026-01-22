using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TaskScheduler;

namespace HardwareBridge.Services
{
    public interface ITaskSchedulerManager
    {
        Task<bool> CreateAutoStartTaskAsync(string executablePath);
        Task<bool> RemoveAutoStartTaskAsync();
        Task<bool> IsAutoStartTaskExistsAsync();
    }

    public class TaskSchedulerManager : ITaskSchedulerManager
    {
        private readonly ILogger<TaskSchedulerManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private const string TaskName = "HardwareBridgeAutoStart";

        public TaskSchedulerManager(
            ILogger<TaskSchedulerManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
        }

        public async Task<bool> CreateAutoStartTaskAsync(string executablePath)
        {
            try
            {
                _logger.LogInformation("Creating auto-start task...");
                
                using (TaskService ts = new TaskService())
                {
                    // Remove existing task if it exists
                    ts.RootFolder.DeleteTask(TaskName, false);
                    
                    // Create a new task definition
                    TaskDefinition td = ts.NewTask();
                    td.RegistrationInfo.Description = "Hardware Bridge Service Auto-Start";
                    td.RegistrationInfo.Author = "Hardware Bridge";
                    td.Principal.RunLevel = TaskRunLevel.Highest;
                    
                    // Set trigger to start at system startup
                    td.Triggers.Add(new BootTrigger());
                    
                    // Set action to run the executable
                    td.Actions.Add(new ExecAction(executablePath, null, null));
                    
                    // Set settings
                    td.Settings.AllowDemandStart = true;
                    td.Settings.AllowHardTerminate = false;
                    td.Settings.DisallowStartIfOnBatteries = false;
                    td.Settings.StopIfGoingOnBatteries = false;
                    td.Settings.StartWhenAvailable = true;
                    td.Settings.RunOnlyIfNetworkAvailable = false;
                    
                    // Register the task
                    ts.RootFolder.RegisterTaskDefinition(TaskName, td);
                    
                    _logger.LogInformation("Auto-start task created successfully");
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create auto-start task");
                return false;
            }
        }

        public async Task<bool> RemoveAutoStartTaskAsync()
        {
            try
            {
                _logger.LogInformation("Removing auto-start task...");
                
                using (TaskService ts = new TaskService())
                {
                    ts.RootFolder.DeleteTask(TaskName, false);
                    _logger.LogInformation("Auto-start task removed successfully");
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to remove auto-start task");
                return false;
            }
        }

        public async Task<bool> IsAutoStartTaskExistsAsync()
        {
            try
            {
                using (TaskService ts = new TaskService())
                {
                    var task = ts.RootFolder.Tasks.FirstOrDefault(t => t.Name == TaskName);
                    return task != null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if auto-start task exists");
                return false;
            }
        }
    }
}