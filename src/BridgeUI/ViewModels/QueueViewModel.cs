using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using BridgeUI.Models;
using BridgeUI.Services;

namespace BridgeUI.ViewModels;

public partial class QueueViewModel : ObservableObject
{
    private readonly BridgeServiceClient _client;

    [ObservableProperty] private ObservableCollection<QueueJob> _jobs = new();
    [ObservableProperty] private string _statusText = "";
    [ObservableProperty] private int _pendingCount;
    [ObservableProperty] private int _processingCount;
    [ObservableProperty] private int _completedCount;
    [ObservableProperty] private int _failedCount;
    [ObservableProperty] private bool _isRefreshing;

    public QueueViewModel(BridgeServiceClient client)
    {
        _client = client;
    }

    [RelayCommand]
    private async Task RefreshQueueAsync()
    {
        if (!_client.IsConnected) return;

        IsRefreshing = true;
        try
        {
            var status = await _client.SendRequestAsync<QueueStatus>("queue.getStatus");
            if (status != null)
            {
                PendingCount = status.PendingJobs;
                ProcessingCount = status.ProcessingJobs;
                CompletedCount = status.CompletedJobs;
                FailedCount = status.FailedJobs;
            }

            var result = await _client.SendRequestAsync("queue.getJobs", new { limit = 100 });
            var jobs = result?.ToObject<List<QueueJob>>();

            MainThread.BeginInvokeOnMainThread(() =>
            {
                Jobs.Clear();
                if (jobs != null)
                {
                    foreach (var job in jobs)
                    {
                        Jobs.Add(job);
                    }
                }
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
    private async Task CancelJobAsync(string? jobId)
    {
        if (!_client.IsConnected || string.IsNullOrEmpty(jobId)) return;

        try
        {
            await _client.SendRequestAsync("queue.cancelJob", new { jobId });
            StatusText = $"Job {jobId} cancelled";
            await RefreshQueueAsync();
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }
}
