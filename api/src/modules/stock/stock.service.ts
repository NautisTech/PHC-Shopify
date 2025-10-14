import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArtigosPaginadosDto, ArtigoListagemDto, ArtigoDetalheDto, RegistarCodigoExternoDto, SuccessResponseDto, AtualizarCamposPersonalizadosDto } from './stock.dto';

@Injectable()
export class StockService {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Listar todos os artigos com paginação e busca
     */
    async listar(
        pagina: number = 1,
        limite: number = 50,
        busca?: string
    ): Promise<ArtigosPaginadosDto> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ListarArtigos]
                @Pagina = @0,
                @Limite = @1,
                @Busca = @2`,
            [pagina, limite, busca || null]
        );

        if (!result || result.length === 0) {
            return {
                total: 0,
                pagina,
                limite,
                dados: []
            };
        }

        const response = result[0];

        return {
            total: response.total,
            pagina: response.pagina,
            limite: response.limite,
            dados: JSON.parse(response.dados || '[]')
        };
    }

    /**
     * Obter artigo por referência
     * - Busca dados de ST
     * - Busca campos da tabela genérica
     * - Busca campos das tabelas externas (st, outras tabelas PHC)
     */
    async obterPorReferencia(referencia: string): Promise<ArtigoDetalheDto> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterArtigoPorReferencia] @Referencia = @0`,
            [referencia]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        const artigo = result[0];

        // Processar campos externos (buscar valores das tabelas específicas)
        if (artigo.campos_personalizados_externos) {
            const camposExternos = JSON.parse(artigo.campos_personalizados_externos);

            // Para cada campo externo, buscar o valor real da tabela
            for (const campo of camposExternos) {
                if (campo.tabela_destino && campo.campo_destino) {
                    try {
                        const valorExterno = await this.buscarValorCampoExterno(
                            referencia,
                            campo.tabela_destino,
                            campo.campo_destino,
                            campo.codigo
                        );
                        campo.valor = valorExterno;
                        delete campo.valor_origem;
                    } catch (error) {
                        console.error(`Erro ao buscar campo ${campo.codigo}:`, error);
                        campo.valor = null;
                    }
                }
            }

            artigo.campos_personalizados_externos = JSON.stringify(camposExternos);
        }

        // Combinar campos genéricos + externos
        const camposGenericos = artigo.campos_personalizados_genericos
            ? JSON.parse(artigo.campos_personalizados_genericos)
            : [];
        const camposExternos = artigo.campos_personalizados_externos
            ? JSON.parse(artigo.campos_personalizados_externos)
            : [];

        artigo.campos_personalizados = [...camposGenericos, ...camposExternos];

        // Limpar propriedades temporárias
        delete artigo.campos_personalizados_genericos;
        delete artigo.campos_personalizados_externos;

        return artigo;
    }

    /**
     * Buscar valor de um campo numa tabela externa
     * Exemplo: buscar st.peso onde st.ref = 'ART-001'
     */
    private async buscarValorCampoExterno(
        referencia: string,
        tabelaDestino: string,
        campoDestino: string,
        codigoCampo: string
    ): Promise<any> {
        // Obter qual FK usar (ref, stampo, etc.)
        const config = await this.dataSource.query(
            `SELECT campo_chave_relacao FROM artigos_campos_personalizados 
             WHERE codigo_campo = @0`,
            [codigoCampo]
        );

        const campoChave = config[0]?.campo_chave_relacao || 'ref';

        // Query dinâmica para buscar o valor
        const sql = `
            SELECT ${campoDestino} AS valor
            FROM ${tabelaDestino}
            WHERE ${campoChave} = @0
        `;

        const result = await this.dataSource.query(sql, [referencia]);
        return result[0]?.valor || null;
    }

    /**
     * Registar código da aplicação externa para um artigo
     * - Valida se campos personalizados existem
     * - SP decide onde guardar cada campo
     */
    async registarCodigoExterno(
        referencia: string,
        dto: RegistarCodigoExternoDto
    ): Promise<SuccessResponseDto> {
        // Verificar se artigo existe
        const artigo = await this.obterPorReferencia(referencia);
        if (!artigo) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        // VALIDAR campos personalizados se existirem
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_RegistarCodigoExternoArtigo]
                @Referencia = @0,
                @CodigoExterno = @1,
                @Observacoes = @2,
                @CamposPersonalizados = @3`,
            [referencia, dto.codigoExterno, dto.observacoes || null, camposJson]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return {
            status: 'SUCCESS',
            mensagem: `Código externo '${dto.codigoExterno}' registado para o artigo '${referencia}'`
        };
    }

    /**
     * Atualizar campos personalizados de um artigo
     */
    async atualizarCamposPersonalizados(
        referencia: string,
        dto: AtualizarCamposPersonalizadosDto
    ): Promise<SuccessResponseDto> {
        // Verificar se artigo existe
        const artigo = await this.obterPorReferencia(referencia);
        if (!artigo) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        // VALIDAR campos personalizados
        await this.validarCamposPersonalizados(dto.camposPersonalizados);

        const camposJson = JSON.stringify(dto.camposPersonalizados);

        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_AtualizarCamposPersonalizadosArtigo]
                @Referencia = @0,
                @CamposPersonalizados = @1`,
            [referencia, camposJson]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return {
            status: 'SUCCESS',
            mensagem: `Campos personalizados atualizados para o artigo '${referencia}'`
        };
    }

    /**
     * Listar artigos sem código externo (ainda não sincronizados)
     */
    async listarNaoSincronizados(limite: number = 100): Promise<ArtigoListagemDto[]> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ListarArtigosNaoSincronizados] @Limite = @0`,
            [limite]
        );

        return result || [];
    }

    /**
     * VALIDAR se os campos enviados existem na configuração
     */
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        // Buscar TODAS as configurações de campos ativos
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM artigos_campos_personalizados WHERE ativo = 1`
        );

        for (const campo of campos) {
            // Verificar se o campo existe na configuração
            const definicao = definicoesCampos.find(
                (d: any) => d.codigo_campo === campo.codigo
            );

            if (!definicao) {
                throw new BadRequestException(
                    `Campo personalizado '${campo.codigo}' não existe ou não está ativo`
                );
            }

            // Validar se campo é obrigatório
            if (definicao.obrigatorio &&
                (campo.valor === null || campo.valor === undefined || campo.valor === '')) {
                throw new BadRequestException(
                    `Campo '${definicao.nome_campo}' é obrigatório`
                );
            }

            // Validar regex se existir
            if (definicao.validacao && campo.valor) {
                const regex = new RegExp(definicao.validacao);
                if (!regex.test(String(campo.valor))) {
                    throw new BadRequestException(
                        `Valor inválido para '${definicao.nome_campo}'`
                    );
                }
            }

            // Validar opções de select
            if (definicao.tipo_dados === 'select' && definicao.opcoes && campo.valor) {
                const opcoes = JSON.parse(definicao.opcoes);
                if (!opcoes.includes(String(campo.valor))) {
                    throw new BadRequestException(
                        `Valor de '${definicao.nome_campo}' deve ser uma das opções: ${opcoes.join(', ')}`
                    );
                }
            }

            // Validar tipo de dado
            if (!this.validarTipoDado(campo.valor, definicao.tipo_dados)) {
                throw new BadRequestException(
                    `Tipo de dado inválido para '${definicao.nome_campo}'. ` +
                    `Esperado: ${definicao.tipo_dados}`
                );
            }
        }
    }

    /**
     * Validar tipo de dado
     */
    private validarTipoDado(valor: any, tipoDados: string): boolean {
        if (valor === null || valor === undefined) {
            return true;
        }

        switch (tipoDados) {
            case 'number':
            case 'decimal':
                return !isNaN(Number(valor));
            case 'boolean':
                return typeof valor === 'boolean' ||
                    valor === 'true' || valor === 'false' ||
                    valor === true || valor === false;
            case 'date':
            case 'datetime':
                return !isNaN(Date.parse(valor));
            case 'json':
                try {
                    if (typeof valor === 'object') return true;
                    JSON.parse(valor);
                    return true;
                } catch {
                    return false;
                }
            default:
                return true;
        }
    }

    /**
     *  Listar configurações de campos personalizados
     */
    async listarCamposPersonalizados(): Promise<any[]> {
        const result = await this.dataSource.query(
            `SELECT 
                codigo_campo,
                nome_campo,
                tipo_dados,
                tabela_destino,
                campo_destino,
                campo_chave_relacao,
                tamanho_maximo,
                obrigatorio,
                valor_padrao,
                opcoes,
                validacao,
                ordem,
                grupo,
                visivel,
                editavel
             FROM artigos_campos_personalizados
             WHERE ativo = 1
             ORDER BY ordem, grupo, nome_campo`
        );

        return result;
    }

    /**
     * Obter configuração de um campo específico
     */
    async obterConfiguracaoCampo(codigoCampo: string): Promise<any> {
        const result = await this.dataSource.query(
            `SELECT * FROM artigos_campos_personalizados 
             WHERE codigo_campo = @0 AND ativo = 1`,
            [codigoCampo]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException(
                `Campo personalizado '${codigoCampo}' não encontrado`
            );
        }

        return result[0];
    }
}