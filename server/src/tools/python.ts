import { spawn } from 'node:child_process';
import path from 'node:path';

const TOOLS_DIR = path.resolve(__dirname, '..', '..', '..', 'tools');

export function runPython(script: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const scriptPath = path.join(TOOLS_DIR, script);

  return new Promise((resolve, reject) => {
    const child = spawn('python', [scriptPath, ...args], {
      cwd: TOOLS_DIR,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));

    child.on('error', reject);
    child.on('close', (code) => resolve({ code: typeof code === 'number' ? code : 1, stdout, stderr }));
  });
}

export type WindowInfo = {
  handle: string;
  title: string;
  width: number;
  height: number;
  className: string;
  isVisible: boolean;
};

export async function listWindows(): Promise<WindowInfo[]> {
  const r = await runPython('ListWindows.py', []);
  if (r.code !== 0) throw new Error(`ListWindows.py failed (code=${r.code}): ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout.trim() || '[]') as WindowInfo[];
}

export async function foregroundWindow(handle: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runPython('ForegroundWindow.py', [handle]);
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}

export async function typeText(handle: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runPython('TypeText.py', [handle, text]);
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}

export async function pressKey(handle: string, key: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runPython('PressKey.py', [handle, key]);
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}

export async function killWindow(handle: string): Promise<{ ok: boolean; error?: string }> {
  const r = await runPython('KillWindow.py', [handle]);
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}

export async function captureWindowPy(handle: string, outPath: string): Promise<{ ok: boolean; png?: string; width?: number; height?: number; error?: string }> {
  const r = await runPython('CaptureWindow.py', [handle, outPath]);
  if (r.code !== 0 && !r.stdout.trim()) {
    throw new Error(`CaptureWindow.py failed (code=${r.code}): ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}

export async function newConsole(command?: string, title?: string): Promise<{ ok: boolean; error?: string }> {
  const args: string[] = [];
  if (command) {
    args.push('--command', command);
  }
  if (title) {
    args.push('--title', title);
  }
  const r = await runPython('NewConsole.py', args);
  return JSON.parse(r.stdout.trim() || '{"ok":false}');
}
