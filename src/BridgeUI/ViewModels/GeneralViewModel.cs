using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using BridgeUI.Models;
using BridgeUI.Services;

namespace BridgeUI.ViewModels;

public partial class GeneralViewModel : ObservableObject
{
    private readonly BridgeServiceClient _client;

    [ObservableProperty] private string _serviceHost = "localhost";
    [ObservableProperty] private int _servicePort = 9443;
    [ObservableProperty] private string _connectionStatus = "Disconnected";
    [ObservableProperty] private string _serviceVersion = "1.0.0";
    [ObservableProperty] private string _platform = "";
    [ObservableProperty] private string _uptime = "00:00:00";
    [ObservableProperty] private int _connectedDeviceCount;
    [ObservableProperty] private int _activeConnectionCount;
    [ObservableProperty] private bool _isConnected;
    [ObservableProperty] private string _statusText = "";

    [ObservableProperty] private bool _enablePrinterDiscovery;
    [ObservableProperty] private bool _enableSerialDiscovery = true;
    [ObservableProperty] private bool _enableUsbHidDiscovery;
    [ObservableProperty] private bool _enableNetworkDiscovery = true;
    [ObservableProperty] private bool _enableBiometricDiscovery;
    [ObservableProperty] private int _discoveryIntervalSeconds = 30;

    public GeneralViewModel(BridgeServiceClient client)
    {
        _client = client;
        _client.OnConnectionChanged += (s, connected) =>
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                IsConnected = connected;
                ConnectionStatus = connected ? "Connected" : "Disconnected";
            });
        };
    }

    [RelayCommand]
    private async Task ConnectToServiceAsync()
    {
        try
        {
            ConnectionStatus = "Connecting...";
            _client.Host = ServiceHost;
            _client.Port = ServicePort;
            await _client.ConnectAsync();
            await RefreshAsync();
        }
        catch (Exception ex)
        {
            ConnectionStatus = $"Error: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task DisconnectFromServiceAsync()
    {
        try
        {
            await _client.DisconnectAsync();
            ConnectionStatus = "Disconnected";
            IsConnected = false;
            StatusText = "Disconnected from service";
        }
        catch (Exception ex)
        {
            ConnectionStatus = $"Error: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        if (!_client.IsConnected) return;

        try
        {
            var info = await _client.SendRequestAsync("system.getInfo");
            if (info != null)
            {
                ServiceVersion = info["version"]?.ToObject<string>() ?? "1.0.0";
                Platform = info["platform"]?.ToObject<string>() ?? "Unknown";
            }

            var health = await _client.SendRequestAsync<SystemHealth>("system.getHealth");
            if (health != null)
            {
                ConnectedDeviceCount = health.ConnectedDevices;
                ActiveConnectionCount = health.TotalDevices;
            }

            var settings = await _client.SendRequestAsync("settings.get");
            if (settings?["Device"] != null)
            {
                EnablePrinterDiscovery = settings["Device"]?["EnablePrinterDiscovery"]?.ToObject<bool>() ?? false;
                EnableSerialDiscovery = settings["Device"]?["EnableSerialPortDiscovery"]?.ToObject<bool>() ?? true;
                EnableUsbHidDiscovery = settings["Device"]?["EnableUsbHidDiscovery"]?.ToObject<bool>() ?? false;
                EnableNetworkDiscovery = settings["Device"]?["EnableNetworkDiscovery"]?.ToObject<bool>() ?? true;
                EnableBiometricDiscovery = settings["Device"]?["EnableBiometricDiscovery"]?.ToObject<bool>() ?? false;
            }

            StatusText = $"Last refreshed: {DateTime.Now:HH:mm:ss}";
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
                Device = new
                {
                    EnablePrinterDiscovery,
                    EnableSerialPortDiscovery = EnableSerialDiscovery,
                    EnableUsbHidDiscovery,
                    EnableNetworkDiscovery,
                    EnableBiometricDiscovery,
                    DiscoveryInterval = TimeSpan.FromSeconds(DiscoveryIntervalSeconds)
                }
            });
            StatusText = "Settings saved successfully";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }
}
