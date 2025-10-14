import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
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

// Response DTO para listagem de artigos
export class ArtigoListagemDto {
    @ApiProperty({
        description: 'Título do artigo',
        example: 'Smartphone XYZ Pro',
    })
    titulo: string;

    @ApiProperty({
        description: 'Referência do artigo no PHC',
        example: 'ART-001',
    })
    referencia: string;

    @ApiProperty({
        description: 'Marca do produto',
        example: 'Samsung',
    })
    marca: string;

    @ApiProperty({
        description: 'Descrição do artigo',
        example: 'Smartphone com 128GB de armazenamento',
    })
    descricao: string;

    @ApiProperty({
        description: 'Preço de venda (sem promoção)',
        example: 599.99,
    })
    preco: number;

    @ApiPropertyOptional({
        description: 'Preço promocional (se existir)',
        example: 499.99,
        nullable: true,
    })
    precoPromocional?: number;

    @ApiPropertyOptional({
        description: 'Peso do produto em kg',
        example: 0.185,
        nullable: true,
    })
    peso?: number;

    @ApiProperty({
        description: 'Quantidade em stock',
        example: 150,
    })
    stock: number;

    @ApiPropertyOptional({
        description: 'Código do artigo na aplicação externa (se já foi registado)',
        example: 'EXT-12345',
        nullable: true,
    })
    codigoExterno?: string;

    @ApiPropertyOptional({
        description: 'Campos personalizados do artigo',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'garantia_meses', tipo: 'number', valor: 24 },
            { codigo: 'cor_disponivel', tipo: 'select', valor: 'Preto' }
        ]
    })
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// Response DTO para detalhes completos do artigo
export class ArtigoDetalheDto extends ArtigoListagemDto {
    @ApiPropertyOptional({
        description: 'Referências de artigos associados',
        example: ['ART-002', 'ART-003'],
        type: [String],
    })
    referenciasAssociadas?: string[];

    @ApiPropertyOptional({
        description: 'URL ou caminho da ficha técnica em PDF',
        example: 'https://exemplo.com/fichas/ART-001.pdf',
        nullable: true,
    })
    fichaTecnicaPdf?: string;

    @ApiProperty({
        description: 'Data de criação do artigo',
        example: '2025-01-15T10:30:00',
    })
    dataCriacao: string;

    @ApiProperty({
        description: 'Data da última atualização',
        example: '2025-10-14T14:20:00',
    })
    dataAtualizacao: string;
}

// DTO para registar código externo
export class RegistarCodigoExternoDto {
    @ApiProperty({
        description: 'Código/ID do artigo na aplicação externa',
        example: 'EXT-12345',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    codigoExterno: string;

    @ApiPropertyOptional({
        description: 'Observações sobre o mapeamento',
        example: 'Sincronizado com e-commerce',
    })
    @IsOptional()
    @IsString()
    observacoes?: string;

    @ApiPropertyOptional({
        description: 'Campos personalizados a actualizar durante o registo',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'data_sincronizacao', tipo: 'datetime', valor: '2025-10-14T15:30:00' },
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

// Response padrão de sucesso
export class SuccessResponseDto {
    @ApiProperty({ example: 'SUCCESS' })
    status: string;

    @ApiProperty({ example: 'Operação realizada com sucesso' })
    mensagem: string;
}

// Response de listagem paginada
export class ArtigosPaginadosDto {
    @ApiProperty({ example: 250 })
    total: number;

    @ApiProperty({ example: 1 })
    pagina: number;

    @ApiProperty({ example: 50 })
    limite: number;

    @ApiProperty({
        type: [ArtigoListagemDto],
        description: 'Lista de artigos',
    })
    dados: ArtigoListagemDto[];
}