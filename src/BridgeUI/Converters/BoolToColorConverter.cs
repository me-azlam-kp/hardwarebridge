using System.Globalization;

namespace BridgeUI.Converters;

public class BoolToColorConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is bool b && b)
            return Colors.Green;
        return Colors.Red;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class InverseBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is bool b)
            return !b;
        return true;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is bool b)
            return !b;
        return false;
    }
}

public class StatusToColorConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is string status)
        {
            return status.ToLowerInvariant() switch
            {
                "pending" => Color.FromArgb("#2196F3"),
                "processing" => Color.FromArgb("#FF9800"),
                "completed" => Color.FromArgb("#4CAF50"),
                "failed" => Color.FromArgb("#F44336"),
                "cancelled" => Color.FromArgb("#9E9E9E"),
                _ => Color.FromArgb("#757575")
            };
        }
        return Color.FromArgb("#757575");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

public class StatusToBgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is string status)
        {
            return status.ToLowerInvariant() switch
            {
                "pending" => Color.FromArgb("#202196F3"),
                "processing" => Color.FromArgb("#20FF9800"),
                "completed" => Color.FromArgb("#204CAF50"),
                "failed" => Color.FromArgb("#20F44336"),
                "cancelled" => Color.FromArgb("#209E9E9E"),
                _ => Color.FromArgb("#20757575")
            };
        }
        return Color.FromArgb("#20757575");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

public class BoolToStatusBgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is bool connected && connected)
            return Color.FromArgb("#304CAF50");
        return Color.FromArgb("#30F44336");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
