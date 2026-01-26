# HANDOFF - Brillanza Limpiezas

## Contexto do Projeto

Este documento descreve detalhadamente tudo que foi implementado no projeto Brillanza Limpiezas, um sistema de gestao interna para uma empresa de limpeza. O objetivo e permitir que outro desenvolvedor ou IA continue o desenvolvimento a partir deste ponto.

---

## 1. Especificacao Original

O sistema foi desenvolvido baseado na seguinte especificacao:

### Objetivo
Sistema de gestao interna para empresa de limpeza que permite:
- Gestao de clientes
- Gestao de trabalhadoras
- Gestao de servicos (agenda)
- Registro da execucao dos servicos
- Calculo interno de valores
- Geracao de relatorios

### Restricoes
- NAO realiza pagamentos
- NAO processa cobrancas
- NAO integra com bancos
- Todos os valores sao apenas informativos

### Perfis de Usuario

**Administrador:**
- CRUD completo de clientes
- CRUD completo de trabalhadoras
- CRUD completo de servicos
- Visualizacao de todos os dados
- Visualizacao de relatorios e metricas

**Trabalhadora:**
- Visualizar apenas servicos atribuidos a ela
- Visualizar dados basicos do cliente do servico
- Atualizar status do servico (iniciar/finalizar)
- Inserir observacoes e checklist
- NAO visualiza valores financeiros
- NAO acessa relatorios globais
- NAO edita clientes nem outras trabalhadoras

---

## 2. Decisoes Tecnicas Tomadas

### Stack Escolhida
| Tecnologia | Versao | Motivo |
|------------|--------|--------|
| React Native | 0.81.5 | Cross-platform (Android/iOS) |
| Expo | SDK 54 | Facilita desenvolvimento mobile |
| Expo Router | 6.0.21 | Navegacao file-based |
| Supabase | 2.90.1 | Backend completo (DB + Auth + RLS) |
| TypeScript | 5.9.2 | Tipagem estatica |
| React Native Paper | 5.14.5 | UI Material Design |
| React Hook Form | 7.71.0 | Gerenciamento de formularios |
| Zod | 4.3.5 | Validacao de schemas |
| date-fns | 4.1.0 | Manipulacao de datas |

### Arquitetura
- **Frontend**: React Native com Expo (managed workflow)
- **Backend**: Supabase (PostgreSQL hospedado)
- **Autenticacao**: Supabase Auth com email/senha
- **Seguranca**: Row Level Security (RLS) no banco
- **Navegacao**: Expo Router com grupos de rotas (auth, admin, worker)

---

## 3. Estrutura de Pastas Criada

```
C:/projetos/app-brillanza/
├── app/                              # EXPO ROUTER - Telas
│   ├── _layout.tsx                   # Root layout (auth check, providers)
│   ├── index.tsx                     # Redirect baseado no perfil
│   │
│   ├── (auth)/                       # GRUPO: Rotas publicas
│   │   ├── _layout.tsx               # Stack navigator
│   │   └── login.tsx                 # Tela de login
│   │
│   ├── (admin)/                      # GRUPO: Rotas do administrador
│   │   ├── _layout.tsx               # Tab navigator (5 tabs)
│   │   ├── index.tsx                 # Dashboard com metricas
│   │   │
│   │   ├── clientes/                 # CRUD COMPLETO
│   │   │   ├── _layout.tsx           # Stack navigator
│   │   │   ├── index.tsx             # Lista + busca
│   │   │   ├── novo.tsx              # Formulario de criacao
│   │   │   └── [id].tsx              # Detalhes + edicao + exclusao
│   │   │
│   │   ├── trabalhadoras/            # PLACEHOLDER (Fase 2)
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── nova.tsx
│   │   │   └── [id].tsx
│   │   │
│   │   ├── servicos/                 # PLACEHOLDER (Fase 2)
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── novo.tsx
│   │   │   └── [id].tsx
│   │   │
│   │   └── relatorios/               # PLACEHOLDER (Fase 4)
│   │       ├── _layout.tsx
│   │       └── index.tsx
│   │
│   └── (worker)/                     # GRUPO: Rotas da trabalhadora
│       ├── _layout.tsx               # Stack navigator
│       ├── index.tsx                 # Agenda (lista de servicos)
│       └── servico/
│           └── [id].tsx              # Detalhes + iniciar/finalizar
│
├── src/                              # CODIGO FONTE
│   ├── components/                   # Componentes reutilizaveis (vazio)
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx           # Context de autenticacao
│   │
│   ├── hooks/                        # Custom hooks (vazio)
│   │
│   ├── lib/
│   │   ├── supabase.ts              # Cliente Supabase configurado
│   │   └── theme.ts                 # Tema Material Design + cores de status
│   │
│   ├── services/
│   │   └── clientes.ts              # Funcoes CRUD de clientes
│   │
│   ├── types/
│   │   └── database.ts              # Tipos TypeScript das entidades
│   │
│   └── utils/                        # Funcoes utilitarias (vazio)
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Schema completo do banco
│
├── assets/                           # Icones e splash (padrao Expo)
│
├── .env                              # Credenciais Supabase (NAO COMMITAR)
├── .env.example                      # Template de credenciais
├── .gitignore                        # Arquivos ignorados
├── app.json                          # Configuracao do Expo
├── package.json                      # Dependencias
├── package-lock.json
├── tsconfig.json                     # Configuracao TypeScript
├── DOCUMENTACAO.md                   # Documentacao geral
└── HANDOFF.md                        # Este arquivo
```

---

## 4. Configuracao do Supabase

### Projeto
- **URL**: https://wlwfgumywjaphlfxqwfp.supabase.co
- **Region**: (verificar no dashboard)

### Credenciais (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://wlwfgumywjaphlfxqwfp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indsd2ZndW15d2phcGhsZnhxd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODk3MjEsImV4cCI6MjA4MzQ2NTcyMX0.kRXSEv-Mv4mjnBMROlXhciXr0nGOr0hdyKkTqTWgyyA
```

### Schema do Banco de Dados

#### Tabela: profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'worker')),
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabela: clientes
```sql
CREATE TABLE clientes (
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
```

#### Tabela: trabalhadoras
```sql
CREATE TABLE trabalhadoras (
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
```

#### Tabela: servicos
```sql
CREATE TABLE servicos (
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
```

### Funcoes SQL Criadas

```sql
-- Verifica se usuario logado e admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND tipo = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna ID da trabalhadora vinculada ao usuario logado
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

-- Trigger: cria perfil automaticamente apos signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Politicas RLS (Row Level Security)

**profiles:**
- Users can view own profile: `auth.uid() = id`
- Admin can view all profiles: `is_admin()`
- Admin can insert profiles: `is_admin()`
- Admin can update profiles: `is_admin()`

**clientes:**
- Admin full access: `is_admin()` (ALL operations)
- Worker can view client basic info: apenas clientes dos seus servicos

**trabalhadoras:**
- Admin full access: `is_admin()` (ALL operations)
- Worker can view own data: `user_id = auth.uid()`

**servicos:**
- Admin full access: `is_admin()` (ALL operations)
- Worker can view own servicos: `trabalhadora_id = get_trabalhadora_id()`
- Worker can update own servicos: `trabalhadora_id = get_trabalhadora_id()`

---

## 5. Usuario de Teste Criado

```
Email: yagokian2@gmail.com
Senha: kian2025
Tipo: admin
ID: 3254ad6b-3933-4c95-9fb7-f61723e76dfa
```

Este usuario tem acesso total ao sistema como administrador.

---

## 6. Arquivos Principais e Seu Conteudo

### app/_layout.tsx
- Configura providers (SafeAreaProvider, PaperProvider, AuthProvider)
- Verifica autenticacao e redireciona:
  - Nao autenticado -> (auth)/login
  - Admin -> (admin)
  - Worker -> (worker)
- Mostra loading enquanto carrega sessao

### src/contexts/AuthContext.tsx
- Gerencia estado de autenticacao
- Funcoes: signIn, signOut
- Expoe: user, profile, session, loading, isAdmin, isWorker
- Persiste sessao com AsyncStorage
- Busca perfil do usuario apos login

### src/lib/supabase.ts
- Cria cliente Supabase
- Configura AsyncStorage para persistencia
- Usa variaveis de ambiente EXPO_PUBLIC_*

### src/lib/theme.ts
- Define tema Material Design 3
- Cores primarias, secundarias, erro, etc.
- Cores de status: agendado (roxo), em_andamento (amarelo), concluido (verde), cancelado (vermelho)

### src/types/database.ts
- Define tipos TypeScript:
  - UserType: 'admin' | 'worker'
  - ChargeType: 'hora' | 'diaria' | 'fixo'
  - ServiceStatus: 'agendado' | 'em_andamento' | 'concluido' | 'cancelado'
  - Profile, Cliente, Trabalhadora, Servico

### src/services/clientes.ts
- getClientes(): lista todos
- getCliente(id): busca por ID
- createCliente(data): cria novo
- updateCliente(id, data): atualiza
- deleteCliente(id): exclui
- searchClientes(query): busca por nome

### app/(admin)/clientes/
- **index.tsx**: Lista com Searchbar, FAB para adicionar, FlatList com pull-to-refresh
- **novo.tsx**: Formulario com React Hook Form + Zod, campos validados
- **[id].tsx**: Formulario de edicao + botao de exclusao com confirmacao

### app/(worker)/index.tsx
- Lista servicos agrupados por data
- Mostra status com cores
- Pull-to-refresh
- Clique abre detalhes

### app/(worker)/servico/[id].tsx
- Mostra dados do cliente (nome, endereco, telefone)
- Botoes: Ligar, Abrir Mapa
- Horarios: previsto, inicio real, fim real
- Campo de observacoes
- Botao Iniciar (muda status para em_andamento)
- Botao Finalizar (muda status para concluido)

---

## 7. Dependencias Instaladas (package.json)

```json
{
  "dependencies": {
    "@expo/vector-icons": "^14.x",
    "@hookform/resolvers": "^5.2.2",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@supabase/supabase-js": "^2.90.1",
    "date-fns": "^4.1.0",
    "expo": "~54.0.31",
    "expo-constants": "~18.0.13",
    "expo-linking": "~8.0.11",
    "expo-router": "~6.0.21",
    "expo-secure-store": "~15.0.8",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-hook-form": "^7.71.0",
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-paper": "^5.14.5",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-url-polyfill": "^2.x",
    "zod": "^4.3.5"
  },
  "devDependencies": {
    "@types/react": "~19.1.0",
    "typescript": "~5.9.2"
  }
}
```

---

## 8. O Que Foi Testado e Funciona

- [x] Conexao com Supabase
- [x] Criacao de tabelas via SQL
- [x] Politicas RLS funcionando
- [x] Criacao de usuario via API
- [x] Login com email/senha
- [x] Trigger de criacao de perfil
- [x] Verificacao de tipo de usuario (admin/worker)
- [x] TypeScript compila sem erros (`npx tsc --noEmit`)
- [x] Servidor Expo inicia (`npx expo start`)

---

## 9. Problemas Conhecidos e Solucoes

### Problema 1: Erro "Database error saving new user"
**Causa**: Trigger handle_new_user() com erro
**Solucao**: Recriar a funcao com `split_part(NEW.email, '@', 1)` ao inves de `NEW.email` direto

### Problema 2: Erros de TypeScript com Supabase
**Causa**: Tipos genericos do Supabase muito restritos
**Solucao**: Remover tipo Database do createClient e usar `as any` em updates

### Problema 3: Conflito de peer dependencies no npm install
**Causa**: Versoes conflitantes de React
**Solucao**: Usar `--legacy-peer-deps` nos comandos npm

---

## 10. Proximos Passos (Fases Pendentes)

### FASE 2: Gestao Completa (Prioridade Alta)

#### 2.1 CRUD de Trabalhadoras
Criar em `app/(admin)/trabalhadoras/`:

**index.tsx** - Lista de trabalhadoras:
- Lista com avatar, nome, telefone, status (ativo/inativo)
- Filtro por status
- Busca por nome
- FAB para adicionar

**nova.tsx** - Formulario de criacao:
- Campos: nome*, telefone, tipos_de_servico (multi-select), tipo_pagamento (segmented), valor_pagamento, dias_disponiveis (multi-select), observacoes, ativo
- Opcao para criar usuario vinculado (email + senha)

**[id].tsx** - Edicao:
- Mesmos campos + botao excluir
- Se tiver user_id, mostrar email vinculado
- Opcao para desvincular/vincular usuario

**Criar arquivo** `src/services/trabalhadoras.ts`:
```typescript
getTrabalhadoras()
getTrabalhadora(id)
createTrabalhadora(data)
updateTrabalhadora(id, data)
deleteTrabalhadora(id)
searchTrabalhadoras(query)
getTrabalhadoras Disponiveis(data, horario) // para agendamento
```

#### 2.2 CRUD de Servicos
Criar em `app/(admin)/servicos/`:

**index.tsx** - Calendario/Lista:
- Visualizacao por dia/semana/mes
- Filtros: status, trabalhadora, cliente
- Cards com: cliente, trabalhadora, horario, status
- FAB para agendar

**novo.tsx** - Agendamento:
- Selecionar cliente (dropdown com busca)
- Selecionar trabalhadora (dropdown com busca, mostrar disponibilidade)
- Data e hora
- Duracao estimada
- Tipo cobranca cliente + valor
- Tipo pagamento trabalhadora + valor
- Observacoes

**[id].tsx** - Detalhes/Edicao:
- Todos os campos
- Historico de status
- Botao cancelar (com motivo)

**Criar arquivo** `src/services/servicos.ts`:
```typescript
getServicos(filtros?)
getServico(id)
createServico(data)
updateServico(id, data)
cancelarServico(id, motivo)
getServicosPorData(data)
getServicosPorTrabalhadora(trabalhadoreId)
getServicosPorCliente(clienteId)
```

#### 2.3 Vinculacao Trabalhadora <-> Usuario
- Ao criar trabalhadora, opcao de criar usuario
- Ao criar usuario com tipo 'worker', criar trabalhadora automaticamente
- Tela para vincular trabalhadora existente a usuario existente

---

### FASE 3: Fluxo da Trabalhadora (Prioridade Media)

#### 3.1 Melhorar Agenda
- Visualizacao por semana
- Indicadores visuais de status
- Notificacoes de novos servicos

#### 3.2 Execucao de Servicos
- Checklist dinamico (definido no servico)
- Fotos antes/depois (usar expo-image-picker)
- Assinatura do cliente (opcional)
- Geolocalizacao ao iniciar/finalizar

#### 3.3 Historico
- Lista de servicos concluidos
- Filtro por periodo

---

### FASE 4: Relatorios e Finalizacao (Prioridade Baixa)

#### 4.1 Dashboard Admin
Atualizar `app/(admin)/index.tsx`:
- Cards com dados reais:
  - Servicos hoje
  - Servicos esta semana
  - Em andamento agora
  - Concluidos este mes
- Grafico de servicos por status
- Proximos servicos

#### 4.2 Relatorios
Criar em `app/(admin)/relatorios/`:
- Filtros: periodo, cliente, trabalhadora
- Metricas:
  - Total de servicos
  - Total por cliente
  - Total por trabalhadora
  - Soma valores cobrados (cliente)
  - Soma valores pagos (trabalhadora)
  - Margem total e por trabalhadora
- Exportar para PDF/Excel (opcional)

#### 4.3 Ajustes Finais
- Testes em dispositivos reais
- Ajustes de UI/UX
- Performance
- Tratamento de erros
- Loading states
- Empty states

---

## 11. Comandos Uteis

```bash
# Instalar dependencias
cd C:/projetos/app-brillanza
npm install

# Iniciar servidor de desenvolvimento
npx expo start

# Iniciar no modo web
npx expo start --web

# Iniciar no Android
npx expo start --android

# Verificar TypeScript
npx tsc --noEmit

# Limpar cache
npx expo start --clear
```

---

## 12. Links Uteis

- **Supabase Dashboard**: https://supabase.com/dashboard/project/wlwfgumywjaphlfxqwfp
- **Expo Documentation**: https://docs.expo.dev
- **React Native Paper**: https://callstack.github.io/react-native-paper
- **Expo Router**: https://expo.github.io/router/docs

---

## 13. Contato/Contexto Original

Este projeto foi iniciado em 12/01/2026 baseado em uma especificacao tecnica fornecida pelo usuario. O desenvolvimento seguiu um plano em 4 fases, com a Fase 1 concluida.

A especificacao original esta no inicio da conversa e inclui detalhes sobre entidades, regras de negocio, fluxos e requisitos nao-funcionais.

---

*Documento gerado em 12/01/2026*


🟦 IDENTIDADE VISUAL – BRILLANZA LIMPIEZAS
Cor principal (Brand Primary)

A cor oficial do sistema é baseada no logotipo Brillanza Limpiezas:

Azul Brillanza
HEX: #1E88E5
RGB: 30, 136, 229


Essa cor deve ser utilizada para:

Barra superior do aplicativo (AppBar / Header)

Botões principais (Criar, Salvar, Iniciar, Finalizar)

Ícones ativos

Destaques visuais

Links e elementos de ação

Cores de apoio
Fundo principal (Branco):      #FFFFFF
Cards e inputs (Cinza claro): #F2F4F7
Texto principal:             #2E2E2E

Cores de status (serviços)

Essas cores devem ser usadas em cards, chips, badges e indicadores de status:

Agendado      → #7E57C2   (roxo)
Em andamento  → #F9A825   (amarelo)
Concluído     → #2E7D32   (verde)
Cancelado     → #C62828   (vermelho)


Essas cores ajudam a identificar rapidamente a situação de cada serviço tanto para administradores quanto para trabalhadoras.

Regra de uso visual

A interface deve ser clara e limpa

O Azul Brillanza (#1E88E5) deve ser usado com moderação, apenas em elementos de ação

Evitar telas muito escuras ou coloridas demais

Priorizar legibilidade e simplicidade