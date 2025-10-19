import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ClientesService {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Criar cliente completo
     * - Insere em CL, CL2
     * - Guarda campos personalizados (genéricos ou em tabelas específicas)
     */
    async criar(dto: CreateClienteDto): Promise<any> {
        // Se NÃO tiver NIF, retorna o Consumidor Final
        if (!dto.nif || dto.nif.trim() === '') {
            const consumidorFinal = await this.obterConsumidorFinal();
            return {
                status: 'SUCCESS',
                clienteId: consumidorFinal.no,
                clstamp: consumidorFinal.clstamp,
                mensagem: 'Atribuído ao cliente Consumidor Final',
                isConsumidorFinal: true
            };
        }

        // Verificar se NIF já existe
        const clienteExistente = await this.obterPorNif(dto.nif);
        if (clienteExistente) {
            throw new BadRequestException('Já existe um cliente com este NIF');
        }

        // VALIDAR campos personalizados
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Gerar clstamp (GUID de 25 caracteres)
            const clStamp = this.gerarStamp();
            const dataAtual = new Date();

            // Buscar descrição do país
            const paisResult = await queryRunner.query(
                `SELECT nome FROM paises WHERE nomeabrv = @0`,
                [dto.pais || 'PT']
            );
            const descPais = paisResult[0]?.nome || 'Portugal';

            // ========================================
            // 1. INSERIR NA TABELA CL
            // ========================================
            const insertClResult = await queryRunner.query(`
                INSERT INTO cl (
                    Nome, ncont, MOEDA, telefone, tlmvl, morada, Local, codpost, email,
                    PAIS, descarga, obs, clstamp, usrdata, usrinis, usrhora,
                    ousrdata, ousrinis, ousrhora, VENCIMENTO, ALIMITE
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12,
                    @13, @14, @15, @16, @17, @18, @19, @20
                );
                SELECT SCOPE_IDENTITY() AS clienteNo;
            `, [
                dto.nome,
                dto.nif,
                dto.moeda || 'EUR',
                dto.telefone || null,
                dto.telemovel || null,
                dto.morada || null,
                dto.local || null,
                dto.codigoPostal || null,
                dto.email || null,
                1 || null,
                dto.descarga || null,
                dto.observacoes || null,
                clStamp,
                dataAtual,
                'web',
                dataAtual.toTimeString().split(' ')[0],
                dataAtual,
                'web',
                dataAtual.toTimeString().split(' ')[0],
                0, // VENCIMENTO
                0  // ALIMITE
            ]);

            const clienteNo = insertClResult[0].clienteNo;

            // ========================================
            // 2. INSERIR NA TABELA CL2
            // ========================================
            await queryRunner.query(`
                INSERT INTO cl2 (
                    cl2stamp, codpais, descpais, usrdata, usrinis, usrhora,
                    ousrdata, ousrinis, ousrhora
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6, @7, @8
                )
            `, [
                clStamp,
                dto.pais || 'PT',
                descPais,
                dataAtual,
                'web',
                dataAtual.toTimeString().split(' ')[0],
                dataAtual,
                'web',
                dataAtual.toTimeString().split(' ')[0]
            ]);

            // ========================================
            // 3. PROCESSAR CAMPOS PERSONALIZADOS
            // ========================================
            if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
                await this.processarCamposPersonalizados(
                    queryRunner,
                    clienteNo,
                    clStamp,
                    dto.camposPersonalizados
                );
            }

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                clienteId: clienteNo,
                clstamp: clStamp,
                mensagem: 'Cliente criado com sucesso'
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(
                `Erro ao criar cliente: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Atualizar cliente
     */
    async atualizar(id: number, dto: UpdateClienteDto): Promise<any> {
        // Verificar se cliente existe
        const clienteExiste = await this.obterPorId(id);
        if (!clienteExiste) {
            throw new NotFoundException('Cliente não encontrado');
        }

        // Se alterar NIF, verificar duplicação
        if (dto.nif) {
            const clienteComNif = await this.obterPorNif(dto.nif);
            if (clienteComNif && clienteComNif.no !== id) {
                throw new BadRequestException('Já existe outro cliente com este NIF');
            }
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

            // Obter clstamp
            const clStampResult = await queryRunner.query(
                `SELECT clstamp FROM cl WHERE no = @0`,
                [id]
            );
            const clStamp = clStampResult[0].clstamp;

            // ========================================
            // 1. ATUALIZAR TABELA CL
            // ========================================
            const setClauses: string[] = [];
            const params: any[] = [];
            let paramIndex = 0;

            if (dto.nome !== undefined) {
                setClauses.push(`Nome = @${paramIndex++}`);
                params.push(dto.nome);
            }
            if (dto.nif !== undefined) {
                setClauses.push(`ncont = @${paramIndex++}`);
                params.push(dto.nif);
            }
            if (dto.moeda !== undefined) {
                setClauses.push(`MOEDA = @${paramIndex++}`);
                params.push(dto.moeda);
            }
            if (dto.telefone !== undefined) {
                setClauses.push(`telefone = @${paramIndex++}`);
                params.push(dto.telefone);
            }
            if (dto.telemovel !== undefined) {
                setClauses.push(`tlmvl = @${paramIndex++}`);
                params.push(dto.telemovel);
            }
            if (dto.morada !== undefined) {
                setClauses.push(`morada = @${paramIndex++}`);
                params.push(dto.morada);
            }
            if (dto.local !== undefined) {
                setClauses.push(`Local = @${paramIndex++}`);
                params.push(dto.local);
            }
            if (dto.codigoPostal !== undefined) {
                setClauses.push(`codpost = @${paramIndex++}`);
                params.push(dto.codigoPostal);
            }
            if (dto.email !== undefined) {
                setClauses.push(`email = @${paramIndex++}`);
                params.push(dto.email);
            }
            if (dto.pais !== undefined) {
                setClauses.push(`PAIS = @${paramIndex++}`);
                params.push(dto.pais);
            }
            if (dto.descarga !== undefined) {
                setClauses.push(`descarga = @${paramIndex++}`);
                params.push(dto.descarga);
            }
            if (dto.observacoes !== undefined) {
                setClauses.push(`obs = @${paramIndex++}`);
                params.push(dto.observacoes);
            }

            // Adicionar campos de auditoria
            setClauses.push(`ousrdata = @${paramIndex++}`);
            params.push(dataAtual);
            setClauses.push(`ousrinis = @${paramIndex++}`);
            params.push('web');
            setClauses.push(`ousrhora = @${paramIndex++}`);
            params.push(dataAtual.toTimeString().split(' ')[0]);

            // WHERE
            params.push(id);

            if (setClauses.length > 0) {
                await queryRunner.query(
                    `UPDATE cl SET ${setClauses.join(', ')} WHERE no = @${paramIndex}`,
                    params
                );
            }

            // ========================================
            // 2. ATUALIZAR CL2 se país foi alterado
            // ========================================
            if (dto.pais !== undefined) {
                const paisResult = await queryRunner.query(
                    `SELECT nome FROM paises WHERE nomeabrv = @0`,
                    [dto.pais]
                );
                const descPais = paisResult[0]?.nome || dto.pais;

                await queryRunner.query(`
                    UPDATE cl2
                    SET codpais = @0, descpais = @1,
                        ousrdata = @2, ousrinis = @3, ousrhora = @4
                    WHERE cl2stamp = @5
                `, [
                    dto.pais,
                    descPais,
                    dataAtual,
                    'web',
                    dataAtual.toTimeString().split(' ')[0],
                    clStamp
                ]);
            }

            // ========================================
            // 3. PROCESSAR CAMPOS PERSONALIZADOS
            // ========================================
            if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
                await this.processarCamposPersonalizados(
                    queryRunner,
                    id,
                    clStamp,
                    dto.camposPersonalizados
                );
            }

            await queryRunner.commitTransaction();

            return {
                status: 'SUCCESS',
                clienteId: id,
                clstamp: clStamp,
                mensagem: 'Cliente atualizado com sucesso'
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(
                `Erro ao atualizar cliente: ${error.message}`
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Processar campos personalizados
     * - Verifica se vai para tabela específica ou genérica
     * - Guarda no local correto
     */
    private async processarCamposPersonalizados(
        queryRunner: any,
        clienteNo: number,
        clStamp: string,
        campos: any[]
    ): Promise<void> {
        for (const campo of campos) {
            // Buscar configuração do campo
            const config = await queryRunner.query(
                `SELECT tabela_destino, campo_destino, campo_chave_relacao, tipo_dados
                 FROM cl_campos_personalizados
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
                const valorChave = (campo_chave_relacao === 'clstamp' || campo_chave_relacao === 'cl2stamp')
                    ? clStamp
                    : clienteNo;

                // Verificar se registro existe
                const existe = await queryRunner.query(
                    `SELECT COUNT(*) as count FROM ${tabela_destino} 
                     WHERE ${campo_chave_relacao || 'no'} = @0`,
                    [valorChave]
                );

                if (existe[0].count > 0) {
                    // UPDATE
                    await queryRunner.query(
                        `UPDATE ${tabela_destino} 
                         SET ${campo_destino} = @0 
                         WHERE ${campo_chave_relacao || 'no'} = @1`,
                        [campo.valor, valorChave]
                    );
                } else {
                    // INSERT
                    await queryRunner.query(
                        `INSERT INTO ${tabela_destino} (${campo_chave_relacao || 'no'}, ${campo_destino})
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
                    `DELETE FROM cl_valores_personalizados
                     WHERE cliente_no = @0 AND codigo_campo = @1`,
                    [clienteNo, campo.codigo]
                );

                // Inserir novo valor
                const dataAtual = new Date();
                await queryRunner.query(`
                    INSERT INTO cl_valores_personalizados (
                        cliente_no, codigo_campo,
                        valor_texto, valor_numero, valor_data, 
                        valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9)
                `, [
                    clienteNo,
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
     * Obter cliente por ID
     */
    async obterPorId(id: number): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT 
                cl.no, cl.Nome, cl.ncont, cl.MOEDA, cl.telefone, cl.tlmvl,
                cl.morada, cl.Local, cl.codpost, cl.email, cl.PAIS,
                cl.descarga, cl.obs, cl.VENCIMENTO, cl.ALIMITE, cl.clstamp,
                cl.usrdata, cl.usrinis, cl.usrhora,
                cl.ousrdata, cl.ousrinis, cl.ousrhora,
                cl2.codpais, cl2.descpais
            FROM cl
            LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
            WHERE cl.no = @0
        `, [id]);

        if (!result || result.length === 0) {
            throw new NotFoundException('Cliente não encontrado');
        }

        const cliente = result[0];

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
            FROM cl_campos_personalizados cp
            LEFT JOIN cl_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo AND vp.cliente_no = @0
            WHERE cp.ativo = 1 AND cp.tabela_destino IS NULL
            ORDER BY cp.ordem
        `, [id]);

        // Buscar configuração de campos externos
        const camposExternosConfig = await this.dataSource.query(`
            SELECT 
                codigo_campo, nome_campo, tipo_dados, grupo,
                tabela_destino, campo_destino, campo_chave_relacao
            FROM cl_campos_personalizados
            WHERE ativo = 1 AND tabela_destino IS NOT NULL
            ORDER BY ordem
        `);

        // Buscar valores dos campos externos
        const camposExternos: any[] = [];
        for (const config of camposExternosConfig) {
            try {
                const valor = await this.buscarValorCampoExterno(
                    id,
                    cliente.clstamp,
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

        cliente.campos_personalizados = [...camposGenericos, ...camposExternos];

        return cliente;
    }

    /**
     * Buscar valor de campo em tabela externa
     */
    private async buscarValorCampoExterno(
        clienteNo: number,
        clstamp: string,
        tabelaDestino: string,
        campoDestino: string,
        campoChave: string
    ): Promise<any> {
        const valorChave = (campoChave === 'clstamp' || campoChave === 'cl2stamp')
            ? clstamp
            : clienteNo;

        const result = await this.dataSource.query(
            `SELECT ${campoDestino} AS valor 
             FROM ${tabelaDestino} 
             WHERE ${campoChave || 'no'} = @0`,
            [valorChave]
        );

        return result[0]?.valor || null;
    }

    /**
     * Obter cliente por NIF
     */
    async obterPorNif(nif: string): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT cl.no, cl.Nome, cl.ncont, cl.clstamp, cl.email
            FROM cl
            WHERE cl.ncont = @0
        `, [nif]);

        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * Listar clientes com paginação
     */
    async listar(
        pagina: number = 1,
        limite: number = 50,
        procura?: string
    ): Promise<any> {
        const offset = (pagina - 1) * limite;

        // Construir WHERE clause
        let whereClause = '(cl.inactivo = 0 OR cl.inactivo IS NULL)';
        const params: any[] = [];
        let paramIndex = 0;

        if (procura) {
            whereClause += ` AND (
                cl.Nome LIKE @${paramIndex} OR 
                cl.ncont LIKE @${paramIndex} OR 
                cl.email LIKE @${paramIndex} OR
                CAST(cl.no AS NVARCHAR) LIKE @${paramIndex}
            )`;
            params.push(`%${procura}%`);
            paramIndex++;
        }

        // Contar total
        const totalResult = await this.dataSource.query(
            `SELECT COUNT(*) as total FROM cl WHERE ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // Buscar dados paginados
        params.push(offset);
        params.push(limite);

        const dados = await this.dataSource.query(`
            SELECT 
                cl.no, cl.Nome, cl.ncont AS nif, cl.MOEDA AS moeda,
                cl.telefone, cl.tlmvl AS telemovel, cl.morada,
                cl.Local AS localidade, cl.codpost AS codigoPostal,
                cl.email, cl.PAIS AS pais, cl.VENCIMENTO AS diasVencimento,
                cl.ALIMITE AS limiteCredito, cl.clstamp,
                cl.usrdata AS dataCriacao, cl.ousrdata AS dataAtualizacao,
                cl2.codpais AS codigoPais, cl2.descpais AS nomePais,
                CASE WHEN cl.inactivo = 1 THEN 0 ELSE 1 END AS ativo
            FROM cl
            LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
            WHERE ${whereClause}
            ORDER BY cl.no DESC
            OFFSET @${paramIndex} ROWS
            FETCH NEXT @${paramIndex + 1} ROWS ONLY
        `, params);

        return {
            total,
            pagina,
            limite,
            totalPaginas: Math.ceil(total / limite),
            dados
        };
    }

    /**
     * Obter Consumidor Final
     */
    private async obterConsumidorFinal(): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT TOP 1 no, clstamp, Nome 
            FROM cl 
            WHERE Nome LIKE '%Consumidor Final%' OR ncont = '999999990'
            ORDER BY no ASC
        `);

        if (!result || result.length === 0) {
            throw new NotFoundException('Cliente Consumidor Final não encontrado');
        }

        return result[0];
    }

    /**
     * Validar campos personalizados
     */
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM cl_campos_personalizados WHERE ativo = 1`
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
            FROM cl_campos_personalizados
            WHERE ativo = 1
            ORDER BY ordem, grupo, nome_campo
        `);
    }

    /**
     * Obter configuração de um campo específico
     */
    async obterConfiguracaoCampo(codigoCampo: string): Promise<any> {
        const result = await this.dataSource.query(
            `SELECT * FROM cl_campos_personalizados 
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