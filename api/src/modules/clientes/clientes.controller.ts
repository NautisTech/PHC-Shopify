import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { AuthGuard } from '../../guards/auth.guard';
import { CreateClienteDto, UpdateClienteDto, ClienteResponseDto, ClientesPaginadosDto, ClienteDetalheResponseDto, ConfiguracaoCampoDto } from './clientes.dto';

@ApiTags('Clientes')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('clientes')
export class ClientesController {
    constructor(private readonly service: ClientesService) { }

    @Post()
    @ApiOperation({
        summary: 'Criar novo cliente',
        description: `
Cria um novo cliente no PHC com suporte a campos personalizados.

**Regras:**
- Se o NIF for fornecido: cria um novo cliente com todos os dados
- Se o NIF for vazio/null: retorna o ID do cliente "Consumidor Final"

**Campos Personalizados:**
- Podem ser guardados na tabela genérica (cl_valores_personalizados)
- Ou em tabelas específicas do PHC (ex: cl, cl2, etc.)
- A configuração na tabela cl_campos_personalizados determina onde cada campo é guardado

**Exemplos de campos:**
- _id → vai para cl._id (campo externo como Shopify ID)
- data_aniversario → vai para cl_valores_personalizados
- zona_comercial → pode ir para cl2.zona (se configurado)

**Transações:**
Toda a operação é feita dentro de uma transação. Se houver erro em qualquer etapa, 
tudo é revertido (rollback).
        `
    })
    @ApiResponse({
        status: 201,
        description: 'Cliente criado com sucesso',
        type: ClienteResponseDto,
        example: {
            status: 'SUCCESS',
            clienteId: 1,
            clstamp: 'abc123def456ghi789jkl012m',
            mensagem: 'Cliente criado com sucesso'
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos ou NIF duplicado',
        example: {
            statusCode: 400,
            message: 'Já existe um cliente com este NIF',
            error: 'Bad Request'
        }
    })
    @ApiResponse({
        status: 401,
        description: 'Não autenticado - Token inválido ou não fornecido'
    })
    criar(@Body() dto: CreateClienteDto) {
        return this.service.criar(dto);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Atualizar cliente existente',
        description: `
Atualiza os dados de um cliente. Apenas os campos fornecidos serão atualizados.

**Campos personalizados:**
- Atualiza tanto campos genéricos quanto em tabelas externas
- Se o campo estiver configurado para tabela externa, atualiza lá
- Caso contrário, atualiza na tabela genérica
- Remove e recria valores na tabela genérica

**Validações:**
- Verifica se o cliente existe
- Se alterar NIF, verifica se já existe outro cliente com esse NIF
- Valida todos os campos personalizados antes de atualizar

**Transações:**
Toda a operação é feita dentro de uma transação.
        `
    })
    @ApiParam({ name: 'id', description: 'Número do cliente (no)', example: 1 })
    @ApiResponse({
        status: 200,
        description: 'Cliente atualizado com sucesso',
        type: ClienteResponseDto
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    @ApiResponse({ status: 400, description: 'Dados inválidos ou NIF duplicado' })
    atualizar(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateClienteDto
    ) {
        return this.service.atualizar(id, dto);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Obter cliente por ID',
        description: `
Retorna todos os dados de um cliente, incluindo:
- Dados básicos da tabela CL (nome, NIF, morada, etc.)
- Dados complementares da tabela CL2 (país, descrição país)
- Campos personalizados genéricos (da tabela cl_valores_personalizados)
- Campos personalizados de tabelas externas (busca os valores nas tabelas configuradas)

**Campos Externos:**
Para cada campo configurado para uma tabela externa (ex: cl._id), 
a API busca o valor real dessa tabela e retorna junto com os dados.
        `
    })
    @ApiParam({ name: 'id', description: 'Número do cliente (no)', example: 1 })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        type: ClienteDetalheResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    obterPorId(@Param('id', ParseIntPipe) id: number) {
        return this.service.obterPorId(id);
    }

    @Get('nif/:nif')
    @ApiOperation({
        summary: 'Obter cliente por NIF',
        description: 'Procura um cliente pelo NIF. Retorna dados básicos do cliente.'
    })
    @ApiParam({ name: 'nif', description: 'NIF do cliente (9 dígitos)', example: '123456789' })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        example: {
            no: 1,
            Nome: 'João Silva',
            ncont: '123456789',
            clstamp: 'abc123def456ghi789jkl012m',
            email: 'joao.silva@email.com'
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    async obterPorNif(@Param('nif') nif: string) {
        const cliente = await this.service.obterPorNif(nif);
        if (!cliente) {
            throw new NotFoundException('Cliente não encontrado');
        }
        return cliente;
    }

    @Get()
    @ApiOperation({
        summary: 'Listar clientes',
        description: `
Lista todos os clientes com paginação e busca opcional.

**Paginação:**
- Controla através dos parâmetros 'pagina' e 'limite'
- Retorna total de registos e total de páginas

**Busca:**
- Procura por nome, NIF, email ou número do cliente
- Usa operador LIKE para busca parcial

**Filtros:**
- Apenas clientes ativos (inactivo = 0 ou NULL)
        `
    })
    @ApiQuery({ name: 'pagina', required: false, example: 1, description: 'Número da página' })
    @ApiQuery({ name: 'limite', required: false, example: 50, description: 'Registos por página (máximo 100)' })
    @ApiQuery({ name: 'procura', required: false, example: 'João', description: 'Termo de busca (nome, NIF, email)' })
    @ApiResponse({
        status: 200,
        description: 'Lista de clientes',
        type: ClientesPaginadosDto,
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listar(
        @Query('pagina') pagina?: number,
        @Query('limite') limite?: number,
        @Query('procura') procura?: string
    ) {
        const paginaValidada = Math.max(1, pagina || 1);
        const limiteValidado = Math.min(100, Math.max(1, limite || 50));

        return this.service.listar(paginaValidada, limiteValidado, procura);
    }

    @Get('configuracao/campos-personalizados')
    @ApiOperation({
        summary: 'Listar configuração de campos personalizados',
        description: `
Retorna a lista de todos os campos personalizados disponíveis para clientes.

**Útil para:**
- Construir formulários dinâmicos no frontend
- Validar campos antes de enviar
- Saber quais campos vão para tabelas externas vs tabela genérica
- Conhecer validações, tipos de dados e obrigatoriedade

**Informações retornadas:**
- codigo_campo: Identificador único do campo
- nome_campo: Nome amigável para exibição
- tipo_dados: text, number, date, boolean, select, etc.
- tabela_destino: Tabela PHC onde o campo é guardado (NULL = tabela genérica)
- campo_destino: Coluna na tabela destino
- obrigatorio: Se o campo é obrigatório
- opcoes: Array de opções para campos tipo 'select'
- validacao: Expressão regular para validação
        `
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de configurações',
        type: [ConfiguracaoCampoDto],
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listarCamposPersonalizados() {
        return this.service.listarCamposPersonalizados();
    }

    @Get('configuracao/campos-personalizados/:codigo')
    @ApiOperation({
        summary: 'Obter configuração de um campo específico',
        description: `
Retorna os detalhes de configuração de um campo personalizado.

**Útil para:**
- Validar um campo específico no frontend
- Conhecer as regras de um campo antes de submeter
- Construir inputs dinâmicos com base na configuração
        `
    })
    @ApiParam({
        name: 'codigo',
        description: 'Código do campo personalizado',
        example: '_id'
    })
    @ApiResponse({
        status: 200,
        description: 'Configuração do campo',
        type: ConfiguracaoCampoDto,
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Campo não encontrado' })
    obterConfiguracaoCampo(@Param('codigo') codigo: string) {
        return this.service.obterConfiguracaoCampo(codigo);
    }
}