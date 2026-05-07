// In production set VITE_API_URL to your Render backend URL.
// In development the Vite proxy forwards /api → http://localhost:3000.
const BASE = import.meta.env.VITE_API_URL || "";

async function request(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${method} /api${path} → ${res.status}`);
  }
  return res.json();
}

export const get  = (path)       => request("GET",    path);
export const post = (path, body) => request("POST",   path, body);
export const put  = (path, body) => request("PUT",    path, body);
export const del  = (path)       => request("DELETE", path);
