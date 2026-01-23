using Microsoft.Extensions.Logging;
using BridgeUI.Services;
using BridgeUI.ViewModels;
using BridgeUI.Views;

namespace BridgeUI;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // Services
        builder.Services.AddSingleton<BridgeServiceClient>();

        // ViewModels
        builder.Services.AddTransient<GeneralViewModel>();
        builder.Services.AddTransient<WebSocketViewModel>();
        builder.Services.AddTransient<DevicesViewModel>();
        builder.Services.AddTransient<QueueViewModel>();
        builder.Services.AddTransient<LoggingViewModel>();

        // Pages
        builder.Services.AddTransient<GeneralPage>();
        builder.Services.AddTransient<WebSocketPage>();
        builder.Services.AddTransient<DevicesPage>();
        builder.Services.AddTransient<QueuePage>();
        builder.Services.AddTransient<LoggingPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
