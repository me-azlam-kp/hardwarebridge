using BridgeUI.ViewModels;

namespace BridgeUI.Views;

public partial class WebSocketPage : ContentPage
{
    public WebSocketPage(WebSocketViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
