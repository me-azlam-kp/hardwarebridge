using BridgeUI.ViewModels;

namespace BridgeUI.Views;

public partial class LoggingPage : ContentPage
{
    public LoggingPage(LoggingViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
