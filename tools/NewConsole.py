#!/usr/bin/env python3
"""Open a new console window."""

import sys
import json
import subprocess
import time
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

def new_console(command=None, title=None):
    try:
        if command:
            # Run custom command
            cmd = f'start cmd /k "{command}"'
        elif title:
            # Open cmd with custom title
            cmd = f'start cmd /k "title {title}"'
        else:
            # Just open cmd
            cmd = 'start cmd'

        subprocess.Popen(cmd, shell=True)
        time.sleep(0.3)  # Brief delay for window to appear

        return {"ok": True, "command": command or "cmd", "title": title}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    command = None
    title = None

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--command" and i + 1 < len(sys.argv):
            command = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--title" and i + 1 < len(sys.argv):
            title = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    result = new_console(command, title)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
