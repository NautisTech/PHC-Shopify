import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsEnum, Min, IsBoolean } from 'class-validator';
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

// Linha da Encomenda
export class LinhaEncomendaDto {
    @ApiProperty({
        description: 'Referência do artigo ou serviço',
        example: 'ART-001',
    })
    @IsString()
    ref: string;

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
    @IsBoolean()
    stns?: boolean;
}

// CREATE Encomenda DTO
export class CreateEncomendaDto {
    @ApiProperty({
        description: 'ID do cliente (pode ser ID interno PHC ou ID externo)',
        example: 'shopify_12345',
    })
    @IsString()
    @IsOptional()
    clienteId: string;

    @ApiPropertyOptional({
        description: 'Data da encomenda (ISO 8601). Se não enviado, usa data atual',
        example: '2025-10-19T10:30:00',
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
        description: 'Linhas atualizadas da encomenda (substitui todas as linhas)',
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

    @ApiProperty({ example: 'Encomenda - 1 - shopify_12345' })
    nmdos: string;

    @ApiProperty({ example: 1299.98 })
    total: number;

    @ApiProperty({ example: 'Encomenda criada com sucesso' })
    mensagem: string;
}

export class LinhaEncomendaResponseDto {
    @ApiProperty({ example: 'ART-001' })
    ref: string;

    @ApiProperty({ example: 'Smartphone XYZ Pro' })
    design: string;

    @ApiProperty({ example: 2 })
    qtt: number;

    @ApiProperty({ example: 599.99 })
    preco: number;

    @ApiProperty({ example: 23 })
    iva: number;

    @ApiProperty({ example: 1199.98 })
    total: number;

    @ApiProperty({ example: false })
    stns: boolean;
}

export class CampoPersonalizadoResponseDto {
    @ApiProperty({ example: 'metodo_pagamento' })
    codigo: string;

    @ApiProperty({ example: 'Método de Pagamento' })
    nome: string;

    @ApiProperty({ example: 'select' })
    tipo: string;

    @ApiPropertyOptional({ example: 'Pagamento' })
    grupo?: string;

    @ApiPropertyOptional({ example: 'bo' })
    tabela_destino?: string;

    @ApiProperty({ example: 'Multibanco' })
    valor: any;
}

export class EncomendaDetalheDto {
    @ApiProperty({ example: 1 })
    ndos: number;

    @ApiProperty({ example: 'Encomenda - 1 - shopify_12345' })
    nmdos: string;

    @ApiProperty({ example: 1 })
    obrano: number;

    @ApiProperty({ example: 2025 })
    boano: number;

    @ApiProperty({ example: '2025-10-19T10:30:00' })
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

    @ApiProperty({ example: 'abc123def456ghi789jkl012m' })
    bostamp: string;

    @ApiProperty({ type: [LinhaEncomendaResponseDto] })
    linhas: LinhaEncomendaResponseDto[];

    @ApiProperty({ type: [CampoPersonalizadoResponseDto] })
    campos_personalizados: CampoPersonalizadoResponseDto[];
}

export class EncomendaListagemDto {
    @ApiProperty({ example: 1 })
    ndos: number;

    @ApiProperty({ example: 'Encomenda - 1 - shopify_12345' })
    nmdos: string;

    @ApiProperty({ example: 1 })
    obrano: number;

    @ApiProperty({ example: 2025 })
    boano: number;

    @ApiProperty({ example: '2025-10-19T10:30:00' })
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
}

export class EncomendasPaginadasDto {
    @ApiProperty({ example: 250 })
    total: number;

    @ApiProperty({ example: 1 })
    pagina: number;

    @ApiProperty({ example: 50 })
    limite: number;

    @ApiProperty({ type: [EncomendaListagemDto] })
    dados: EncomendaListagemDto[];
}

export class ConfiguracaoCampoDto {
    @ApiProperty({ example: 'metodo_pagamento' })
    codigo_campo: string;

    @ApiProperty({ example: 'Método de Pagamento' })
    nome_campo: string;

    @ApiProperty({ example: 'select' })
    tipo_dados: string;

    @ApiPropertyOptional({ example: 'bo' })
    tabela_destino?: string;

    @ApiPropertyOptional({ example: 'fref' })
    campo_destino?: string;

    @ApiPropertyOptional({ example: 'bostamp' })
    campo_chave_relacao?: string;

    @ApiPropertyOptional({ example: null })
    tamanho_maximo?: number;

    @ApiProperty({ example: false })
    obrigatorio: boolean;

    @ApiPropertyOptional({ example: null })
    valor_padrao?: string;

    @ApiPropertyOptional({
        example: '["Multibanco","MBWay","Cartão de Crédito","Transferência Bancária"]'
    })
    opcoes?: string;

    @ApiPropertyOptional({ example: null })
    validacao?: string;

    @ApiProperty({ example: 1 })
    ordem: number;

    @ApiPropertyOptional({ example: 'Pagamento' })
    grupo?: string;

    @ApiProperty({ example: true })
    visivel: boolean;

    @ApiProperty({ example: true })
    editavel: boolean;
}