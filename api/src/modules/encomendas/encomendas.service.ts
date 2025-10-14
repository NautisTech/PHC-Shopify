import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateEncomendaDto, UpdateEncomendaDto, EncomendaResponseDto, EncomendaDetalheDto, EncomendaListagemDto, CampoPersonalizadoDto } from './encomendas.dto';

@Injectable()
export class EncomendasService {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Criar encomenda completa (BO + BO2 + BO3 + BI + BI2)
     */
    async criar(dto: CreateEncomendaDto): Promise<EncomendaResponseDto> {
        // Obter dados do cliente
        const cliente = await this.obterCliente(dto.clienteId);
        if (!cliente) {
            throw new NotFoundException(`Cliente '${dto.clienteId}' não encontrado`);
        }

        // Validar campos personalizados se existirem
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

        // Validar campos personalizados
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
     */
    async obterPorId(id: number): Promise<EncomendaDetalheDto> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterEncomendaPorId] @Ndos = @0`,
            [id]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException('Encomenda não encontrada');
        }

        return result[0];
    }

    /**
     * Listar encomendas com paginação
     */
    async listar(
        pagina: number = 1,
        limite: number = 50,
        busca?: string
    ): Promise<EncomendaListagemDto> {
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
            `SELECT cl.no, cl.Nome, cl.ncont, cl.morada, cl.local, cl.codpost, cl.telefone, cl.email, cl.tlmvl
       FROM cl
       INNER JOIN clientes_codigo_externo ce ON ce.cliente_no = cl.no
       WHERE ce.codigo_externo = @0`,
            [clienteId]
        );

        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * Validar campos personalizados
     */
    private async validarCamposPersonalizados(campos: CampoPersonalizadoDto[]): Promise<void> {
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM encomendas_campos_personalizados WHERE ativo = 1`
        );

        for (const campo of campos) {
            const definicao = definicoesCampos.find(
                (d: any) => d.codigo_campo === campo.codigo
            );

            if (!definicao) {
                throw new BadRequestException(`Campo personalizado '${campo.codigo}' não existe`);
            }

            if (definicao.obrigatorio && (campo.valor === null || campo.valor === undefined || campo.valor === '')) {
                throw new BadRequestException(`Campo '${definicao.nome_campo}' é obrigatório`);
            }

            if (definicao.validacao && campo.valor) {
                const regex = new RegExp(definicao.validacao);
                if (!regex.test(String(campo.valor))) {
                    throw new BadRequestException(`Valor inválido para '${definicao.nome_campo}'`);
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
        }
    }
}