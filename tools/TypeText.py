#!/usr/bin/env python3
"""Type text into a window by handle."""

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
    time.sleep(0.1)  # Small delay for focus to take effect

def type_text(handle_str, text):
    try:
        hwnd = parse_handle(handle_str)
    except ValueError:
        return {"ok": False, "error": f"Invalid handle: {handle_str}"}

    if not user32.IsWindow(hwnd):
        return {"ok": False, "error": f"Window not found: {handle_str}"}

    focus_window(hwnd)

    # Use pyautogui for typing
    try:
        import pyautogui
        pyautogui.typewrite(text, interval=0.01) if text.isascii() else pyautogui.write(text)
        return {"ok": True, "handle": handle_str, "text": text}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: TypeText.py <handle> <text>"}))
        sys.exit(1)

    handle = sys.argv[1]
    text = sys.argv[2]

    result = type_text(handle, text)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
