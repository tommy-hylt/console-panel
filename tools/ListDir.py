import os
import sys
import json
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', default='')
    args = parser.parse_args()

    dir_path = args.path.strip() if args.path else os.getcwd()

    try:
        abs_path = os.path.abspath(dir_path)
        entries = sorted(
            [e for e in os.listdir(abs_path) if os.path.isdir(os.path.join(abs_path, e))],
            key=str.lower
        )
        print(json.dumps({"ok": True, "path": abs_path, "dirs": entries}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "path": dir_path, "dirs": []}))

if __name__ == '__main__':
    main()
