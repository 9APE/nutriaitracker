let activeUserId: string | null = null;

export function setActiveUserScope(userId?: string | null) {
  activeUserId = userId ?? null;
}

export function userScopedKey(baseKey: string, userId?: string | null): string {
  const id = userId ?? activeUserId;
  return id ? `${baseKey}:${id}` : baseKey;
}

export function dayScopedUserKey(
  baseKey: string,
  day: string,
  userId?: string | null,
): string {
  return `${userScopedKey(baseKey, userId)}:${day}`;
}
