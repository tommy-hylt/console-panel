import type { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureWindow } from '../tools/captureWindows';

function safeHandle(s: string): string {
  // allow 0x... hex or decimal; keep only safe chars for folder/file usage
  return s.replace(/[^0-9a-fA-Fx]/g, '');
}

export async function captureHandler(req: Request, res: Response) {
  const handle = String(req.params.handle || '').trim();
  if (!handle) return res.status(400).json({ ok: false, error: 'missing handle' });

  const outDir = path.join(os.tmpdir(), 'consolepanel-captures', safeHandle(handle), String(Date.now()));
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const results = await captureWindow(handle, outDir);
    const first = results[0];
    if (!first || !first.ok || !first.png) {
      return res.status(500).json({ ok: false, results });
    }

    const filePath = path.join(outDir, first.png);
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ ok: false, error: 'png not found after capture', results });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Capture-JSON', JSON.stringify(results));

    fs.createReadStream(filePath).pipe(res);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
