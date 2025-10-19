import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { EncomendasService } from './encomendas.service';
import { AuthGuard } from '../../guards/auth.guard';
import { CreateEncomendaDto, UpdateEncomendaDto, EncomendaResponseDto, EncomendaDetalheDto, EncomendasPaginadasDto, ConfiguracaoCampoDto } from './encomendas.dto';

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

**Processo Completo:**
1. Valida se cliente existe (ID PHC ou ID externo como Shopify)
2. Busca dados do cliente automaticamente
3. Gera número sequencial da encomenda (obrano) para o ano atual
4. Calcula totais automaticamente (EUR e Escudos)
5. Cria cabeçalho da encomenda:
   - BO: Dados principais (cliente, totais, datas)
   - BO2: Dados complementares (morada entrega, contactos)
   - BO3: Dados fiscais (país, motivo isenção)
6. Cria linhas da encomenda:
   - BI: Linhas de artigos/serviços
   - BI2: Dados complementares das linhas
7. Guarda campos personalizados (se enviados)

**Cálculos Automáticos:**
- Total EUR = Σ (qtt × preco)
- Total Escudos = Total EUR × 200.482
- IVA: 23% (default), 6%, ou 13%
- TABIVA: 1 (6%), 2 (23%), 3 (13%)

**Campos Automáticos:**
- ndos: Número sequencial global
- obrano: Número sequencial do ano
- boano: Ano da encomenda
- nmdos: Nome da encomenda (auto-gerado)
- stamps: GUIDs de 25 caracteres

**Validações:**
- Cliente tem que existir
- Linhas não podem estar vazias
- Quantidade e preço têm que ser > 0
- Campos personalizados validados (se enviados)

**NÃO Valida:**
- Stock dos artigos
- Se artigos existem na tabela ST (mas busca dados se existirem)

**Transações:**
Toda a operação é feita dentro de uma transação. Se houver erro em qualquer etapa,
tudo é revertido (rollback).
        `
    })
    @ApiResponse({
        status: 201,
        description: 'Encomenda criada com sucesso',
        type: EncomendaResponseDto,
        example: {
            status: 'SUCCESS',
            encomendaId: 1,
            bostamp: 'abc123def456ghi789jkl012m',
            obrano: 1,
            boano: 2025,
            nmdos: 'Encomenda - 1 - shopify_12345',
            total: 1299.98,
            mensagem: 'Encomenda criada com sucesso'
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos',
        example: {
            statusCode: 400,
            message: 'A encomenda deve ter pelo menos uma linha',
            error: 'Bad Request'
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({
        status: 404,
        description: 'Cliente não encontrado',
        example: {
            statusCode: 404,
            message: "Cliente 'shopify_12345' não encontrado",
            error: 'Not Found'
        }
    })
    criar(@Body() dto: CreateEncomendaDto) {
        return this.service.criar(dto);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Atualizar encomenda',
        description: `
Atualiza uma encomenda existente.

**Pode Atualizar:**
- Linhas da encomenda (substitui TODAS as linhas antigas)
- Campos personalizados

**Processo ao Atualizar Linhas:**
1. Deleta todas as linhas antigas (BI e BI2)
2. Recalcula totais
3. Insere novas linhas
4. Atualiza totais no cabeçalho (BO)

**Não Atualiza:**
- Dados do cliente (no, nome, nif, morada)
- Data da encomenda
- Números de controlo (ndos, obrano, boano)

**Validações:**
- Verifica se encomenda existe
- Valida campos personalizados (se enviados)
- Valida linhas (se enviadas)

**Transações:**
Toda a operação é feita dentro de uma transação.
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
        example: {
            status: 'SUCCESS',
            mensagem: 'Encomenda atualizada com sucesso'
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Encomenda não encontrada' })
    @ApiResponse({ status: 400, description: 'Dados inválidos' })
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
- Dados do cabeçalho:
  - Informações da encomenda (ndos, nmdos, obrano, boano, data)
  - Dados do cliente (no, nome, nif)
  - Totais (em EUR)
- Todas as linhas da encomenda:
  - Referência, descrição, quantidade, preço
  - IVA, total por linha
  - Indicador de serviço (stns)
- Campos personalizados:
  - Genéricos (da tabela encomendas_valores_personalizados)
  - Externos (busca valores nas tabelas configuradas: BO, BO2, BO3, etc.)

**Campos Externos:**
Para cada campo configurado para uma tabela externa,
a API busca o valor real dessa tabela e retorna junto com os dados.
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
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Encomenda não encontrada' })
    obterPorId(@Param('id', ParseIntPipe) id: number) {
        return this.service.obterPorId(id);
    }

    @Get()
    @ApiOperation({
        summary: 'Listar encomendas',
        description: `
Lista todas as encomendas com paginação e busca opcional.

**Filtros Aplicados:**
- Apenas encomendas com origem = 'BO'

**Paginação:**
- Controla através dos parâmetros 'pagina' e 'limite'
- Retorna total de registos

**Busca:**
- Procura por: nmdos, nome do cliente, NIF, ou número da encomenda (obrano)
- Usa operador LIKE para busca parcial

**Ordenação:**
- Por data da encomenda (mais recentes primeiro)
- Secundário por ndos (descendente)

**Não Inclui:**
- Linhas da encomenda (usar GET /:id para detalhes)
- Campos personalizados
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
        description: 'Termo de busca (nmdos, nome cliente, NIF, obrano)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de encomendas',
        type: EncomendasPaginadasDto,
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listar(
        @Query('pagina') pagina?: number,
        @Query('limite') limite?: number,
        @Query('busca') busca?: string
    ) {
        const paginaValidada = Math.max(1, pagina || 1);
        const limiteValidado = Math.min(100, Math.max(1, limite || 50));

        return this.service.listar(paginaValidada, limiteValidado, busca);
    }

    //     @Get('configuracao/campos-personalizados')
    //     @ApiOperation({
    //         summary: 'Listar configuração de campos personalizados',
    //         description: `
    // Retorna a lista de todos os campos personalizados disponíveis para encomendas.

    // **Útil para:**
    // - Construir formulários dinâmicos no frontend
    // - Validar campos antes de enviar
    // - Saber quais campos vão para tabelas externas vs tabela genérica
    // - Conhecer validações, tipos de dados e obrigatoriedade

    // **Campos Podem Ir Para:**
    // - Tabela genérica: encomendas_valores_personalizados
    // - Tabelas PHC: BO, BO2, BO3, ou outras configuradas

    // **Informações retornadas:**
    // - codigo_campo: Identificador único
    // - nome_campo: Nome amigável
    // - tipo_dados: text, number, date, boolean, select, json, etc.
    // - tabela_destino: Onde o campo é guardado
    // - campo_chave_relacao: FK usada (ndos, bostamp, bo2stamp, bo3stamp)
    // - opcoes: Para campos tipo 'select'
    //         `
    //     })
    //     @ApiResponse({
    //         status: 200,
    //         description: 'Lista de configurações',
    //         type: [ConfiguracaoCampoDto],
    //     })
    //     @ApiResponse({ status: 401, description: 'Não autenticado' })
    //     listarCamposPersonalizados() {
    //         return this.service.listarCamposPersonalizados();
    //     }

    //     @Get('configuracao/campos-personalizados/:codigo')
    //     @ApiOperation({
    //         summary: 'Obter configuração de um campo específico',
    //         description: `
    // Retorna os detalhes de configuração de um campo personalizado de encomendas.

    // **Útil para:**
    // - Validar um campo específico no frontend
    // - Conhecer as regras de um campo antes de submeter
    // - Construir inputs dinâmicos
    // - Obter lista de opções para campos tipo 'select'
    //         `
    //     })
    //     @ApiParam({
    //         name: 'codigo',
    //         description: 'Código do campo personalizado',
    //         example: 'metodo_pagamento'
    //     })
    //     @ApiResponse({
    //         status: 200,
    //         description: 'Configuração do campo',
    //         type: ConfiguracaoCampoDto,
    //     })
    //     @ApiResponse({ status: 401, description: 'Não autenticado' })
    //     @ApiResponse({ status: 404, description: 'Campo não encontrado' })
    //     obterConfiguracaoCampo(@Param('codigo') codigo: string) {
    //         return this.service.obterConfiguracaoCampo(codigo);
    //     }
}