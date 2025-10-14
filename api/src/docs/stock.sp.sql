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
    
    -- Contar total de registos (apenas artigos com _site = 1)
    SELECT @Total = COUNT(*)
    FROM st -- TABELA DE ARTIGOS DO PHC
    WHERE _site = 1 -- APENAS ARTIGOS DISPONÍVEIS PARA WEB
    AND (@Busca IS NULL 
        OR design LIKE '%' + @Busca + '%'  -- título
        OR ref LIKE '%' + @Busca + '%'     -- referência
        OR 'pedir_david_marca' LIKE '%' + @Busca + '%'); -- marca
    
    -- Buscar registos paginados com campos personalizados
    SELECT 
        @Total AS total,
        @Pagina AS pagina,
        @Limite AS limite,
        (
            SELECT 
                st.design AS titulo,
                st.ref AS referencia,
                'pedir_david_marca' AS marca, -- CAMPO A CONFIRMAR
                'pedir_david_descricao' AS descricao, -- CAMPO A CONFIRMAR
                st.epv1 AS preco,
                'pedir_david_preco_promocional' AS precoPromocional, -- CAMPO A CONFIRMAR
                'pedir_david_peso' AS peso, -- CAMPO A CONFIRMAR
                'pedir_david_stock' AS stock, -- CAMPO A CONFIRMAR
                cam.codigo_externo AS codigoExterno,
                -- Subconsulta para campos personalizados em JSON
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
                    ORDER BY cp.ordem
                    FOR JSON PATH
                ) AS camposPersonalizados
            FROM st
            LEFT JOIN artigos_codigo_externo cam ON cam.referencia = st.ref
            WHERE (@Busca IS NULL 
                OR st.design LIKE '%' + @Busca + '%'
                OR st.ref LIKE '%' + @Busca + '%'
                OR 'pedir_david_marca' LIKE '%' + @Busca + '%')
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
        'pedir_david_marca' AS marca, -- CAMPO A CONFIRMAR
        'pedir_david_descricao' AS descricao, -- CAMPO A CONFIRMAR
        st.epv1 AS preco,
        'pedir_david_preco_promocional' AS precoPromocional, -- CAMPO A CONFIRMAR
        'pedir_david_peso' AS peso, -- CAMPO A CONFIRMAR
        'pedir_david_stock' AS stock, -- CAMPO A CONFIRMAR
        cam.codigo_externo AS codigoExterno,
        -- Referências associadas (subconsulta JSON)
        (
            SELECT ra.ref_associada
            FROM 'pedir_david_tabela_referencias_associadas' ra -- TABELA A CONFIRMAR
            WHERE ra.ref_principal = st.ref
            FOR JSON PATH
        ) AS referenciasAssociadas,
        'pedir_david_ficha_tecnica_pdf' AS fichaTecnicaPdf, -- CAMPO A CONFIRMAR
        st.usrdata AS dataCriacao,
        st.ousrdata AS dataAtualizacao,
        -- Campos personalizados em JSON
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
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS camposPersonalizados
    FROM st
    LEFT JOIN artigos_codigo_externo cam ON cam.referencia = st.ref
    WHERE st.ref = @Referencia;
END
GO

-- ============================================
-- 3. SP: REGISTAR CÓDIGO EXTERNO DO ARTIGO
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_RegistarCodigoExternoArtigo]
    @Referencia NVARCHAR(50),
    @CodigoExterno NVARCHAR(100),
    @Observacoes NVARCHAR(MAX) = NULL,
    @CamposPersonalizados NVARCHAR(MAX) = NULL -- JSON: [{"codigo":"campo","tipo":"text","valor":"valor"}]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        -- Verificar se artigo existe
        IF NOT EXISTS (SELECT 1 FROM st WHERE ref = @Referencia)
        BEGIN
            RAISERROR('Artigo não encontrado', 16, 1);
            RETURN;
        END
        
        -- Verificar se código externo já existe para outro artigo
        IF EXISTS (
            SELECT 1 
            FROM artigos_codigo_externo 
            WHERE codigo_externo = @CodigoExterno 
            AND referencia != @Referencia
        )
        BEGIN
            RAISERROR('Código externo já está associado a outro artigo', 16, 1);
            RETURN;
        END
        
        -- Inserir ou atualizar código externo
        MERGE INTO artigos_codigo_externo AS target
        USING (SELECT @Referencia AS ref, @CodigoExterno AS cod) AS source
        ON target.referencia = source.ref
        WHEN MATCHED THEN
            UPDATE SET 
                codigo_externo = source.cod,
                observacoes = @Observacoes,
                atualizado_em = @DataAtual
        WHEN NOT MATCHED THEN
            INSERT (referencia, codigo_externo, observacoes, criado_em, atualizado_em)
            VALUES (source.ref, source.cod, @Observacoes, @DataAtual, @DataAtual);
        
        -- Processar campos personalizados se fornecidos
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            -- Deletar valores existentes dos campos que vão ser atualizados
            DELETE FROM artigos_valores_personalizados
            WHERE referencia = @Referencia
            AND codigo_campo IN (
                SELECT JSON_VALUE(value, '$.codigo')
                FROM OPENJSON(@CamposPersonalizados)
            );
            
            -- Inserir novos valores
            INSERT INTO artigos_valores_personalizados (
                referencia,
                codigo_campo,
                valor_texto,
                valor_numero,
                valor_data,
                valor_datetime,
                valor_boolean,
                valor_json,
                criado_em,
                atualizado_em
            )
            SELECT 
                @Referencia,
                JSON_VALUE(value, '$.codigo'),
                CASE WHEN JSON_VALUE(value, '$.tipo') IN ('text', 'textarea', 'email', 'phone', 'url', 'select') 
                     THEN JSON_VALUE(value, '$.valor') END,
                CASE WHEN JSON_VALUE(value, '$.tipo') IN ('number', 'decimal') 
                     THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DECIMAL(18,4)) END,
                CASE WHEN JSON_VALUE(value, '$.tipo') = 'date' 
                     THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DATE) END,
                CASE WHEN JSON_VALUE(value, '$.tipo') = 'datetime' 
                     THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DATETIME2) END,
                CASE WHEN JSON_VALUE(value, '$.tipo') = 'boolean' 
                     THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS BIT) END,
                CASE WHEN JSON_VALUE(value, '$.tipo') = 'json' 
                     THEN JSON_QUERY(value, '$.valor') END,
                @DataAtual,
                @DataAtual
            FROM OPENJSON(@CamposPersonalizados);
        END
        
        COMMIT TRANSACTION;
        
        SELECT 
            'SUCCESS' AS Status,
            'Código externo registado com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        
        SELECT 
            'ERROR' AS Status,
            ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO

-- ============================================
-- 4. SP: ATUALIZAR CAMPOS PERSONALIZADOS
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_AtualizarCamposPersonalizadosArtigo]
    @Referencia NVARCHAR(50),
    @CamposPersonalizados NVARCHAR(MAX) -- JSON: [{"codigo":"campo","tipo":"text","valor":"valor"}]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @DataAtual DATETIME = GETDATE();
    
    BEGIN TRY
        -- Verificar se artigo existe
        IF NOT EXISTS (SELECT 1 FROM st WHERE ref = @Referencia)
        BEGIN
            RAISERROR('Artigo não encontrado', 16, 1);
            RETURN;
        END
        
        -- Deletar valores existentes dos campos que vão ser atualizados
        DELETE FROM artigos_valores_personalizados
        WHERE referencia = @Referencia
        AND codigo_campo IN (
            SELECT JSON_VALUE(value, '$.codigo')
            FROM OPENJSON(@CamposPersonalizados)
        );
        
        -- Inserir novos valores
        INSERT INTO artigos_valores_personalizados (
            referencia,
            codigo_campo,
            valor_texto,
            valor_numero,
            valor_data,
            valor_datetime,
            valor_boolean,
            valor_json,
            criado_em,
            atualizado_em
        )
        SELECT 
            @Referencia,
            JSON_VALUE(value, '$.codigo'),
            CASE WHEN JSON_VALUE(value, '$.tipo') IN ('text', 'textarea', 'email', 'phone', 'url', 'select') 
                 THEN JSON_VALUE(value, '$.valor') END,
            CASE WHEN JSON_VALUE(value, '$.tipo') IN ('number', 'decimal') 
                 THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DECIMAL(18,4)) END,
            CASE WHEN JSON_VALUE(value, '$.tipo') = 'date' 
                 THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DATE) END,
            CASE WHEN JSON_VALUE(value, '$.tipo') = 'datetime' 
                 THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS DATETIME2) END,
            CASE WHEN JSON_VALUE(value, '$.tipo') = 'boolean' 
                 THEN TRY_CAST(JSON_VALUE(value, '$.valor') AS BIT) END,
            CASE WHEN JSON_VALUE(value, '$.tipo') = 'json' 
                 THEN JSON_QUERY(value, '$.valor') END,
            @DataAtual,
            @DataAtual
        FROM OPENJSON(@CamposPersonalizados);
        
        COMMIT TRANSACTION;
        
        SELECT 
            'SUCCESS' AS Status,
            'Campos personalizados atualizados com sucesso' AS Mensagem;
            
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        
        SELECT 
            'ERROR' AS Status,
            ERROR_MESSAGE() AS ErrorMessage;
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
        'pedir_david_marca' AS marca, -- CAMPO A CONFIRMAR
        'pedir_david_descricao' AS descricao, -- CAMPO A CONFIRMAR
        st.epv1 AS preco,
        'pedir_david_preco_promocional' AS precoPromocional, -- CAMPO A CONFIRMAR
        'pedir_david_peso' AS peso, -- CAMPO A CONFIRMAR
        'pedir_david_stock' AS stock, -- CAMPO A CONFIRMAR
        NULL AS codigoExterno,
        -- Campos personalizados
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
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS camposPersonalizados
    FROM st
    LEFT JOIN artigos_codigo_externo cam ON cam.referencia = st.ref
    WHERE cam.codigo_externo IS NULL -- Artigos sem código externo
    ORDER BY st.ref DESC;
END
GO

-- ============================================
-- 6. TABELAS AUXILIARES
-- ============================================

-- Tabela para mapeamento de códigos externos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[artigos_codigo_externo]'))
BEGIN
    CREATE TABLE [dbo].[artigos_codigo_externo] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        referencia NVARCHAR(50) UNIQUE NOT NULL,
        codigo_externo NVARCHAR(100) UNIQUE NOT NULL,
        observacoes NVARCHAR(MAX) NULL,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_referencia ON artigos_codigo_externo(referencia);
    CREATE INDEX IX_codigo_externo ON artigos_codigo_externo(codigo_externo);
END
GO

-- Tabela de definição de campos personalizados
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[artigos_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[artigos_campos_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL, -- text, number, decimal, date, datetime, boolean, select, json
        tamanho_maximo INT NULL,
        obrigatorio BIT DEFAULT 0,
        valor_padrao NVARCHAR(MAX) NULL,
        opcoes NVARCHAR(MAX) NULL, -- JSON array para selects
        validacao NVARCHAR(500) NULL, -- Regex
        ordem INT DEFAULT 0,
        grupo NVARCHAR(100) NULL,
        visivel BIT DEFAULT 1,
        editavel BIT DEFAULT 1,
        configuracao_extra NVARCHAR(MAX) NULL, -- JSON
        ativo BIT DEFAULT 1,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Tabela de valores personalizados dos artigos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[artigos_valores_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[artigos_valores_personalizados] (
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
-- 7. INSERIR CAMPOS PERSONALIZADOS EXEMPLO
-- ============================================

-- Exemplos de campos personalizados para artigos
IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'garantia_meses')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao, configuracao_extra)
    VALUES 
        ('garantia_meses', 'Garantia (meses)', 'number', 1, 'Especificações', 0, '24', '{"minimo":0,"maximo":120}');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'destaque_homepage')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao)
    VALUES 
        ('destaque_homepage', 'Destaque na Homepage', 'boolean', 2, 'Marketing', 0, 'false');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'categoria_ecommerce')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, opcoes)
    VALUES 
        ('categoria_ecommerce', 'Categoria E-commerce', 'select', 3, 'Marketing', 0, 
         '["Eletrónica","Informática","Telefonia","Acessórios","Outros"]');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'sincronizado')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao)
    VALUES 
        ('sincronizado', 'Sincronizado com App Externa', 'boolean', 4, 'Sistema', 0, 'false');
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'data_sincronizacao')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio)
    VALUES 
        ('data_sincronizacao', 'Data de Sincronização', 'datetime', 5, 'Sistema', 0);
END

IF NOT EXISTS (SELECT 1 FROM artigos_campos_personalizados WHERE codigo_campo = 'url_produto_externo')
BEGIN
    INSERT INTO artigos_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, tamanho_maximo)
    VALUES 
        ('url_produto_externo', 'URL do Produto na App Externa', 'text', 6, 'Sistema', 0, 500);
END
GO

-- ============================================
-- 8. NOTAS IMPORTANTES PARA DAVID
-- ============================================

/*
CAMPOS A CONFIRMAR NA TABELA 'st' (artigos do PHC):

✅ JÁ CONFIRMADOS:
- design → Título do artigo
- ref → Referência do artigo
- epv1 → Preço de venda
- usrdata → Data de criação
- ousrdata → Data de atualização

❓ A CONFIRMAR COM DAVID:
- marca → Nome do campo? (ex: marca, fabricante, fornecedor)
- descricao → Campo com descrição detalhada (pode ser 'obs', 'descricao', etc.)
- precoPromocional → Preço promocional (epv2, campo específico, ou tabela de promoções?)
- peso → Peso do produto (pode estar noutra tabela)
- stock → Quantidade em stock (pode ser campo direto ou calculado da tabela 'stk')
- referenciasAssociadas → Tabela de artigos relacionados/acessórios
- fichaTecnicaPdf → Campo com caminho/URL da ficha técnica

CAMPOS PERSONALIZADOS JÁ CRIADOS (exemplos):
✅ garantia_meses (number)
✅ destaque_homepage (boolean)
✅ categoria_ecommerce (select)
✅ sincronizado (boolean)
✅ data_sincronizacao (datetime)
✅ url_produto_externo (text)

FLUXO DE SINCRONIZAÇÃO:
1. App externa: GET /stock → busca artigos
2. App externa cria produtos no seu sistema
3. App externa: POST /stock/{ref}/codigo-externo → regista mapeamento
4. Opcionalmente atualiza campos personalizados (sincronizado=true, data, url, etc.)
*/