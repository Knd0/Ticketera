import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

const DEFAULT_ORIGINS = ['http://localhost:4220', 'http://localhost:4200'];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Railway y otros proxies: la IP real del cliente para el límite de pedidos.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  // Antes `enableCors()` aceptaba cualquier origen. Ahora sólo los del frontend.
  const origins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : DEFAULT_ORIGINS });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
