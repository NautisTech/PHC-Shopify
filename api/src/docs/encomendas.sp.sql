-- ============================================
-- 1. FUNÇÃO: CALCULAR PRÓXIMO NÚMERO SEQUENCIAL DO ANO
-- ============================================

CREATE OR ALTER FUNCTION [dbo].[fn_ProximoObranoAno](@Ano INT)
RETURNS INT
AS
BEGIN
    DECLARE @ProximoObrano INT;
    
    SELECT @ProximoObrano = ISNULL(MAX(obrano), 0) + 1
    FROM bo
    WHERE boano = @Ano;
    
    RETURN @ProximoObrano;
END
GO

-- ============================================
-- 2. SP: CRIAR ENCOMENDA COMPLETA
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_CriarEncomendaCompleta]
    @ClienteNo INT,
    @ClienteId NVARCHAR(100),
    @DataEncomenda DATETIME,
    @Linhas NVARCHAR(MAX), -- JSON: [{"ref":"ART-001","design":"Produto","qtt":2,"preco":50.00,"iva":23,"stns":false}]
    @CamposPersonalizados NVARCHAR(MAX) = NULL -- JSON campos personalizados
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @BoStamp NVARCHAR(25);
    DECLARE @Ndos INT;
    DECLARE @Nmdos NVARCHAR(255);
    DECLARE @Obrano INT;
    DECLARE @Boano INT;
    DECLARE @DataAtual DATETIME = GETDATE();
    DECLARE @TotalEuro DECIMAL(18,2) = 0;
    DECLARE @TotalEscudos DECIMAL(18,2) = 0;
    DECLARE @Lordem INT = 10000;
    
    -- Dados do cliente
    DECLARE @ClienteNome NVARCHAR(255);
    DECLARE @ClienteNif NVARCHAR(9);
    DECLARE @ClienteMorada NVARCHAR(255);
    DECLARE @ClienteLocal NVARCHAR(100);
    DECLARE @ClienteCodPost NVARCHAR(8);
    DECLARE @ClienteTelefone NVARCHAR(20);
    DECLARE @ClienteEmail NVARCHAR(255);
    
    BEGIN TRY
        -- Obter ano da encomenda
        SET @Boano = YEAR(@DataEncomenda);
        
        -- Calcular próximo obrano do ano
        SET @Obrano = dbo.fn_ProximoObranoAno(@Boano);
        
        -- Gerar stamps (GUID de 25 caracteres)
        SET @BoStamp = SUBSTRING(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 1, 25);
        
        -- Obter dados do cliente
        SELECT 
            @ClienteNome = Nome,
            @ClienteNif = ncont,
            @ClienteMorada = morada,
            @ClienteLocal = local,
            @ClienteCodPost = codpost,
            @ClienteTelefone = COALESCE(telefone, tlmvl),
            @ClienteEmail = email
        FROM cl
        WHERE no = @ClienteNo;
        
        -- Calcular total das linhas
        SELECT @TotalEuro = SUM(CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)))
        FROM OPENJSON(@Linhas);
        
        SET @TotalEscudos = @TotalEuro * 200.482;
        
        -- Obter próximo ndos (ID auto-increment)
        SELECT @Ndos = ISNULL(MAX(ndos), 0) + 1 FROM bo;
        
        -- Gerar nmdos: "Encomenda - {ndos} - {clienteId}"
        SET @Nmdos = 'Encomenda - ' + CAST(@Ndos AS NVARCHAR(10)) + ' - ' + @ClienteId;
        
        -- ========================================
        -- INSERIR BO (Cabeçalho da Encomenda)
        -- ========================================
        INSERT INTO [dbo].[bo] (
            bostamp,
            ndos,
            nmdos,
            obrano,
            boano,
            dataobra,
            no,
            estab,
            nome,
            ncont,
            nome2,
            morada,
            local,
            codpost,
            tipo,
            totaldeb,
            etotaldeb,
            moeda,
            memissao,
            custo,
            fref,
            maquina,
            origem,
            ousrdata,
            ousrhora,
            ousrinis,
            usrdata,
            usrhora,
            usrinis
        )
        VALUES (
            @BoStamp,
            @Ndos,
            @Nmdos,
            @Obrano,
            @Boano,
            @DataEncomenda,
            @ClienteNo,
            0, -- estab sempre zero
            @ClienteNome,
            @ClienteNif,
            '', -- nome2 vazio
            @ClienteMorada,
            @ClienteLocal,
            @ClienteCodPost,
            'web',
            @TotalEscudos,
            @TotalEuro,
            'EURO',
            'EURO',
            0, -- custo
            '',
            '',
            'BO',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web'
        );
        
        -- ========================================
        -- INSERIR BO2
        -- ========================================
        INSERT INTO [dbo].[bo2] (
            bo2stamp,
            morada,
            local,
            codpost,
            telefone,
            contacto,
            email,
            tiposaft,
            ousrdata,
            ousrhora,
            ousrinis,
            usrdata,
            usrhora,
            usrinis
        )
        VALUES (
            @BoStamp,
            @ClienteMorada,
            @ClienteLocal,
            @ClienteCodPost,
            @ClienteTelefone,
            @ClienteNome,
            @ClienteEmail,
            '',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web'
        );
        
        -- ========================================
        -- INSERIR BO3
        -- ========================================
        INSERT INTO [dbo].[bo3] (
            bo3stamp,
            codpais,
            descpais,
            codmotiseimp,
            motiseimp,
            ousrdata,
            ousrhora,
            ousrinis,
            usrdata,
            usrhora,
            usrinis
        )
        VALUES (
            @BoStamp,
            'PT',
            'Portugal',
            '',
            '',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web'
        );
        
        -- ========================================
        -- INSERIR BI (Linhas da Encomenda)
        -- ========================================
        INSERT INTO [dbo].[bi] (
            bistamp,
            bostamp,
            ndos,
            nmdos,
            obrano,
            rdata,
            boano,
            dataobra,
            no,
            estab,
            nome,
            morada,
            local,
            codpost,
            ref,
            design,
            stns,
            qtt,
            iva,
            tabiva,
            armazem,
            debito,
            edebito,
            debitoori,
            edebitoori,
            ttdeb,
            ettdeb,
            lordem,
            cpoc,
            familia,
            unidade,
            usr1,
            usr2,
            usr3,
            usr4,
            usr5,
            usr6,
            ousrdata,
            ousrhora,
            ousrinis,
            usrdata,
            usrhora,
            usrinis
        )
        SELECT 
            SUBSTRING(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 1, 25) AS bistamp,
            @BoStamp,
            @Ndos,
            @Nmdos,
            @Obrano,
            @DataEncomenda,
            @Boano,
            @DataEncomenda,
            @ClienteNo,
            0,
            @ClienteNome,
            @ClienteMorada,
            @ClienteLocal,
            @ClienteCodPost,
            JSON_VALUE(value, '$.ref'),
            ISNULL(JSON_VALUE(value, '$.design'), st.design), -- Se não vier design, busca da ST
            CASE WHEN JSON_VALUE(value, '$.stns') = 'true' THEN 1 ELSE 0 END,
            CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)),
            ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23), -- IVA padrão 23%
            CASE 
                WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 6 THEN 1
                WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 23 THEN 2
                WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 13 THEN 3
                ELSE 2
            END AS tabiva,
            1, -- armazem sempre 1
            CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482, -- debito em escudos
            CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)), -- edebito em euros
            CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482, -- debitoori
            CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)), -- edebitoori
            CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482, -- ttdeb
            CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)), -- ettdeb
            @Lordem + (ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1), -- lordem incrementa
            st.cpoc,
            st.familia,
            st.unidade,
            st.usr1,
            st.usr2,
            st.usr3,
            st.usr4,
            st.usr5,
            st.usr6,
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web'
        FROM OPENJSON(@Linhas)
        LEFT JOIN st ON st.ref = JSON_VALUE(value, '$.ref');
        
        -- ========================================
        -- INSERIR BI2 (para cada linha)
        -- ========================================
        INSERT INTO [dbo].[bi2] (
            bi2stamp,
            bostamp,
            morada,
            local,
            codpost,
            telefone,
            email,
            ousrdata,
            ousrhora,
            ousrinis,
            usrdata,
            usrhora,
            usrinis
        )
        SELECT DISTINCT
            @BoStamp, -- bi2stamp = bostamp
            @BoStamp,
            @ClienteMorada,
            @ClienteLocal,
            @ClienteCodPost,
            @ClienteTelefone,
            @ClienteEmail,
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web',
            @DataAtual,
            CONVERT(VARCHAR(8), @DataAtual, 108),
            'web'
        FROM OPENJSON(@Linhas);
        
        -- ========================================
        -- PROCESSAR CAMPOS PERSONALIZADOS
        -- ========================================
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            INSERT INTO [dbo].[encomendas_valores_personalizados] (
                encomenda_ndos,
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
                @Ndos,
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
            @Ndos AS EncomendaId,
            @BoStamp AS Bostamp,
            @Obrano AS Obrano,
            @Boano AS Boano,
            @Nmdos AS Nmdos,
            @TotalEuro AS Total,
            'Encomenda criada com sucesso' AS Mensagem;
            
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
-- 3. SP: ATUALIZAR ENCOMENDA COMPLETA
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_AtualizarEncomendaCompleta]
    @Ndos INT,
    @Linhas NVARCHAR(MAX) = NULL,
    @CamposPersonalizados NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    DECLARE @BoStamp NVARCHAR(25);
    DECLARE @DataAtual DATETIME = GETDATE();
    DECLARE @TotalEuro DECIMAL(18,2) = 0;
    DECLARE @TotalEscudos DECIMAL(18,2) = 0;
    DECLARE @Lordem INT = 10000;
    
    BEGIN TRY
        -- Verificar se encomenda existe
        IF NOT EXISTS (SELECT 1 FROM bo WHERE ndos = @Ndos)
        BEGIN
            RAISERROR('Encomenda não encontrada', 16, 1);
            RETURN;
        END
        
        -- Obter bostamp
        SELECT @BoStamp = bostamp FROM bo WHERE ndos = @Ndos;
        
        -- ========================================
        -- ATUALIZAR LINHAS SE FORNECIDAS
        -- ========================================
        IF @Linhas IS NOT NULL
        BEGIN
            -- Calcular novo total
            SELECT @TotalEuro = SUM(CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)))
            FROM OPENJSON(@Linhas);
            
            SET @TotalEscudos = @TotalEuro * 200.482;
            
            -- Deletar linhas antigas
            DELETE FROM bi WHERE bostamp = @BoStamp;
            DELETE FROM bi2 WHERE bostamp = @BoStamp;
            
            -- Inserir novas linhas BI
            INSERT INTO [dbo].[bi] (
                bistamp,
                bostamp,
                ndos,
                nmdos,
                obrano,
                rdata,
                boano,
                dataobra,
                no,
                estab,
                nome,
                morada,
                local,
                codpost,
                ref,
                design,
                stns,
                qtt,
                iva,
                tabiva,
                armazem,
                debito,
                edebito,
                debitoori,
                edebitoori,
                ttdeb,
                ettdeb,
                lordem,
                cpoc,
                familia,
                unidade,
                usr1,
                usr2,
                usr3,
                usr4,
                usr5,
                usr6,
                ousrdata,
                ousrhora,
                ousrinis,
                usrdata,
                usrhora,
                usrinis
            )
            SELECT 
                SUBSTRING(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 1, 25),
                @BoStamp,
                bo.ndos,
                bo.nmdos,
                bo.obrano,
                bo.dataobra,
                bo.boano,
                bo.dataobra,
                bo.no,
                0,
                bo.nome,
                bo.morada,
                bo.local,
                bo.codpost,
                JSON_VALUE(value, '$.ref'),
                ISNULL(JSON_VALUE(value, '$.design'), st.design),
                CASE WHEN JSON_VALUE(value, '$.stns') = 'true' THEN 1 ELSE 0 END,
                CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)),
                ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23),
                CASE 
                    WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 6 THEN 1
                    WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 23 THEN 2
                    WHEN ISNULL(CAST(JSON_VALUE(value, '$.iva') AS DECIMAL(5,2)), 23) = 13 THEN 3
                    ELSE 2
                END,
                1,
                CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482,
                CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)),
                CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482,
                CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)),
                CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)) * 200.482,
                CAST(JSON_VALUE(value, '$.qtt') AS DECIMAL(18,4)) * CAST(JSON_VALUE(value, '$.preco') AS DECIMAL(18,2)),
                @Lordem + (ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1),
                st.cpoc,
                st.familia,
                st.unidade,
                st.usr1,
                st.usr2,
                st.usr3,
                st.usr4,
                st.usr5,
                st.usr6,
                @DataAtual,
                CONVERT(VARCHAR(8), @DataAtual, 108),
                'web',
                @DataAtual,
                CONVERT(VARCHAR(8), @DataAtual, 108),
                'web'
            FROM OPENJSON(@Linhas)
            CROSS JOIN bo
            LEFT JOIN st ON st.ref = JSON_VALUE(value, '$.ref')
            WHERE bo.bostamp = @BoStamp;
            
            -- Inserir BI2
            INSERT INTO [dbo].[bi2] (
                bi2stamp,
                bostamp,
                morada,
                local,
                codpost,
                telefone,
                email,
                ousrdata,
                ousrhora,
                ousrinis,
                usrdata,
                usrhora,
                usrinis
            )
            SELECT DISTINCT
                @BoStamp,
                @BoStamp,
                bo.morada,
                bo.local,
                bo.codpost,
                bo2.telefone,
                bo2.email,
                @DataAtual,
                CONVERT(VARCHAR(8), @DataAtual, 108),
                'web',
                @DataAtual,
                CONVERT(VARCHAR(8), @DataAtual, 108),
                'web'
            FROM OPENJSON(@Linhas)
            CROSS JOIN bo
            LEFT JOIN bo2 ON bo2.bo2stamp = bo.bostamp
            WHERE bo.bostamp = @BoStamp;
            
            -- Atualizar totais no BO
            UPDATE bo
            SET 
                totaldeb = @TotalEscudos,
                etotaldeb = @TotalEuro,
                ousrdata = @DataAtual,
                ousrhora = CONVERT(VARCHAR(8), @DataAtual, 108),
                ousrinis = 'web'
            WHERE bostamp = @BoStamp;
        END
        
        -- ========================================
        -- ATUALIZAR CAMPOS PERSONALIZADOS
        -- ========================================
        IF @CamposPersonalizados IS NOT NULL
        BEGIN
            -- Deletar valores existentes
            DELETE FROM encomendas_valores_personalizados
            WHERE encomenda_ndos = @Ndos
            AND codigo_campo IN (
                SELECT JSON_VALUE(value, '$.codigo')
                FROM OPENJSON(@CamposPersonalizados)
            );
            
            -- Inserir novos valores
            INSERT INTO [dbo].[encomendas_valores_personalizados] (
                encomenda_ndos,
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
                @Ndos,
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
            'Encomenda atualizada com sucesso' AS Mensagem;
            
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
-- 4. SP: OBTER ENCOMENDA POR ID
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ObterEncomendaPorId]
    @Ndos INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        bo.ndos,
        bo.nmdos,
        bo.obrano,
        bo.boano,
        bo.dataobra,
        bo.no AS clienteNo,
        bo.nome AS clienteNome,
        bo.ncont AS clienteNif,
        bo.etotaldeb AS total,
        bo.moeda,
        -- Linhas da encomenda em JSON
        (
            SELECT 
                bi.ref,
                bi.design,
                bi.qtt,
                bi.edebito AS preco,
                bi.iva,
                bi.ettdeb AS total,
                bi.stns
            FROM bi
            WHERE bi.bostamp = bo.bostamp
            ORDER BY bi.lordem
            FOR JSON PATH
        ) AS linhas,
        -- Campos personalizados em JSON
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
            FROM encomendas_campos_personalizados cp
            LEFT JOIN encomendas_valores_personalizados vp 
                ON vp.codigo_campo = cp.codigo_campo 
                AND vp.encomenda_ndos = bo.ndos
            WHERE cp.ativo = 1
            ORDER BY cp.ordem
            FOR JSON PATH
        ) AS camposPersonalizados
    FROM bo
    WHERE bo.ndos = @Ndos;
END
GO

-- ============================================
-- 5. SP: LISTAR ENCOMENDAS COM PAGINAÇÃO
-- ============================================

CREATE OR ALTER PROCEDURE [dbo].[sp_ListarEncomendas]
    @Pagina INT = 1,
    @Limite INT = 50,
    @Busca NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Offset INT = (@Pagina - 1) * @Limite;
    DECLARE @Total INT;
    
    -- Contar total
    SELECT @Total = COUNT(*)
    FROM bo
    WHERE origem = 'BO'
    AND (@Busca IS NULL 
        OR bo.nmdos LIKE '%' + @Busca + '%'
        OR bo.nome LIKE '%' + @Busca + '%'
        OR bo.ncont LIKE '%' + @Busca + '%'
        OR CAST(bo.obrano AS NVARCHAR(10)) LIKE '%' + @Busca + '%');
    
    -- Buscar registos paginados
    SELECT 
        @Total AS total,
        @Pagina AS pagina,
        @Limite AS limite,
        (
            SELECT 
                bo.ndos,
                bo.nmdos,
                bo.obrano,
                bo.boano,
                bo.dataobra,
                bo.no AS clienteNo,
                bo.nome AS clienteNome,
                bo.ncont AS clienteNif,
                bo.etotaldeb AS total,
                bo.moeda
            FROM bo
            WHERE origem = 'BO'
            AND (@Busca IS NULL 
                OR bo.nmdos LIKE '%' + @Busca + '%'
                OR bo.nome LIKE '%' + @Busca + '%'
                OR bo.ncont LIKE '%' + @Busca + '%'
                OR CAST(bo.obrano AS NVARCHAR(10)) LIKE '%' + @Busca + '%')
            ORDER BY bo.dataobra DESC, bo.ndos DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limite ROWS ONLY
            FOR JSON PATH
        ) AS dados;
END
GO

-- ============================================
-- 6. TABELAS AUXILIARES
-- ============================================

-- Tabela de campos personalizados de encomendas
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[encomendas_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[encomendas_campos_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL,
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

-- Tabela de valores personalizados de encomendas
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[encomendas_valores_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[encomendas_valores_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        encomenda_ndos INT NOT NULL,
        codigo_campo NVARCHAR(100) NOT NULL,
        valor_texto NVARCHAR(MAX) NULL,
        valor_numero DECIMAL(18,4) NULL,
        valor_data DATE NULL,
        valor_datetime DATETIME2 NULL,
        valor_boolean BIT NULL,
        valor_json NVARCHAR(MAX) NULL,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_encomenda_campo UNIQUE (encomenda_ndos, codigo_campo)
    );
    
    CREATE INDEX IX_encomenda_ndos ON encomendas_valores_personalizados(encomenda_ndos);
    CREATE INDEX IX_codigo_campo ON encomendas_valores_personalizados(codigo_campo);
END
GO

-- Tabela para mapear códigos externos de clientes (se não existir)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[clientes_codigo_externo]'))
BEGIN
    CREATE TABLE [dbo].[clientes_codigo_externo] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        cliente_no INT NOT NULL,
        codigo_externo NVARCHAR(100) UNIQUE NOT NULL,
        observacoes NVARCHAR(MAX) NULL,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_cliente_no ON clientes_codigo_externo(cliente_no);
    CREATE INDEX IX_codigo_externo ON clientes_codigo_externo(codigo_externo);
END
GO

-- ============================================
-- 7. INSERIR CAMPOS PERSONALIZADOS EXEMPLO
-- ============================================

IF NOT EXISTS (SELECT 1 FROM encomendas_campos_personalizados WHERE codigo_campo = 'metodo_pagamento')
BEGIN
    INSERT INTO encomendas_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, opcoes)
    VALUES 
        ('metodo_pagamento', 'Método de Pagamento', 'select', 1, 'Pagamento', 0, 
         '["Multibanco","MBWay","Cartão de Crédito","Transferência Bancária","PayPal"]');
END

IF NOT EXISTS (SELECT 1 FROM encomendas_campos_personalizados WHERE codigo_campo = 'observacoes_entrega')
BEGIN
    INSERT INTO encomendas_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio)
    VALUES 
        ('observacoes_entrega', 'Observações de Entrega', 'text', 2, 'Logística', 0);
END

IF NOT EXISTS (SELECT 1 FROM encomendas_campos_personalizados WHERE codigo_campo = 'urgente')
BEGIN
    INSERT INTO encomendas_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, valor_padrao)
    VALUES 
        ('urgente', 'Encomenda Urgente', 'boolean', 3, 'Logística', 0, 'false');
END

IF NOT EXISTS (SELECT 1 FROM encomendas_campos_personalizados WHERE codigo_campo = 'id_shopify')
BEGIN
    INSERT INTO encomendas_campos_personalizados 
        (codigo_campo, nome_campo, tipo_dados, ordem, grupo, obrigatorio, tamanho_maximo)
    VALUES 
        ('id_shopify', 'ID Shopify', 'text', 4, 'Sistema', 0, 100);
END
GO