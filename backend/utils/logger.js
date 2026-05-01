'use strict';

/**
 * FarmTrace Structured Logger (Pino)
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   const log = logger.child({ module: 'blockchainWorker' });
 *   log.info({ jobId: job.id }, 'Job completed');
 *   log.error({ err }, 'Something broke');
 */

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // In production, emit raw newline-delimited JSON for log aggregators
  // In dev, pipe through pino-pretty if available, otherwise raw JSON
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),

  // Attach base fields to every log line in production
  base: isDev
    ? undefined
    : {
        app: 'farmtrace-backend',
        env: process.env.NODE_ENV || 'production',
      },

  // Redact secrets that should never appear in logs
  redact: {
    paths: [
      'req.headers.authorization',
      'body.password',
      'body.privateKey',
      '*.apiKey',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },

  // Serialize Error objects properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

module.exports = logger;
