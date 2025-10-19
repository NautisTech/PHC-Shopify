import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateEncomendaDto, UpdateEncomendaDto } from './encomendas.dto';

@Injectable()
export class EncomendasService {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Criar encomenda completa (BO + BO2 + BO3 + BI + BI2)
     */
    async criar(dto: CreateEncomendaDto): Promise<any> {
        // Validar linhas
        if (!dto.linhas || dto.linhas.length === 0) {
            throw new BadRequestException('A encomenda deve ter pelo menos uma linha');
        }

        // Obter dados do cliente
        const cliente = await this.obterCliente(dto.clienteId);
        if (!cliente) {
            throw new NotFoundException(`Cliente '${dto.clienteId}' não encontrado`);
        }

        // VALIDAR campos personalizados
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Preparar dados
            const dataEncomenda = dto.dataEncomenda ? new Date(dto.dataEncomenda) : new Date();
            const boano = dataEncomenda.getFullYear();
            const boStamp = this.gerarStamp();

            // Calcular próximo obrano do ano
            const obrano = await this.calcularProximoObrano(queryRunner, boano);

            // Calcular totais
            let totalEuro = 0;
            for (const linha of dto.linhas) {
                totalEuro += linha.qtt * linha.preco;
            }
            const totalEscudos = totalEuro * 200.482;

            // Obter próximo ndos
            const ndosResult = await queryRunner.query(`SELECT ISNULL(MAX(ndos), 0) + 1 AS ndos FROM bo`);
            const ndos = ndosResult[0].ndos;

            // Gerar nmdos
            const nmdos = `Encomenda - ${ndos} - ${dto.clienteId}`;

            // ========================================
            // 1. INSERIR BO (Cabeçalho)
            // ========================================
            await queryRunner.query(`
                INSERT INTO bo (
                    bostamp, ndos, nmdos, obrano, boano, dataobra, no, estab,
                    nome, ncont, nome2, morada, local, codpost, tipo,
                    totaldeb, etotaldeb, moeda, memissao, custo, fref, maquina, origem,
                    ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6, @7,
                    @8, @9, @10, @11, @12, @13, @14,
                    @15, @16, @17, @18, @19, @20, @21, @22,
                    @23, @24, @25, @26, @27, @28
                )
            `, [
                boStamp, ndos, nmdos, obrano, boano, dataEncomenda, cliente.no, 0,
                cliente.Nome, cliente.ncont, '', cliente.morada, cliente.local, cliente.codpost, 'web',
                totalEscudos, totalEuro, 'EURO', 'EURO', 0, '', '', 'BO',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web'
            ]);

            // ========================================
            // 2. INSERIR BO2
            // ========================================
            await queryRunner.query(`
                INSERT INTO bo2 (
                    bo2stamp, morada, local, codpost, telefone, contacto, email, tiposaft,
                    ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6, @7,
                    @8, @9, @10, @11, @12, @13
                )
            `, [
                boStamp, cliente.morada, cliente.local, cliente.codpost,
                cliente.telefone || cliente.tlmvl, cliente.Nome, cliente.email, '',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web'
            ]);

            // ========================================
            // 3. INSERIR BO3
            // ========================================
            await queryRunner.query(`
                INSERT INTO bo3 (
                    bo3stamp, codpais, descpais, codmotiseimp, motiseimp,
                    ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                )
                VALUES (
                    @0, @1, @2, @3, @4,
                    @5, @6, @7, @8, @9, @10
                )
            `, [
                boStamp, 'PT', 'Portugal', '', '',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web'
            ]);

            // ========================================
            // 4. INSERIR BI (Linhas)
            // ========================================
            let lordem = 10000;
            for (const linha of dto.linhas) {
                const biStamp = this.gerarStamp();
                const iva = linha.iva || 23;
                const tabiva = this.getTabIva(iva);
                const stns = linha.stns ? 1 : 0;

                // Buscar dados do artigo (design, cpoc, familia, etc.)
                const artigo = await this.buscarDadosArtigo(queryRunner, linha.ref);
                const design = linha.design || artigo?.design || linha.ref;

                // Converter ref para número se necessário
                const refNumerico = isNaN(Number(linha.ref)) ? 0 : Number(linha.ref);

                await queryRunner.query(`
                    INSERT INTO bi (
                        bistamp, bostamp, ndos, nmdos, obrano, rdata, dataobra,
                        no, estab, nome, morada, local, codpost, ref, design, stns, qtt,
                        iva, tabiva, armazem, debito, edebito, debitoori, edebitoori,
                        ttdeb, ettdeb, lordem, cpoc, familia, unidade,
                        usr1, usr2, usr3, usr4, usr5, usr6,
                        ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                    )
                    VALUES (
                        @0, @1, @2, @3, @4, @5, @6, @7,
                        @8, @9, @10, @11, @12, @13, @14, @15, @16, @17,
                        @18, @19, @20, @21, @22, @23, @24,
                        @25, @26, @27, @28, @29, @30,
                        @31, @32, @33, @34, @35, @36,
                        @37, @38, @39, @40, @41
                    )
                `, [
                    biStamp, boStamp, ndos, nmdos, obrano, dataEncomenda, dataEncomenda,
                    cliente.no, 0, cliente.Nome, cliente.morada, cliente.local, cliente.codpost,
                    refNumerico, design, stns, linha.qtt,
                    iva, tabiva, 1, linha.preco * 200.482, linha.preco, linha.preco * 200.482, linha.preco,
                    linha.qtt * linha.preco * 200.482, linha.qtt * linha.preco, lordem,
                    artigo?.cpoc || 0, artigo?.familia || 0, artigo?.unidade || '',
                    artigo?.usr1 || '', artigo?.usr2 || '', artigo?.usr3 || '',
                    artigo?.usr4 || '', artigo?.usr5 || '', artigo?.usr6 || '',
                    dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web',
                    dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web'
                ]);

                lordem++;
            }

            // ========================================
            // 5. INSERIR BI2
            // ========================================
            await queryRunner.query(`
                INSERT INTO bi2 (
                    bi2stamp, bostamp, morada, local, codpost, telefone, email,
                    ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6,
                    @7, @8, @9, @10, @11, @12
                )
            `, [
                boStamp, boStamp, cliente.morada, cliente.local, cliente.codpost,
                cliente.telefone || cliente.tlmvl, cliente.email,
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web',
                dataEncomenda, dataEncomenda.toTimeString().split(' ')[0], 'web'
            ]);

            // ========================================
            // 6. PROCESSAR CAMPOS PERSONALIZADOS
            // ========================================
            if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
                await this.processarCamposPersonalizados(
                    queryRunner,
                    ndos,
                    boStamp,
                    dto.camposPersonalizados
                );
            }

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                encomendaId: ndos,
                bostamp: boStamp,
                obrano: obrano,
                boano: boano,
                nmdos: nmdos,
                total: totalEuro,
                mensagem: 'Encomenda criada com sucesso'
            };

        } catch (error) {
            // Log do erro completo para debug
            console.error('Erro completo ao criar encomenda:', error);

            // Tentar fazer rollback apenas se a transação ainda estiver ativa
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }

            throw new BadRequestException(
                `Erro ao criar encomenda: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Atualizar encomenda
     */
    async atualizar(id: number, dto: UpdateEncomendaDto): Promise<any> {
        // Verificar se encomenda existe
        const encomenda = await this.obterPorId(id);
        if (!encomenda) {
            throw new NotFoundException('Encomenda não encontrada');
        }

        // VALIDAR campos personalizados
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const dataAtual = new Date();
            const bostamp = encomenda.bostamp;

            // ========================================
            // ATUALIZAR LINHAS (se fornecidas)
            // ========================================
            if (dto.linhas && dto.linhas.length > 0) {
                // Calcular novos totais
                let totalEuro = 0;
                for (const linha of dto.linhas) {
                    totalEuro += linha.qtt * linha.preco;
                }
                const totalEscudos = totalEuro * 200.482;

                // Deletar linhas antigas
                await queryRunner.query(`DELETE FROM bi WHERE bostamp = @0`, [bostamp]);
                await queryRunner.query(`DELETE FROM bi2 WHERE bostamp = @0`, [bostamp]);

                // Inserir novas linhas
                let lordem = 10000;
                for (const linha of dto.linhas) {
                    const biStamp = this.gerarStamp();
                    const iva = linha.iva || 23;
                    const tabiva = this.getTabIva(iva);
                    const stns = linha.stns ? 1 : 0;

                    const artigo = await this.buscarDadosArtigo(queryRunner, linha.ref);
                    const design = linha.design || artigo?.design || linha.ref;

                    await queryRunner.query(`
                        INSERT INTO bi (
                            bistamp, bostamp, ndos, nmdos, obrano, rdata, dataobra,
                            no, estab, nome, morada, local, codpost, ref, design, stns, qtt,
                            iva, tabiva, armazem, debito, edebito, debitoori, edebitoori,
                            ttdeb, ettdeb, lordem, cpoc, familia, unidade,
                            usr1, usr2, usr3, usr4, usr5, usr6,
                            ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                        )
                        SELECT 
                            @0, @1, bo.ndos, bo.nmdos, bo.obrano, bo.dataobra, bo.dataobra,
                            bo.no, 0, bo.nome, bo.morada, bo.local, bo.codpost, @2, @3, @4, @5,
                            @6, @7, 1, @8, @9, @10, @11,
                            @12, @13, @14, @15, @16, @17,
                            @18, @19, @20, @21, @22, @23,
                            @24, @25, @26, @27, @28, @29
                        FROM bo
                        WHERE bo.bostamp = @1
                    `, [
                        biStamp, bostamp, linha.ref, design, stns, linha.qtt,
                        iva, tabiva, linha.preco * 200.482, linha.preco, linha.preco * 200.482, linha.preco,
                        linha.qtt * linha.preco * 200.482, linha.qtt * linha.preco, lordem,
                        artigo?.cpoc || '', artigo?.familia || '', artigo?.unidade || '',
                        artigo?.usr1 || '', artigo?.usr2 || '', artigo?.usr3 || '',
                        artigo?.usr4 || '', artigo?.usr5 || '', artigo?.usr6 || '',
                        dataAtual, dataAtual.toTimeString().split(' ')[0], 'web',
                        dataAtual, dataAtual.toTimeString().split(' ')[0], 'web'
                    ]);

                    lordem++;
                }

                // Reinserir BI2
                await queryRunner.query(`
                    INSERT INTO bi2 (
                        bi2stamp, bostamp, morada, local, codpost, telefone, email,
                        ousrdata, ousrhora, ousrinis, usrdata, usrhora, usrinis
                    )
                    SELECT 
                        @0, @0, bo.morada, bo.local, bo.codpost, bo2.telefone, bo2.email,
                        @1, @2, @3, @4, @5, @6
                    FROM bo
                    LEFT JOIN bo2 ON bo2.bo2stamp = bo.bostamp
                    WHERE bo.bostamp = @0
                `, [
                    bostamp,
                    dataAtual, dataAtual.toTimeString().split(' ')[0], 'web',
                    dataAtual, dataAtual.toTimeString().split(' ')[0], 'web'
                ]);

                // Atualizar totais no cabeçalho
                await queryRunner.query(`
                    UPDATE bo
                    SET totaldeb = @0, etotaldeb = @1,
                        ousrdata = @2, ousrhora = @3, ousrinis = @4
                    WHERE bostamp = @5
                `, [
                    totalEscudos, totalEuro,
                    dataAtual, dataAtual.toTimeString().split(' ')[0], 'web',
                    bostamp
                ]);
            }

            // ========================================
            // PROCESSAR CAMPOS PERSONALIZADOS
            // ========================================
            if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
                await this.processarCamposPersonalizados(
                    queryRunner,
                    id,
                    bostamp,
                    dto.camposPersonalizados
                );
            }

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                mensagem: 'Encomenda atualizada com sucesso'
            };

        } catch (error) {
            // Log do erro completo para debug
            console.error('Erro completo ao atualizar encomenda:', error);

            // Tentar fazer rollback apenas se a transação ainda estiver ativa
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }

            throw new BadRequestException(
                `Erro ao atualizar encomenda: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Obter encomenda por ID
     */
    async obterPorId(id: number): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT 
                bo.ndos, bo.nmdos, bo.obrano, bo.boano, bo.dataobra,
                bo.no AS clienteNo, bo.nome AS clienteNome, bo.ncont AS clienteNif,
                bo.etotaldeb AS total, bo.moeda, bo.bostamp
            FROM bo
            WHERE bo.ndos = @0
        `, [id]);

        if (!result || result.length === 0) {
            throw new NotFoundException('Encomenda não encontrada');
        }

        const encomenda = result[0];

        // Buscar linhas
        encomenda.linhas = await this.dataSource.query(`
            SELECT 
                bi.ref, bi.design, bi.qtt, bi.edebito AS preco,
                bi.iva, bi.ettdeb AS total, bi.stns
            FROM bi
            WHERE bi.bostamp = @0
            ORDER BY bi.lordem
        `, [encomenda.bostamp]);

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
            FROM encomendas_campos_personalizados cp
            LEFT JOIN encomendas_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo AND vp.encomenda_ndos = @0
            WHERE cp.ativo = 1 AND cp.tabela_destino IS NULL
            ORDER BY cp.ordem
        `, [id]);

        // Buscar configuração de campos externos
        const camposExternosConfig = await this.dataSource.query(`
            SELECT 
                codigo_campo, nome_campo, tipo_dados, grupo,
                tabela_destino, campo_destino, campo_chave_relacao
            FROM encomendas_campos_personalizados
            WHERE ativo = 1 AND tabela_destino IS NOT NULL
            ORDER BY ordem
        `);

        // Buscar valores dos campos externos
        const camposExternos: any[] = [];
        for (const config of camposExternosConfig) {
            try {
                const valor = await this.buscarValorCampoExterno(
                    id,
                    encomenda.bostamp,
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

        encomenda.campos_personalizados = [...camposGenericos, ...camposExternos];

        return encomenda;
    }

    /**
     * Listar encomendas com paginação
     */
    async listar(
        pagina: number = 1,
        limite: number = 50,
        busca?: string
    ): Promise<any> {
        const offset = (pagina - 1) * limite;

        // Construir WHERE clause
        let whereClause = "origem = 'BO'";
        const params: any[] = [];
        let paramIndex = 0;

        if (busca) {
            whereClause += ` AND (
                bo.nmdos LIKE @${paramIndex} OR 
                bo.nome LIKE @${paramIndex} OR 
                bo.ncont LIKE @${paramIndex} OR
                CAST(bo.obrano AS NVARCHAR(10)) LIKE @${paramIndex}
            )`;
            params.push(`%${busca}%`);
            paramIndex++;
        }

        // Contar total
        const totalResult = await this.dataSource.query(
            `SELECT COUNT(*) as total FROM bo WHERE ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // Buscar dados paginados
        params.push(offset);
        params.push(limite);

        const dados = await this.dataSource.query(`
            SELECT 
                bo.ndos, bo.nmdos, bo.obrano, bo.boano, bo.dataobra,
                bo.no AS clienteNo, bo.nome AS clienteNome, bo.ncont AS clienteNif,
                bo.etotaldeb AS total, bo.moeda
            FROM bo
            WHERE ${whereClause}
            ORDER BY bo.dataobra DESC, bo.ndos DESC
            OFFSET @${paramIndex} ROWS
            FETCH NEXT @${paramIndex + 1} ROWS ONLY
        `, params);

        return {
            total,
            pagina,
            limite,
            dados
        };
    }

    /**
     * Obter cliente (por ID PHC ou ID externo)
     */
    private async obterCliente(clienteId: string): Promise<any> {
        // Tentar buscar por ID numérico (PHC)
        if (!isNaN(Number(clienteId))) {
            const result = await this.dataSource.query(`
                SELECT no, Nome, ncont, morada, local, codpost, telefone, email, tlmvl
                FROM cl 
                WHERE no = @0
            `, [Number(clienteId)]);

            if (result && result.length > 0) {
                return result[0];
            }
        }

        // Buscar por código externo
        const result = await this.dataSource.query(`
            SELECT cl.no, cl.Nome, cl.ncont, cl.morada, cl.local, cl.codpost, 
                   cl.telefone, cl.email, cl.tlmvl
            FROM cl
            WHERE cl._id = @0
        `, [clienteId]);

        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * Calcular próximo obrano do ano
     */
    private async calcularProximoObrano(queryRunner: any, ano: number): Promise<number> {
        const result = await queryRunner.query(
            `SELECT ISNULL(MAX(obrano), 0) + 1 AS obrano FROM bo WHERE boano = @0`,
            [ano]
        );
        return result[0].obrano;
    }

    /**
     * Buscar dados do artigo
     */
    private async buscarDadosArtigo(queryRunner: any, ref: string): Promise<any> {
        const result = await queryRunner.query(
            `SELECT design, cpoc, familia, unidade, usr1, usr2, usr3, usr4, usr5, usr6 
             FROM st WHERE ref = @0`,
            [ref]
        );
        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * Obter tabiva baseado na taxa de IVA
     */
    private getTabIva(iva: number): number {
        if (iva === 6) return 1;
        if (iva === 13) return 3;
        return 2; // 23% ou default
    }

    /**
     * Processar campos personalizados
     */
    private async processarCamposPersonalizados(
        queryRunner: any,
        ndos: number,
        bostamp: string,
        campos: any[]
    ): Promise<void> {
        const dataAtual = new Date();

        for (const campo of campos) {
            const config = await queryRunner.query(
                `SELECT tabela_destino, campo_destino, campo_chave_relacao, tipo_dados
                 FROM encomendas_campos_personalizados
                 WHERE codigo_campo = @0 AND ativo = 1`,
                [campo.codigo]
            );

            if (!config || config.length === 0) continue;

            const { tabela_destino, campo_destino, campo_chave_relacao, tipo_dados } = config[0];

            if (tabela_destino && campo_destino) {
                const valorChave = ['bostamp', 'bo2stamp', 'bo3stamp'].includes(campo_chave_relacao)
                    ? bostamp
                    : ndos;

                const existe = await queryRunner.query(
                    `SELECT COUNT(*) as count FROM ${tabela_destino} 
                     WHERE ${campo_chave_relacao || 'ndos'} = @0`,
                    [valorChave]
                );

                if (existe[0].count > 0) {
                    await queryRunner.query(
                        `UPDATE ${tabela_destino} 
                         SET ${campo_destino} = @0 
                         WHERE ${campo_chave_relacao || 'ndos'} = @1`,
                        [campo.valor, valorChave]
                    );
                } else {
                    await queryRunner.query(
                        `INSERT INTO ${tabela_destino} (${campo_chave_relacao || 'ndos'}, ${campo_destino})
                         VALUES (@0, @1)`,
                        [valorChave, campo.valor]
                    );
                }
            } else {
                await queryRunner.query(
                    `DELETE FROM encomendas_valores_personalizados
                     WHERE encomenda_ndos = @0 AND codigo_campo = @1`,
                    [ndos, campo.codigo]
                );

                await queryRunner.query(`
                    INSERT INTO encomendas_valores_personalizados (
                        encomenda_ndos, codigo_campo,
                        valor_texto, valor_numero, valor_data, 
                        valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9)
                `, [
                    ndos, campo.codigo,
                    ['text', 'textarea', 'email', 'phone', 'url', 'select'].includes(tipo_dados) ? campo.valor : null,
                    ['number', 'decimal'].includes(tipo_dados) ? campo.valor : null,
                    tipo_dados === 'date' ? campo.valor : null,
                    tipo_dados === 'datetime' ? campo.valor : null,
                    tipo_dados === 'boolean' ? campo.valor : null,
                    tipo_dados === 'json' ? JSON.stringify(campo.valor) : null,
                    dataAtual, dataAtual
                ]);
            }
        }
    }

    /**
     * Buscar valor de campo em tabela externa
     */
    private async buscarValorCampoExterno(
        ndos: number,
        bostamp: string,
        tabelaDestino: string,
        campoDestino: string,
        campoChave: string
    ): Promise<any> {
        const valorChave = ['bostamp', 'bo2stamp', 'bo3stamp'].includes(campoChave)
            ? bostamp
            : ndos;

        const result = await this.dataSource.query(
            `SELECT ${campoDestino} AS valor 
             FROM ${tabelaDestino} 
             WHERE ${campoChave || 'ndos'} = @0`,
            [valorChave]
        );

        return result[0]?.valor || null;
    }

    /**
     * VALIDAR campos personalizados
     */
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM encomendas_campos_personalizados WHERE ativo = 1`
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
                        `Valor de '${definicao.nome_campo}' deve ser: ${opcoes.join(', ')}`
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
            FROM encomendas_campos_personalizados
            WHERE ativo = 1
            ORDER BY ordem, grupo, nome_campo
        `);
    }

    /**
     * Obter configuração de um campo específico
     */
    async obterConfiguracaoCampo(codigoCampo: string): Promise<any> {
        const result = await this.dataSource.query(
            `SELECT * FROM encomendas_campos_personalizados 
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

    /**
     * Gerar stamp (GUID de 25 caracteres)
     */
    private gerarStamp(): string {
        const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        return guid.replace(/-/g, '').substring(0, 25);
    }
}