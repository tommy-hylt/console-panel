#!/usr/bin/env python3
"""Open a new console window."""

import sys
import os
import json
import subprocess

# Windows flag for creating new console
CREATE_NEW_CONSOLE = 0x00000010

def new_console(command=None, title=None, directory=None):
    try:
        # Resolve directory to absolute path
        resolved_dir = os.path.abspath(directory) if directory else None

        # Build command parts — cwd param doesn't work with CREATE_NEW_CONSOLE,
        # so use cd /d inside cmd.exe instead.
        # Use a single string to avoid subprocess double-quoting.
        parts = []
        if resolved_dir:
            parts.append(f'cd /d "{resolved_dir}"')
        if title:
            parts.append(f'title "{title}"')
        if command:
            parts.append(f'"{command}"')

        if parts:
            cmd_line = f'cmd.exe /k {" && ".join(parts)}'
        else:
            cmd_line = 'cmd.exe'

        # Create new console window
        subprocess.Popen(
            cmd_line,
            creationflags=CREATE_NEW_CONSOLE,
            close_fds=True
        )

        return {"ok": True, "command": command or "cmd", "title": title}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    command = None
    title = None

    directory = None

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--command" and i + 1 < len(sys.argv):
            command = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--title" and i + 1 < len(sys.argv):
            title = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--directory" and i + 1 < len(sys.argv):
            directory = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    result = new_console(command, title, directory)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)
