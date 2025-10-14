import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto, ClienteResponseDto, ClienteDetalheResponseDto } from './clientes.dto';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
    constructor(private readonly service: ClientesService) { }

    @Post()
    @ApiOperation({
        summary: 'Criar novo cliente',
        description: `
    Cria um novo cliente no PHC. 
    
    **Regras:**
    - Se o NIF for fornecido: cria um novo cliente com todos os dados
    - Se o NIF for vazio/null: retorna o ID do cliente "Consumidor Final" (não cria nada)
    
    **Campos obrigatórios:** Nome + NIF (para criar novo cliente)
    **Campos opcionais:** Todos os outros
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
            message: ['Nome deve ter no mínimo 3 caracteres', 'NIF deve ter exatamente 9 dígitos'],
            error: 'Bad Request'
        }
    })
    criar(@Body() dto: CreateClienteDto) {
        return this.service.criar(dto);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Atualizar cliente existente',
        description: 'Atualiza os dados de um cliente. Apenas os campos fornecidos serão atualizados.'
    })
    @ApiParam({ name: 'id', description: 'Número do cliente (no)', example: 1 })
    @ApiResponse({
        status: 200,
        description: 'Cliente atualizado com sucesso',
        type: ClienteResponseDto
    })
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
        description: 'Retorna todos os dados de um cliente, incluindo campos personalizados'
    })
    @ApiParam({ name: 'id', description: 'Número do cliente (no)', example: 1 })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        type: ClienteDetalheResponseDto
    })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    obterPorId(@Param('id', ParseIntPipe) id: number) {
        return this.service.obterPorId(id);
    }

    @Get('nif/:nif')
    @ApiOperation({
        summary: 'Buscar cliente por NIF',
        description: 'Procura um cliente pelo NIF'
    })
    @ApiParam({ name: 'nif', description: 'NIF do cliente (9 dígitos)', example: '123456789' })
    @ApiResponse({
        status: 200,
        description: 'Cliente encontrado',
        type: ClienteDetalheResponseDto
    })
    @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
    buscarPorNif(@Param('nif') nif: string) {
        const cliente = this.service.buscarPorNif(nif);
        if (!cliente) {
            throw new NotFoundException('Cliente não encontrado');
        }
        return cliente;
    }

    @Get()
    @ApiOperation({
        summary: 'Listar clientes',
        description: 'Lista todos os clientes com paginação e busca opcional'
    })
    @ApiQuery({ name: 'pagina', required: false, example: 1, description: 'Número da página' })
    @ApiQuery({ name: 'limite', required: false, example: 50, description: 'Registros por página' })
    @ApiQuery({ name: 'busca', required: false, example: 'João', description: 'Busca por nome, NIF ou email' })
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
    listar(
        @Query('pagina') pagina?: number,
        @Query('limite') limite?: number,
        @Query('busca') busca?: string
    ) {
        return this.service.listar(pagina, limite, busca);
    }
}