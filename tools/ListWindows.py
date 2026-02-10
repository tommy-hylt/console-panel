#!/usr/bin/env python3
"""List all visible top-level windows with their handles and titles."""

import json
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

# Window enumeration callback type
EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

def get_window_text(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length == 0:
        return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value

def get_class_name(hwnd):
    buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buf, 256)
    return buf.value

def is_window_visible(hwnd):
    return bool(user32.IsWindowVisible(hwnd))

def get_window_rect(hwnd):
    class RECT(ctypes.Structure):
        _fields_ = [("left", wintypes.LONG), ("top", wintypes.LONG),
                    ("right", wintypes.LONG), ("bottom", wintypes.LONG)]
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.right - rect.left, rect.bottom - rect.top

def get_window_pid(hwnd):
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value

def list_windows():
    windows = []

    def callback(hwnd, lparam):
        if not is_window_visible(hwnd):
            return True
        title = get_window_text(hwnd)
        if not title.strip():
            return True

        width, height = get_window_rect(hwnd)
        windows.append({
            "handle": f"0x{hwnd:X}",
            "title": title,
            "pid": get_window_pid(hwnd),
            "width": width,
            "height": height,
            "className": get_class_name(hwnd),
            "isVisible": True
        })
        return True

    user32.EnumWindows(EnumWindowsProc(callback), 0)
    return windows

if __name__ == "__main__":
    result = list_windows()
    print(json.dumps(result))
