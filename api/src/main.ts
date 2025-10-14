import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - Permite requisições de outros domínios
  app.enableCors({
    origin: [process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // VALIDATION PIPE - Validação automática dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não definidas nos DTOs
      forbidNonWhitelisted: true, // Retorna erro se enviar campos extras
      transform: true, // Transforma tipos automaticamente
      transformOptions: {
        enableImplicitConversion: true, // Conversão automática de tipos
      },
    }),
  );

  // SWAGGER - Documentação da API
  const config = new DocumentBuilder()
    .setTitle('API PHC - Integração Web')
    .setDescription(`
      API REST para integração com o PHC.
      Autenticação via Bearer Token.
      
      Clientes
      - Criar, atualizar, listar e obter clientes
      - Campos personalizados configuráveis
      - Suporte a Consumidor Final (sem NIF)
      
      Stock / Artigos
      - Listar artigos disponíveis para web (_web = 1)
      - Obter detalhes de artigos
      - Registar códigos externos (mapeamento com apps externas)
      - Campos personalizados (garantia, categorias, etc.)
      
      Encomendas (BO/BI)
      - Criar encomendas completas
      - Múltiplas linhas por encomenda
      - Validação automática de clientes
      - Cálculos automáticos (IVA, totais, conversões)
      - Campos personalizados (método pagamento, observações, etc.)
    `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        name: 'Authorization',
        description: 'Insira o Bearer Token fornecido',
        in: 'header',
      },
      'bearer', // Nome da security scheme
    )
    .addTag('Clientes', 'Gestão de clientes')
    .addTag('Stock / Artigos', 'Gestão de artigos e stock')
    .addTag('Encomendas', 'Gestão de encomendas (BO/BI)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  ═══════════════════════════════════════════════════════════
                                                             
     API PHC iniciada com sucesso!                        
                                                             
     Servidor:      http://localhost:${port}                  
     Documentação:  http://localhost:${port}/api-docs        
     Health Check:  http://localhost:${port}/api/health       
     Bearer Token configurado: ${process.env.API_BEARER_TOKEN ? 'Sim' : 'Não'}

  ════════════════════════════════════════════════════════════
  `);
}

bootstrap();