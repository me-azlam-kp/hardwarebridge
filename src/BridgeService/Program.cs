using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using System;
using System.Threading.Tasks;
using HardwareBridge.Models;
using HardwareBridge.Services;

namespace HardwareBridge
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            // Configure Serilog
            var loggerConfig = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.Console()
                .WriteTo.File("logs/hardware-bridge-.txt", rollingInterval: RollingInterval.Day);

#if WINDOWS
            loggerConfig = loggerConfig.WriteTo.EventLog("Hardware Bridge Service", manageEventSource: true);
#endif

            Log.Logger = loggerConfig.CreateLogger();

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

        public static IHostBuilder CreateHostBuilder(string[] args)
        {
            var builder = Host.CreateDefaultBuilder(args);

#if WINDOWS
            builder = builder.UseWindowsService(options =>
            {
                options.ServiceName = "HardwareBridgeService";
            });
#endif

            builder = builder
                .ConfigureLogging((context, logging) =>
                {
                    logging.ClearProviders();
                    logging.AddSerilog();
#if WINDOWS
                    logging.AddEventLog(settings =>
                    {
                        settings.SourceName = "Hardware Bridge Service";
                        settings.LogName = "Hardware Bridge";
                    });
#endif
                })
                .ConfigureServices((context, services) =>
                {
                    // Configuration
                    services.Configure<ServiceConfiguration>(
                        context.Configuration.GetSection("HardwareBridge"));

                    // Core services
                    services.AddSingleton<IWebSocketServer, WebSocketServer>();
                    services.AddSingleton<IJsonRpcHandler, JsonRpcHandler>();
                    services.AddSingleton<IDeviceManager, DeviceManager>();
                    services.AddSingleton<IOfflineQueueManager, OfflineQueueManager>();
                    services.AddSingleton<ISettingsManager, SettingsManager>();
                    services.AddSingleton<ILoggingManager, LoggingManager>();

#if WINDOWS
                    services.AddSingleton<ICertificateManager, CertificateManager>();
                    services.AddSingleton<ITaskSchedulerManager, TaskSchedulerManager>();
#endif

                    // Device-specific services
                    services.AddSingleton<ISerialPortManager, SerialPortManager>();
                    services.AddSingleton<INetworkDeviceManager, NetworkDeviceManager>();
                    services.AddSingleton<IBiometricManager, BiometricManager>();

#if WINDOWS
                    services.AddSingleton<IPrinterManager, PrinterManager>();
                    services.AddSingleton<IUsbHidManager, UsbHidManager>();
#endif

                    // Main service
                    services.AddHostedService<HardwareBridgeService>();
                })
                .UseSerilog();

            return builder;
        }
    }
}
