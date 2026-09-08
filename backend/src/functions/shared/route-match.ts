/**
 * Generic API-Gateway-style path matcher.
 *
 * Why this exists: the impersonation proxy needs to resolve an arbitrary
 * `{role}/...` path (e.g. "manager/shifts/abc123") to one of the real role
 * handlers and extract any `{paramName}` path segments from it, the same way
 * API Gateway's HttpApi route table does for direct (non-impersonated)
 * traffic. Reimplementing that matching logic here — rather than registering
 * a second copy of every route in SAM — is what eliminates the old
 * hand-maintained impersonate whitelist.
 */

/** A single path-pattern segment is either a literal or a `{name}` capture. */
function compilePattern(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((segment) => {
      const paramMatch = /^\{([a-zA-Z0-9_]+)\}$/.exec(segment);
      if (paramMatch) return `(?<${paramMatch[1]}>[^/]+)`;
      // Escape regex special characters in literal segments.
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped}$`);
}

/**
 * Match a concrete path (e.g. "manager/shifts/abc123") against a route
 * pattern (e.g. "manager/shifts/{shiftId}"), returning the extracted named
 * path parameters on success or null on no match. Pure function — no AWS
 * SDK calls — so it is unit-testable without mocking anything.
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const regex = compilePattern(pattern);
  const match = regex.exec(path);
  if (!match) return null;
  return { ...(match.groups ?? {}) };
}
