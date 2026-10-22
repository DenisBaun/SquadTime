const API_ROOT = (import.meta.env.VITE_API_URL ?? '') + '/api/auth';

export async function register(username: string, email: string, password: string) {
  const res = await fetch(`${API_ROOT}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  return res.json();
}

export async function login(identifier: string, password: string) {
  const res = await fetch(`${API_ROOT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  return res.json();
}

export function saveToken(token: string) {
  try {
    localStorage.setItem('squadtime_token', token);
  } catch (e) {
    console.warn('Could not save token', e);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem('squadtime_token');
  } catch (e) {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem('squadtime_token');
  } catch (e) { }
}
