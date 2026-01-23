using BridgeUI.ViewModels;

namespace BridgeUI.Views;

public partial class QueuePage : ContentPage
{
    public QueuePage(QueueViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
