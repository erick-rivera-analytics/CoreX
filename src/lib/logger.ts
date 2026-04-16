type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  return configured === "debug" || configured === "warn" || configured === "error" ? configured : "info";
}

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[resolveLogLevel()];
}

function sanitize(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/password|token|secret|cookie|authorization/i.test(key)),
  );
}

export function logEvent(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  if (!shouldLog(level)) return;

  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(details),
  };

  if (process.env.LOG_FORMAT === "json") {
    console[level === "debug" ? "info" : level](JSON.stringify(payload));
    return;
  }

  console[level === "debug" ? "info" : level](`[${level.toUpperCase()}] ${event}`, sanitize(details));
}
