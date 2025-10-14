import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { EncomendasService } from './encomendas.service';
import { CreateEncomendaDto, UpdateEncomendaDto, EncomendaResponseDto, EncomendaDetalheDto, EncomendaListagemDto, CampoPersonalizadoDto } from './encomendas.dto';
import { AuthGuard } from '../../guards/auth.guard';

@ApiTags('Encomendas')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('encomendas')
export class EncomendasController {
    constructor(private readonly service: EncomendasService) { }

    @Post()
    @ApiOperation({
        summary: 'Criar encomenda completa',
        description: `
    Cria uma encomenda no PHC nas tabelas BO, BO2, BO3, BI e BI2.
    
    **Processo:**
    1. Valida se cliente existe (ID PHC ou ID externo como Shopify)
    2. Busca dados do cliente automaticamente
    3. Gera número sequencial da encomenda (obrano) para o ano atual
    4. Cria cabeçalho da encomenda (BO, BO2, BO3)
    5. Cria linhas da encomenda (BI, BI2)
    6. Guarda campos personalizados (se enviados)
    
    **Validações:**
    - Cliente tem que existir
    - Linhas não podem estar vazias
    - Quantidade e preço têm que ser > 0
    
    **Não valida:**
    - Stock dos artigos
    - Se artigos existem na tabela ST
    `
    })
    @ApiResponse({
        status: 201,
        description: 'Encomenda criada com sucesso',
        type: EncomendaResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos',
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente não encontrado',
    })
    criar(@Body() dto: CreateEncomendaDto) {
        return this.service.criar(dto);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Atualizar encomenda',
        description: `
    Atualiza uma encomenda existente.
    
    **Pode atualizar:**
    - Linhas da encomenda (substitui todas as linhas)
    - Campos personalizados
    `
    })
    @ApiParam({
        name: 'id',
        description: 'ID da encomenda (ndos)',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Encomenda atualizada',
    })
    @ApiResponse({
        status: 404,
        description: 'Encomenda não encontrada',
    })
    atualizar(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEncomendaDto
    ) {
        return this.service.atualizar(id, dto);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Obter encomenda por ID',
        description: `
    Retorna todos os detalhes de uma encomenda específica.
    
    **Inclui:**
    - Dados do cabeçalho (cliente, data, totais)
    - Todas as linhas da encomenda
    - Campos personalizados
    `
    })
    @ApiParam({
        name: 'id',
        description: 'ID da encomenda (ndos)',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Encomenda encontrada',
        type: EncomendaDetalheDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Encomenda não encontrada',
    })
    obterPorId(@Param('id', ParseIntPipe) id: number) {
        return this.service.obterPorId(id);
    }

    @Get()
    @ApiOperation({
        summary: 'Listar encomendas',
        description: `
    Lista todas as encomendas com paginação e busca opcional.
    
    **Busca:** Procura por número da encomenda, nome do cliente ou NIF.
    `
    })
    @ApiQuery({
        name: 'pagina',
        required: false,
        example: 1,
        description: 'Número da página',
    })
    @ApiQuery({
        name: 'limite',
        required: false,
        example: 50,
        description: 'Registos por página (máximo 100)',
    })
    @ApiQuery({
        name: 'busca',
        required: false,
        example: 'João Silva',
        description: 'Termo de busca',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de encomendas',
        type: EncomendaListagemDto,
    })
    listar(
        @Query('pagina') pagina?: number,
        @Query('limite') limite?: number,
        @Query('busca') busca?: string
    ) {
        const paginaValidada = Math.max(1, pagina || 1);
        const limiteValidado = Math.min(100, Math.max(1, limite || 50));

        return this.service.listar(paginaValidada, limiteValidado, busca);
    }
}