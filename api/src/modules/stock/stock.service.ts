import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArtigosPaginadosDto, ArtigoListagemDto, ArtigoDetalheDto, RegistarCodigoExternoDto, SuccessResponseDto, CampoPersonalizadoDto, AtualizarCamposPersonalizadosDto } from './stock.dto';

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
     */
    async obterPorReferencia(referencia: string): Promise<ArtigoDetalheDto> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterArtigoPorReferencia] @Referencia = @0`,
            [referencia]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException(`Artigo com referência '${referencia}' não encontrado`);
        }

        return result[0];
    }

    /**
     * Registar código da aplicação externa para um artigo
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

        // Validar campos personalizados se existirem
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

        // Validar campos personalizados
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
     * Validar campos personalizados antes de inserir/atualizar
     */
    private async validarCamposPersonalizados(campos: CampoPersonalizadoDto[]): Promise<void> {
        const definicoesCampos = await this.dataSource.query(
            `SELECT * FROM artigos_campos_personalizados WHERE ativo = 1`
        );

        for (const campo of campos) {
            const definicao = definicoesCampos.find(
                (d: any) => d.codigo_campo === campo.codigo
            );

            if (!definicao) {
                throw new BadRequestException(`Campo personalizado '${campo.codigo}' não existe`);
            }

            // Validar se campo é obrigatório
            if (definicao.obrigatorio && (campo.valor === null || campo.valor === undefined || campo.valor === '')) {
                throw new BadRequestException(`Campo '${definicao.nome_campo}' é obrigatório`);
            }

            // Validar regex se existir
            if (definicao.validacao && campo.valor) {
                const regex = new RegExp(definicao.validacao);
                if (!regex.test(String(campo.valor))) {
                    throw new BadRequestException(`Valor inválido para '${definicao.nome_campo}'`);
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
        }
    }
}