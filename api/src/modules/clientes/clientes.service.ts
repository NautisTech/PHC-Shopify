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


    // Criar cliente
    // - Valida se campos personalizados existem em cl_campos_personalizados
    // - SP decide onde guardar cada campo(cl_info, cl2 ou tabela genérica)
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

        // VALIDAR se os campos enviados existem na configuração
        if (dto.camposPersonalizados && dto.camposPersonalizados.length > 0) {
            await this.validarCamposPersonalizados(dto.camposPersonalizados);
        }

        // Converter campos para JSON
        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

        // Chamar SP (ele decide onde guardar cada campo)
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_CriarClienteCompleto]
                @Nome = @0,
                @Nif = @1,
                @Moeda = @2,
                @Telefone = @3,
                @Telemovel = @4,
                @Morada = @5,
                @Local = @6,
                @CodigoPostal = @7,
                @Email = @8,
                @Pais = @9,
                @Descarga = @10,
                @Observacoes = @11,
                @CamposPersonalizados = @12`,
            [
                dto.nome,
                dto.nif,
                dto.moeda || 'EUR',
                dto.telefone || null,
                dto.telemovel || null,
                dto.morada || null,
                dto.local || null,
                dto.codigoPostal || null,
                dto.email || null,
                dto.pais || 'PT',
                dto.descarga || null,
                dto.observacoes || null,
                camposJson
            ]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return result[0];
    }


    // Atualizar cliente
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

        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_AtualizarClienteCompleto]
                @ClienteNo = @0,
                @Nome = @1,
                @Nif = @2,
                @Moeda = @3,
                @Telefone = @4,
                @Telemovel = @5,
                @Morada = @6,
                @Local = @7,
                @CodigoPostal = @8,
                @Email = @9,
                @Pais = @10,
                @Descarga = @11,
                @Observacoes = @12,
                @CamposPersonalizados = @13`,
            [
                id,
                dto.nome || null,
                dto.nif || null,
                dto.moeda || null,
                dto.telefone || null,
                dto.telemovel || null,
                dto.morada || null,
                dto.local || null,
                dto.codigoPostal || null,
                dto.email || null,
                dto.pais || null,
                dto.descarga || null,
                dto.observacoes || null,
                camposJson
            ]
        );

        if (result[0]?.Status === 'ERROR') {
            throw new BadRequestException(result[0].ErrorMessage);
        }

        return result[0];
    }


    // Obter cliente por ID
    // - Obtem dados de CL, CL2
    // - Obtem campos da tabela genérica
    // - Obtem campos das tabelas externas (cl_info, cl2, etc.)
    async obterPorId(id: number): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterClienteCompleto] @ClienteNo = @0`,
            [id]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException('Cliente não encontrado');
        }

        const cliente = result[0];

        // Processar campos externos (obter valores das tabelas específicas)
        if (cliente.campos_personalizados_externos) {
            const camposExternos = JSON.parse(cliente.campos_personalizados_externos);

            // Para cada campo externo, obter o valor real da tabela
            for (const campo of camposExternos) {
                if (campo.tabela_destino && campo.campo_destino) {
                    try {
                        const valorExterno = await this.obterValorCampoExterno(
                            id,
                            cliente.clstamp,
                            campo.tabela_destino,
                            campo.campo_destino,
                            campo.codigo
                        );
                        campo.valor = valorExterno;
                        delete campo.valor_origem;
                    } catch (error) {
                        console.error(`Erro ao obter campo ${campo.codigo}:`, error);
                        campo.valor = null;
                    }
                }
            }

            cliente.campos_personalizados_externos = JSON.stringify(camposExternos);
        }

        // Combinar campos genéricos + externos numa única lista
        const camposGenericos = cliente.campos_personalizados_genericos
            ? JSON.parse(cliente.campos_personalizados_genericos)
            : [];
        const camposExternos = cliente.campos_personalizados_externos
            ? JSON.parse(cliente.campos_personalizados_externos)
            : [];

        cliente.campos_personalizados = [...camposGenericos, ...camposExternos];

        // Limpar propriedades temporárias
        delete cliente.campos_personalizados_genericos;
        delete cliente.campos_personalizados_externos;

        return cliente;
    }



    // Obter valor de um campo numa tabela externa
    // Exemplo: obter cl_info.nome_empresa onde cl_info.cl_no = 5
    private async obterValorCampoExterno(
        clienteNo: number,
        clstamp: string,
        tabelaDestino: string,
        campoDestino: string,
        codigoCampo: string
    ): Promise<any> {
        // Obter qual FK usar (cl_no, clstamp, cl2stamp, etc.)
        const config = await this.dataSource.query(
            `SELECT campo_chave_relacao FROM cl_campos_personalizados 
             WHERE codigo_campo = @0`,
            [codigoCampo]
        );

        const campoChave = config[0]?.campo_chave_relacao || 'cl_no';

        // Determinar o valor da chave
        const valorChave = (campoChave === 'clstamp' || campoChave === 'cl2stamp')
            ? clstamp
            : clienteNo;

        // Query dinâmica para obter o valor
        const sql = `
            SELECT ${campoDestino} AS valor
            FROM ${tabelaDestino}
            WHERE ${campoChave} = @0
        `;

        const result = await this.dataSource.query(sql, [valorChave]);
        return result[0]?.valor || null;
    }

    // Obter cliente por NIF
    async obterPorNif(nif: string): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterClientePorNif] @Nif = @0`,
            [nif]
        );

        return result && result.length > 0 ? result[0] : null;
    }

    // Listar clientes
    async listar(
        pagina: number = 1,
        limite: number = 50,
        obtem?: string
    ): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ListarClientes] 
                @Pagina = @0, 
                @Limite = @1,
                @Obtem = @2`,
            [pagina, limite, obtem || null]
        );

        return result;
    }

    // Obter Consumidor Final
    private async obterConsumidorFinal(): Promise<any> {
        const result = await this.dataSource.query(
            `SELECT TOP 1 no, clstamp, Nome 
             FROM cl 
             WHERE Nome LIKE '%Consumidor Final%' 
             OR ncont = '999999990'
             ORDER BY no ASC`
        );

        if (!result || result.length === 0) {
            throw new NotFoundException(
                'Cliente Consumidor Final não encontrado'
            );
        }

        return result[0];
    }


    // VALIDAR se os campos enviados existem na configuração
    // - Obtem em cl_campos_personalizados
    // - Se não existir, lança erro
    // - Valida obrigatoriedade, tipo, regex, etc.
    private async validarCamposPersonalizados(campos: any[]): Promise<void> {
        // Obter TODAS as configurações de campos ativos
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM cl_campos_personalizados WHERE ativo = 1`
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

    // Validar tipo de dado básico
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

    // Listar configurações de campos personalizados
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
             FROM cl_campos_personalizados
             WHERE ativo = 1
             ORDER BY ordem, grupo, nome_campo`
        );

        return result;
    }

    // Obter configuração de um campo específico
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
}