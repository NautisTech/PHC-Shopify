import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Campo Personalizado
export class CampoPersonalizadoDto {
    @ApiProperty({
        description: 'Código do campo personalizado',
        example: 'metodo_pagamento',
    })
    @IsString()
    codigo: string;

    @ApiProperty({
        description: 'Tipo de dado',
        enum: ['text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'json'],
        example: 'select',
    })
    @IsEnum(['text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'json'])
    tipo: string;

    @ApiProperty({
        description: 'Valor do campo',
        example: 'Multibanco',
    })
    valor: any;
}

// Linha da Encomenda (Artigo/Serviço)
export class LinhaEncomendaDto {
    @ApiProperty({
        description: 'Referência do artigo ou serviço',
        example: 'ART-001',
    })
    @IsString()
    ref: string;

    @ApiProperty({
        description: 'Descrição do artigo/serviço (opcional, se não for enviado busca da tabela ST)',
        example: 'Smartphone XYZ Pro',
        required: false,
    })
    @IsOptional()
    @IsString()
    design?: string;

    @ApiProperty({
        description: 'Quantidade',
        example: 2,
        minimum: 0.01,
    })
    @IsNumber()
    @Min(0.01)
    qtt: number;

    @ApiProperty({
        description: 'Preço unitário em euros',
        example: 599.99,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    preco: number;

    @ApiPropertyOptional({
        description: 'Taxa de IVA (%) - Se não enviado, usa 23%',
        example: 23,
        default: 23,
    })
    @IsOptional()
    @IsNumber()
    iva?: number;

    @ApiPropertyOptional({
        description: 'Indica se é serviço (true) ou produto (false)',
        example: false,
        default: false,
    })
    @IsOptional()
    stns?: boolean;
}

// CREATE Encomenda DTO
export class CreateEncomendaDto {
    @ApiProperty({
        description: 'ID do cliente (pode ser ID interno PHC ou ID externo da Shopify)',
        example: 'SHOP-12345',
    })
    @IsString()
    clienteId: string;

    @ApiPropertyOptional({
        description: 'Data da encomenda (ISO 8601). Se não enviado, usa data atual',
        example: '2025-10-14T10:30:00',
    })
    @IsOptional()
    @IsString()
    dataEncomenda?: string;

    @ApiProperty({
        description: 'Linhas da encomenda (artigos/serviços)',
        type: [LinhaEncomendaDto],
        example: [
            {
                ref: 'ART-001',
                design: 'Smartphone XYZ Pro',
                qtt: 2,
                preco: 599.99,
                iva: 23,
                stns: false
            },
            {
                ref: 'SRV-001',
                design: 'Instalação e Configuração',
                qtt: 1,
                preco: 50.00,
                iva: 23,
                stns: true
            }
        ]
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LinhaEncomendaDto)
    linhas: LinhaEncomendaDto[];

    @ApiPropertyOptional({
        description: 'Campos personalizados da encomenda',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'metodo_pagamento', tipo: 'select', valor: 'Multibanco' },
            { codigo: 'observacoes_entrega', tipo: 'text', valor: 'Entregar após as 18h' },
            { codigo: 'urgente', tipo: 'boolean', valor: true }
        ]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// UPDATE Encomenda DTO
export class UpdateEncomendaDto {
    @ApiPropertyOptional({
        description: 'Linhas atualizadas da encomenda',
        type: [LinhaEncomendaDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LinhaEncomendaDto)
    linhas?: LinhaEncomendaDto[];

    @ApiPropertyOptional({
        description: 'Campos personalizados a atualizar',
        type: [CampoPersonalizadoDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// Response DTOs
export class EncomendaResponseDto {
    @ApiProperty({ example: 'SUCCESS' })
    status: string;

    @ApiProperty({ example: 1 })
    encomendaId: number;

    @ApiProperty({ example: 'abc123def456ghi789jkl012m' })
    bostamp: string;

    @ApiProperty({ example: 1 })
    obrano: number;

    @ApiProperty({ example: 2025 })
    boano: number;

    @ApiProperty({ example: 'Encomenda - 1 - SHOP-12345' })
    nmdos: string;

    @ApiProperty({ example: 1299.98 })
    total: number;

    @ApiProperty({ example: 'Encomenda criada com sucesso' })
    mensagem: string;
}

export class EncomendaDetalheDto {
    @ApiProperty({ example: 1 })
    ndos: number;

    @ApiProperty({ example: 'Encomenda - 1 - SHOP-12345' })
    nmdos: string;

    @ApiProperty({ example: 1 })
    obrano: number;

    @ApiProperty({ example: 2025 })
    boano: number;

    @ApiProperty({ example: '2025-10-14T10:30:00' })
    dataobra: string;

    @ApiProperty({ example: 1 })
    clienteNo: number;

    @ApiProperty({ example: 'João Silva' })
    clienteNome: string;

    @ApiProperty({ example: '123456789' })
    clienteNif: string;

    @ApiProperty({ example: 1299.98 })
    total: number;

    @ApiProperty({ example: 'EURO' })
    moeda: string;

    @ApiProperty({
        description: 'Linhas da encomenda',
        example: [
            {
                ref: 'ART-001',
                design: 'Smartphone XYZ Pro',
                qtt: 2,
                preco: 599.99,
                iva: 23,
                total: 1199.98
            }
        ]
    })
    linhas: any[];

    @ApiProperty({
        description: 'Campos personalizados',
        example: [
            { codigo: 'metodo_pagamento', nome: 'Método de Pagamento', valor: 'Multibanco' }
        ]
    })
    camposPersonalizados: any[];
}

export class EncomendaListagemDto {
    @ApiProperty({ example: 250 })
    total: number;

    @ApiProperty({ example: 1 })
    pagina: number;

    @ApiProperty({ example: 50 })
    limite: number;

    @ApiProperty({ type: [EncomendaDetalheDto] })
    dados: EncomendaDetalheDto[];
}