import { utilities as nestWinstonUtils } from 'nest-winston';
import * as winston from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  nestWinstonUtils.format.nestLike('Pasana', {
    prettyPrint: true,
    colors: true,
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const winstonConfig: winston.LoggerOptions = {
  level: isDev ? 'debug' : 'info',
  transports: [
    new winston.transports.Console({
      format: isDev ? devFormat : prodFormat,
    }),
  ],
};
