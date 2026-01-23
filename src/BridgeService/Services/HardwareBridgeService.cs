using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Serilog;

namespace HardwareBridge.Services
{
    public class HardwareBridgeService : BackgroundService
    {
        private readonly ILogger<HardwareBridgeService> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWebSocketServer _webSocketServer;
        private readonly IDeviceManager _deviceManager;
        private readonly ISettingsManager _settingsManager;
        private readonly IOfflineQueueManager _queueManager;
        private readonly ILoggingManager _loggingManager;

#if WINDOWS
        private readonly ICertificateManager _certificateManager;
        private SystemTrayApplication _trayApp;
        private Thread _uiThread;
#endif

        public HardwareBridgeService(
            ILogger<HardwareBridgeService> logger,
            IOptionsMonitor<ServiceConfiguration> config,
            IServiceProvider serviceProvider,
            IWebSocketServer webSocketServer,
            IDeviceManager deviceManager,
            ISettingsManager settingsManager,
            IOfflineQueueManager queueManager,
            ILoggingManager loggingManager)
        {
            _logger = logger;
            _config = config;
            _serviceProvider = serviceProvider;
            _webSocketServer = webSocketServer;
            _deviceManager = deviceManager;
            _settingsManager = settingsManager;
            _queueManager = queueManager;
            _loggingManager = loggingManager;

#if WINDOWS
            _certificateManager = serviceProvider.GetRequiredService<ICertificateManager>();
            InitializeSystemTray();
#endif
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                _logger.LogInformation("Hardware Bridge Service starting...");

                // Initialize logging
                await _loggingManager.InitializeAsync();

                // Load settings
                var settings = await _settingsManager.LoadSettingsAsync();

#if WINDOWS
                // Initialize certificate manager
                await _certificateManager.InitializeAsync();
#endif

                // Initialize offline queue
                await _queueManager.InitializeAsync();

                // Start device discovery
                await _deviceManager.StartDiscoveryAsync();

                // Start WebSocket server
                await _webSocketServer.StartAsync();

                _logger.LogInformation("Hardware Bridge Service started successfully");

                // Keep service running until cancellation
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Hardware Bridge Service is stopping due to cancellation");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Hardware Bridge Service");
                throw;
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Hardware Bridge Service stopping...");

            try
            {
                // Stop WebSocket server
                await _webSocketServer.StopAsync();

                // Stop device discovery
                await _deviceManager.StopDiscoveryAsync();

#if WINDOWS
                // Gracefully shut down the tray application
                if (_trayApp != null)
                {
                    _trayApp.ExitThread();
                }

                // Wait for the UI thread to finish
                if (_uiThread != null && _uiThread.IsAlive)
                {
                    _uiThread.Join(TimeSpan.FromSeconds(5));
                }
#endif

                _logger.LogInformation("Hardware Bridge Service stopped");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping Hardware Bridge Service");
            }

            await base.StopAsync(cancellationToken);
        }

#if WINDOWS
        private void InitializeSystemTray()
        {
            try
            {
                _uiThread = new Thread(() =>
                {
                    try
                    {
                        _trayApp = new SystemTrayApplication(_serviceProvider);
                        System.Windows.Forms.Application.Run(_trayApp);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in system tray application");
                    }
                });

                _uiThread.SetApartmentState(ApartmentState.STA);
                _uiThread.IsBackground = true;
                _uiThread.Start();

                _logger.LogInformation("System tray application initialized");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing system tray application");
            }
        }
#endif
    }

#if WINDOWS
    public class SystemTrayApplication : System.Windows.Forms.ApplicationContext
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SystemTrayApplication> _logger;
        private System.Windows.Forms.NotifyIcon _trayIcon;
        private MainWindow _settingsWindow;

        public SystemTrayApplication(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            _logger = serviceProvider.GetRequiredService<ILogger<SystemTrayApplication>>();

            InitializeTrayIcon();
            InitializeSettingsWindow();
        }

        private void InitializeTrayIcon()
        {
            try
            {
                var contextMenu = new System.Windows.Forms.ContextMenuStrip();
                contextMenu.Items.Add("Settings", null, ShowSettings);
                contextMenu.Items.Add("View Logs", null, ViewLogs);
                contextMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
                contextMenu.Items.Add("Restart Service", null, RestartService);
                contextMenu.Items.Add("Stop Service", null, StopService);
                contextMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
                contextMenu.Items.Add("Exit", null, Exit);

                _trayIcon = new System.Windows.Forms.NotifyIcon()
                {
                    Icon = System.Drawing.SystemIcons.Application,
                    Text = "Hardware Bridge Service",
                    ContextMenuStrip = contextMenu,
                    Visible = true
                };

                _trayIcon.DoubleClick += ShowSettings;

                _logger.LogInformation("System tray icon initialized");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing tray icon");
            }
        }

        private void InitializeSettingsWindow()
        {
            try
            {
                _settingsWindow = new MainWindow(_serviceProvider);
                _logger.LogInformation("Settings window initialized");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing settings window");
            }
        }

        private void ShowSettings(object sender, EventArgs e)
        {
            try
            {
                if (_settingsWindow == null || _settingsWindow.IsDisposed)
                {
                    _settingsWindow = new MainWindow(_serviceProvider);
                }

                if (_settingsWindow.Visible)
                {
                    _settingsWindow.Activate();
                }
                else
                {
                    _settingsWindow.Show();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error showing settings window");
            }
        }

        private void ViewLogs(object sender, EventArgs e)
        {
            try
            {
                var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (Directory.Exists(logPath))
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = logPath,
                        UseShellExecute = true
                    });
                }
                else
                {
                    System.Windows.Forms.MessageBox.Show("Log directory not found.", "Information",
                        System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error opening log directory");
            }
        }

        private void RestartService(object sender, EventArgs e)
        {
            try
            {
                var result = System.Windows.Forms.MessageBox.Show("Are you sure you want to restart the Hardware Bridge Service?",
                    "Confirm Restart", System.Windows.Forms.MessageBoxButtons.YesNo, System.Windows.Forms.MessageBoxIcon.Question);

                if (result == System.Windows.Forms.DialogResult.Yes)
                {
                    _logger.LogInformation("Service restart requested from system tray");
                    var lifetime = _serviceProvider.GetRequiredService<IHostApplicationLifetime>();
                    lifetime.StopApplication();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restarting service");
            }
        }

        private void StopService(object sender, EventArgs e)
        {
            try
            {
                var result = System.Windows.Forms.MessageBox.Show("Are you sure you want to stop the Hardware Bridge Service?",
                    "Confirm Stop", System.Windows.Forms.MessageBoxButtons.YesNo, System.Windows.Forms.MessageBoxIcon.Question);

                if (result == System.Windows.Forms.DialogResult.Yes)
                {
                    _logger.LogInformation("Service stop requested from system tray");
                    var lifetime = _serviceProvider.GetRequiredService<IHostApplicationLifetime>();
                    lifetime.StopApplication();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping service");
            }
        }

        private void Exit(object sender, EventArgs e)
        {
            try
            {
                _logger.LogInformation("Exiting system tray application");

                if (_settingsWindow != null && !_settingsWindow.IsDisposed)
                {
                    _settingsWindow.Close();
                    _settingsWindow.Dispose();
                }

                if (_trayIcon != null)
                {
                    _trayIcon.Visible = false;
                    _trayIcon.Dispose();
                }

                System.Windows.Forms.Application.Exit();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exiting system tray application");
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _settingsWindow?.Dispose();
                _trayIcon?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
#endif
}
