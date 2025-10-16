-- ============================================
-- SISTEMA DE CAMPOS PERSONALIZADOS - CLIENTES
-- Suporta tanto tabela genérica quanto tabelas específicas do PHC
-- ============================================

-- ============================================
-- 1. SP: CRIAR CLIENTE COMPLETO (ATUALIZADO)
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_CriarClienteCompleto]
    @Nome NVARCHAR(255),
    @Nif NVARCHAR(9),
    @Moeda NVARCHAR(10) = 'EUR',
    @Telefone NVARCHAR(20) = NULL,
    @Telemovel NVARCHAR(20) = NULL,
    @Morada NVARCHAR(255) = NULL,
    @Local NVARCHAR(100) = NULL,
    @CodigoPostal NVARCHAR(8) = NULL,
    @Email NVARCHAR(255) = NULL,
    @Pais NVARCHAR(2) = 'PT',
    @Descarga NVARCHAR(255) = NULL,
    @Observacoes NVARCHAR(MAX) = NULL,
    @CamposPersonalizados NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @ClienteNo INT;
    DECLARE @ClStamp NVARCHAR(25);
    DECLARE @DescPais NVARCHAR(100);
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        -- Gerar GUID de 25 caracteres para clstamp
        SET @ClStamp = SUBSTRING(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 1, 25);
        
        -- Buscar descrição do país
        SELECT @DescPais = descpais 
        FROM paises 
        WHERE codpais = @Pais;
        
        IF @DescPais IS NULL
            SET @DescPais = 'Portugal';
        
        -- ========================================
        -- INSERIR NA TABELA CL
        -- ========================================
        INSERT INTO [dbo].[cl] (
            Nome, ncont, MOEDA, telefone, tlmvl, morada, Local, codpost, email,
            PAIS, descarga, obs, clstamp, usrdata, usrinis, usrhora,
            ousrdata, ousrinis, ousrhora, VENCIMENTO, ALIMITE
        )
        VALUES (
            @Nome, @Nif, @Moeda, @Telefone, @Telemovel, @Morada, @Local, 
            @CodigoPostal, @Email, @Pais, @Descarga, @Observacoes, @ClStamp,
            @DataAtual, 'web', CONVERT(VARCHAR(8), @DataAtual, 108),
            @DataAtual, 'web', CONVERT(VARCHAR(8), @DataAtual, 108),
            0, 0
        );
        
        SET @ClienteNo = SCOPE_IDENTITY();
        
        -- ========================================
        -- INSERIR NA TABELA CL2
        -- ========================================
        INSERT INTO [dbo].[cl2] (
            cl2stamp, codpais, descpais, usrdata, usrinis, usrhora,
            ousrdata, ousrinis, ousrhora
        )
        VALUES (
            @ClStamp, @Pais, @DescPais, @DataAtual, 'web', 
            CONVERT(VARCHAR(8), @DataAtual, 108), @DataAtual, 'web', 
            CONVERT(VARCHAR(8), @DataAtual, 108)
        );
        
        -- ========================================
        -- PROCESSAR CAMPOS PERSONALIZADOS
        -- ========================================
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            DECLARE @CodigoCampo NVARCHAR(100);
            DECLARE @TipoDados NVARCHAR(50);
            DECLARE @Valor NVARCHAR(MAX);
            DECLARE @TabelaDestino NVARCHAR(100);
            DECLARE @CampoDestino NVARCHAR(100);
            DECLARE @CampoChaveRelacao NVARCHAR(100);
            DECLARE @SQL NVARCHAR(MAX);
            DECLARE @ValorChave NVARCHAR(50);
            
            -- Cursor para processar cada campo
            DECLARE campo_cursor CURSOR FOR
            SELECT 
                JSON_VALUE(value, '$.codigo') AS codigo,
                JSON_VALUE(value, '$.tipo') AS tipo,
                JSON_VALUE(value, '$.valor') AS valor
            FROM OPENJSON(@CamposPersonalizados);
            
            OPEN campo_cursor;
            FETCH NEXT FROM campo_cursor INTO @CodigoCampo, @TipoDados, @Valor;
            
            WHILE @@FETCH_STATUS = 0
            BEGIN
                -- Buscar configuração do campo
                SELECT 
                    @TabelaDestino = tabela_destino,
                    @CampoDestino = campo_destino,
                    @CampoChaveRelacao = campo_chave_relacao
                FROM cl_campos_personalizados
                WHERE codigo_campo = @CodigoCampo AND ativo = 1;
                
                -- ========================================
                -- OPÇÃO 1: Campo vai para tabela específica do PHC
                -- ========================================
                IF @TabelaDestino IS NOT NULL AND @TabelaDestino != ''
                BEGIN
                    -- Determinar o valor da chave de relação
                    SET @ValorChave = CASE 
                        WHEN @CampoChaveRelacao = 'clstamp' THEN @ClStamp
                        WHEN @CampoChaveRelacao = 'no' OR @CampoChaveRelacao = 'cl_no' THEN CAST(@ClienteNo AS NVARCHAR(50))
                        ELSE CAST(@ClienteNo AS NVARCHAR(50))
                    END;
                    
                    -- Construir SQL dinâmico para UPDATE ou INSERT
                    SET @SQL = '
                        IF EXISTS (SELECT 1 FROM ' + QUOTENAME(@TabelaDestino) + ' 
                                   WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ' = @ValorChave)
                        BEGIN
                            UPDATE ' + QUOTENAME(@TabelaDestino) + '
                            SET ' + QUOTENAME(@CampoDestino) + ' = @Valor
                            WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ' = @ValorChave
                        END
                        ELSE
                        BEGIN
                            INSERT INTO ' + QUOTENAME(@TabelaDestino) + ' 
                                (' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ', ' + QUOTENAME(@CampoDestino) + ')
                            VALUES (@ValorChave, @Valor)
                        END';
                    
                    EXEC sp_executesql @SQL, 
                         N'@ValorChave NVARCHAR(50), @Valor NVARCHAR(MAX)', 
                         @ValorChave, @Valor;
                END
                -- ========================================
                -- OPÇÃO 2: Campo vai para tabela genérica
                -- ========================================
                ELSE
                BEGIN
                    INSERT INTO [dbo].[cl_valores_personalizados] (
                        cliente_no, codigo_campo,
                        valor_texto, valor_numero, valor_data, 
                        valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    SELECT 
                        @ClienteNo, @CodigoCampo,
                        CASE WHEN @TipoDados IN ('text', 'textarea', 'email', 'phone', 'url', 'select') 
                             THEN @Valor END,
                        CASE WHEN @TipoDados IN ('number', 'decimal') 
                             THEN TRY_CAST(@Valor AS DECIMAL(18,4)) END,
                        CASE WHEN @TipoDados = 'date' 
                             THEN TRY_CAST(@Valor AS DATE) END,
                        CASE WHEN @TipoDados = 'datetime' 
                             THEN TRY_CAST(@Valor AS DATETIME2) END,
                        CASE WHEN @TipoDados = 'boolean' 
                             THEN TRY_CAST(@Valor AS BIT) END,
                        CASE WHEN @TipoDados = 'json' 
                             THEN @Valor END,
                        @DataAtual, @DataAtual;
                END
                
                FETCH NEXT FROM campo_cursor INTO @CodigoCampo, @TipoDados, @Valor;
            END
            
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        COMMIT TRANSACTION;
        
        SELECT 
            'SUCCESS' AS Status,
            @ClienteNo AS ClienteId,
            @ClStamp AS ClStamp,
            'Cliente criado com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('global', 'campo_cursor') >= 0
        BEGIN
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        ROLLBACK TRANSACTION;
        
        SELECT 
            'ERROR' AS Status,
            ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO

-- ============================================
-- 2. SP: ATUALIZAR CLIENTE COMPLETO (ATUALIZADO)
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_AtualizarClienteCompleto]
    @ClienteNo INT,
    @Nome NVARCHAR(255) = NULL,
    @Nif NVARCHAR(9) = NULL,
    @Moeda NVARCHAR(10) = NULL,
    @Telefone NVARCHAR(20) = NULL,
    @Telemovel NVARCHAR(20) = NULL,
    @Morada NVARCHAR(255) = NULL,
    @Local NVARCHAR(100) = NULL,
    @CodigoPostal NVARCHAR(8) = NULL,
    @Email NVARCHAR(255) = NULL,
    @Pais NVARCHAR(2) = NULL,
    @Descarga NVARCHAR(255) = NULL,
    @Observacoes NVARCHAR(MAX) = NULL,
    @CamposPersonalizados NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @ClStamp NVARCHAR(25);
    DECLARE @DescPais NVARCHAR(100);
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        -- Verificar se cliente existe
        IF NOT EXISTS (SELECT 1 FROM cl WHERE no = @ClienteNo)
        BEGIN
            RAISERROR('Cliente não encontrado', 16, 1);
            RETURN;
        END
        
        -- Obter clstamp
        SELECT @ClStamp = clstamp FROM cl WHERE no = @ClienteNo;
        
        -- Atualizar tabela CL
        UPDATE [dbo].[cl]
        SET
            Nome = ISNULL(@Nome, Nome),
            ncont = ISNULL(@Nif, ncont),
            MOEDA = ISNULL(@Moeda, MOEDA),
            telefone = ISNULL(@Telefone, telefone),
            tlmvl = ISNULL(@Telemovel, tlmvl),
            morada = ISNULL(@Morada, morada),
            Local = ISNULL(@Local, Local),
            codpost = ISNULL(@CodigoPostal, codpost),
            email = ISNULL(@Email, email),
            PAIS = ISNULL(@Pais, PAIS),
            descarga = ISNULL(@Descarga, descarga),
            obs = ISNULL(@Observacoes, obs),
            ousrdata = @DataAtual,
            ousrinis = 'web',
            ousrhora = CONVERT(VARCHAR(8), @DataAtual, 108)
        WHERE no = @ClienteNo;
        
        -- Atualizar CL2 se país foi alterado
        IF @Pais IS NOT NULL
        BEGIN
            SELECT @DescPais = descpais FROM paises WHERE codpais = @Pais;
            IF @DescPais IS NULL SET @DescPais = @Pais;
            
            UPDATE [dbo].[cl2]
            SET
                codpais = @Pais,
                descpais = @DescPais,
                ousrdata = @DataAtual,
                ousrinis = 'web',
                ousrhora = CONVERT(VARCHAR(8), @DataAtual, 108)
            WHERE cl2stamp = @ClStamp;
        END
        
        -- Processar campos personalizados (mesma lógica do criar)
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            DECLARE @CodigoCampo NVARCHAR(100);
            DECLARE @TipoDados NVARCHAR(50);
            DECLARE @Valor NVARCHAR(MAX);
            DECLARE @TabelaDestino NVARCHAR(100);
            DECLARE @CampoDestino NVARCHAR(100);
            DECLARE @CampoChaveRelacao NVARCHAR(100);
            DECLARE @SQL NVARCHAR(MAX);
            DECLARE @ValorChave NVARCHAR(50);
            
            DECLARE campo_cursor CURSOR FOR
            SELECT 
                JSON_VALUE(value, '$.codigo'),
                JSON_VALUE(value, '$.tipo'),
                JSON_VALUE(value, '$.valor')
            FROM OPENJSON(@CamposPersonalizados);
            
            OPEN campo_cursor;
            FETCH NEXT FROM campo_cursor INTO @CodigoCampo, @TipoDados, @Valor;
            
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SELECT 
                    @TabelaDestino = tabela_destino,
                    @CampoDestino = campo_destino,
                    @CampoChaveRelacao = campo_chave_relacao
                FROM cl_campos_personalizados
                WHERE codigo_campo = @CodigoCampo AND ativo = 1;
                
                IF @TabelaDestino IS NOT NULL AND @TabelaDestino != ''
                BEGIN
                    SET @ValorChave = CASE 
                        WHEN @CampoChaveRelacao = 'clstamp' THEN @ClStamp
                        ELSE CAST(@ClienteNo AS NVARCHAR(50))
                    END;
                    
                    SET @SQL = '
                        IF EXISTS (SELECT 1 FROM ' + QUOTENAME(@TabelaDestino) + ' 
                                   WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ' = @ValorChave)
                        BEGIN
                            UPDATE ' + QUOTENAME(@TabelaDestino) + '
                            SET ' + QUOTENAME(@CampoDestino) + ' = @Valor
                            WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ' = @ValorChave
                        END
                        ELSE
                        BEGIN
                            INSERT INTO ' + QUOTENAME(@TabelaDestino) + ' 
                                (' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'cl_no')) + ', ' + QUOTENAME(@CampoDestino) + ')
                            VALUES (@ValorChave, @Valor)
                        END';
                    
                    EXEC sp_executesql @SQL, 
                         N'@ValorChave NVARCHAR(50), @Valor NVARCHAR(MAX)', 
                         @ValorChave, @Valor;
                END
                ELSE
                BEGIN
                    -- Deletar e reinserir na tabela genérica
                    DELETE FROM cl_valores_personalizados
                    WHERE cliente_no = @ClienteNo AND codigo_campo = @CodigoCampo;
                    
                    INSERT INTO cl_valores_personalizados (
                        cliente_no, codigo_campo, valor_texto, valor_numero, 
                        valor_data, valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    SELECT 
                        @ClienteNo, @CodigoCampo,
                        CASE WHEN @TipoDados IN ('text', 'textarea', 'email', 'phone', 'url', 'select') 
                             THEN @Valor END,
                        CASE WHEN @TipoDados IN ('number', 'decimal') 
                             THEN TRY_CAST(@Valor AS DECIMAL(18,4)) END,
                        CASE WHEN @TipoDados = 'date' 
                             THEN TRY_CAST(@Valor AS DATE) END,
                        CASE WHEN @TipoDados = 'datetime' 
                             THEN TRY_CAST(@Valor AS DATETIME2) END,
                        CASE WHEN @TipoDados = 'boolean' 
                             THEN TRY_CAST(@Valor AS BIT) END,
                        CASE WHEN @TipoDados = 'json' 
                             THEN @Valor END,
                        @DataAtual, @DataAtual;
                END
                
                FETCH NEXT FROM campo_cursor INTO @CodigoCampo, @TipoDados, @Valor;
            END
            
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        COMMIT TRANSACTION;
        
        SELECT 
            'SUCCESS' AS Status,
            @ClienteNo AS ClienteId,
            @ClStamp AS ClStamp,
            'Cliente atualizado com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('global', 'campo_cursor') >= 0
        BEGIN
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        ROLLBACK TRANSACTION;
        
        SELECT 
            'ERROR' AS Status,
            ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO

-- ============================================
-- 3. SP: OBTER CLIENTE COMPLETO (ATUALIZADO)
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ObterClienteCompleto]
    @ClienteNo INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cl.no,
        cl.Nome,
        cl.ncont,
        cl.MOEDA,
        cl.telefone,
        cl.tlmvl,
        cl.morada,
        cl.Local,
        cl.codpost,
        cl.email,
        cl.PAIS,
        cl.descarga,
        cl.obs,
        cl.VENCIMENTO,
        cl.ALIMITE,
        cl.clstamp,
        cl.usrdata,
        cl.usrinis,
        cl.usrhora,
        cl.ousrdata,
        cl.ousrinis,
        cl.ousrhora,
        cl2.codpais,
        cl2.descpais,
        -- Campos personalizados (genéricos + externos)
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                cp.tabela_destino,
                cp.campo_destino,
                COALESCE(
                    vp.valor_texto,
                    CAST(vp.valor_numero AS NVARCHAR(50)),
                    CONVERT(VARCHAR(10), vp.valor_data, 120),
                    CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                    CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                    vp.valor_json
                ) AS valor,
                cp.grupo
            FROM cl_campos_personalizados cp
            LEFT JOIN cl_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo 
                AND vp.cliente_no = cl.no
            WHERE cp.ativo = 1
            AND cp.tabela_destino IS NULL  -- Apenas campos genéricos
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados_genericos,
        -- Campos de tabelas externas (dinâmico)
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                cp.tabela_destino,
                cp.campo_destino,
                'ver_tabela_' + cp.tabela_destino AS valor_origem
            FROM cl_campos_personalizados cp
            WHERE cp.ativo = 1
            AND cp.tabela_destino IS NOT NULL
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados_externos
    FROM cl
    LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
    WHERE cl.no = @ClienteNo;
END
GO

-- ============================================
-- 4. EXEMPLOS DE CONFIGURAÇÃO
-- ============================================

-- Exemplo 1: Campo na tabela genérica
-- INSERT INTO cl_campos_personalizados 
--     (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao)
-- VALUES 
--     ('data_aniversario', 'Data de Aniversário', 'date', 10, 'Pessoal', 0, NULL);

-- Exemplo 2: Campo na tabela CL_INFO
-- INSERT INTO cl_campos_personalizados 
--     (codigo_campo, nome_campo, tipo_dados, tabela_destino, campo_destino, campo_chave_relacao, ordem, grupo)
-- VALUES 
--     ('nome_empresa', 'Nome da Empresa', 'text', 'cl_info', 'nome_empresa', 'cl_no', 1, 'Comercial');

-- Exemplo 3: Campo na tabela CL2 (usando clstamp)
-- INSERT INTO cl_campos_personalizados 
--     (codigo_campo, nome_campo, tipo_dados, tabela_destino, campo_destino, campo_chave_relacao, ordem, grupo)
-- VALUES 
--     ('zona_comercial', 'Zona Comercial', 'text', 'cl2', 'zona', 'cl2stamp', 2, 'Comercial');

INSERT INTO cl_campos_personalizados 
    (codigo_campo, nome_campo, tipo_dados, tabela_destino, campo_destino, campo_chave_relacao, ordem, grupo)
VALUES 
    ('_id', 'Id Externo', 'text', 'cl', '_id', 'cl_no', 1, 'Comercial');


GO