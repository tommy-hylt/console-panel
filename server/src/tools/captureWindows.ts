import { spawn } from 'node:child_process';
import path from 'node:path';

const TOOL_DIR = path.resolve(__dirname, '..', '..', '..', 'tools', 'CaptureWindows', 'bin', 'Release', 'net8.0-windows');
const DLL = path.join(TOOL_DIR, 'CaptureWindows.dll');

function runDotnet(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('dotnet', [DLL, ...args], {
      cwd: TOOL_DIR,
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

export type ListedWindow = {
  handle: string;
  title: string;
  width: number;
  height: number;
  className: string;
  isVisible: boolean;
};

export type CaptureResult = {
  handle: string;
  title: string;
  width: number;
  height: number;
  ok: boolean;
  png?: string;
  method?: string;
  error?: string;
};

export async function listWindows(): Promise<ListedWindow[]> {
  const r = await runDotnet(['--list']);
  if (r.code !== 0) throw new Error(`CaptureWindows --list failed (code=${r.code}): ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout.trim() || '[]') as ListedWindow[];
}

export async function captureWindow(handle: string, outDir: string): Promise<CaptureResult[]> {
  const r = await runDotnet(['--handle', handle, '--out', outDir]);
  if (r.code !== 0 && r.code !== 1) {
    // 1 means partial failure per utility convention; still parse output.
    throw new Error(`CaptureWindows --handle failed (code=${r.code}): ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout.trim() || '[]') as CaptureResult[];
}
