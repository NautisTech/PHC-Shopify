import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { AuthGuard } from '../../guards/auth.guard';
import { ArtigosPaginadosDto, ArtigoListagemDto, SuccessResponseDto, RegistarCodigoExternoDto, AtualizarCamposPersonalizadosDto, ConfiguracaoCampoDto } from './stock.dto';

@ApiTags('Stock / Artigos')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('stock')
export class StockController {
    constructor(private readonly service: StockService) { }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os artigos',
        description: `
Lista todos os artigos do PHC com paginação e busca opcional.

**Filtros Aplicados:**
- Apenas artigos com u_site = 1 (disponíveis para web/e-commerce)

**Inclui:**
- Dados base do artigo (título, referência, preço, stock)
- Campos personalizados configurados (apenas visíveis)
- Código externo (se já foi registado)

**Busca:** Procura por título ou referência do artigo.
**Paginação:** Controla através dos parâmetros 'pagina' e 'limite'.

**Performance:**
Para cada artigo, busca os campos personalizados. Em listagens grandes, 
isto pode ter impacto. Considere aumentar o cache ou usar índices.
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
        description: 'Termo de busca (título ou referência)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de artigos retornada com sucesso',
        type: ArtigosPaginadosDto,
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

    @Get('nao-sincronizados')
    @ApiOperation({
        summary: 'Listar artigos ainda não sincronizados',
        description: `
Retorna artigos que ainda não têm código externo registado (u_id = 0).

**Útil para:**
- Sincronização inicial com aplicações externas (Shopify, WooCommerce, etc.)
- Identificar produtos novos que precisam ser exportados
- Processos de integração automática

**Filtros:**
- u_site = 1 (apenas artigos para web)
- u_id = 0 (sem código externo)

**Ordenação:** Por referência descendente (mais recentes primeiro)
        `
    })
    @ApiQuery({
        name: 'limite',
        required: false,
        example: 100,
        description: 'Quantidade máxima de artigos a retornar (máximo 500)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de artigos não sincronizados',
        type: [ArtigoListagemDto],
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    listarNaoSincronizados(@Query('limite') limite?: number) {
        const limiteValidado = Math.min(500, Math.max(1, limite || 100));
        return this.service.listarNaoSincronizados(limiteValidado);
    }

    @Get(':ref')
    @ApiOperation({
        summary: 'Obter artigo por referência',
        description: `
Retorna todos os detalhes de um artigo específico pela sua referência.

**Inclui:**
- Dados básicos (título, preço, stock, etc.)
- Campos personalizados genéricos (da tabela artigos_valores_personalizados)
- Campos personalizados externos (busca valores nas tabelas configuradas)
- Código externo (se já foi registado)
- Datas de criação e atualização

**Campos Externos:**
Para cada campo configurado para uma tabela externa, 
a API busca o valor real dessa tabela e retorna junto com os dados.
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
        type: ArtigoListagemDto,
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Artigo não encontrado' })
    obterPorReferencia(@Param('ref') referencia: string) {
        return this.service.obterPorReferencia(referencia);
    }

    @Post(':ref/codigo-externo')
    @ApiOperation({
        summary: 'Registar código da aplicação externa',
        description: `
Regista o código/ID que a aplicação externa usa para identificar este artigo.

**Funcionalidades:**
- Atualiza o campo u_id na tabela st
- Valida se o código já está em uso por outro artigo
- Opcionalmente atualiza campos personalizados (ex: data_sincronizacao, sincronizado)

**Uso Típico - Fluxo de Sincronização:**
1. App externa busca artigos do PHC (GET /stock ou /stock/nao-sincronizados)
2. App cria os produtos no seu sistema com IDs próprios
3. App regista o mapeamento PHC ↔ App Externa através deste endpoint
4. Opcionalmente marca como sincronizado com campos personalizados

**Exemplo de Campos Personalizados:**
- data_sincronizacao (datetime) → Quando foi sincronizado
- sincronizado (boolean) → true
- url_produto_externo (text) → Link do produto no e-commerce

**Transações:**
Toda a operação é feita dentro de uma transação. Se houver erro, tudo é revertido.

**Validações:**
- Verifica se artigo existe
- Verifica se código externo já está em uso
- Valida todos os campos personalizados antes de guardar
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
        example: {
            status: 'SUCCESS',
            mensagem: "Código externo 'shopify_12345' registado para o artigo 'ART-001'"
        }
    })
    @ApiResponse({ status: 401, description: 'Não autenticado' })
    @ApiResponse({ status: 404, description: 'Artigo não encontrado' })
    @ApiResponse({
        status: 400,
        description: 'Código externo já registado para outro artigo ou campos inválidos',
        example: {
            statusCode: 400,
            message: "Código externo 'shopify_12345' já está associado ao artigo 'ART-002'",
            error: 'Bad Request'
        }
    })
    registarCodigoExterno(
        @Param('ref') referencia: string,
        @Body() dto: RegistarCodigoExternoDto
    ) {
        return this.service.registarCodigoExterno(referencia, dto);
    }

    //     @Put(':ref/campos-personalizados')
    //     @ApiOperation({
    //         summary: 'Atualizar campos personalizados de um artigo',
    //         description: `
    // Atualiza os valores dos campos personalizados de um artigo específico.

    // **Campos Personalizados:**
    // - Podem estar na tabela genérica (artigos_valores_personalizados)
    // - Ou em tabelas específicas do PHC (st, ou outras configuradas)
    // - A configuração determina onde cada campo é guardado

    // **Exemplos de Uso:**
    // - Marcar artigo como destaque → { codigo: 'destaque_homepage', tipo: 'boolean', valor: true }
    // - Atualizar garantia → { codigo: 'garantia_meses', tipo: 'number', valor: 36 }
    // - Definir categorias do e-commerce → { codigo: 'categoria_ecommerce', tipo: 'select', valor: 'Eletrónica' }
    // - Adicionar tags → { codigo: 'tags', tipo: 'json', valor: '["novidade", "promoção"]' }

    // **Validações:**
    // - Verifica se artigo existe
    // - Valida se todos os campos existem na configuração
    // - Valida tipos de dados
    // - Valida obrigatoriedade
    // - Valida opções (para campos tipo 'select')
    // - Valida regex (se configurado)

    // **Transações:**
    // Toda a operação é feita dentro de uma transação.
    // Para campos genéricos: remove valor antigo e insere novo.
    // Para campos externos: faz UPDATE ou INSERT conforme necessário.
    //         `
    //     })
    //     @ApiParam({
    //         name: 'ref',
    //         description: 'Referência do artigo no PHC',
    //         example: 'ART-001',
    //     })
    //     @ApiResponse({
    //         status: 200,
    //         description: 'Campos personalizados atualizados',
    //         type: SuccessResponseDto,
    //         example: {
    //             status: 'SUCCESS',
    //             mensagem: "Campos personalizados atualizados para o artigo 'ART-001'"
    //         }
    //     })
    //     @ApiResponse({ status: 401, description: 'Não autenticado' })
    //     @ApiResponse({ status: 404, description: 'Artigo não encontrado' })
    //     @ApiResponse({
    //         status: 400,
    //         description: 'Campos personalizados inválidos',
    //         example: {
    //             statusCode: 400,
    //             message: "Campo personalizado 'campo_invalido' não existe ou não está ativo",
    //             error: 'Bad Request'
    //         }
    //     })
    //     atualizarCamposPersonalizados(
    //         @Param('ref') referencia: string,
    //         @Body() dto: AtualizarCamposPersonalizadosDto
    //     ) {
    //         return this.service.atualizarCamposPersonalizados(referencia, dto);
    //     }

    //     @Get('configuracao/campos-personalizados')
    //     @ApiOperation({
    //         summary: 'Listar configuração de campos personalizados',
    //         description: `
    // Retorna a lista de todos os campos personalizados disponíveis para artigos.

    // **Útil para:**
    // - Construir formulários dinâmicos no frontend
    // - Validar campos antes de enviar
    // - Saber quais campos vão para tabelas externas vs tabela genérica
    // - Conhecer validações, tipos de dados e obrigatoriedade

    // **Informações retornadas:**
    // - codigo_campo: Identificador único do campo
    // - nome_campo: Nome amigável para exibição
    // - tipo_dados: text, number, date, boolean, select, json, etc.
    // - tabela_destino: Tabela PHC onde o campo é guardado (NULL = tabela genérica)
    // - campo_destino: Coluna na tabela destino
    // - obrigatorio: Se o campo é obrigatório
    // - opcoes: Array JSON de opções para campos tipo 'select'
    // - validacao: Expressão regular para validação
    // - ordem: Ordem de exibição
    // - grupo: Agrupamento lógico dos campos
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
    // Retorna os detalhes de configuração de um campo personalizado.

    // **Útil para:**
    // - Validar um campo específico no frontend antes de submeter
    // - Conhecer as regras de validação de um campo
    // - Construir inputs dinâmicos com base na configuração
    // - Obter lista de opções para campos tipo 'select'
    //         `
    //     })
    //     @ApiParam({
    //         name: 'codigo',
    //         description: 'Código do campo personalizado',
    //         example: 'garantia_meses'
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