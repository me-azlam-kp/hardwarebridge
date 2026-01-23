# BridgeUI

A .NET MAUI cross-platform desktop application for managing the HardwareBridge service. Provides a graphical interface to configure settings, monitor devices, and manage the job queue.

## Features

- **Cross-platform** — Runs on Windows (WinUI 3) and macOS (Mac Catalyst)
- **5-tab interface** — General, WebSocket, Devices, Queue, Logging
- **Real-time connection** — Communicates with BridgeService via WebSocket JSON-RPC
- **MVVM architecture** — Built with CommunityToolkit.Mvvm

## Screenshots

The UI provides 5 tabs:

1. **General** — Connect to service, view status, configure device discovery
2. **WebSocket** — Configure server port, TLS, and allowed origins
3. **Devices** — View discovered devices, connect/disconnect
4. **Queue** — Monitor job queue, cancel pending jobs
5. **Logging** — Configure log level, sinks, and file settings

## Prerequisites

- [.NET 10.0 SDK](https://dotnet.microsoft.com/download)
- MAUI workload installed:
  ```bash
  dotnet workload install maui-maccatalyst   # macOS
  dotnet workload install maui-windows       # Windows
  ```
- **macOS**: Xcode (full installation from App Store, not just Command Line Tools)
- **Windows**: Visual Studio 2022+ with MAUI workload, or Windows App SDK

## Build & Run

```bash
# macOS
dotnet build src/BridgeUI/BridgeUI.csproj -f net10.0-maccatalyst
dotnet run --project src/BridgeUI/BridgeUI.csproj -f net10.0-maccatalyst

# Windows
dotnet build src/BridgeUI/BridgeUI.csproj -f net10.0-windows10.0.19041.0
dotnet run --project src/BridgeUI/BridgeUI.csproj -f net10.0-windows10.0.19041.0
```

## Usage

1. Start the BridgeService first (it listens on port 8443 by default)
2. Launch BridgeUI
3. On the **General** tab, set the host/port and click **Connect**
4. Once connected, all tabs will show live data from the service

## Architecture

BridgeUI is a standalone application that communicates with BridgeService over WebSocket. There is no direct project reference between them — they are fully decoupled.

```
┌─────────────┐    WebSocket (JSON-RPC 2.0)    ┌────────────────┐
│   BridgeUI  │  ◄──────────────────────────►  │  BridgeService │
│  (MAUI App) │       ws://localhost:8443       │   (Background) │
└─────────────┘                                 └────────────────┘
```

## Project Structure

```
src/BridgeUI/
├── BridgeUI.csproj             — Project file (MAUI, net10.0)
├── MauiProgram.cs              — App builder, DI registration
├── App.xaml / App.xaml.cs      — Application entry, resource converters
├── AppShell.xaml               — Shell with TabBar navigation
├── Converters/
│   └── BoolToColorConverter.cs — Value converters for XAML bindings
├── Services/
│   └── BridgeServiceClient.cs  — WebSocket JSON-RPC client
├── Models/
│   └── ServiceModels.cs        — DTOs (DeviceInfo, QueueJob, etc.)
├── ViewModels/
│   ├── GeneralViewModel.cs     — Service connection, discovery config
│   ├── WebSocketViewModel.cs   — Server/TLS/origins configuration
│   ├── DevicesViewModel.cs     — Device list, connect/disconnect
│   ├── QueueViewModel.cs       — Queue jobs, cancel operations
│   └── LoggingViewModel.cs     — Log level, sinks, file settings
├── Views/
│   ├── GeneralPage.xaml        — General settings tab
│   ├── WebSocketPage.xaml      — WebSocket config tab
│   ├── DevicesPage.xaml        — Device management tab
│   ├── QueuePage.xaml          — Queue management tab
│   └── LoggingPage.xaml        — Logging config tab
├── Resources/
│   ├── AppIcon/                — Application icons
│   ├── Fonts/                  — Bundled fonts
│   └── Styles/                 — Colors and styles
└── Platforms/
    ├── Windows/                — Windows-specific startup
    └── MacCatalyst/            — macOS-specific startup
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Microsoft.Maui.Controls | (SDK) | MAUI framework |
| CommunityToolkit.Mvvm | 8.4.0 | MVVM source generators |
| Newtonsoft.Json | 13.0.3 | JSON-RPC message handling |
| Microsoft.Extensions.Logging.Debug | 10.0.0 | Debug logging |

## Troubleshooting

### macOS: "A valid Xcode installation was not found"

Install Xcode from the App Store, then set the developer path:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Connection refused

Ensure BridgeService is running and listening on the expected port:

```bash
dotnet run --project src/BridgeService/HardwareBridge.csproj
```

### MAUI workload not found

Update workload manifests and install:

```bash
dotnet workload update
dotnet workload install maui
```
