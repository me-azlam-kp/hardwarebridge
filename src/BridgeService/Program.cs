using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using System;
using System.Threading.Tasks;

namespace HardwareBridge
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            // Configure Serilog
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.Console()
                .WriteTo.File("logs/hardware-bridge-.txt", rollingInterval: RollingInterval.Day)
                .WriteTo.EventLog("Hardware Bridge Service", manageEventSource: true)
                .CreateLogger();

            try
            {
                Log.Information("Starting Hardware Bridge Service");
                
                var host = CreateHostBuilder(args).Build();
                
                // Handle console Ctrl+C gracefully
                Console.CancelKeyPress += (sender, e) =>
                {
                    e.Cancel = true;
                    host.StopAsync().Wait();
                };

                await host.RunAsync();
            }
            catch (Exception ex)
            {
                Log.Fatal(ex, "Host terminated unexpectedly");
            }
            finally
            {
                Log.CloseAndFlush();
            }
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .UseWindowsService(options =>
                {
                    options.ServiceName = "HardwareBridgeService";
                })
                .ConfigureLogging((context, logging) =>
                {
                    logging.ClearProviders();
                    logging.AddSerilog();
                    logging.AddEventLog(settings =>
                    {
                        settings.SourceName = "Hardware Bridge Service";
                        settings.LogName = "Hardware Bridge";
                    });
                })
                .ConfigureServices((context, services) =>
                {
                    // Configuration
                    services.Configure<ServiceConfiguration>(
                        context.Configuration.GetSection("HardwareBridge"));
                    
                    // Core services
                    services.AddSingleton<ICertificateManager, CertificateManager>();
                    services.AddSingleton<IDeviceManager, DeviceManager>();
                    services.AddSingleton<IWebSocketServer, WebSocketServer>();
                    services.AddSingleton<IJsonRpcHandler, JsonRpcHandler>();
                    services.AddSingleton<IOfflineQueueManager, OfflineQueueManager>();
                    services.AddSingleton<ISettingsManager, SettingsManager>();
                    services.AddSingleton<ITaskSchedulerManager, TaskSchedulerManager>();
                    services.AddSingleton<ILoggingManager, LoggingManager>();
                    
                    // Device-specific services
                    services.AddSingleton<IPrinterManager, PrinterManager>();
                    services.AddSingleton<ISerialPortManager, SerialPortManager>();
                    services.AddSingleton<IUsbHidManager, UsbHidManager>();
                    
                    // Main service
                    services.AddHostedService<HardwareBridgeService>();
                })
                .UseSerilog();
    }
}