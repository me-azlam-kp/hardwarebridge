using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using HardwareBridge.Models;
using HardwareBridge.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace HardwareBridge
{
    public partial class MainWindow : Window
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MainWindow> _logger;
        private readonly ISettingsManager _settingsManager;
        private readonly IDeviceManager _deviceManager;
        private readonly IOfflineQueueManager _queueManager;
        private readonly IWebSocketServer _webSocketServer;
        private ServiceConfiguration _currentSettings;
        private System.Windows.Threading.DispatcherTimer _refreshTimer;

        public MainWindow(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            _logger = serviceProvider.GetRequiredService<ILogger<MainWindow>>();
            _settingsManager = serviceProvider.GetRequiredService<ISettingsManager>();
            _deviceManager = serviceProvider.GetRequiredService<IDeviceManager>();
            _queueManager = serviceProvider.GetRequiredService<IOfflineQueueManager>();
            _webSocketServer = serviceProvider.GetRequiredService<IWebSocketServer>();
            
            InitializeComponent();
            LoadSettings();
            InitializeTimer();
            RefreshDevices();
            RefreshQueue();
        }

        private void InitializeTimer()
        {
            _refreshTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(5)
            };
            _refreshTimer.Tick += async (s, e) => await RefreshDataAsync();
            _refreshTimer.Start();
        }

        private async Task RefreshDataAsync()
        {
            try
            {
                await RefreshDevices();
                await RefreshQueue();
                UpdateUptime();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing data");
            }
        }

        private void UpdateUptime()
        {
            var uptime = TimeSpan.FromMilliseconds(Environment.TickCount);
            UptimeText.Text = $"Uptime: {uptime.Days}d {uptime.Hours}h {uptime.Minutes}m";
        }

        private async void LoadSettings()
        {
            try
            {
                _currentSettings = await _settingsManager.LoadSettingsAsync();
                
                // WebSocket settings
                PortTextBox.Text = _currentSettings.WebSocket.Port.ToString();
                UseTlsCheckBox.IsChecked = _currentSettings.WebSocket.UseTls;
                OriginsTextBox.Text = string.Join(",", _currentSettings.WebSocket.AllowedOrigins ?? new string[] { "*" });
                EnableMutualTlsCheckBox.IsChecked = _currentSettings.WebSocket.EnableMutualTls;
                
                // Certificate settings
                UseLetsEncryptCheckBox.IsChecked = _currentSettings.Certificate.UseLetsEncrypt;
                DomainTextBox.Text = _currentSettings.Certificate.Domain;
                EmailTextBox.Text = _currentSettings.Certificate.Email;
                AcmeServerTextBox.Text = _currentSettings.Certificate.AcmeServer;
                
                // Security settings
                EnableOriginValidationCheckBox.IsChecked = _currentSettings.Security.EnableOriginValidation;
                EnableCapabilityTokensCheckBox.IsChecked = _currentSettings.Security.EnableCapabilityTokens;
                AdminOriginsTextBox.Text = string.Join(",", _currentSettings.Security.AdminOrigins ?? new string[] { "localhost" });
                
                // Device settings
                EnablePrinterDiscovery.IsChecked = _currentSettings.Device.EnablePrinterDiscovery;
                EnableSerialPortDiscovery.IsChecked = _currentSettings.Device.EnableSerialPortDiscovery;
                EnableUsbHidDiscovery.IsChecked = _currentSettings.Device.EnableUsbHidDiscovery;
                DiscoveryIntervalTextBox.Text = _currentSettings.Device.DiscoveryInterval.ToString();
                MaxConnectionsTextBox.Text = _currentSettings.WebSocket.MaxConnections.ToString();
                ConnectionTimeoutTextBox.Text = _currentSettings.WebSocket.ConnectionTimeout.TotalSeconds.ToString();
                
                // Logging settings
                EnableConsoleLoggingCheckBox.IsChecked = _currentSettings.Logging.EnableConsole;
                EnableFileLoggingCheckBox.IsChecked = _currentSettings.Logging.EnableFile;
                EnableEventLogCheckBox.IsChecked = _currentSettings.Logging.EnableEventLog;
                EnableETWCheckBox.IsChecked = _currentSettings.Logging.EnableETW;
                MaxFileSizeTextBox.Text = (_currentSettings.Logging.MaxFileSize / (1024 * 1024)).ToString();
                MaxRetainedFilesTextBox.Text = _currentSettings.Logging.MaxRetainedFiles.ToString();
                
                // Set log level
                LogLevelComboBox.SelectedItem = LogLevelComboBox.Items
                    .Cast<System.Windows.Controls.ComboBoxItem>()
                    .FirstOrDefault(item => item.Content.ToString() == _currentSettings.Logging.LogLevel);
                
                _logger.LogInformation("Settings loaded successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading settings");
                MessageBox.Show($"Error loading settings: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            await SaveSettingsAsync();
        }

        private async void ApplyButton_Click(object sender, RoutedEventArgs e)
        {
            await SaveSettingsAsync();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private async Task SaveSettingsAsync()
        {
            try
            {
                // Update settings from UI
                _currentSettings.WebSocket.Port = int.Parse(PortTextBox.Text);
                _currentSettings.WebSocket.UseTls = UseTlsCheckBox.IsChecked ?? true;
                _currentSettings.WebSocket.AllowedOrigins = OriginsTextBox.Text
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .ToArray();
                _currentSettings.WebSocket.EnableMutualTls = EnableMutualTlsCheckBox.IsChecked ?? false;
                _currentSettings.WebSocket.MaxConnections = int.Parse(MaxConnectionsTextBox.Text);
                _currentSettings.WebSocket.ConnectionTimeout = TimeSpan.FromSeconds(int.Parse(ConnectionTimeoutTextBox.Text));
                
                _currentSettings.Certificate.UseLetsEncrypt = UseLetsEncryptCheckBox.IsChecked ?? true;
                _currentSettings.Certificate.Domain = DomainTextBox.Text;
                _currentSettings.Certificate.Email = EmailTextBox.Text;
                _currentSettings.Certificate.AcmeServer = AcmeServerTextBox.Text;
                
                _currentSettings.Security.EnableOriginValidation = EnableOriginValidationCheckBox.IsChecked ?? true;
                _currentSettings.Security.EnableCapabilityTokens = EnableCapabilityTokensCheckBox.IsChecked ?? true;
                _currentSettings.Security.AdminOrigins = AdminOriginsTextBox.Text
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .ToArray();
                
                _currentSettings.Device.EnablePrinterDiscovery = EnablePrinterDiscovery.IsChecked ?? true;
                _currentSettings.Device.EnableSerialPortDiscovery = EnableSerialPortDiscovery.IsChecked ?? true;
                _currentSettings.Device.EnableUsbHidDiscovery = EnableUsbHidDiscovery.IsChecked ?? true;
                _currentSettings.Device.DiscoveryInterval = int.Parse(DiscoveryIntervalTextBox.Text);
                
                _currentSettings.Logging.EnableConsole = EnableConsoleLoggingCheckBox.IsChecked ?? true;
                _currentSettings.Logging.EnableFile = EnableFileLoggingCheckBox.IsChecked ?? true;
                _currentSettings.Logging.EnableEventLog = EnableEventLogCheckBox.IsChecked ?? true;
                _currentSettings.Logging.EnableETW = EnableETWCheckBox.IsChecked ?? true;
                _currentSettings.Logging.MaxFileSize = int.Parse(MaxFileSizeTextBox.Text) * 1024 * 1024;
                _currentSettings.Logging.MaxRetainedFiles = int.Parse(MaxRetainedFilesTextBox.Text);
                
                if (LogLevelComboBox.SelectedItem != null)
                {
                    _currentSettings.Logging.LogLevel = ((System.Windows.Controls.ComboBoxItem)LogLevelComboBox.SelectedItem).Content.ToString();
                }
                
                // Save settings
                await _settingsManager.SaveSettingsAsync(_currentSettings);
                
                // Restart WebSocket server with new settings
                await _webSocketServer.RestartAsync();
                
                MessageBox.Show("Settings saved successfully!", "Success", 
                    MessageBoxButton.OK, MessageBoxImage.Information);
                
                _logger.LogInformation("Settings saved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving settings");
                MessageBox.Show($"Error saving settings: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void RefreshDevices_Click(object sender, RoutedEventArgs e)
        {
            await RefreshDevices();
        }

        private async Task RefreshDevices()
        {
            try
            {
                DeviceStatusText.Text = "Refreshing devices...";
                
                var devices = await _deviceManager.EnumerateDevicesAsync();
                DevicesDataGrid.ItemsSource = devices;
                DeviceCountText.Text = $"{devices.Count} devices found";
                
                DeviceStatusText.Text = "Devices refreshed";
                _logger.LogInformation("Refreshed {Count} devices", devices.Count);
            }
            catch (Exception ex)
            {
                DeviceStatusText.Text = "Error refreshing devices";
                _logger.LogError(ex, "Error refreshing devices");
                MessageBox.Show($"Error refreshing devices: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void ConnectDevice_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var selectedDevice = DevicesDataGrid.SelectedItem as DeviceInfo;
                if (selectedDevice == null)
                {
                    MessageBox.Show("Please select a device to connect.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                if (selectedDevice.IsConnected)
                {
                    MessageBox.Show("Device is already connected.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                DeviceStatusText.Text = $"Connecting to {selectedDevice.Name}...";
                
                var connected = await _deviceManager.ConnectDeviceAsync(selectedDevice.Id, "manual");
                
                if (connected)
                {
                    DeviceStatusText.Text = $"Connected to {selectedDevice.Name}";
                    await RefreshDevices();
                }
                else
                {
                    DeviceStatusText.Text = $"Failed to connect to {selectedDevice.Name}";
                }
            }
            catch (Exception ex)
            {
                DeviceStatusText.Text = "Error connecting device";
                _logger.LogError(ex, "Error connecting device");
                MessageBox.Show($"Error connecting device: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void DisconnectDevice_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var selectedDevice = DevicesDataGrid.SelectedItem as DeviceInfo;
                if (selectedDevice == null)
                {
                    MessageBox.Show("Please select a device to disconnect.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                if (!selectedDevice.IsConnected)
                {
                    MessageBox.Show("Device is not connected.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                DeviceStatusText.Text = $"Disconnecting from {selectedDevice.Name}...";
                
                var disconnected = await _deviceManager.DisconnectDeviceAsync(selectedDevice.Id);
                
                if (disconnected)
                {
                    DeviceStatusText.Text = $"Disconnected from {selectedDevice.Name}";
                    await RefreshDevices();
                }
                else
                {
                    DeviceStatusText.Text = $"Failed to disconnect from {selectedDevice.Name}";
                }
            }
            catch (Exception ex)
            {
                DeviceStatusText.Text = "Error disconnecting device";
                _logger.LogError(ex, "Error disconnecting device");
                MessageBox.Show($"Error disconnecting device: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void RefreshQueue_Click(object sender, RoutedEventArgs e)
        {
            await RefreshQueue();
        }

        private async Task RefreshQueue()
        {
            try
            {
                QueueStatusText.Text = "Refreshing queue...";
                
                var jobs = await _queueManager.GetJobsAsync(null, null, 100);
                QueueDataGrid.ItemsSource = jobs;
                
                var status = await _queueManager.GetStatusAsync();
                QueueStatsText.Text = $"Total: {status.TotalJobs}, Pending: {status.PendingJobs}, Processing: {status.ProcessingJobs}, Completed: {status.CompletedJobs}, Failed: {status.FailedJobs}";
                
                QueueStatusText.Text = "Queue refreshed";
                _logger.LogInformation("Refreshed queue with {Count} jobs", jobs.Count);
            }
            catch (Exception ex)
            {
                QueueStatusText.Text = "Error refreshing queue";
                _logger.LogError(ex, "Error refreshing queue");
                MessageBox.Show($"Error refreshing queue: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void ProcessNext_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                QueueStatusText.Text = "Processing next job...";
                
                var processed = await _queueManager.ProcessNextJobAsync();
                
                if (processed)
                {
                    QueueStatusText.Text = "Job processed successfully";
                }
                else
                {
                    QueueStatusText.Text = "No jobs to process";
                }
                
                await RefreshQueue();
            }
            catch (Exception ex)
            {
                QueueStatusText.Text = "Error processing job";
                _logger.LogError(ex, "Error processing next job");
                MessageBox.Show($"Error processing job: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void CancelJob_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var selectedJob = QueueDataGrid.SelectedItem as QueueJob;
                if (selectedJob == null)
                {
                    MessageBox.Show("Please select a job to cancel.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                QueueStatusText.Text = $"Cancelling job {selectedJob.Id}...";
                
                var cancelled = await _queueManager.CancelJobAsync(selectedJob.Id);
                
                if (cancelled)
                {
                    QueueStatusText.Text = $"Job {selectedJob.Id} cancelled";
                }
                else
                {
                    QueueStatusText.Text = $"Failed to cancel job {selectedJob.Id}";
                }
                
                await RefreshQueue();
            }
            catch (Exception ex)
            {
                QueueStatusText.Text = "Error cancelling job";
                _logger.LogError(ex, "Error cancelling job");
                MessageBox.Show($"Error cancelling job: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void OpenLogDirectory_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (Directory.Exists(logPath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = logPath,
                        UseShellExecute = true
                    });
                }
                else
                {
                    MessageBox.Show("Log directory not found.", "Information", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error opening log directory");
                MessageBox.Show($"Error opening log directory: {ex.Message}", "Error", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ViewLatestLog_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (Directory.Exists(logPath))
                {
                    var latestLog = Directory.GetFiles(logPath, "*.txt")
                        .OrderByDescending(f => File.GetLastWriteTime(f))
                        .FirstOrDefault();
                    
                    if (latestLog != null)
                    {
                        var logContent = File.ReadAllText(latestLog);
                        LogPreviewTextBox.Text = logContent.Length > 10000 
                            ? logContent.Substring(0, 10000) + "... (truncated)" 
                            : logContent;
                    }
                    else
                    {
                        LogPreviewTextBox.Text = "No log files found.";
                    }
                }
                else
                {
                    LogPreviewTextBox.Text = "Log directory not found.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error viewing latest log");
                LogPreviewTextBox.Text = $"Error viewing log: {ex.Message}";
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
            _refreshTimer?.Stop();
        }
    }
}