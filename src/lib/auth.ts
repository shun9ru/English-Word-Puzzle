const SESSION_KEY = "ewp_user_id";

export function getCurrentUserId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function setCurrentUserId(userId: string): void {
  sessionStorage.setItem(SESSION_KEY, userId);
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
