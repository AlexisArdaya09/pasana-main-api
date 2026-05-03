import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { dump } from 'js-yaml';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name: appName, version } = require('../package.json') as {
  name: string;
  version: string;
};

async function exportSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Pasana API')
    .setDescription(
      `API para gestión de pasanacos (grupos de ahorro rotativo).\n\n` +
      `**Flujo de vida de un pasanaco:**\n` +
      `1. POST /groups — Crear grupo (frecuencia: WEEKLY / MONTHLY / CUMPLEANOS)\n` +
      `2. POST /groups/:id/members — Agregar participantes\n` +
      `3. POST /groups/:id/initialize — Inicializar turnos (calcula y fija startDate / endDate automáticamente)\n` +
      `4. POST /payments — Registrar pagos. Al completarse el último turno el grupo pasa a COMPLETED automáticamente.`,
    )
    .setVersion(version)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const yamlContent = dump(document, { lineWidth: -1 });
  const fileName = `${appName}-${version}.yml`;

  writeFileSync(fileName, yamlContent, 'utf8');
  console.log(`✔ Swagger YAML exported to ${fileName}`);

  await app.close();
}

exportSwagger();
