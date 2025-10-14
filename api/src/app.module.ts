import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';

// Módulos da api
import { ClientesModule } from './modules/clientes/clientes.module';
import { StockModule } from './modules/stock/stock.module';
import { EncomendasModule } from './modules/encomendas/encomendas.module';

import 'dotenv/config';

@Module({
  imports: [
    // CONFIGURAÇÃO - Variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TYPEORM - Conexão com SQL Server
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '1433') || 1433,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Azure requer true
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true', // Desenvolvimento local
        enableArithAbort: true,
      },
      synchronize: false, // NUNCA usar true em produção
      logging: process.env.DB_LOGGING === 'true', // Logs de queries SQL
      entities: [], // Não usamos entities porque usamos SPs
      extra: {
        connectionTimeout: 30000,
        requestTimeout: 30000,
        pool: {
          max: 20,
          min: 2,
          idleTimeoutMillis: 30000,
        },
      },
    }),

    // MÓDULOS DA APLICAÇÃO
    ClientesModule,
    StockModule,
    EncomendasModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }