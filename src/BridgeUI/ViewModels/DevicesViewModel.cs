using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using BridgeUI.Services;
using DeviceInfo = BridgeUI.Models.DeviceInfo;

namespace BridgeUI.ViewModels;

public partial class DevicesViewModel : ObservableObject
{
    private readonly BridgeServiceClient _client;

    [ObservableProperty] private ObservableCollection<DeviceInfo> _devices = new();
    [ObservableProperty] private DeviceInfo? _selectedDevice;
    [ObservableProperty] private string _statusText = "No devices";
    [ObservableProperty] private bool _isRefreshing;

    public DevicesViewModel(BridgeServiceClient client)
    {
        _client = client;
    }

    [RelayCommand]
    private async Task RefreshDevicesAsync()
    {
        if (!_client.IsConnected) return;

        IsRefreshing = true;
        try
        {
            var result = await _client.SendRequestAsync("devices.enumerate");
            var devices = result?["devices"]?.ToObject<List<DeviceInfo>>();

            MainThread.BeginInvokeOnMainThread(() =>
            {
                Devices.Clear();
                if (devices != null)
                {
                    foreach (var device in devices)
                    {
                        Devices.Add(device);
                    }
                }
                StatusText = $"{Devices.Count} device(s) found";
            });
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
        finally
        {
            IsRefreshing = false;
        }
    }

    [RelayCommand]
    private async Task ConnectDeviceAsync(string? deviceId)
    {
        if (!_client.IsConnected || string.IsNullOrEmpty(deviceId)) return;

        try
        {
            var device = Devices.FirstOrDefault(d => d.Id == deviceId);
            if (device == null) return;

            await _client.SendRequestAsync("devices.connect", new
            {
                deviceId,
                deviceType = device.Type
            });

            await RefreshDevicesAsync();
            StatusText = $"Connected to {device.Name}";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task DisconnectDeviceAsync(string? deviceId)
    {
        if (!_client.IsConnected || string.IsNullOrEmpty(deviceId)) return;

        try
        {
            var device = Devices.FirstOrDefault(d => d.Id == deviceId);
            if (device == null) return;

            await _client.SendRequestAsync("devices.disconnect", new { deviceId });

            await RefreshDevicesAsync();
            StatusText = $"Disconnected from {device.Name}";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }
}
