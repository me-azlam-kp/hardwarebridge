using BridgeUI.ViewModels;

namespace BridgeUI.Views;

public partial class GeneralPage : ContentPage
{
    public GeneralPage(GeneralViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
