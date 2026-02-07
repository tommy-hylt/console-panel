# ConsolePanel

Remote console monitoring and control system for Windows.

## Project Overview

This project allows users to monitor and control console windows remotely via a web interface.

## Architecture

```
┌─────────────┐    HTTP     ┌─────────────┐    spawn    ┌─────────────────────┐
│   Web App   │ ◄─────────► │   Server    │ ◄─────────► │  CaptureWindows.exe │
│  (browser)  │             │  (Express)  │             │  (C# .NET 8)        │
└─────────────┘             └─────────────┘             └─────────────────────┘
                                   │
                                   │ subprocess
                                   ▼
                            ┌─────────────┐
                            │  pyautogui  │
                            │  (Python)   │
                            └─────────────┘
```

## Directory Structure

```
ConsolePanel/
├── CLAUDE.md
├── server/                    # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Entry point, route registration
│   │   ├── routes/
│   │   │   ├── list.ts       # GET /list - list windows
│   │   │   ├── capture.ts    # GET /capture/:handle - capture screenshot
│   │   │   ├── text.ts       # POST /text - type text (TODO)
│   │   │   └── key.ts        # POST /key - press key (TODO)
│   │   └── tools/
│   │       ├── captureWindows.ts  # CaptureWindows.exe wrapper
│   │       └── pyautogui.ts       # pyautogui wrapper (TODO)
│   └── package.json
├── tools/
│   └── CaptureWindows/       # C# window capture utility
│       └── Program.cs
└── web/                      # Frontend (TODO)
    └── index.html
```

## Server API

### Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/list` | Returns JSON array of windows: `[{handle, title, width, height, className, isVisible}]` |
| GET | `/capture/:handle` | Returns PNG screenshot of window. Header `X-Capture-JSON` contains metadata. |

### Planned Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/text` | `{handle, text}` | Focus window and type text via pyautogui |
| POST | `/key` | `{handle, key}` | Focus window and press key via pyautogui |
| POST | `/kill` | `{handle}` | Kill/close the console window |
| POST | `/new` | `{command?}` | Open new console window |
| POST | `/order` | `{handle, action}` | Reorder window (up/down/top/bottom) |

## Tools

### CaptureWindows (C# .NET 8)

Windows-specific utility for capturing window screenshots.

**Usage:**
```bash
dotnet CaptureWindows.dll --list
dotnet CaptureWindows.dll --handle 0x304BE --out "C:\path\out"
```

**Build:**
```bash
cd tools/CaptureWindows
dotnet build -c Release
```

### pyautogui (Python)

Used for keyboard/mouse input. Will be called via subprocess from server.

**Required Python packages:**
```bash
pip install pyautogui pywin32
```

## Web App Design

### Layout

Each console appears as an expandable row:

```
┌──────────────────────────────────────────────────────────────┐
│ ▶ Console Title 1                           [↑][↓][⊤][⊥][×] │
├──────────────────────────────────────────────────────────────┤
│ ▼ Console Title 2                           [↑][↓][⊤][⊥][×] │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Screenshot (auto-refresh)                   ││
│  └──────────────────────────────────────────────────────────┘│
│  [Input Text] [Press Key] [Refresh]                          │
│                                                              │
│  ┌─────────────────────────────────────────────────┐ [Send]  │
│  │ <textarea for input text>                       │         │
│  └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
│ ▶ Console Title 3                           [↑][↓][⊤][⊥][×] │
└──────────────────────────────────────────────────────────────┘
                        [+ New Console]
```

### Features

- **Expand/Collapse**: Click title row to toggle screenshot visibility
- **Screenshot**: Shows captured window, manual or auto-refresh
- **Input Text**: Opens textarea, sends text to console via pyautogui
- **Press Key**: Opens input for key name (e.g., "enter", "ctrl+c"), sends to console
- **Close**: Kills the console process (with confirmation dialog)
- **Ordering buttons**: [↑] up, [↓] down, [⊤] topmost, [⊥] bottommost
- **New Console**: Opens a new cmd.exe or specified command

## Development Commands

```bash
# Server
cd server
npm install
npm run dev          # Development with ts-node
npm run build        # Compile TypeScript
npm start            # Run compiled JS

# CaptureWindows tool
cd tools/CaptureWindows
dotnet build -c Release
```

## Configuration

- Server port: `PORT` env var (default: 8787)
- Server URL: http://127.0.0.1:8787

## Implementation Notes

- Use pyautogui for text/key input (cross-platform keyboard simulation)
- Focus window via handle before sending input
- pyautogui.write() for text, pyautogui.press() / hotkey() for keys
- Consider adding rate limiting for input endpoints
- Web app should poll /list periodically to update console list
- Screenshots can be cached briefly to reduce load

## TODO

- [ ] Implement `/text` endpoint with pyautogui
- [ ] Implement `/key` endpoint with pyautogui
- [ ] Implement `/kill` endpoint
- [ ] Implement `/new` endpoint
- [ ] Implement `/order` endpoint
- [ ] Create web/index.html frontend
- [ ] Add window focus functionality before input
- [ ] Add confirmation dialogs for destructive actions
