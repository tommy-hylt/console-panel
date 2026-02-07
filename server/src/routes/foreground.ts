import type { Request, Response } from 'express';
import { foregroundWindow } from '../tools/python';

export async function foregroundHandler(req: Request, res: Response) {
  try {
    const { handle } = req.body || {};
    if (!handle) {
      return res.status(400).json({ ok: false, error: 'missing handle' });
    }

    const result = await foregroundWindow(String(handle));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
