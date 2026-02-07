#!/usr/bin/env python3
"""Open a new console window."""

import sys
import json
import subprocess

# Windows flag for creating new console
CREATE_NEW_CONSOLE = 0x00000010

def new_console(command=None, title=None):
    try:
        # Build command to run in new console
        if title:
            cmd_str = f'title {title}'
            if command:
                cmd_str += f' && {command}'
        elif command:
            cmd_str = command
        else:
            cmd_str = None

        args = ['cmd.exe']
        if cmd_str:
            args.extend(['/k', cmd_str])

        # Create new console window
        subprocess.Popen(
            args,
            creationflags=CREATE_NEW_CONSOLE,
            close_fds=True
        )

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
