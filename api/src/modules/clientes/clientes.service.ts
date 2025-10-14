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
        const clienteExistente = await this.buscarPorNif(dto.nif);
        if (clienteExistente) {
            throw new BadRequestException('Já existe um cliente com este NIF');
        }

        const camposJson = dto.camposPersonalizados
            ? JSON.stringify(dto.camposPersonalizados)
            : null;

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

    async atualizar(id: number, dto: UpdateClienteDto): Promise<any> {
        // Verificar se cliente existe
        const clienteExiste = await this.obterPorId(id);
        if (!clienteExiste) {
            throw new NotFoundException('Cliente não encontrado');
        }

        // Se alterar NIF, verificar duplicação
        if (dto.nif) {
            const clienteComNif = await this.buscarPorNif(dto.nif);
            if (clienteComNif && clienteComNif.no !== id) {
                throw new BadRequestException('Já existe outro cliente com este NIF');
            }
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

    async obterPorId(id: number): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ObterClienteCompleto] @ClienteNo = @0`,
            [id]
        );

        if (!result || result.length === 0) {
            throw new NotFoundException('Cliente não encontrado');
        }

        return result[0];
    }

    async buscarPorNif(nif: string): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_BuscarClientePorNif] @Nif = @0`,
            [nif]
        );

        return result && result.length > 0 ? result[0] : null;
    }

    async listar(
        pagina: number = 1,
        limite: number = 50,
        busca?: string
    ): Promise<any> {
        const result = await this.dataSource.query(
            `EXEC [dbo].[sp_ListarClientes] 
        @Pagina = @0, 
        @Limite = @1,
        @Busca = @2`,
            [pagina, limite, busca || null]
        );

        return result;
    }

    private async obterConsumidorFinal(): Promise<any> {
        // Mock - você vai ajustar depois com a query real
        const result = await this.dataSource.query(
            `SELECT TOP 1 no, clstamp, Nome 
       FROM cl 
       WHERE Nome LIKE '%Consumidor Final%' 
       OR ncont = '999999990'
       ORDER BY no ASC`
        );

        if (!result || result.length === 0) {
            throw new NotFoundException(
                'Cliente Consumidor Final não encontrado. Configure o cliente genérico no PHC.'
            );
        }

        return result[0];
    }
}