#!/usr/bin/env python3
"""Close/kill a window by handle."""

import sys
import json
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

WM_CLOSE = 0x0010

def parse_handle(s):
    s = s.strip()
    if s.startswith("0x") or s.startswith("0X"):
        return int(s, 16)
    return int(s)

def kill_window(handle_str):
    try:
        hwnd = parse_handle(handle_str)
    except ValueError:
        return {"ok": False, "error": f"Invalid handle: {handle_str}"}

    if not user32.IsWindow(hwnd):
        return {"ok": False, "error": f"Window not found: {handle_str}"}

    # Send WM_CLOSE message
    user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)

    return {"ok": True, "handle": handle_str}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: KillWindow.py <handle>"}))
        sys.exit(1)

    result = kill_window(sys.argv[1])
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
