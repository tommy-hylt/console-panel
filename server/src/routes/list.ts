import type { Request, Response } from 'express';
import { listWindows } from '../tools/captureWindows';

export async function listHandler(_req: Request, res: Response) {
  try {
    const windows = await listWindows();
    res.json(windows);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
