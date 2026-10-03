// @polsia:user-owned — validates local post-authentication destinations.

const returnPathBase = 'https://traceglass-return.invalid';

function hasControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

export function getSafeReturnPath(candidate: unknown): string {
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    hasControlCharacters(candidate)
  ) {
    return '/';
  }

  try {
    const destination = new URL(candidate, returnPathBase);
    if (destination.origin !== returnPathBase) return '/';
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/';
  }
}
