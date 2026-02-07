#!/usr/bin/env python3
"""Capture a window screenshot by handle, output PNG to a file."""

import sys
import json
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Constants
SRCCOPY = 0x00CC0020
DIB_RGB_COLORS = 0
BI_RGB = 0
PW_RENDERFULLCONTENT = 2  # For modern DWM-composed/GPU-rendered windows

class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]

class BITMAPINFO(ctypes.Structure):
    _fields_ = [
        ("bmiHeader", BITMAPINFOHEADER),
    ]

class RECT(ctypes.Structure):
    _fields_ = [("left", wintypes.LONG), ("top", wintypes.LONG),
                 ("right", wintypes.LONG), ("bottom", wintypes.LONG)]

def parse_handle(s):
    s = s.strip()
    if s.startswith("0x") or s.startswith("0X"):
        return int(s, 16)
    return int(s)

def get_bitmap_bits(dc, bitmap, width, height):
    """Extract raw pixel data from a bitmap."""
    bmi = BITMAPINFO()
    bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.bmiHeader.biWidth = width
    bmi.bmiHeader.biHeight = -height  # Top-down
    bmi.bmiHeader.biPlanes = 1
    bmi.bmiHeader.biBitCount = 32
    bmi.bmiHeader.biCompression = BI_RGB

    buf_size = width * height * 4
    buf = ctypes.create_string_buffer(buf_size)
    gdi32.GetDIBits(dc, bitmap, 0, height, buf, ctypes.byref(bmi), DIB_RGB_COLORS)
    return buf

def is_blank(buf, width, height, sample_count=100):
    """Check if buffer is all zeros by sampling pixels."""
    raw = buf.raw
    step = max(1, (width * height) // sample_count)
    for i in range(0, width * height, step):
        offset = i * 4
        if raw[offset] != 0 or raw[offset+1] != 0 or raw[offset+2] != 0:
            return False
    return True

def capture_with_printwindow(hwnd, width, height):
    """Try PrintWindow with PW_RENDERFULLCONTENT flag (works for modern apps)."""
    hwnd_dc = user32.GetWindowDC(hwnd)
    if not hwnd_dc:
        return None

    try:
        mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
        if not mem_dc:
            return None
        try:
            bitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, width, height)
            if not bitmap:
                return None
            try:
                old_bmp = gdi32.SelectObject(mem_dc, bitmap)
                user32.PrintWindow(hwnd, mem_dc, PW_RENDERFULLCONTENT)
                buf = get_bitmap_bits(mem_dc, bitmap, width, height)
                gdi32.SelectObject(mem_dc, old_bmp)

                if is_blank(buf, width, height):
                    return None
                return buf
            finally:
                gdi32.DeleteObject(bitmap)
        finally:
            gdi32.DeleteDC(mem_dc)
    finally:
        user32.ReleaseDC(hwnd, hwnd_dc)

def capture_from_screen(hwnd, rect, width, height):
    """Capture visible screen region where the window is (BitBlt from desktop)."""
    screen_dc = user32.GetDC(0)  # Desktop DC
    if not screen_dc:
        return None

    try:
        mem_dc = gdi32.CreateCompatibleDC(screen_dc)
        if not mem_dc:
            return None
        try:
            bitmap = gdi32.CreateCompatibleBitmap(screen_dc, width, height)
            if not bitmap:
                return None
            try:
                old_bmp = gdi32.SelectObject(mem_dc, bitmap)
                gdi32.BitBlt(mem_dc, 0, 0, width, height, screen_dc, rect.left, rect.top, SRCCOPY)
                buf = get_bitmap_bits(mem_dc, bitmap, width, height)
                gdi32.SelectObject(mem_dc, old_bmp)
                return buf
            finally:
                gdi32.DeleteObject(bitmap)
        finally:
            gdi32.DeleteDC(mem_dc)
    finally:
        user32.ReleaseDC(0, screen_dc)

def capture_window(handle_str, out_path):
    try:
        hwnd = parse_handle(handle_str)
    except ValueError:
        return {"ok": False, "error": f"Invalid handle: {handle_str}"}

    if not user32.IsWindow(hwnd):
        return {"ok": False, "error": f"Window not found: {handle_str}"}

    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    width = rect.right - rect.left
    height = rect.bottom - rect.top

    if width <= 0 or height <= 0:
        return {"ok": False, "error": f"Window has zero size: {width}x{height}"}

    method = "PrintWindow"

    # Try PrintWindow with PW_RENDERFULLCONTENT first
    buf = capture_with_printwindow(hwnd, width, height)

    # Fallback to screen capture (BitBlt from desktop)
    if buf is None:
        method = "BitBlt"
        buf = capture_from_screen(hwnd, rect, width, height)

    if buf is None:
        return {"ok": False, "error": "All capture methods failed"}

    # Save as PNG
    try:
        from PIL import Image
        img = Image.frombuffer('RGBA', (width, height), buf, 'raw', 'BGRA', 0, 1)
        img = img.convert('RGB')
        img.save(out_path, 'PNG')
        return {"ok": True, "handle": handle_str, "png": out_path, "width": width, "height": height, "method": method}
    except ImportError:
        return {"ok": False, "error": "PIL/Pillow not installed. Run: pip install Pillow"}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: CaptureWindow.py <handle> <output.png>"}))
        sys.exit(1)

    handle = sys.argv[1]
    out_path = sys.argv[2]

    result = capture_window(handle, out_path)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
