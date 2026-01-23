using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using BridgeUI.Services;

namespace BridgeUI.ViewModels;

public partial class WebSocketViewModel : ObservableObject
{
    private readonly BridgeServiceClient _client;

    [ObservableProperty] private int _port = 8443;
    [ObservableProperty] private bool _enableTls;
    [ObservableProperty] private string _certificatePath = "";
    [ObservableProperty] private string _certificatePassword = "";
    [ObservableProperty] private string _allowedOrigins = "";
    [ObservableProperty] private int _maxConnections = 100;
    [ObservableProperty] private string _statusText = "";

    public WebSocketViewModel(BridgeServiceClient client)
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
            var ws = settings?["WebSocket"];
            if (ws != null)
            {
                Port = ws["Port"]?.ToObject<int>() ?? 8443;
                EnableTls = ws["EnableTls"]?.ToObject<bool>() ?? false;
                MaxConnections = ws["MaxConnections"]?.ToObject<int>() ?? 100;
                var origins = ws["AllowedOrigins"]?.ToObject<string[]>();
                AllowedOrigins = origins != null ? string.Join(", ", origins) : "";
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
            var origins = AllowedOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            await _client.SendRequestAsync("settings.save", new
            {
                WebSocket = new
                {
                    Port,
                    EnableTls,
                    MaxConnections,
                    AllowedOrigins = origins
                }
            });
            StatusText = "Settings saved";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }
}
