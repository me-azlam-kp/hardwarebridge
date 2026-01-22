using System;
using System.IO;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace HardwareBridge.Services
{
    public interface ISettingsManager
    {
        Task<ServiceConfiguration> LoadSettingsAsync();
        Task SaveSettingsAsync(ServiceConfiguration settings);
        ServiceConfiguration GetSettings();
    }

    public class SettingsManager : ISettingsManager
    {
        private readonly ILogger<SettingsManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly string _settingsPath;

        public SettingsManager(
            ILogger<SettingsManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "settings.json");
        }

        public async Task<ServiceConfiguration> LoadSettingsAsync()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    var json = await File.ReadAllTextAsync(_settingsPath);
                    var settings = JsonConvert.DeserializeObject<ServiceConfiguration>(json);
                    
                    if (settings != null)
                    {
                        _logger.LogInformation("Settings loaded from {Path}", _settingsPath);
                        return settings;
                    }
                }

                _logger.LogInformation("Using default settings");
                return _config.CurrentValue;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading settings from {Path}, using defaults", _settingsPath);
                return _config.CurrentValue;
            }
        }

        public async Task SaveSettingsAsync(ServiceConfiguration settings)
        {
            try
            {
                var json = JsonConvert.SerializeObject(settings, Formatting.Indented);
                await File.WriteAllTextAsync(_settingsPath, json);
                
                _logger.LogInformation("Settings saved to {Path}", _settingsPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving settings to {Path}", _settingsPath);
                throw;
            }
        }

        public ServiceConfiguration GetSettings()
        {
            return _config.CurrentValue;
        }
    }
}