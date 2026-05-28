/**
 * Asserts that a session user is present before a protected action runs,
 * throwing a localized error the mutation layer can surface otherwise.
 */
export function requireUser(user: unknown, action: string): asserts user {
  if (!user) {
    throw new Error(`Для ${action} нужно войти в аккаунт`);
  }
}
