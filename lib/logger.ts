const sensitiveKeys = new Set(['amount', 'description', 'category', 'institution', 'notes', 'proposed_fields']);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
      [key, sensitiveKeys.has(key) ? '[REDACTED]' : redact(item)],
    ));
  }
  return value;
}

export function safeLog(event: string, details: Record<string, unknown> = {}) {
  console.info(event, redact(details));
}
