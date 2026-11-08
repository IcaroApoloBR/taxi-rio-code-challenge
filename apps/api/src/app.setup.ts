import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { correlationMiddleware } from './http/correlation.middleware';

export function configureApp(app: INestApplication): void {
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Correlation-Id'],
  });
  app.use(correlationMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('TAXI.RIO Corridas')
    .setDescription(
      [
        'API local de corridas. Login e contas ficam na memória do processo. O JWT é RS256, assinado com a chave privada local, e vale 8 horas.',
        '',
        'Fluxo no Swagger:',
        '1. GET /api/auth/demonstracao para ver as contas fictícias.',
        '2. POST /api/auth/login como passageiro. Copie accessToken e clique em Authorize.',
        '3. POST /api/corridas/cotacao e depois POST /api/corridas com o header Idempotency-Key.',
        '4. POST /api/auth/login como motorista, troque o token em Authorize.',
        '5. GET /api/corridas/disponiveis e PATCH /api/corridas/{id}/status na ordem ACCEPTED, IN_PROGRESS, COMPLETED.',
        '6. Volte ao token do passageiro: GET /api/corridas/{id} e POST /api/corridas/{id}/avaliacao.',
        'Para o caminho negativo, cancele com POST /api/corridas/{id}/cancel enquanto o status for REQUESTED ou ACCEPTED.',
      ].join('\n'),
    )
    .setVersion('0.2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addTag('autenticacao', 'Login local e leitura do token.')
    .addTag('corridas', 'Criação, cotação ilustrativa e ciclo da corrida.')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
