# ConsolePanel

Remote console monitoring and control system for Windows.

## Project Overview

This project allows users to monitor and control console windows remotely via a web interface.

## Architecture

```
┌─────────────┐    HTTP     ┌─────────────┐    spawn    ┌──────────────────┐
│   Web App   │ ◄─────────► │   Server    │ ◄─────────► │  tools/*.py      │
│  (React)    │             │  (Express)  │             │  (Python)        │
└─────────────┘             └─────────────┘             └──────────────────┘
                                                        - CaptureWindow.py
                                                        - TypeText.py
                                                        - PressKey.py
                                                        - ForegroundWindow.py
                                                        - KillWindow.py
                                                        - NewConsole.py
```

## Directory Structure

```
ConsolePanel/
├── CLAUDE.md
├── server/                    # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Entry point, route registration
│   │   ├── routes/           # API route handlers
│   │   └── tools/            # Python tool wrappers
│   └── package.json
├── tools/                     # Python tools (each uses pyautogui/pywin32)
│   ├── CaptureWindow.py      # Capture window screenshot
│   ├── TypeText.py           # Type text into window
│   ├── PressKey.py           # Press key in window
│   ├── ForegroundWindow.py   # Bring window to foreground
│   ├── KillWindow.py         # Close/kill window
│   ├── NewConsole.py         # Open new console
│   └── CaptureWindows/       # Legacy C# tool (may deprecate)
└── web/                       # React frontend
    └── src/
```

## Server API

| Method | Endpoint | Query/Body | Description |
|--------|----------|------------|-------------|
| GET | `/list` | - | List windows: `[{handle, title, width, height, className, isVisible}]` |
| GET | `/capture/:handle` | `?hash=xxx` | Capture screenshot. Returns 304 if hash matches. |
| POST | `/text` | `{handle, text}` | Type text into window |
| POST | `/key` | `{handle, key}` | Press key (e.g., "enter", "ctrl+c") |
| POST | `/foreground` | `{handle}` | Bring window to foreground (unminimize if needed) |
| POST | `/kill` | `{handle}` | Kill/close the window |
| POST | `/new` | `{command?}` | Open new console (default: cmd.exe) |

## Tools (Python)

Each tool is a standalone Python script using pyautogui and pywin32.

**Required packages:**
```bash
pip install pyautogui pywin32 pillow
```

**Tool pattern:**
- Accept arguments via command line
- Output JSON to stdout
- Exit code 0 = success, non-zero = error

## Web App

### Tech Stack
- React (Vite)
- react-icons for UI icons

### Features
- **Console list**: Each console as expandable row with title
- **Screenshot**: Auto-refresh with 1s interval (between response end and next request start)
- **Input Text**: Textarea with send button
- **Press Key**: Input field with send button
- **Foreground**: Bring masked/minimized window to front before capture
- **Close**: Kill console (with confirmation)
- **Ordering**: Reorder consoles up/down/top/bottom (client-side only)
- **New Console**: Open new cmd.exe

### Capture Optimization
- Client sends hash of last received image
- Server returns 304 (empty body) if image unchanged
- Reduces bandwidth when console is idle

## Development

### Commands
```bash
# Server
cd server && npm install && npm run dev

# Web
cd web && npm install && npm run dev

# Build tools (legacy C#)
cd tools/CaptureWindows && dotnet build -c Release
```

### Testing
- **Server**: Spawn test consoles with title prefix `ConsolePanel-TestXXX`
  ```bash
  start cmd /k "title ConsolePanel-Test001"
  ```
- **Web**: Use Chrome DevTools MCP for browser testing

### Configuration
- Server port: `PORT` env var (default: 8787)
- Server URL: http://127.0.0.1:8787

## Development Approach

**Iterate incrementally:**
1. Implement one feature at a time
2. Test with real console windows
3. Refine based on behavior
4. Move to next feature

## TODO

- [ ] Create Python tools (TypeText, PressKey, ForegroundWindow, KillWindow, NewConsole)
- [ ] Migrate CaptureWindows from C# to Python (or keep C# if working well)
- [ ] Add `/foreground` endpoint
- [ ] Add `/text` endpoint
- [ ] Add `/key` endpoint
- [ ] Add `/kill` endpoint
- [ ] Add `/new` endpoint
- [ ] Add hash-based 304 response to `/capture`
- [ ] Create React web app with Vite
- [ ] Implement console list UI
- [ ] Implement auto-refresh with 1s interval
- [ ] Add input text/key UI
- [ ] Add console ordering (client-side)
