#!/usr/bin/env python3
"""Press a key or key combination in a window by handle."""

import sys
import json
import time
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

def focus_window(hwnd):
    """Focus window, restore if minimized."""
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(hwnd, SW_SHOW)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.1)

def press_key(handle_str, key):
    try:
        hwnd = parse_handle(handle_str)
    except ValueError:
        return {"ok": False, "error": f"Invalid handle: {handle_str}"}

    if not user32.IsWindow(hwnd):
        return {"ok": False, "error": f"Window not found: {handle_str}"}

    focus_window(hwnd)

    try:
        import pyautogui

        # Handle key combinations like "ctrl+c", "alt+f4"
        key = key.strip().lower()
        if '+' in key:
            parts = [p.strip() for p in key.split('+')]
            pyautogui.hotkey(*parts)
        else:
            pyautogui.press(key)

        return {"ok": True, "handle": handle_str, "key": key}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: PressKey.py <handle> <key>"}))
        sys.exit(1)

    handle = sys.argv[1]
    key = sys.argv[2]

    result = press_key(handle, key)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
