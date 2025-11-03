import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// Campo Personalizado
export class CampoPersonalizadoDto {
    @ApiProperty({
        description: 'Código do campo personalizado',
        example: 'garantia_meses',
    })
    @IsString()
    codigo: string;

    @ApiProperty({
        description: 'Tipo de dado do campo',
        enum: ['text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'json'],
        example: 'number',
    })
    @IsEnum(['text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'json'])
    tipo: string;

    @ApiProperty({
        description: 'Valor do campo personalizado',
        example: 24,
    })
    valor: any;
}

// DTO para registar código externo
export class RegistarCodigoExternoDto {
    @ApiProperty({
        description: 'Código/ID do artigo na aplicação externa',
        example: 'shopify_12345',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    codigoExterno: string;

    @ApiPropertyOptional({
        description: 'Observações sobre o mapeamento',
        example: 'Sincronizado com e-commerce em 2025-10-19',
    })
    @IsOptional()
    @IsString()
    observacoes?: string;

    @ApiPropertyOptional({
        description: 'Campos personalizados a atualizar durante o registo',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'data_sincronizacao', tipo: 'datetime', valor: '2025-10-19T15:30:00' },
            { codigo: 'sincronizado', tipo: 'boolean', valor: true }
        ]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// DTO para atualizar campos personalizados
export class AtualizarCamposPersonalizadosDto {
    @ApiProperty({
        description: 'Lista de campos personalizados a atualizar',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'garantia_meses', tipo: 'number', valor: 36 },
            { codigo: 'destaque_homepage', tipo: 'boolean', valor: true },
            { codigo: 'categoria_ecommerce', tipo: 'select', valor: 'Eletrónica' }
        ]
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados: CampoPersonalizadoDto[];
}

// Response DTOs
export class SuccessResponseDto {
    @ApiProperty({ example: 'SUCCESS' })
    status: string;

    @ApiProperty({ example: 'Operação realizada com sucesso' })
    mensagem: string;
}

export class CampoPersonalizadoResponseDto {
    @ApiProperty({ example: 'garantia_meses' })
    codigo: string;

    @ApiPropertyOptional({ example: 'Garantia (meses)' })
    nome?: string;

    @ApiProperty({ example: 'number' })
    tipo: string;

    @ApiPropertyOptional({ example: 'Especificações' })
    grupo?: string;

    @ApiPropertyOptional({ example: 'st' })
    tabela_destino?: string;

    @ApiProperty({ example: 24 })
    valor: any;
}

export class ArtigoListagemDto {
    @ApiProperty({ example: 'Smartphone XYZ Pro' })
    titulo: string;

    @ApiProperty({ example: 'ART-001' })
    referencia: string;

    @ApiPropertyOptional({ example: 'Samsung' })
    marca?: string;

    @ApiPropertyOptional({ example: 'Smartphone com 128GB de armazenamento' })
    descricao?: string;

    @ApiProperty({ example: 599.99 })
    preco: number;

    @ApiPropertyOptional({ example: 499.99 })
    precoPromocional?: number;

    @ApiPropertyOptional({ example: 0.185 })
    peso?: number;

    @ApiProperty({ example: 150 })
    stock: number;

    @ApiPropertyOptional({ example: 'https://example.com/fichas/produto-xyz.pdf' })
    fichaTecnica?: string;

    @ApiPropertyOptional({ example: '141204' })
    familia?: string;

    @ApiPropertyOptional({ example: 'QUIMICOS - COZINHAS' })
    familiaNome?: string;

    @ApiPropertyOptional({ example: 23 })
    taxaIVA?: number;

    @ApiPropertyOptional({ example: 'UN' })
    unidade?: string;

    @ApiPropertyOptional({ example: '\\\\192.168.1.9\\LOGOS\\FOTOS\\2PA10471.jpg' })
    caminhoImagem?: string;

    @ApiPropertyOptional({ example: 'A2BRIOS - PRODUÇÃO E COMÉRCIO' })
    fornecedor?: string;

    @ApiPropertyOptional({ example: '1332' })
    codigoFornecedor?: string;

    @ApiPropertyOptional({ example: '2022-03-14T00:00:00.000Z' })
    dataCriacao?: Date;

    @ApiPropertyOptional({ example: '2022-03-15T11:42:51.000Z' })
    dataAtualizacao?: Date;

    @ApiPropertyOptional({ example: 'shopify_12345' })
    codigoExterno?: string;

    @ApiPropertyOptional({ type: [CampoPersonalizadoResponseDto] })
    camposPersonalizados?: CampoPersonalizadoResponseDto[];
}

export class ArtigosPaginadosDto {
    @ApiProperty({ example: 250 })
    total: number;

    @ApiProperty({ example: 1 })
    pagina: number;

    @ApiProperty({ example: 50 })
    limite: number;

    @ApiProperty({ type: [ArtigoListagemDto] })
    dados: ArtigoListagemDto[];
}

export class ConfiguracaoCampoDto {
    @ApiProperty({ example: 'garantia_meses' })
    codigo_campo: string;

    @ApiProperty({ example: 'Garantia (meses)' })
    nome_campo: string;

    @ApiProperty({ example: 'number' })
    tipo_dados: string;

    @ApiPropertyOptional({ example: 'st' })
    tabela_destino?: string;

    @ApiPropertyOptional({ example: 'garantia' })
    campo_destino?: string;

    @ApiPropertyOptional({ example: 'ref' })
    campo_chave_relacao?: string;

    @ApiPropertyOptional({ example: null })
    tamanho_maximo?: number;

    @ApiProperty({ example: false })
    obrigatorio: boolean;

    @ApiPropertyOptional({ example: '24' })
    valor_padrao?: string;

    @ApiPropertyOptional({ example: null })
    opcoes?: string;

    @ApiPropertyOptional({ example: null })
    validacao?: string;

    @ApiProperty({ example: 1 })
    ordem: number;

    @ApiPropertyOptional({ example: 'Especificações' })
    grupo?: string;

    @ApiProperty({ example: true })
    visivel: boolean;

    @ApiProperty({ example: true })
    editavel: boolean;
}