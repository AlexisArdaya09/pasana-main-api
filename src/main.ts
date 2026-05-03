import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppModule } from './app.module';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name: appName, version } = require('../package.json') as {
  name: string;
  version: string;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors({ origin: '*' });
  app.getHttpAdapter().getInstance().disable('etag');

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(
    new HttpLoggingInterceptor(app.get<Logger>(WINSTON_MODULE_PROVIDER)),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pasana API')
    .setDescription(
      `API para gestión de pasanacos (grupos de ahorro rotativo).\n\n` +
      `**Flujo de vida de un pasanaco:**\n` +
      `1. \`POST /groups\` — Crear grupo (frecuencia: WEEKLY / MONTHLY / BIRTHDAY)\n` +
      `2. \`POST /groups/:id/members\` — Agregar participantes\n` +
      `3. \`POST /groups/:id/initialize\` — Inicializar turnos (calcula y fija \`startDate\` / \`endDate\` automáticamente)\n` +
      `4. \`POST /payments\` — Registrar pagos. Al completarse el último turno el grupo pasa a \`COMPLETED\` automáticamente.\n\n` +
      `<a href="/api/docs-yaml" download="${appName}-${version}.yml">⬇ Download OpenAPI YAML</a>`,
    )
    .setVersion(version)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    yamlDocumentUrl: 'api/docs-yaml',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const url = await app.getUrl();
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Running on ${url}`, 'Bootstrap');
  logger.log(`Swagger docs at ${url}/api/docs`, 'Bootstrap');
}
bootstrap();
