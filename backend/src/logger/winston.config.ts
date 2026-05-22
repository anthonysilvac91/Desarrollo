import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const winstonConfig: winston.LoggerOptions = {
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, stack }) => {
          const ctx = context ? ` [${context}]` : '';
          return stack
            ? `${timestamp} ${level}${ctx} ${message}\n${stack}`
            : `${timestamp} ${level}${ctx} ${message}`;
        }),
      ),
  transports: [new winston.transports.Console()],
};
