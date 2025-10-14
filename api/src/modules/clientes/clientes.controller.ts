import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto, ClienteResponseDto, ClienteDetalheResponseDto } from './clientes.dto';
import { AuthGuard } from '../../guards/auth.guard';

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
    Cria um novo cliente no PHC com suporte a campos personalizados em tabelas externas.
    
    **Regras:**
    - Se o NIF for fornecido: cria um novo cliente com todos os dados
    - Se o NIF for vazio/null: retorna o ID do cliente "Consumidor Final"
    
    **Campos Personalizados:**
    - Podem ser guardados na tabela genérica (cl_valores_personalizados)
    - Ou em tabelas específicas do PHC (ex: cl_info, cl2, etc.)
    - A configuração determina onde cada campo é guardado
    
    **Exemplos de campos:**
    - nome_empresa → vai para cl_info.nome_empresa
    - data_aniversario → vai para cl_valores_personalizados
    - zona_comercial → vai para cl2.zona
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
        description: 'Dados inválidos',
        example: {
            statusCode: 400,
            message: ['Nome deve ter no mínimo 3 caracteres', 'Campo nome_empresa é obrigatório'],
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
    - Dados básicos (nome, NIF, morada, etc.)
    - Campos personalizados genéricos
    - Campos personalizados de tabelas externas (cl_info, cl2, etc.)

    **Nota:** Os campos de tabelas externas são automaticamente preenchidos
    `
    })
    @ApiParam({ name: 'id', description: 'Número do cliente (no)', example: 1 })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        type: ClienteDetalheResponseDto,
        example: {
            no: 1,
            nome: 'João Silva',
            ncont: '123456789',
            email: 'joao@email.com',
            campos_personalizados: [
                {
                    codigo: 'nome_empresa',
                    nome: 'Nome da Empresa',
                    tipo: 'text',
                    valor: 'TESTE LDA',
                    tabela_destino: 'cl_info'
                },
                {
                    codigo: 'data_aniversario',
                    nome: 'Data de Aniversário',
                    tipo: 'date',
                    valor: '1990-05-15',
                    tabela_destino: null
                }
            ]
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    obterPorId(@Param('id', ParseIntPipe) id: number) {
        return this.service.obterPorId(id);
    }

    @Get('nif/:nif')
    @ApiOperation({
        summary: 'Obtem cliente por NIF',
        description: 'Procura um cliente pelo NIF'
    })
    @ApiParam({ name: 'nif', description: 'NIF do cliente (9 dígitos)', example: '123456789' })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        type: ClienteDetalheResponseDto
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    obtemPorNif(@Param('nif') nif: string) {
        const cliente = this.service.obterPorNif(nif);
        if (!cliente) {
            throw new NotFoundException('Cliente não encontrado');
        }
        return cliente;
    }

    @Get()
    @ApiOperation({
        summary: 'Listar clientes',
        description: 'Lista todos os clientes com paginação e procura opcional'
    })
    @ApiQuery({ name: 'pagina', required: false, example: 1, description: 'Número da página' })
    @ApiQuery({ name: 'limite', required: false, example: 50, description: 'Registros por página' })
    @ApiQuery({ name: 'procura', required: false, example: 'João', description: 'Procura por nome, NIF ou email' })
    @ApiResponse({
        status: 200,
        description: 'Lista de clientes',
        example: {
            total: 100,
            pagina: 1,
            limite: 50,
            dados: [
                {
                    no: 1,
                    nome: 'João Silva',
                    ncont: '123456789',
                    email: 'joao@email.com',
                    telefone: '+351212345678'
                }
            ]
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listar(
        @Query('pagina') pagina?: number,
        @Query('limite') limite?: number,
        @Query('procura') procura?: string
    ) {
        return this.service.listar(pagina, limite, procura);
    }

    @Get('configuracao/campos-personalizados')
    @ApiOperation({
        summary: 'Listar configuração de campos personalizados',
        description: `
    Retorna a lista de todos os campos personalizados disponíveis para clientes.
    
    **Útil para:**
    - Construir formulários dinâmicos
    - Validar campos antes de enviar
    - Saber quais campos vão para tabelas externas
    `
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de configurações',
        example: [
            {
                codigo_campo: 'nome_empresa',
                nome_campo: 'Nome da Empresa',
                tipo_dados: 'text',
                tabela_destino: 'cl_info',
                campo_destino: 'nome_empresa',
                campo_chave_relacao: 'cl_no',
                obrigatorio: false,
                valor_padrao: null,
                grupo: 'Comercial',
                ordem: 1
            },
            {
                codigo_campo: 'data_aniversario',
                nome_campo: 'Data de Aniversário',
                tipo_dados: 'date',
                tabela_destino: null,
                campo_destino: null,
                obrigatorio: false,
                grupo: 'Pessoal',
                ordem: 10
            }
        ]
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listarCamposPersonalizados() {
        return this.service.listarCamposPersonalizados();
    }

    @Get('configuracao/campos-personalizados/:codigo')
    @ApiOperation({
        summary: 'Obter configuração de um campo específico',
        description: 'Retorna os detalhes de configuração de um campo personalizado'
    })
    @ApiParam({
        name: 'codigo',
        description: 'Código do campo personalizado',
        example: 'nome_empresa'
    })
    @ApiResponse({
        status: 200,
        description: 'Configuração do campo',
        example: {
            codigo_campo: 'nome_empresa',
            nome_campo: 'Nome da Empresa',
            tipo_dados: 'text',
            tabela_destino: 'cl_info',
            campo_destino: 'nome_empresa',
            campo_chave_relacao: 'cl_no',
            tamanho_maximo: 255,
            obrigatorio: true,
            validacao: null,
            opcoes: null,
            grupo: 'Comercial',
            ordem: 1
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Campo não encontrado' })
    obterConfiguracaoCampo(@Param('codigo') codigo: string) {
        return this.service.obterConfiguracaoCampo(codigo);
    }
}