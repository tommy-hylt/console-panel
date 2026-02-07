using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            var outDir = Path.Combine(AppContext.BaseDirectory, "out");
            Directory.CreateDirectory(outDir);

            // Usage:
            //   CaptureWindows.exe --list
            //   CaptureWindows.exe --handle 0x304BE --out "C:\path\out"
            // Output:
            //   --list: prints JSON array [{ handle, title, width, height, className, isVisible }]
            //   --handle: writes one PNG named by handle (e.g. 0x304BE.png) and prints JSON array with one element

            bool listOnly = false;
            string? outOverride = null;
            string? handleArg = null;

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--list")
                {
                    listOnly = true;
                }
                else if (args[i] == "--handle" && i + 1 < args.Length)
                {
                    handleArg = args[++i];
                }
                else if (args[i] == "--out" && i + 1 < args.Length)
                {
                    outOverride = args[++i];
                }
            }

            if (!string.IsNullOrWhiteSpace(outOverride))
            {
                outDir = outOverride!;
                Directory.CreateDirectory(outDir);
            }

            var windows = EnumerateTopLevelWindows();

            if (listOnly)
            {
                // List visible top-level windows.
                var list = new List<object>();
                foreach (var w in windows)
                {
                    if (!w.IsVisible) continue;
                    if (string.IsNullOrWhiteSpace(w.Title)) continue;

                    var bounds = GetExtendedFrameBounds(w.Hwnd);
                    if (bounds.Width <= 0 || bounds.Height <= 0) bounds = GetWindowRect(w.Hwnd);

                    list.Add(new
                    {
                        handle = $"0x{w.Hwnd.ToInt64():X}",
                        title = w.Title,
                        width = Math.Max(0, bounds.Width),
                        height = Math.Max(0, bounds.Height),
                        className = w.ClassName,
                        isVisible = w.IsVisible,
                    });
                }

                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(list));
                return 0;
            }

            var targets = new List<Win>();

            if (!string.IsNullOrWhiteSpace(handleArg))
            {
                var hwnd = ParseHandle(handleArg!);
                if (hwnd == IntPtr.Zero || !IsWindow(hwnd))
                {
                    Console.WriteLine($"ERROR: invalid handle: {handleArg}");
                    return 2;
                }

                // Title/class are best-effort for reporting.
                targets.Add(new Win(hwnd, GetWindowText(hwnd), GetClassName(hwnd), IsWindowVisible(hwnd)));
            }
            else
            {
                Console.WriteLine("ERROR: missing target. Use --handle <hwnd> or --list.");
                return 2;
            }

            if (targets.Count == 0)
            {
                Console.WriteLine("No target windows found.");
                return 2;
            }

            var results = new List<object>();
            int ok = 0;

            foreach (var w in targets)
            {
                var handleHex = $"0x{w.Hwnd.ToInt64():X}";

                var bounds = GetExtendedFrameBounds(w.Hwnd);
                if (bounds.Width <= 0 || bounds.Height <= 0)
                {
                    bounds = GetWindowRect(w.Hwnd);
                }

                if (bounds.Width <= 0 || bounds.Height <= 0)
                {
                    results.Add(new { handle = handleHex, title = w.Title, width = 0, height = 0, ok = false, error = "no-bounds" });
                    continue;
                }

                using var bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                }

                string method = "PrintWindow";
                bool captured = false;

                using (var g = Graphics.FromImage(bmp))
                {
                    IntPtr hdc = g.GetHdc();
                    try
                    {
                        captured = PrintWindow(w.Hwnd, hdc, PW_RENDERFULLCONTENT);
                        if (!captured)
                        {
                            method = "WM_PRINT";
                            captured = SendPrintMessage(w.Hwnd, hdc);
                        }
                    }
                    finally
                    {
                        g.ReleaseHdc(hdc);
                    }
                }

                if (!captured)
                {
                    results.Add(new { handle = handleHex, title = w.Title, width = bounds.Width, height = bounds.Height, ok = false, error = $"capture-failed:{Marshal.GetLastWin32Error()}" });
                    continue;
                }

                // PNG named by handle.
                var fileName = handleHex + ".png";
                var filePath = Path.Combine(outDir, fileName);
                bmp.Save(filePath, ImageFormat.Png);

                results.Add(new { handle = handleHex, title = w.Title, width = bounds.Width, height = bounds.Height, ok = true, png = fileName, method });
                ok++;
            }

            // JSON array to stdout.
            Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(results));

            return ok == targets.Count ? 0 : 1;
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            return 1;
        }
    }

    private static bool SendPrintMessage(IntPtr hwnd, IntPtr hdc)
    {
        const int WM_PRINT = 0x0317;
        const int PRF_CHECKVISIBLE = 0x00000001;
        const int PRF_NONCLIENT = 0x00000002;
        const int PRF_CLIENT = 0x00000004;
        const int PRF_ERASEBKGND = 0x00000008;
        const int PRF_CHILDREN = 0x00000010;
        const int PRF_OWNED = 0x00000020;

        IntPtr res = SendMessage(hwnd, WM_PRINT, hdc, (IntPtr)(PRF_CLIENT | PRF_NONCLIENT | PRF_ERASEBKGND | PRF_CHILDREN | PRF_OWNED | PRF_CHECKVISIBLE));
        // SendMessage returns LRESULT (often 0). Consider success if no exception and window is valid.
        return IsWindow(hwnd) && res != IntPtr.Zero || IsWindow(hwnd);
    }

    private static IntPtr ParseHandle(string s)
    {
        s = s.Trim();
        if (s.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
        {
            if (long.TryParse(s[2..], System.Globalization.NumberStyles.HexNumber, null, out var v))
                return new IntPtr(v);
            return IntPtr.Zero;
        }

        if (long.TryParse(s, out var d)) return new IntPtr(d);
        return IntPtr.Zero;
    }

    private static Win FindBestMatchByTitle(List<Win> wins, string match)
    {
        // Prefer exact match; then substring (case-insensitive).
        foreach (var w in wins)
        {
            if (w.Title.Equals(match, StringComparison.Ordinal)) return w;
        }
        foreach (var w in wins)
        {
            if (w.Title.IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0) return w;
        }
        return default;
    }

    private static List<Win> EnumerateTopLevelWindows()
    {
        var result = new List<Win>();
        EnumWindows((hwnd, lParam) =>
        {
            var title = GetWindowText(hwnd);
            var cls = GetClassName(hwnd);
            bool vis = IsWindowVisible(hwnd);
            result.Add(new Win(hwnd, title, cls, vis));
            return true;
        }, IntPtr.Zero);
        return result;
    }

    private static Rectangle GetExtendedFrameBounds(IntPtr hwnd)
    {
        // Includes the drop shadow / extended frame, closer to what you see.
        const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
        if (DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, out RECT rect, Marshal.SizeOf<RECT>()) == 0)
        {
            return Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);
        }
        return Rectangle.Empty;
    }

    private static Rectangle GetWindowRect(IntPtr hwnd)
    {
        if (GetWindowRect(hwnd, out RECT r))
        {
            return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
        }
        return Rectangle.Empty;
    }

    private readonly record struct Win(IntPtr Hwnd, string Title, string ClassName, bool IsVisible);

    // Win32
    private const uint PW_RENDERFULLCONTENT = 0x00000002;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowTextLengthW(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetClassNameW(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private static string GetWindowText(IntPtr hwnd)
    {
        int len = GetWindowTextLengthW(hwnd);
        if (len <= 0) return string.Empty;
        var sb = new StringBuilder(len + 1);
        GetWindowTextW(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    private static string GetClassName(IntPtr hwnd)
    {
        var sb = new StringBuilder(256);
        GetClassNameW(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
