import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, ValidateNested, Matches, MinLength, MaxLength, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// Campo Personalizado
export class CampoPersonalizadoDto {
    @ApiProperty({
        description: 'Código do campo personalizado',
        example: 'vencimento',
    })
    @IsString()
    codigo: string;

    @ApiProperty({
        description: 'Tipo de dado do campo',
        enum: ['text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'json'],
        example: 'number',
    })
    @IsString()
    tipo: string;

    @ApiProperty({
        description: 'Valor do campo personalizado',
        example: 30,
    })
    valor: any;
}

// CREATE Cliente DTO
export class CreateClienteDto {
    @ApiProperty({
        description: 'Nome completo do cliente',
        example: 'João Silva',
        minLength: 3,
        maxLength: 255,
    })
    @IsString()
    @MinLength(3, { message: 'Nome deve ter no mínimo 3 caracteres' })
    @MaxLength(255, { message: 'Nome deve ter no máximo 255 caracteres' })
    nome: string;

    @ApiProperty({
        description: 'NIF do cliente (9 dígitos). Se vazio/null, será atribuído ao Consumidor Final',
        example: '123456789',
        required: false,
        pattern: '^[0-9]{9}$',
    })
    @IsOptional()
    @Matches(/^[0-9]{9}$/, { message: 'NIF deve ter exatamente 9 dígitos' })
    nif?: string;

    @ApiPropertyOptional({
        description: 'Moeda do cliente',
        example: 'EUR',
        default: 'EUR',
    })
    @IsOptional()
    @IsString()
    moeda?: string;

    @ApiPropertyOptional({
        description: 'Telefone fixo do cliente',
        example: '+351212345678',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    telefone?: string;

    @ApiPropertyOptional({
        description: 'Telemóvel do cliente',
        example: '+351912345678',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    telemovel?: string;

    @ApiPropertyOptional({
        description: 'Morada do cliente',
        example: 'Rua das Flores, 123',
        maxLength: 255,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    morada?: string;

    @ApiPropertyOptional({
        description: 'Localidade',
        example: 'Lisboa',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    local?: string;

    @ApiPropertyOptional({
        description: 'Código Postal (formato: 0000-000)',
        example: '1000-100',
        pattern: '^[0-9]{4}-[0-9]{3}$',
    })
    @IsOptional()
    @Matches(/^[0-9]{4}-[0-9]{3}$/, { message: 'Código Postal deve ter o formato 0000-000' })
    codigoPostal?: string;

    @ApiPropertyOptional({
        description: 'Email do cliente',
        example: 'joao.silva@email.com',
    })
    @IsOptional()
    @IsEmail({}, { message: 'Email inválido' })
    email?: string;

    @ApiPropertyOptional({
        description: 'País (código ISO)',
        example: 'PT',
        default: 'PT',
    })
    @IsOptional()
    @IsString()
    pais?: string;

    @ApiPropertyOptional({
        description: 'Local de descarga/entrega',
        example: 'Armazém Principal',
    })
    @IsOptional()
    @IsString()
    descarga?: string;

    @ApiPropertyOptional({
        description: 'Observações',
        example: 'Cliente preferencial',
    })
    @IsOptional()
    @IsString()
    observacoes?: string;

    @ApiPropertyOptional({
        description: 'Campos personalizados do cliente',
        type: [CampoPersonalizadoDto],
        example: [
            { codigo: 'vencimento', tipo: 'number', valor: 30 },
            { codigo: 'alimite', tipo: 'boolean', valor: false }
        ],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// UPDATE Cliente DTO
export class UpdateClienteDto {
    @ApiPropertyOptional({
        description: 'Nome completo do cliente',
        example: 'João Silva Atualizado',
    })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(255)
    nome?: string;

    @ApiPropertyOptional({
        description: 'NIF do cliente (9 dígitos)',
        example: '987654321',
    })
    @IsOptional()
    @Matches(/^[0-9]{9}$/, { message: 'NIF deve ter exatamente 9 dígitos' })
    nif?: string;

    @ApiPropertyOptional({
        description: 'Moeda do cliente',
        example: 'USD',
    })
    @IsOptional()
    @IsString()
    moeda?: string;

    @ApiPropertyOptional({
        description: 'Telefone fixo',
        example: '+351213456789',
    })
    @IsOptional()
    @IsString()
    telefone?: string;

    @ApiPropertyOptional({
        description: 'Telemóvel',
        example: '+351913456789',
    })
    @IsOptional()
    @IsString()
    telemovel?: string;

    @ApiPropertyOptional({
        description: 'Morada',
        example: 'Av. da Liberdade, 456',
    })
    @IsOptional()
    @IsString()
    morada?: string;

    @ApiPropertyOptional({
        description: 'Localidade',
        example: 'Porto',
    })
    @IsOptional()
    @IsString()
    local?: string;

    @ApiPropertyOptional({
        description: 'Código Postal',
        example: '4000-100',
    })
    @IsOptional()
    @Matches(/^[0-9]{4}-[0-9]{3}$/)
    codigoPostal?: string;

    @ApiPropertyOptional({
        description: 'Email',
        example: 'joao.novo@email.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        description: 'País',
        example: 'ES',
    })
    @IsOptional()
    @IsString()
    pais?: string;

    @ApiPropertyOptional({
        description: 'Local de descarga',
        example: 'Armazém Secundário',
    })
    @IsOptional()
    @IsString()
    descarga?: string;

    @ApiPropertyOptional({
        description: 'Observações',
        example: 'Cliente VIP',
    })
    @IsOptional()
    @IsString()
    observacoes?: string;

    @ApiPropertyOptional({
        description: 'Campos personalizados',
        type: [CampoPersonalizadoDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampoPersonalizadoDto)
    camposPersonalizados?: CampoPersonalizadoDto[];
}

// Response DTOs para Swagger
export class ClienteResponseDto {
    @ApiProperty({ example: 'SUCCESS' })
    status: string;

    @ApiProperty({ example: 1 })
    clienteId: number;

    @ApiProperty({ example: 'abc123def456ghi789jkl012m' })
    clstamp: string;

    @ApiProperty({ example: 'Cliente criado com sucesso' })
    mensagem: string;
}

export class ClienteDetalheResponseDto {
    @ApiProperty({ example: 1 })
    no: number;

    @ApiProperty({ example: 'João Silva' })
    nome: string;

    @ApiProperty({ example: '123456789' })
    ncont: string;

    @ApiProperty({ example: 'EUR' })
    moeda: string;

    @ApiProperty({ example: '+351212345678' })
    telefone: string;

    @ApiProperty({ example: '+351912345678' })
    tlmvl: string;

    @ApiProperty({ example: 'Rua das Flores, 123' })
    morada: string;

    @ApiProperty({ example: 'Lisboa' })
    local: string;

    @ApiProperty({ example: '1000-100' })
    codpost: string;

    @ApiProperty({ example: 'joao.silva@email.com' })
    email: string;

    @ApiProperty({ example: 'PT' })
    pais: string;

    @ApiProperty({ example: 'Portugal' })
    descpais: string;

    @ApiProperty({ example: 30 })
    vencimento: number;

    @ApiProperty({ example: false })
    alimite: boolean;

    @ApiProperty({ example: '2025-10-14T10:30:00' })
    usrdata: string;

    @ApiProperty({ example: 'web' })
    usrinis: string;
}