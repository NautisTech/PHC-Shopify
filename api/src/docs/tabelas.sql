-- ============================================
-- TABELAS DE CAMPOS PERSONALIZADOS - SISTEMA COMPLETO
-- Para Clientes, Encomendas e Artigos
-- ============================================

-- ============================================
-- 1. CLIENTES - TABELAS
-- ============================================

-- Tabela de configuração de campos personalizados de clientes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cl_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[cl_campos_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL,                    -- text, number, decimal, date, datetime, boolean, select, json
        tabela_destino NVARCHAR(100) NULL,                   -- Tabela PHC (ex: cl_info, cl2) ou NULL para genérica
        campo_destino NVARCHAR(100) NULL,                    -- Coluna na tabela destino
        campo_chave_relacao NVARCHAR(100) NULL,              -- FK (ex: cl_no, clstamp)
        tamanho_maximo INT NULL,
        obrigatorio BIT DEFAULT 0,
        valor_padrao NVARCHAR(MAX) NULL,
        opcoes NVARCHAR(MAX) NULL,                           -- JSON array para selects
        validacao NVARCHAR(500) NULL,                        -- Regex
        ordem INT DEFAULT 0,
        grupo NVARCHAR(100) NULL,
        visivel BIT DEFAULT 1,
        editavel BIT DEFAULT 1,
        configuracao_extra NVARCHAR(MAX) NULL,               -- JSON
        ativo BIT DEFAULT 1,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Tabela de valores personalizados de clientes (genérica)
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
    
    CREATE INDEX IX_cl_valores_cliente_no ON cl_valores_personalizados(cliente_no);
    CREATE INDEX IX_cl_valores_codigo_campo ON cl_valores_personalizados(codigo_campo);
END
GO

-- ============================================
-- 2. ENCOMENDAS - TABELAS
-- ============================================

-- Tabela de configuração de campos personalizados de encomendas
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[encomendas_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[encomendas_campos_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL,                    -- text, number, decimal, date, datetime, boolean, select, json
        tabela_destino NVARCHAR(100) NULL,                   -- Tabela PHC (ex: bo, bo2, bo3) ou NULL para genérica
        campo_destino NVARCHAR(100) NULL,                    -- Coluna na tabela destino
        campo_chave_relacao NVARCHAR(100) NULL,              -- FK (ex: ndos, bostamp, bo2stamp, bo3stamp)
        tamanho_maximo INT NULL,
        obrigatorio BIT DEFAULT 0,
        valor_padrao NVARCHAR(MAX) NULL,
        opcoes NVARCHAR(MAX) NULL,                           -- JSON array para selects
        validacao NVARCHAR(500) NULL,                        -- Regex
        ordem INT DEFAULT 0,
        grupo NVARCHAR(100) NULL,
        visivel BIT DEFAULT 1,
        editavel BIT DEFAULT 1,
        configuracao_extra NVARCHAR(MAX) NULL,               -- JSON
        ativo BIT DEFAULT 1,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Tabela de valores personalizados de encomendas (genérica)
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
    
    CREATE INDEX IX_enc_valores_encomenda_ndos ON encomendas_valores_personalizados(encomenda_ndos);
    CREATE INDEX IX_enc_valores_codigo_campo ON encomendas_valores_personalizados(codigo_campo);
END
GO

-- ============================================
-- 3. ARTIGOS/STOCK - TABELAS
-- ============================================

-- Tabela de configuração de campos personalizados de artigos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[artigos_campos_personalizados]'))
BEGIN
    CREATE TABLE [dbo].[artigos_campos_personalizados] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_campo NVARCHAR(100) UNIQUE NOT NULL,
        nome_campo NVARCHAR(255) NOT NULL,
        tipo_dados NVARCHAR(50) NOT NULL,                    -- text, number, decimal, date, datetime, boolean, select, json
        tabela_destino NVARCHAR(100) NULL,                   -- Tabela PHC (ex: st, st2) ou NULL para genérica
        campo_destino NVARCHAR(100) NULL,                    -- Coluna na tabela destino
        campo_chave_relacao NVARCHAR(100) NULL,              -- FK (ex: ref, ststamp)
        tamanho_maximo INT NULL,
        obrigatorio BIT DEFAULT 0,
        valor_padrao NVARCHAR(MAX) NULL,
        opcoes NVARCHAR(MAX) NULL,                           -- JSON array para selects
        validacao NVARCHAR(500) NULL,                        -- Regex
        ordem INT DEFAULT 0,
        grupo NVARCHAR(100) NULL,
        visivel BIT DEFAULT 1,
        editavel BIT DEFAULT 1,
        configuracao_extra NVARCHAR(MAX) NULL,               -- JSON
        ativo BIT DEFAULT 1,
        criado_em DATETIME2 DEFAULT GETDATE(),
        atualizado_em DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Tabela de valores personalizados de artigos (genérica)
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
    
    CREATE INDEX IX_art_valores_referencia ON artigos_valores_personalizados(referencia);
    CREATE INDEX IX_art_valores_codigo_campo ON artigos_valores_personalizados(codigo_campo);
END
GO