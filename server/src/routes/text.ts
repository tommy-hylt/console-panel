import type { Request, Response } from 'express';
import { typeText } from '../tools/python';

export async function textHandler(req: Request, res: Response) {
  try {
    const { handle, text } = req.body || {};
    if (!handle) {
      return res.status(400).json({ ok: false, error: 'missing handle' });
    }
    if (typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'missing text' });
    }

    const result = await typeText(String(handle), text);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
