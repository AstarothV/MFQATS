// Small helpers for the Quality Scan tools that talk to the Python detection server (through /staff/yolo).

const MAX_PHOTO_PX = 2000; // long side sent to the server
const SERVER_DOWN = 'Could not reach the detection server. Make sure the Python server is running.';

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(SERVER_DOWN);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (res.redirected || (res.ok && !isJson)) throw new Error('Your session has expired. Please log in again.');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (!body && (res.status === 404 || res.status >= 500)) throw new Error(SERVER_DOWN);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `The request failed (HTTP ${res.status})`);
  }
  return body;
}

export const postJson = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Photo file -> JPEG data URL, scaled down so uploads stay small.
export function shrink(file: File, maxPx = MAX_PHOTO_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`"${file.name}" is not a photo the browser can open.`)); };
    img.src = url;
  });
}
