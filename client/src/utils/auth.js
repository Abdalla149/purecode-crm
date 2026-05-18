export function decodeToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

export function getHomeRoute(role) {
  return role === 'admin' ? '/dashboard' : '/my-queue';
}
