import type { Request, Response } from 'express';
import { pressKey } from '../tools/python';

export async function keyHandler(req: Request, res: Response) {
  try {
    const { handle, key } = req.body || {};
    if (!handle) {
      return res.status(400).json({ ok: false, error: 'missing handle' });
    }
    if (!key) {
      return res.status(400).json({ ok: false, error: 'missing key' });
    }

    const result = await pressKey(String(handle), String(key));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
