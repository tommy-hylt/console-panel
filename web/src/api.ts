export type WindowInfo = {
  handle: string;
  title: string;
  pid: number;
  width: number;
  height: number;
  className: string;
  isVisible: boolean;
};

export type ApiResult = {
  ok: boolean;
  error?: string;
};

const API_BASE = '';

export async function listWindows(): Promise<WindowInfo[]> {
  const res = await fetch(`${API_BASE}/list`);
  return res.json();
}

export async function captureWindow(handle: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/capture/${handle}`);
  return res.blob();
}

export async function foregroundWindow(handle: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/foreground`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  return res.json();
}

export async function typeText(handle: string, text: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, text }),
  });
  return res.json();
}

export async function pressKey(handle: string, key: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, key }),
  });
  return res.json();
}

export async function killWindow(handle: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/kill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  return res.json();
}

export async function newConsole(title?: string, command?: string, directory?: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, command, directory }),
  });
  return res.json();
}
