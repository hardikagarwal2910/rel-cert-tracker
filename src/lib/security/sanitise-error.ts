/**
 * sanitiseError — strips API keys and credentials from error messages
 * before they are logged or returned to the client.
 *
 * Global error response must always be:
 *   { error: 'An internal error occurred' }
 * This function is used to produce a safe string for internal logging only.
 */

const STATIC_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9\-_]+/gi,              // Anthropic API keys
  /-----BEGIN[\s\S]*?-----END[^\n]*/gi,    // PEM private keys
  /resend_[A-Za-z0-9_]+/gi,                // Resend API keys
  /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, // JWTs
];

function buildDynamicPatterns(): RegExp[] {
  const patterns: RegExp[] = [];

  const encKey = process.env.ENCRYPTION_KEY;
  if (encKey && encKey.length >= 8) {
    patterns.push(new RegExp(escapeRegex(encKey), 'g'));
  }

  const authSecret = process.env.NEXTAUTH_SECRET;
  if (authSecret && authSecret.length >= 8) {
    patterns.push(new RegExp(escapeRegex(authSecret), 'g'));
  }

  return patterns;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitiseError(err: unknown): string {
  let message = 'Unknown error';

  if (err instanceof Error) {
    message = err.message || 'Unknown error';
  } else if (typeof err === 'string') {
    message = err;
  } else if (err !== null && err !== undefined) {
    try {
      message = String(err);
    } catch {
      message = 'Unknown error';
    }
  }

  const allPatterns = [...STATIC_PATTERNS, ...buildDynamicPatterns()];
  for (const pattern of allPatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }

  // Never return stack traces
  const stackIdx = message.indexOf('\n    at ');
  if (stackIdx !== -1) {
    message = message.substring(0, stackIdx);
  }

  return message;
}
