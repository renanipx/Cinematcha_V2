const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const LOG_DIR = process.env.LOG_DIR || '/var/log/cinematcha';
const isProduction = process.env.NODE_ENV === 'production';
const forceMinimal = process.env.FORCE_MINIMAL_LOGGING === 'true';

// Determine active logs severity limit
let activeLogLevel = 'info';
if (forceMinimal) {
  activeLogLevel = 'error';
} else if (process.env.LOG_LEVEL) {
  activeLogLevel = process.env.LOG_LEVEL;
} else if (!isProduction) {
  activeLogLevel = 'debug';
}

const standardFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, context, traceId, stack }) => {
    const ctx = context ? ` [\x1b[36m${context}\x1b[0m]` : '';
    const trace = traceId ? ` [trace:\x1b[33m${traceId}\x1b[0m]` : '';
    const errStack = stack ? `\n${stack}` : '';
    return `[${timestamp}] ${level}:${ctx}${trace} ${message}${errStack}`;
  })
);

const transports = [];

// Console transport is always active
transports.push(
  new winston.transports.Console({
    level: activeLogLevel,
    format: isProduction ? standardFormat : devFormat
  })
);

// File transport is active in production, unless forced minimal
if (isProduction && !forceMinimal) {
  // Ensure log directory exists or fallback gracefully
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error(`[LOGGER] Failed to create log directory: ${err.message}. DailyRotateFile transport might fail.`);
  }

  // Combined daily rotate
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info',
      format: standardFormat
    })
  );

  // Error daily rotate
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'error',
      format: standardFormat
    })
  );
}

const logger = winston.createLogger({
  level: activeLogLevel,
  exitOnError: false,
  transports
});

module.exports = logger;
