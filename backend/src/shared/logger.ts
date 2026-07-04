type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug: (message: string, meta?: any) => {
    if (shouldLog("debug")) {
      console.debug(`[${timestamp()}] [DEBUG] ${message}`, meta !== undefined ? meta : "");
    }
  },
  info: (message: string, meta?: any) => {
    if (shouldLog("info")) {
      console.info(`[${timestamp()}] [INFO] ${message}`, meta !== undefined ? meta : "");
    }
  },
  warn: (message: string, meta?: any) => {
    if (shouldLog("warn")) {
      console.warn(`[${timestamp()}] [WARN] ${message}`, meta !== undefined ? meta : "");
    }
  },
  error: (message: string, meta?: any) => {
    if (shouldLog("error")) {
      console.error(`[${timestamp()}] [ERROR] ${message}`, meta !== undefined ? meta : "");
    }
  },
};