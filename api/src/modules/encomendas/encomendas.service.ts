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
     * - Valida se campos personalizados existem em encomendas_campos_personalizados
     * - SP decide onde guardar cada campo (bo, bo2, bo3 ou tabela genérica)
     */
    async criar(dto: CreateEncomendaDto): Promise<any> {
        // Obter dados do cliente (por ID PHC ou código externo)
        const cliente = await this.obterCliente(dto.clienteId);
        if (!cliente) {
            throw new NotFoundException(`Cliente '${dto.clienteId}' não encontrado`);
        }

        // VALIDAR campos personalizados se existirem
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        // Preparar dados para o SP
        const linhasJson = JSON.stringify(dto.linhas);
        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

        const dataEncomenda = dto.dataEncomenda
            ? new Date(dto.dataEncomenda)
            : new Date();

        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_CriarEncomendaCompleta]
                @ClienteNo = @0,
                @ClienteId = @1,
                @DataEncomenda = @2,
                @Linhas = @3,
                @CamposPersonalizados = @4`,
            [
                cliente.no,
                dto.clienteId,
                dataEncomenda,
                linhasJson,
                camposJson
            ]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return result[0];
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

        const linhasJson = dto.linhas ? JSON.stringify(dto.linhas) : null;
        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_AtualizarEncomendaCompleta]
                @Ndos = @0,
                @Linhas = @1,
                @CamposPersonalizados = @2`,
            [id, linhasJson, camposJson]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return result[0];
    }

    /**
     * Obter encomenda por ID (ndos)
     * - Busca dados de BO, BO2, BO3, BI
     * - Busca campos da tabela genérica
     * - Busca campos das tabelas externas (bo, bo2, bo3, etc.)
     */
    async obterPorId(id: number): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterEncomendaPorId] @Ndos = @0`,
            [id]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException('Encomenda não encontrada');
        }

        const encomenda = result[0];

        // Processar campos externos (buscar valores das tabelas específicas)
        if (encomenda.campos_personalizados_externos) {
            const camposExternos = JSON.parse(encomenda.campos_personalizados_externos);

            // Para cada campo externo, buscar o valor real da tabela
            for (const campo of camposExternos) {
                if (campo.tabela_destino && campo.campo_destino) {
                    try {
                        const valorExterno = await this.buscarValorCampoExterno(
                            id,
                            encomenda.bostamp,
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

            encomenda.campos_personalizados_externos = JSON.stringify(camposExternos);
        }

        // Combinar campos genéricos + externos
        const camposGenericos = encomenda.campos_personalizados_genericos
            ? JSON.parse(encomenda.campos_personalizados_genericos)
            : [];
        const camposExternos = encomenda.campos_personalizados_externos
            ? JSON.parse(encomenda.campos_personalizados_externos)
            : [];

        encomenda.campos_personalizados = [...camposGenericos, ...camposExternos];

        // Limpar propriedades temporárias
        delete encomenda.campos_personalizados_genericos;
        delete encomenda.campos_personalizados_externos;

        return encomenda;
    }

    /**
     * Buscar valor de um campo numa tabela externa
     * Exemplo: buscar bo2.transportadora onde bo2.bo2stamp = 'abc123'
     */
    private async buscarValorCampoExterno(
        ndos: number,
        bostamp: string,
        tabelaDestino: string,
        campoDestino: string,
        codigoCampo: string
    ): Promise<any> {
        // Obter qual FK usar (ndos, bostamp, bo2stamp, bo3stamp, etc.)
        const config = await this.dataSource.query(
            `SELECT campo_chave_relacao FROM encomendas_campos_personalizados 
             WHERE codigo_campo = @0`,
            [codigoCampo]
        );

        const campoChave = config[0]?.campo_chave_relacao || 'encomenda_ndos';

        // Determinar o valor da chave
        const valorChave = (campoChave === 'bostamp' || campoChave === 'bo2stamp' || campoChave === 'bo3stamp')
            ? bostamp
            : ndos;

        // Query dinâmica para buscar o valor
        const sql = `
            SELECT ${campoDestino} AS valor
            FROM ${tabelaDestino}
            WHERE ${campoChave} = @0
        `;

        const result = await this.dataSource.query(sql, [valorChave]);
        return result[0]?.valor || null;
    }

    /**
     * Listar encomendas com paginação
     */
    async listar(
        pagina: number = 1,
        limite: number = 50,
        busca?: string
    ): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ListarEncomendas]
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
     * Obter cliente (por ID PHC ou ID externo)
     */
    private async obterCliente(clienteId: string): Promise<any> {
        // Tentar buscar por ID numérico (PHC)
        if (!isNaN(Number(clienteId))) {
            const result = await this.dataSource.query(
                `SELECT no, Nome, ncont, morada, local, codpost, telefone, email, tlmvl
                 FROM cl 
                 WHERE no = @0`,
                [Number(clienteId)]
            );

            if (result && result.length > 0) {
                return result[0];
            }
        }

        // Buscar por código externo (Shopify, etc.)
        const result = await this.dataSource.query(
            `SELECT cl.no, cl.Nome, cl.ncont, cl.morada, cl.local, cl.codpost, 
                    cl.telefone, cl.email, cl.tlmvl
             FROM cl
             INNER JOIN clientes_codigo_externo ce ON ce.cliente_no = cl.no
             WHERE ce.codigo_externo = @0`,
            [clienteId]
        );

        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * VALIDAR se os campos enviados existem na configuração
     */
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        // Buscar TODAS as configurações de campos ativos
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM encomendas_campos_personalizados WHERE ativo = 1`
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
                        `Valor de '${definicao.nome_campo}' deve ser: ${opcoes.join(', ')}`
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
     * Listar configurações de campos personalizados
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
             FROM encomendas_campos_personalizados
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
}