#!/usr/bin/env python3
"""Bring a window to foreground by handle."""

import sys
import json
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

SW_RESTORE = 9
SW_SHOW = 5

def parse_handle(s):
    s = s.strip()
    if s.startswith("0x") or s.startswith("0X"):
        return int(s, 16)
    return int(s)

def foreground_window(handle_str):
    try:
        hwnd = parse_handle(handle_str)
    except ValueError:
        return {"ok": False, "error": f"Invalid handle: {handle_str}"}

    if not user32.IsWindow(hwnd):
        return {"ok": False, "error": f"Window not found: {handle_str}"}

    # Check if minimized and restore
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(hwnd, SW_SHOW)

    # Bring to foreground
    result = user32.SetForegroundWindow(hwnd)

    if result:
        return {"ok": True, "handle": handle_str}
    else:
        # SetForegroundWindow can fail due to Windows restrictions
        # Try alternative approach
        user32.BringWindowToTop(hwnd)
        return {"ok": True, "handle": handle_str, "method": "BringWindowToTop"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: ForegroundWindow.py <handle>"}))
        sys.exit(1)

    result = foreground_window(sys.argv[1])
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
