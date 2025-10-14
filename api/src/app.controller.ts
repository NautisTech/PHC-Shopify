import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) { }

  @Get('health')
  @ApiOperation({
    summary: 'Health Check',
    description: 'Verifica se a API e a conexão com a base de dados estão funcionais'
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema operacional',
    example: {
      status: 'ok',
      timestamp: '2025-10-14T10:30:00.000Z',
      database: 'connected',
      uptime: 3600
    }
  })
  async healthCheck() {
    let dbStatus = 'disconnected';

    try {
      // Testar conexão com a BD
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Informação da API',
    description: 'Retorna informações básicas sobre a API'
  })
  @ApiResponse({
    status: 200,
    example: {
      name: 'API PHC',
      version: '1.0.0',
      description: 'API REST para integração com PHC',
      documentation: '/api-docs'
    }
  })
  getInfo() {
    return {
      name: 'API PHC',
      version: '1.0.0',
      description: 'API REST para integração com PHC',
      documentation: '/api-docs',
    };
  }
}