import type { Request, Response } from 'express';
import { newConsole } from '../tools/python';

export async function newHandler(req: Request, res: Response) {
  try {
    const { command, title, directory } = req.body || {};

    const result = await newConsole(
      command ? String(command) : undefined,
      title ? String(title) : undefined,
      directory ? String(directory) : undefined
    );
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.stack || e) });
  }
}
