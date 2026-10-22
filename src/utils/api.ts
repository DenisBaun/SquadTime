export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function authHeaders() {
  const token = localStorage.getItem('squadtime_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}
