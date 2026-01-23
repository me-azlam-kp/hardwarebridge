using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using BridgeUI.Services;

namespace BridgeUI.ViewModels;

public partial class LoggingViewModel : ObservableObject
{
    private readonly BridgeServiceClient _client;

    [ObservableProperty] private string _logLevel = "Information";
    [ObservableProperty] private bool _enableConsole = true;
    [ObservableProperty] private bool _enableFile = true;
    [ObservableProperty] private bool _enableEventLog;
    [ObservableProperty] private string _logPath = "logs";
    [ObservableProperty] private int _maxFileSizeMb = 10;
    [ObservableProperty] private int _maxRetainedFiles = 30;
    [ObservableProperty] private string _statusText = "";

    public List<string> LogLevels { get; } = new() { "Verbose", "Debug", "Information", "Warning", "Error", "Fatal" };

    public LoggingViewModel(BridgeServiceClient client)
    {
        _client = client;
    }

    [RelayCommand]
    private async Task LoadSettingsAsync()
    {
        if (!_client.IsConnected) return;

        try
        {
            var settings = await _client.SendRequestAsync("settings.get");
            var logging = settings?["Logging"];
            if (logging != null)
            {
                LogLevel = logging["LogLevel"]?.ToObject<string>() ?? "Information";
                EnableConsole = logging["EnableConsole"]?.ToObject<bool>() ?? true;
                EnableFile = logging["EnableFile"]?.ToObject<bool>() ?? true;
                EnableEventLog = logging["EnableEventLog"]?.ToObject<bool>() ?? false;
                LogPath = logging["LogPath"]?.ToObject<string>() ?? "logs";
                MaxFileSizeMb = (logging["MaxFileSize"]?.ToObject<int>() ?? 10485760) / 1048576;
                MaxRetainedFiles = logging["MaxRetainedFiles"]?.ToObject<int>() ?? 30;
            }
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task SaveSettingsAsync()
    {
        if (!_client.IsConnected) return;

        try
        {
            await _client.SendRequestAsync("settings.save", new
            {
                Logging = new
                {
                    LogLevel,
                    EnableConsole,
                    EnableFile,
                    EnableEventLog,
                    LogPath,
                    MaxFileSize = MaxFileSizeMb * 1048576,
                    MaxRetainedFiles
                }
            });
            StatusText = "Logging settings saved";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }
}
