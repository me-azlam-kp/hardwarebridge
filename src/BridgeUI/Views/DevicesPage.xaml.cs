using BridgeUI.ViewModels;

namespace BridgeUI.Views;

public partial class DevicesPage : ContentPage
{
    public DevicesPage(DevicesViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
