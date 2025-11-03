import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RegistarCodigoExternoDto, AtualizarCamposPersonalizadosDto } from './stock.dto';

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
    ): Promise<any> {
        const offset = (pagina - 1) * limite;

        // Construir WHERE clause
        let whereClause = '_site = 1';
        const params: any[] = [];
        let paramIndex = 0;

        if (busca) {
            whereClause += ` AND (
                design LIKE @${paramIndex} OR 
                ref LIKE @${paramIndex}
            )`;
            params.push(`%${busca}%`);
            paramIndex++;
        }

        // Contar total
        const totalResult = await this.dataSource.query(
            `SELECT COUNT(*) as total FROM st WHERE ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // Buscar dados paginados
        params.push(offset);
        params.push(limite);

        const dados = await this.dataSource.query(`
            SELECT 
                st.design AS titulo,
                st.ref AS referencia,
                st.u_marcafl AS marca,
                st.u_desctec AS descricao,
                st.epv1 AS preco,
                st.epv5 AS precoPromocional,
                st.peso AS peso,
                st.stock AS stock,
                st.url AS fichaTecnica,
                st._id AS codigoExterno,
                st.familia AS familia,
                st.faminome AS familiaNome,
                st.tabiva AS taxaIVA,
                st.unidade AS unidade,
                st.imagem AS caminhoImagem,
                st.fornecedor AS fornecedor,
                st.fornec AS codigoFornecedor
            FROM st
            WHERE ${whereClause}
            ORDER BY st.ref DESC
            OFFSET @${paramIndex} ROWS
            FETCH NEXT @${paramIndex + 1} ROWS ONLY
        `, params);

        // Buscar campos personalizados para cada artigo
        for (const artigo of dados) {
            artigo.camposPersonalizados = await this.buscarCamposPersonalizados(artigo.referencia);
        }

        return {
            total,
            pagina,
            limite,
            dados
        };
    }

    /**
     * Obter artigo por referência
     */
    async obterPorReferencia(referencia: string): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT 
                st.design AS titulo,
                st.ref AS referencia,
                st.u_marcafl AS marca,
                st.u_desctec AS descricao,
                st.epv1 AS preco,
                st.epv5 AS precoPromocional,
                st.peso AS peso,
                st.stock AS stock,
                st.url AS fichaTecnica,
                st._id AS codigoExterno,
                st.familia AS familia,
                st.faminome AS familiaNome,
                st.tabiva AS taxaIVA,
                st.unidade AS unidade,
                st.imagem AS caminhoImagem,
                st.fornecedor AS fornecedor,
                st.fornec AS codigoFornecedor,
                st.usrdata AS dataCriacao,
                st.ousrdata AS dataAtualizacao
            FROM st
            WHERE st.ref = @0
        `, [referencia]);

        if (!result || result.length === 0) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        const artigo = result[0];

        // Buscar campos personalizados genéricos
        const camposGenericos = await this.dataSource.query(`
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                cp.grupo,
                COALESCE(
                    vp.valor_texto,
                    CAST(vp.valor_numero AS NVARCHAR(50)),
                    CONVERT(VARCHAR(10), vp.valor_data, 120),
                    CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                    CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                    vp.valor_json
                ) AS valor
            FROM artigos_campos_personalizados cp
            LEFT JOIN artigos_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo AND vp.referencia = @0
            WHERE cp.ativo = 1 AND cp.tabela_destino IS NULL
            ORDER BY cp.ordem
        `, [referencia]);

        // Buscar configuração de campos externos
        const camposExternosConfig = await this.dataSource.query(`
            SELECT 
                codigo_campo, nome_campo, tipo_dados, grupo,
                tabela_destino, campo_destino, campo_chave_relacao
            FROM artigos_campos_personalizados
            WHERE ativo = 1 AND tabela_destino IS NOT NULL
            ORDER BY ordem
        `);

        // Buscar valores dos campos externos
        const camposExternos: any[] = [];
        for (const config of camposExternosConfig) {
            try {
                const valor = await this.buscarValorCampoExterno(
                    referencia,
                    config.tabela_destino,
                    config.campo_destino,
                    config.campo_chave_relacao
                );

                camposExternos.push({
                    codigo: config.codigo_campo,
                    nome: config.nome_campo,
                    tipo: config.tipo_dados,
                    grupo: config.grupo,
                    tabela_destino: config.tabela_destino,
                    valor: valor
                });
            } catch (error) {
                console.error(`Erro ao buscar campo ${config.codigo_campo}:`, error);
            }
        }

        artigo.campos_personalizados = [...camposGenericos, ...camposExternos];

        return artigo;
    }

    /**
     * Buscar campos personalizados de um artigo (para listagem)
     */
    private async buscarCamposPersonalizados(referencia: string): Promise<any[]> {
        const campos = await this.dataSource.query(`
            SELECT 
                cp.codigo_campo AS codigo,
                cp.tipo_dados AS tipo,
                COALESCE(
                    vp.valor_texto,
                    CAST(vp.valor_numero AS NVARCHAR(50)),
                    CONVERT(VARCHAR(10), vp.valor_data, 120),
                    CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                    CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                    vp.valor_json
                ) AS valor
            FROM artigos_campos_personalizados cp
            LEFT JOIN artigos_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo AND vp.referencia = @0
            WHERE cp.ativo = 1 AND cp.visivel = 1 AND cp.tabela_destino IS NULL
            ORDER BY cp.ordem
        `, [referencia]);

        return campos || [];
    }

    /**
     * Buscar valor de campo em tabela externa
     */
    private async buscarValorCampoExterno(
        referencia: string,
        tabelaDestino: string,
        campoDestino: string,
        campoChave: string
    ): Promise<any> {
        const result = await this.dataSource.query(
            `SELECT ${campoDestino} AS valor 
             FROM ${tabelaDestino} 
             WHERE ${campoChave || 'ref'} = @0`,
            [referencia]
        );

        return result[0]?.valor || null;
    }

    /**
     * Registar código externo para um artigo
     */
    async registarCodigoExterno(
        referencia: string,
        dto: RegistarCodigoExternoDto
    ): Promise<any> {
        // Verificar se artigo existe
        const artigo = await this.obterPorReferencia(referencia);
        if (!artigo) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        // Verificar se código externo já está em uso
        const codigoEmUso = await this.dataSource.query(
            `SELECT ref FROM st WHERE _id = @0 AND ref != @1`,
            [dto.codigoExterno, referencia]
        );

        if (codigoEmUso && codigoEmUso.length > 0) {
            throw new BadRequestException(
                `Código externo '${dto.codigoExterno}' já está associado ao artigo '${codigoEmUso[0].ref}'`
            );
        }

        // VALIDAR campos personalizados se existirem
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const dataAtual = new Date();

            // Atualizar código externo
            await queryRunner.query(
                `UPDATE st SET _id = @0, ousrdata = @1 WHERE ref = @2`,
                [dto.codigoExterno, dataAtual, referencia]
            );

            // Processar campos personalizados se fornecidos
            if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
                await this.processarCamposPersonalizados(
                    queryRunner,
                    referencia,
                    dto.camposPersonalizados
                );
            }

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                mensagem: `Código externo '${dto.codigoExterno}' registado para o artigo '${referencia}'`
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(
                `Erro ao registar código externo: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Atualizar campos personalizados de um artigo
     */
    async atualizarCamposPersonalizados(
        referencia: string,
        dto: AtualizarCamposPersonalizadosDto
    ): Promise<any> {
        // Verificar se artigo existe
        const artigo = await this.obterPorReferencia(referencia);
        if (!artigo) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        // VALIDAR campos personalizados
        await this.validarCamposPersonalizados(dto.camposPersonalizados);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await this.processarCamposPersonalizados(
                queryRunner,
                referencia,
                dto.camposPersonalizados
            );

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                mensagem: `Campos personalizados atualizados para o artigo '${referencia}'`
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(
                `Erro ao atualizar campos personalizados: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Processar campos personalizados
     */
    private async processarCamposPersonalizados(
        queryRunner: any,
        referencia: string,
        campos: any[]
    ): Promise<void> {
        const dataAtual = new Date();

        for (const campo of campos) {
            // Buscar configuração do campo
            const config = await queryRunner.query(
                `SELECT tabela_destino, campo_destino, campo_chave_relacao, tipo_dados
                 FROM artigos_campos_personalizados
                 WHERE codigo_campo = @0 AND ativo = 1`,
                [campo.codigo]
            );

            if (!config || config.length === 0) {
                continue; // Campo não configurado, pular
            }

            const { tabela_destino, campo_destino, campo_chave_relacao, tipo_dados } = config[0];

            // ========================================
            // OPÇÃO 1: Campo vai para tabela específica
            // ========================================
            if (tabela_destino && campo_destino) {
                const valorChave = referencia;

                // Verificar se registro existe
                const existe = await queryRunner.query(
                    `SELECT COUNT(*) as count FROM ${tabela_destino} 
                     WHERE ${campo_chave_relacao || 'ref'} = @0`,
                    [valorChave]
                );

                if (existe[0].count > 0) {
                    // UPDATE
                    await queryRunner.query(
                        `UPDATE ${tabela_destino} 
                         SET ${campo_destino} = @0 
                         WHERE ${campo_chave_relacao || 'ref'} = @1`,
                        [campo.valor, valorChave]
                    );
                } else {
                    // INSERT
                    await queryRunner.query(
                        `INSERT INTO ${tabela_destino} (${campo_chave_relacao || 'ref'}, ${campo_destino})
                         VALUES (@0, @1)`,
                        [valorChave, campo.valor]
                    );
                }
            }
            // ========================================
            // OPÇÃO 2: Campo vai para tabela genérica
            // ========================================
            else {
                // Remover valor existente
                await queryRunner.query(
                    `DELETE FROM artigos_valores_personalizados
                     WHERE referencia = @0 AND codigo_campo = @1`,
                    [referencia, campo.codigo]
                );

                // Inserir novo valor
                await queryRunner.query(`
                    INSERT INTO artigos_valores_personalizados (
                        referencia, codigo_campo,
                        valor_texto, valor_numero, valor_data, 
                        valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9)
                `, [
                    referencia,
                    campo.codigo,
                    ['text', 'textarea', 'email', 'phone', 'url', 'select'].includes(tipo_dados) ? campo.valor : null,
                    ['number', 'decimal'].includes(tipo_dados) ? campo.valor : null,
                    tipo_dados === 'date' ? campo.valor : null,
                    tipo_dados === 'datetime' ? campo.valor : null,
                    tipo_dados === 'boolean' ? campo.valor : null,
                    tipo_dados === 'json' ? JSON.stringify(campo.valor) : null,
                    dataAtual,
                    dataAtual
                ]);
            }
        }
    }

    /**
     * Listar artigos sem código externo (ainda não sincronizados)
     */
    async listarNaoSincronizados(limite: number = 100): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT TOP (@0)
                st.design AS titulo,
                st.ref AS referencia,
                st.u_marcafl AS marca,
                st.u_desctec AS descricao,
                st.epv1 AS preco,
                st.epv5 AS precoPromocional,
                st.peso AS peso,
                st.stock AS stock,
                st.url AS fichaTecnica,
                NULL AS codigoExterno,
                st.familia AS familia,
                st.faminome AS familiaNome,
                st.tabiva AS taxaIVA,
                st.unidade AS unidade,
                st.imagem AS caminhoImagem,
                st.fornecedor AS fornecedor,
                st.fornec AS codigoFornecedor
            FROM st
            WHERE st._id = 0 AND st._site = 1
            ORDER BY st.ref DESC
        `, [limite]);

        return result || [];
    }

    /**
     * VALIDAR campos personalizados
     */
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM artigos_campos_personalizados WHERE ativo = 1`
        );

        for (const campo of campos) {
            const definicao = definicoesCampos.find(
                (d: any) => d.codigo_campo === campo.codigo
            );

            if (!definicao) {
                throw new BadRequestException(
                    `Campo personalizado '${campo.codigo}' não existe ou não está ativo`
                );
            }

            if (definicao.obrigatorio &&
                (campo.valor === null || campo.valor === undefined || campo.valor === '')) {
                throw new BadRequestException(
                    `Campo '${definicao.nome_campo}' é obrigatório`
                );
            }

            if (definicao.validacao && campo.valor) {
                const regex = new RegExp(definicao.validacao);
                if (!regex.test(String(campo.valor))) {
                    throw new BadRequestException(
                        `Valor inválido para '${definicao.nome_campo}'`
                    );
                }
            }

            if (definicao.tipo_dados === 'select' && definicao.opcoes && campo.valor) {
                const opcoes = JSON.parse(definicao.opcoes);
                if (!opcoes.includes(String(campo.valor))) {
                    throw new BadRequestException(
                        `Valor de '${definicao.nome_campo}' deve ser uma das opções: ${opcoes.join(', ')}`
                    );
                }
            }

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
        if (valor === null || valor === undefined) return true;

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
     * Listar configurações de campos personalizados
     */
    async listarCamposPersonalizados(): Promise<any[]> {
        return await this.dataSource.query(`
            SELECT 
                codigo_campo, nome_campo, tipo_dados,
                tabela_destino, campo_destino, campo_chave_relacao,
                tamanho_maximo, obrigatorio, valor_padrao,
                opcoes, validacao, ordem, grupo, visivel, editavel
            FROM artigos_campos_personalizados
            WHERE ativo = 1
            ORDER BY ordem, grupo, nome_campo
        `);
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