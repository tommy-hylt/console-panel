import type { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureWindowPy } from '../tools/python';

function safeHandle(s: string): string {
  return s.replace(/[^0-9a-fA-Fx]/g, '');
}

export async function captureHandler(req: Request, res: Response) {
  const handle = String(req.params.handle || '').trim();
  if (!handle) return res.status(400).json({ ok: false, error: 'missing handle' });

  const outDir = path.join(os.tmpdir(), 'consolepanel-captures');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `${safeHandle(handle)}.png`);

  try {
    const result = await captureWindowPy(handle, outFile);
    if (!result.ok || !fs.existsSync(outFile)) {
      return res.status(500).json({ ok: false, error: result.error || 'capture failed' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(outFile).pipe(res);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
