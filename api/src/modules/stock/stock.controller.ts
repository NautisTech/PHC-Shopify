import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { ArtigosPaginadosDto, ArtigoListagemDto, ArtigoDetalheDto, RegistarCodigoExternoDto, SuccessResponseDto, AtualizarCamposPersonalizadosDto } from './stock.dto';

@ApiTags('Stock / Artigos')
@Controller('stock')
export class StockController {
    constructor(private readonly service: StockService) { }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os artigos',
        description: `
    Lista todos os artigos do PHC com paginação e busca opcional.
    
    **Inclui:**
    - Dados base do artigo (título, referência, preço, stock)
    - Campos personalizados configurados
    - Código externo (se já foi registado)
    
    **Busca:** Procura por título, referência ou marca.
    **Paginação:** Controla através dos parâmetros 'pagina' e 'limite'.
    `
    })
    @ApiQuery({
        name: 'pagina',
        required: false,
        example: 1,
        description: 'Número da página (começa em 1)',
    })
    @ApiQuery({
        name: 'limite',
        required: false,
        example: 50,
        description: 'Quantidade de registos por página (máximo 100)',
    })
    @ApiQuery({
        name: 'busca',
        required: false,
        example: 'Samsung',
        description: 'Termo de busca (título, referência ou marca)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de artigos retornada com sucesso',
        type: ArtigosPaginadosDto,
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

    @Get('nao-sincronizados')
    @ApiOperation({
        summary: 'Listar artigos ainda não sincronizados com app externa',
        description: 'Retorna artigos que ainda não têm código externo registado'
    })
    @ApiQuery({
        name: 'limite',
        required: false,
        example: 100,
        description: 'Quantidade máxima de artigos a retornar',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de artigos não sincronizados',
        type: [ArtigoListagemDto],
    })
    listarNaoSincronizados(@Query('limite') limite?: number) {
        const limiteValidado = Math.min(500, Math.max(1, limite || 100));
        return this.service.listarNaoSincronizados(limiteValidado);
    }

    @Get(':ref')
    @ApiOperation({
        summary: 'Obter artigo por referência',
        description: `
    Retorna todos os detalhes de um artigo específico pela sua referência.
    
    Inclui:
    - Dados básicos (título, preço, stock, etc.)
    - Campos personalizados com seus valores
    - Referências associadas
    - Ficha técnica (PDF)
    - Código externo (se já foi registado)
    `
    })
    @ApiParam({
        name: 'ref',
        description: 'Referência do artigo no PHC',
        example: 'ART-001',
    })
    @ApiResponse({
        status: 200,
        description: 'Artigo encontrado',
        type: ArtigoDetalheDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Artigo não encontrado',
    })
    obterPorReferencia(@Param('ref') referencia: string) {
        return this.service.obterPorReferencia(referencia);
    }

    @Post(':ref/codigo-externo')
    @ApiOperation({
        summary: 'Registar código da aplicação externa',
        description: `
    Regista o código/ID que a aplicação externa usa para identificar este artigo.
    
    **Pode também atualizar campos personalizados durante o registo**, como:
    - data_sincronizacao
    - sincronizado (boolean)
    - url_produto_externo
    
    **Uso típico:**
    1. App externa busca artigos do PHC (GET /stock)
    2. App cria os artigos no seu sistema com IDs próprios
    3. App regista o mapeamento PHC ↔ App Externa através deste endpoint
    4. Opcionalmente atualiza campos personalizados (ex: marcar como sincronizado)
    `
    })
    @ApiParam({
        name: 'ref',
        description: 'Referência do artigo no PHC',
        example: 'ART-001',
    })
    @ApiResponse({
        status: 201,
        description: 'Código externo registado com sucesso',
        type: SuccessResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Artigo não encontrado',
    })
    @ApiResponse({
        status: 400,
        description: 'Código externo já registado para outro artigo ou campos inválidos',
    })
    registarCodigoExterno(
        @Param('ref') referencia: string,
        @Body() dto: RegistarCodigoExternoDto
    ) {
        return this.service.registarCodigoExterno(referencia, dto);
    }

    @Put(':ref/campos-personalizados')
    @ApiOperation({
        summary: 'Atualizar campos personalizados de um artigo',
        description: `
    Atualiza os valores dos campos personalizados de um artigo específico.
    
    **Exemplos de uso:**
    - Marcar artigo como destaque
    - Atualizar informações de garantia
    - Definir categorias do e-commerce
    - Adicionar tags ou características especiais
    `
    })
    @ApiParam({
        name: 'ref',
        description: 'Referência do artigo no PHC',
        example: 'ART-001',
    })
    @ApiResponse({
        status: 200,
        description: 'Campos personalizados atualizados',
        type: SuccessResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Artigo não encontrado',
    })
    @ApiResponse({
        status: 400,
        description: 'Campos personalizados inválidos',
    })
    atualizarCamposPersonalizados(
        @Param('ref') referencia: string,
        @Body() dto: AtualizarCamposPersonalizadosDto
    ) {
        return this.service.atualizarCamposPersonalizados(referencia, dto);
    }
}