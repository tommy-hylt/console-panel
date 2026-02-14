import type { Request, Response } from 'express';
import { listDir } from '../tools/python';

export async function lsHandler(req: Request, res: Response) {
  try {
    const dirPath = req.query.path ? String(req.query.path) : undefined;
    const result = await listDir(dirPath);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e), path: '', dirs: [] });
  }
}
