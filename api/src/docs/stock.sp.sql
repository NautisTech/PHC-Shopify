-- ============================================
-- SISTEMA DE CAMPOS PERSONALIZADOS - STOCK/ARTIGOS
-- Suporta tanto tabela genérica quanto tabelas específicas do PHC
-- ============================================


-- ============================================
-- 1. SP: LISTAR ARTIGOS COM PAGINAÇÃO
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ListarArtigos]
    @Pagina INT = 1,
    @Limite INT = 50,
    @Busca NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Offset INT = (@Pagina - 1) * @Limite;
    DECLARE @Total INT;
    
    SELECT @Total = COUNT(*)
    FROM st
    WHERE _site = 1
    AND (@Busca IS NULL 
        OR design LIKE '%' + @Busca + '%'
        OR ref LIKE '%' + @Busca + '%');
    
    SELECT 
        @Total AS total,
        @Pagina AS pagina,
        @Limite AS limite,
        (
            SELECT 
                st.design AS titulo,
                st.ref AS referencia,
                st.epv1 AS preco,
                st._id AS codigoExterno,
                (
                    SELECT 
                        cp.codigo_campo AS codigo,
                        cp.tipo_dados AS tipo,
                        COALESCE(
                            vp.valor_texto,
                            CAST(vp.valor_numero AS NVARCHAR(50)),
                            CONVERT(VARCHAR(10), vp.valor_data, 120),
                            CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                            CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                            vp.valor_json
                        ) AS valor
                    FROM artigos_campos_personalizados cp
                    LEFT JOIN artigos_valores_personalizados vp 
                        ON vp.codigo_campo = cp.codigo_campo 
                        AND vp.referencia = st.ref
                    WHERE cp.ativo = 1
                    AND cp.tabela_destino IS NULL
                    ORDER BY cp.ordem
                    FOR JSON PATH
                ) AS camposPersonalizados
            FROM st
            WHERE _site = 1
            AND (@Busca IS NULL 
                OR st.design LIKE '%' + @Busca + '%'
                OR st.ref LIKE '%' + @Busca + '%')
            ORDER BY st.ref DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limite ROWS ONLY
            FOR JSON PATH
        ) AS dados;
END
GO

-- ============================================
-- 2. SP: OBTER ARTIGO POR REFERÊNCIA
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ObterArtigoPorReferencia]
    @Referencia NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        st.design AS titulo,
        st.ref AS referencia,
        st.epv1 AS preco,
        st._id AS codigoExterno,
        st.usrdata AS dataCriacao,
        st.ousrdata AS dataAtualizacao,
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                cp.grupo,
                COALESCE(
                    vp.valor_texto,
                    CAST(vp.valor_numero AS NVARCHAR(50)),
                    CONVERT(VARCHAR(10), vp.valor_data, 120),
                    CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                    CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                    vp.valor_json
                ) AS valor
            FROM artigos_campos_personalizados cp
            LEFT JOIN artigos_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo 
                AND vp.referencia = st.ref
            WHERE cp.ativo = 1
            AND cp.tabela_destino IS NULL
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados_genericos,
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                cp.tabela_destino,
                cp.campo_destino,
                cp.grupo,
                'ver_tabela_' + cp.tabela_destino AS valor_origem
            FROM artigos_campos_personalizados cp
            WHERE cp.ativo = 1
            AND cp.tabela_destino IS NOT NULL
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados_externos
    FROM st
    WHERE st.ref = @Referencia;
END
GO

-- ============================================
-- 3. SP: REGISTAR CÓDIGO EXTERNO
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_RegistarCodigoExternoArtigo]
    @Referencia NVARCHAR(50),
    @CodigoExterno NVARCHAR(100),
    @Observacoes NVARCHAR(MAX) = NULL,
    @CamposPersonalizados NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM st WHERE ref = @Referencia)
        BEGIN
            RAISERROR('Artigo não encontrado', 16, 1);
            RETURN;
        END
        
        IF EXISTS (
            SELECT 1 FROM st
            WHERE _id = @CodigoExterno AND ref != @Referencia 
        )
        BEGIN
            RAISERROR('Código externo já associado a outro artigo', 16, 1);
            RETURN;
        END
        
        MERGE INTO st AS target
        USING (SELECT @Referencia AS ref, @CodigoExterno AS cod) AS source
        ON target.referencia = source.ref
        WHEN MATCHED THEN
            UPDATE SET 
                _id = source.cod,
                ousrdata = @DataAtual
        WHEN NOT MATCHED THEN
            INSERT (referencia, _id, usrdata, ousrdata)
            VALUES (source.ref, source.cod, @DataAtual, @DataAtual);
        
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            DECLARE @CodigoCampo NVARCHAR(100);
            DECLARE @TipoDados NVARCHAR(50);
            DECLARE @Valor NVARCHAR(MAX);
            DECLARE @TabelaDestino NVARCHAR(100);
            DECLARE @CampoDestino NVARCHAR(100);
            DECLARE @CampoChaveRelacao NVARCHAR(100);
            DECLARE @SQL NVARCHAR(MAX);
            
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
                FROM artigos_campos_personalizados
                WHERE codigo_campo = @CodigoCampo AND ativo = 1;
                
                IF @TabelaDestino IS NOT NULL AND @TabelaDestino != ''
                BEGIN
                    SET @SQL = '
                        UPDATE ' + QUOTENAME(@TabelaDestino) + '
                        SET ' + QUOTENAME(@CampoDestino) + ' = @Valor
                        WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'ref')) + ' = @Referencia';
                    
                    EXEC sp_executesql @SQL, 
                         N'@Referencia NVARCHAR(50), @Valor NVARCHAR(MAX)', 
                         @Referencia, @Valor;
                END
                ELSE
                BEGIN
                    DELETE FROM artigos_valores_personalizados
                    WHERE referencia = @Referencia AND codigo_campo = @CodigoCampo;
                    
                    INSERT INTO artigos_valores_personalizados (
                        referencia, codigo_campo, valor_texto, valor_numero, 
                        valor_data, valor_datetime, valor_boolean, valor_json,
                        criado_em, atualizado_em
                    )
                    SELECT 
                        @Referencia, @CodigoCampo,
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
        
        SELECT 'SUCCESS' AS Status, 'Código externo registado com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('global', 'campo_cursor') >= 0
        BEGIN
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Status, ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO

-- ============================================
-- 4. SP: ATUALIZAR CAMPOS PERSONALIZADOS
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_AtualizarCamposPersonalizadosArtigo]
    @Referencia NVARCHAR(50),
    @CamposPersonalizados NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM st WHERE ref = @Referencia)
        BEGIN
            RAISERROR('Artigo não encontrado', 16, 1);
            RETURN;
        END
        
        DECLARE @CodigoCampo NVARCHAR(100);
        DECLARE @TipoDados NVARCHAR(50);
        DECLARE @Valor NVARCHAR(MAX);
        DECLARE @TabelaDestino NVARCHAR(100);
        DECLARE @CampoDestino NVARCHAR(100);
        DECLARE @CampoChaveRelacao NVARCHAR(100);
        DECLARE @SQL NVARCHAR(MAX);
        
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
            FROM artigos_campos_personalizados
            WHERE codigo_campo = @CodigoCampo AND ativo = 1;
            
            IF @TabelaDestino IS NOT NULL AND @TabelaDestino != ''
            BEGIN
                SET @SQL = '
                    UPDATE ' + QUOTENAME(@TabelaDestino) + '
                    SET ' + QUOTENAME(@CampoDestino) + ' = @Valor
                    WHERE ' + QUOTENAME(ISNULL(@CampoChaveRelacao, 'ref')) + ' = @Referencia';
                
                EXEC sp_executesql @SQL, 
                     N'@Referencia NVARCHAR(50), @Valor NVARCHAR(MAX)', 
                     @Referencia, @Valor;
            END
            ELSE
            BEGIN
                DELETE FROM artigos_valores_personalizados
                WHERE referencia = @Referencia AND codigo_campo = @CodigoCampo;
                
                INSERT INTO artigos_valores_personalizados (
                    referencia, codigo_campo, valor_texto, valor_numero, 
                    valor_data, valor_datetime, valor_boolean, valor_json,
                    criado_em, atualizado_em
                )
                SELECT 
                    @Referencia, @CodigoCampo,
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
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Status, 'Campos atualizados com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('global', 'campo_cursor') >= 0
        BEGIN
            CLOSE campo_cursor;
            DEALLOCATE campo_cursor;
        END
        
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Status, ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO

-- ============================================
-- 5. SP: LISTAR ARTIGOS NÃO SINCRONIZADOS
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ListarArtigosNaoSincronizados]
    @Limite INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@Limite)
        st.design AS titulo,
        st.ref AS referencia,
        st.epv1 AS preco,
        NULL AS codigoExterno
    FROM st
    WHERE st._id IS NULL
    AND st._site = 1
    ORDER BY st.ref DESC;
END
GO

-- ============================================
-- 6. CRIAR TABELAS AUXILIARES
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'artigos_campos_personalizados'))
BEGIN
    CREATE TABLE artigos_campos_personalizados (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL,
        tabela_destino NVARCHAR(100) NULL,
        campo_destino NVARCHAR(100) NULL,
        campo_chave_relacao NVARCHAR(100) NULL,
        tamanho_maximo INT NULL,
        obrigatorio BIT DEFAULT 0,
        valor_padrao NVARCHAR(MAX) NULL,
        opcoes NVARCHAR(MAX) NULL,
        validacao NVARCHAR(500) NULL,
        ordem INT DEFAULT 0,
        grupo NVARCHAR(100) NULL,
        visivel BIT DEFAULT 1,
        editavel BIT DEFAULT 1,
        configuracao_extra NVARCHAR(MAX) NULL,
        ativo BIT DEFAULT 1,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'artigos_valores_personalizados'))
BEGIN
    CREATE TABLE artigos_valores_personalizados (
        id INT IDENTITY(1,1) PRIMARY KEY,
        referencia NVARCHAR(50) NOT NULL,
        codigo_campo NVARCHAR(100) NOT NULL,
        valor_texto NVARCHAR(MAX) NULL,
        valor_numero DECIMAL(18,4) NULL,
        valor_data DATE NULL,
        valor_datetime DATETIME2 NULL,
        valor_boolean BIT NULL,
        valor_json NVARCHAR(MAX) NULL,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_artigo_campo UNIQUE (referencia, codigo_campo)
    );
    
    CREATE INDEX IX_referencia ON artigos_valores_personalizados(referencia);
    CREATE INDEX IX_codigo_campo ON artigos_valores_personalizados(codigo_campo);
END
GO

-- ============================================
-- 7. EXEMPLOS DE CAMPOS PERSONALIZADOS
-- ============================================

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'garantia_meses')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, valor_padrao)
    VALUES 
        ('garantia_meses', 'Garantia (meses)', 'number', 1, 'Especificações', '24');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'destaque_homepage')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, valor_padrao)
    VALUES 
        ('destaque_homepage', 'Destaque Homepage', 'boolean', 2, 'Marketing', 'false');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'sincronizado')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, valor_padrao)
    VALUES 
        ('sincronizado', 'Sincronizado', 'boolean', 3, 'Sistema', 'false');
END

GO