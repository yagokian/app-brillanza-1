-- Brillanza Limpiezas - Schema Inicial
-- Execute este script no SQL Editor do Supabase

-- Habilitar RLS em todas as tabelas
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Tabela de perfis (extende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'worker')),
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  tipo_servico TEXT,
  frequencia TEXT,
  tipo_cobranca TEXT CHECK (tipo_cobranca IN ('hora', 'diaria', 'fixo')),
  valor_acordado DECIMAL(10,2),
  observacoes TEXT,
  aceite_lgpd BOOLEAN DEFAULT false,
  data_aceite_lgpd TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de trabalhadoras
CREATE TABLE IF NOT EXISTS trabalhadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  tipos_de_servico TEXT[],
  tipo_pagamento TEXT CHECK (tipo_pagamento IN ('hora', 'diaria', 'fixo')),
  valor_pagamento DECIMAL(10,2),
  dias_disponiveis TEXT[],
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  trabalhadora_id UUID REFERENCES trabalhadoras(id) ON DELETE SET NULL,
  data_servico DATE NOT NULL,
  hora_inicio_prevista TIME,
  duracao_estimada INTERVAL,
  tipo_cobranca_cliente TEXT CHECK (tipo_cobranca_cliente IN ('hora', 'diaria', 'fixo')),
  valor_cliente DECIMAL(10,2),
  tipo_pagamento_trabalhadora TEXT CHECK (tipo_pagamento_trabalhadora IN ('hora', 'diaria', 'fixo')),
  valor_trabalhadora DECIMAL(10,2),
  status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'em_andamento', 'concluido', 'cancelado')),
  checklist JSONB,
  observacoes_trabalhadora TEXT,
  hora_inicio_real TIMESTAMPTZ,
  hora_fim_real TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_servicos_data ON servicos(data_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_trabalhadora ON servicos(trabalhadora_id);
CREATE INDEX IF NOT EXISTS idx_servicos_cliente ON servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);
CREATE INDEX IF NOT EXISTS idx_trabalhadoras_user_id ON trabalhadoras(user_id);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabalhadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND tipo = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para obter trabalhadora_id do usuário atual
CREATE OR REPLACE FUNCTION get_trabalhadora_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM trabalhadoras
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- POLÍTICAS DE PROFILES
-- =====================

-- Usuário pode ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin pode ver todos os perfis
CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admin pode inserir perfis
CREATE POLICY "Admin can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin());

-- Admin pode atualizar perfis
CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- =====================
-- POLÍTICAS DE CLIENTES
-- =====================

-- Admin tem acesso total a clientes
CREATE POLICY "Admin full access to clientes" ON clientes
  FOR ALL USING (is_admin());

-- Worker pode ver dados básicos de clientes dos seus serviços
CREATE POLICY "Worker can view client basic info" ON clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM servicos s
      JOIN trabalhadoras t ON t.id = s.trabalhadora_id
      WHERE s.cliente_id = clientes.id
      AND t.user_id = auth.uid()
    )
  );

-- =========================
-- POLÍTICAS DE TRABALHADORAS
-- =========================

-- Admin tem acesso total a trabalhadoras
CREATE POLICY "Admin full access to trabalhadoras" ON trabalhadoras
  FOR ALL USING (is_admin());

-- Trabalhadora pode ver seus próprios dados
CREATE POLICY "Worker can view own data" ON trabalhadoras
  FOR SELECT USING (user_id = auth.uid());

-- =====================
-- POLÍTICAS DE SERVIÇOS
-- =====================

-- Admin tem acesso total a serviços
CREATE POLICY "Admin full access to servicos" ON servicos
  FOR ALL USING (is_admin());

-- Worker pode ver seus próprios serviços
CREATE POLICY "Worker can view own servicos" ON servicos
  FOR SELECT USING (
    trabalhadora_id = get_trabalhadora_id()
  );

-- Worker pode atualizar seus próprios serviços (status, observações, checklist, horários)
CREATE POLICY "Worker can update own servicos" ON servicos
  FOR UPDATE USING (
    trabalhadora_id = get_trabalhadora_id()
  )
  WITH CHECK (
    trabalhadora_id = get_trabalhadora_id()
  );

-- =====================
-- TRIGGER PARA CRIAR PERFIL
-- =====================

-- Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil após signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
