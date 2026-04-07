# Brillanza Limpiezas - Documentacao do Projeto

## Visao Geral

Sistema de gestao interna para empresa de limpeza, desenvolvido com React Native (Expo) e Supabase.

---

## Stack Tecnologica

| Tecnologia | Uso |
|------------|-----|
| React Native + Expo | App mobile (Android/iOS) |
| Supabase | Backend (PostgreSQL + Auth + RLS) |
| TypeScript | Linguagem |
| React Native Paper | UI (Material Design) |
| Expo Router | Navegacao |
| React Hook Form + Zod | Formularios e validacao |
| date-fns | Manipulacao de datas |

---

## Estrutura do Projeto

```
app-brillanza/
├── app/                           # Telas (Expo Router)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             # Tela de login
│   ├── (admin)/
│   │   ├── _layout.tsx           # Layout com tabs
│   │   ├── index.tsx             # Dashboard admin
│   │   ├── clientes/             # CRUD de clientes
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Lista
│   │   │   ├── novo.tsx          # Criar
│   │   │   └── [id].tsx          # Editar/Excluir
│   │   ├── trabalhadoras/        # (Fase 2)
│   │   ├── servicos/             # (Fase 2)
│   │   └── relatorios/           # (Fase 4)
│   ├── (worker)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Agenda
│   │   └── servico/[id].tsx      # Detalhes do servico
│   ├── _layout.tsx               # Root layout
│   └── index.tsx                 # Redirect inicial
├── src/
│   ├── components/               # Componentes reutilizaveis
│   ├── contexts/
│   │   └── AuthContext.tsx       # Contexto de autenticacao
│   ├── hooks/                    # Custom hooks
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase
│   │   └── theme.ts             # Tema Material Design
│   ├── services/
│   │   └── clientes.ts          # API de clientes
│   ├── types/
│   │   └── database.ts          # Tipos TypeScript
│   └── utils/                    # Funcoes utilitarias
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── assets/                       # Icones e imagens
├── .env                          # Credenciais (NAO COMMITAR)
├── .env.example                  # Template de credenciais
├── app.json                      # Config do Expo
├── package.json
└── tsconfig.json
```

---

## Configuracao do Supabase

### Credenciais (.env)

```env
EXPO_PUBLIC_SUPABASE_URL=https://wlwfgumywjaphlfxqwfp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Tabelas Criadas

| Tabela | Descricao |
|--------|-----------|
| profiles | Perfis de usuario (admin/worker) |
| clientes | Cadastro de clientes |
| trabalhadoras | Cadastro de trabalhadoras |
| servicos | Agendamentos e execucao |

### Politicas RLS (Row Level Security)

- **Admin**: Acesso total a todas as tabelas
- **Worker**:
  - Ve apenas seus proprios servicos
  - Ve dados basicos dos clientes dos seus servicos
  - NAO ve valores financeiros
  - NAO ve servicos de outras trabalhadoras

### Funcoes SQL

| Funcao | Descricao |
|--------|-----------|
| is_admin() | Verifica se usuario e admin |
| get_trabalhadora_id() | Retorna ID da trabalhadora do usuario |
| handle_new_user() | Trigger que cria perfil automaticamente |

---

## Perfis de Usuario

### Admin
- Email: (ver .env ou gerenciador de senhas)
- Acesso: Total (CRUD clientes, trabalhadoras, servicos, relatorios)

### Worker (Trabalhadora)
- Acesso: Apenas sua agenda e servicos atribuidos
- Pode: Iniciar/finalizar servico, adicionar observacoes
- NAO pode: Ver valores, editar clientes, ver servicos de outras

---

## Funcionalidades Implementadas (Fase 1)

### Autenticacao
- [x] Login com email/senha
- [x] Persistencia de sessao
- [x] Redirecionamento por tipo de usuario
- [x] Logout

### Dashboard Admin
- [x] Cards de metricas (placeholder)
- [x] Acoes rapidas
- [x] Menu de navegacao (tabs)

### CRUD de Clientes
- [x] Listar clientes
- [x] Buscar clientes
- [x] Criar cliente
- [x] Editar cliente
- [x] Excluir cliente
- [x] Campos: nome, telefone, email, endereco, tipo servico, frequencia, tipo cobranca, valor acordado, observacoes, aceite LGPD

### Tela da Trabalhadora
- [x] Agenda com servicos agrupados por data
- [x] Detalhes do servico
- [x] Botao iniciar servico
- [x] Botao finalizar servico
- [x] Campo de observacoes
- [x] Acoes: ligar para cliente, abrir mapa

---

## Fases do Projeto

| Fase | Status | Descricao |
|------|--------|-----------|
| 1 | ✅ Concluida | Setup + Auth + CRUD Clientes |
| 2 | Pendente | CRUD Trabalhadoras + Servicos |
| 3 | Pendente | Fluxo completo da Trabalhadora |
| 4 | Pendente | Relatorios e Dashboard |

---

## Comandos

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desenvolvimento
npx expo start

# Rodar no Android
npx expo start --android

# Rodar no iOS
npx expo start --ios

# Rodar na web
npx expo start --web

# Verificar tipos TypeScript
npx tsc --noEmit
```

---

## Proximos Passos (Fase 2)

1. CRUD de Trabalhadoras
   - Listar, criar, editar, excluir
   - Vincular com usuario (user_id)
   - Definir tipos de servico e disponibilidade

2. CRUD de Servicos
   - Agendar servico
   - Atribuir cliente e trabalhadora
   - Definir valores (cliente e trabalhadora)
   - Calendario de servicos

3. Vinculacao trabalhadora <-> usuario
   - Criar usuario para trabalhadora
   - Vincular automaticamente

---

## Observacoes Importantes

1. **Seguranca**: O arquivo `.env` NAO deve ser commitado (esta no .gitignore)

2. **RLS**: Todas as tabelas tem Row Level Security habilitado. As politicas garantem que cada usuario so ve o que pode.

3. **Trigger**: Ao criar um usuario, o perfil e criado automaticamente via trigger `on_auth_user_created`

4. **Valores**: Trabalhadoras NAO veem valores financeiros (valor_cliente, valor_trabalhadora, margem)

---

## Historico de Desenvolvimento

### 12/01/2026
- Criado projeto Expo com TypeScript
- Instaladas dependencias (Supabase, Paper, Router, etc)
- Criada estrutura de pastas
- Configurado Supabase (schema + RLS + triggers)
- Implementado sistema de autenticacao
- Criada navegacao base (admin/worker)
- Implementado CRUD completo de Clientes
- Criado usuario admin de teste
