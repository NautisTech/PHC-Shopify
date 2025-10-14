-- ============================================
-- 1. SP: CRIAR CLIENTE COMPLETO
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
    @CamposPersonalizados NVARCHAR(MAX) = NULL -- JSON: [{"codigo":"vencimento","tipo":"number","valor":30}]
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
        
        -- Inserir na tabela CL
        INSERT INTO [dbo].[cl] (
            Nome,
            ncont,
            MOEDA,
            telefone,
            tlmvl,
            morada,
            Local,
            codpost,
            email,
            PAIS,
            descarga,
            obs,
            clstamp,
            usrdata,
            usrinis,
            usrhora,
            ousrdata,
            ousrinis,
            ousrhora,
            VENCIMENTO,
            ALIMITE
        )
        VALUES (
            @Nome,
            @Nif,
            @Moeda,
            @Telefone,
            @Telemovel,
            @Morada,
            @Local,
            @CodigoPostal,
            @Email,
            @Pais,
            @Descarga,
            @Observacoes,
            @ClStamp,
            @DataAtual,
            'web',
            CONVERT(VARCHAR(8), @DataAtual, 108), -- HH:MM:SS
            @DataAtual,
            'web',
            CONVERT(VARCHAR(8), @DataAtual, 108),
            0, -- VENCIMENTO padrão
            0  -- ALIMITE padrão (desativado)
        );
        
        SET @ClienteNo = SCOPE_IDENTITY();
        
        -- Inserir na tabela CL2
        INSERT INTO [dbo].[cl2] (
            cl2stamp,
            codpais,
            descpais,
            usrdata,
            usrinis,
            usrhora,
            ousrdata,
            ousrinis,
            ousrhora
        )
        VALUES (
            @ClStamp, -- Mesmo stamp da CL
            @Pais,
            @DescPais,
            @DataAtual,
            'web',
            CONVERT(VARCHAR(8), @DataAtual, 108),
            @DataAtual,
            'web',
            CONVERT(VARCHAR(8), @DataAtual, 108)
        );
        
        -- Processar campos personalizados se fornecidos
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[cl_valores_personalizados] (
                cliente_no,
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
                @ClienteNo,
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
            @ClienteNo AS ClienteId,
            @ClStamp AS ClStamp,
            'Cliente criado com sucesso' AS Mensagem;
            
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
-- 2. SP: ATUALIZAR CLIENTE COMPLETO
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
        
        -- Atualizar tabela CL (apenas campos não nulos)
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
            -- Buscar descrição do país
            SELECT @DescPais = descpais 
            FROM paises 
            WHERE codpais = @Pais;
            
            IF @DescPais IS NULL
                SET @DescPais = @Pais;
            
            UPDATE [dbo].[cl2]
            SET
                codpais = @Pais,
                descpais = @DescPais,
                ousrdata = @DataAtual,
                ousrinis = 'web',
                ousrhora = CONVERT(VARCHAR(8), @DataAtual, 108)
            WHERE cl2stamp = @ClStamp;
        END
        
        -- Processar campos personalizados
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            -- Deletar valores existentes dos campos que vão ser atualizados
            DELETE FROM [dbo].[cl_valores_personalizados]
            WHERE cliente_no = @ClienteNo
            AND codigo_campo IN (
                SELECT JSON_VALUE(value, '$.codigo')
                FROM OPENJSON(@CamposPersonalizados)
            );
            
            -- Inserir novos valores
            INSERT INTO [dbo].[cl_valores_personalizados] (
                cliente_no,
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
                @ClienteNo,
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
            @ClienteNo AS ClienteId,
            @ClStamp AS ClStamp,
            'Cliente atualizado com sucesso' AS Mensagem;
            
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
-- 3. SP: OBTER CLIENTE COMPLETO POR ID
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ObterClienteCompleto]
    @ClienteNo INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Dados principais do cliente
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
        -- Subconsulta para campos personalizados em JSON
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
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
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados
    FROM cl
    LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
    WHERE cl.no = @ClienteNo;
END
GO

-- ============================================
-- 4. SP: BUSCAR CLIENTE POR NIF
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_BuscarClientePorNif]
    @Nif NVARCHAR(9)
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
        cl2.codpais,
        cl2.descpais,
        (
            SELECT 
                cp.codigo_campo AS codigo,
                cp.nome_campo AS nome,
                cp.tipo_dados AS tipo,
                COALESCE(
                    vp.valor_texto,
                    CAST(vp.valor_numero AS NVARCHAR(50)),
                    CONVERT(VARCHAR(10), vp.valor_data, 120),
                    CONVERT(VARCHAR(19), vp.valor_datetime, 120),
                    CASE WHEN vp.valor_boolean = 1 THEN 'true' ELSE 'false' END,
                    vp.valor_json
                ) AS valor
            FROM cl_campos_personalizados cp
            LEFT JOIN cl_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo 
                AND vp.cliente_no = cl.no
            WHERE cp.ativo = 1
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS campos_personalizados
    FROM cl
    LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
    WHERE cl.ncont = @Nif;
END
GO

-- ============================================
-- 5. SP: LISTAR CLIENTES COM PAGINAÇÃO
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ListarClientes]
    @Pagina INT = 1,
    @Limite INT = 50,
    @Busca NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Offset INT = (@Pagina - 1) * @Limite;
    
    -- Contar total de registros
    DECLARE @Total INT;
    
    SELECT @Total = COUNT(*)
    FROM cl
    WHERE (@Busca IS NULL 
        OR cl.Nome LIKE '%' + @Busca + '%'
        OR cl.ncont LIKE '%' + @Busca + '%'
        OR cl.email LIKE '%' + @Busca + '%');
    
    -- Buscar registros paginados
    SELECT 
        @Total AS total,
        @Pagina AS pagina,
        @Limite AS limite,
        (
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
                cl.clstamp,
                cl.usrdata,
                cl2.descpais
            FROM cl
            LEFT JOIN cl2 ON cl2.cl2stamp = cl.clstamp
            WHERE (@Busca IS NULL 
                OR cl.Nome LIKE '%' + @Busca + '%'
                OR cl.ncont LIKE '%' + @Busca + '%'
                OR cl.email LIKE '%' + @Busca + '%')
            ORDER BY cl.no DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limite ROWS ONLY
            FOR JSON PATH
        ) AS dados;
END
GO

-- ============================================
-- 6. TABELAS AUXILIARES (caso não existam)
-- ============================================

-- Tabela de campos personalizados de clientes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cl_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[cl_campos_personalizados] (
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

-- Tabela de valores personalizados de clientes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cl_valores_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[cl_valores_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        cliente_no INT NOT NULL,
        codigo_campo NVARCHAR(100) NOT NULL,
        valor_texto NVARCHAR(MAX) NULL,
        valor_numero DECIMAL(18,4) NULL,
        valor_data DATE NULL,
        valor_datetime DATETIME2 NULL,
        valor_boolean BIT NULL,
        valor_json NVARCHAR(MAX) NULL,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_cliente_campo UNIQUE (cliente_no, codigo_campo)
    );
    
    CREATE INDEX IX_cliente_no ON cl_valores_personalizados(cliente_no);
    CREATE INDEX IX_codigo_campo ON cl_valores_personalizados(codigo_campo);
END
GO

-- ============================================
-- 7. INSERIR CAMPOS PERSONALIZADOS PADRÃO
-- ============================================

-- Inserir campos personalizados se não existirem
IF NOT EXISTS (SELECT 1 FROM cl_campos_personalizados WHERE codigo_campo = 'vencimento')
BEGIN
    INSERT INTO cl_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao, configuracao_extra)
    VALUES 
        ('vencimento', 'Dias de Vencimento', 'number', 1, 'Financeiro', 0, '30', '{"minimo":0,"maximo":365}');
END

IF NOT EXISTS (SELECT 1 FROM cl_campos_personalizados WHERE codigo_campo = 'alimite')
BEGIN
    INSERT INTO cl_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao)
    VALUES 
        ('alimite', 'Alerta de Limite de Crédito', 'boolean', 2, 'Financeiro', 0, 'false');
END
GO