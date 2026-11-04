@AGENTS.md

# Brillanza Limpiezas (web)

Sistema interno de gestão de uma empresa de limpeza em **Barcelona** (RGPD/LOPDGDD).
O usuário conversa em **português**. A interface é **ES + PT**.
O app Expo antigo na raiz do repo está **descontinuado**: não mexer nele.

## Stack
- Next.js 16 (App Router, `src/proxy.ts` no lugar de middleware, `cacheComponents: false`)
- Tailwind 4 + shadcn/ui estilo **base-nova**: usa Base UI, então componentes compostos recebem `render={...}`, não `asChild`
- Supabase com `@supabase/ssr` e chave **publishable**. Projeto na UE: `vzehlszyxkmeiagxdphd`
- next-intl sem prefixo de idioma na URL: o idioma vem do cookie `locale` e de `profiles.idioma`. Fuso: `Europe/Madrid`

## Estrutura
- `src/lib/auth.ts`: `getCurrentUser()` e `requireUser({ role })`. Toda página e layout protegido chama `requireUser`.
- `src/lib/supabase/{server,client,proxy}.ts`: clientes Supabase.
- `src/components/shell/`: `AppShell` (sidebar no desktop, abas embaixo no celular) e `PageHeader`.
- `messages/{es,pt}.json`: **todo texto novo entra nos dois arquivos**.
- Rotas: `/admin/*` (admin), `/agenda/*` (colaboradora), `/financeiro/*` (admin e papel `financeiro`), `/login`, `/cambiar-contrasena`, `/verificacion` (2FA do admin), `/privacidad` (pública), `/auth/sair`.
- `supabase/migrations/`: o SQL é rodado **à mão pelo usuário** no SQL Editor do Supabase. Nunca editar uma migration já aplicada; criar uma nova.

## Regras de dados e segurança (não quebrar)
- Nome do papel na interface e no banco: **colaboradora/colaboradoras**. O código do papel em `profiles.tipo` continua `'worker'`.
- Admin acessa as tabelas diretamente (RLS via `private.is_admin()`), só com sessão **AAL2** (2FA TOTP). `requireUser` manda admin sem AAL2 para `/verificacion`.
- Papel `profiles.tipo = 'financeiro'`: só o módulo financeiro (`/financeiro`), também com AAL2. Criado pelo admin em `/financeiro/usuarios`. No banco: `private.is_financeiro()` (admin ou financeiro, AAL2).
- Financeiro (`fin_*`): documentos, parcelas, movimentações e anexos só mudam pelas RPCs `rpc_fin_*` (transação, `for update`, chave de idempotência); nada é apagado, estorno é linha nova; tudo vai para `fin_historico`. Anexos no bucket privado `financeiro`, baixados por `/financeiro/anexos/[id]`. Colaboradora nunca vê nada financeiro.
- A colaboradora **não acessa tabelas**: só RPCs `public.rpc_*` com `security definer`, que **nunca** devolvem valores financeiros.
- Funções novas em `public`: dar `revoke execute ... from public, anon` e `grant ... to authenticated`.
- Todo usuário novo nasce `worker`. Nunca usar `user_metadata` para permissões.
- Exclusão de pessoas = anonimização (`rpc_admin_anonimizar_*`). `servicos.cliente_id` é `on delete restrict`. Serviço só pode ser excluído se nunca começou (trigger `bloquear_exclusao`); senão, cancelar.
- Exportações de dados pessoais passam por `src/lib/rgpd-export.ts` e ficam no `audit_log` como `EXPORT`.
- Criar ou apagar contas de login: só no servidor, com `SUPABASE_SECRET_KEY` (sem `NEXT_PUBLIC_`).
- Páginas são `no-store` e não há service worker com cache. CSP em `next.config.ts`.

## Verificação
- `npx tsc --noEmit`, `npm run lint` e `npm run build`.
- `npm run test:db`: testes de permissão do banco em Postgres em memória. Ao mudar o banco, rodar e acrescentar casos.
- O dev server roda pela config `web` em `../.claude/launch.json`. O usuário faz login ele mesmo: não digitar senhas reais.

## Fases
1. ✅ Base: login, primeiro acesso, layout responsivo, PWA, ES/PT, banco RGPD.
2. Admin: CRUD de clientes, CRUD de colaboradoras (com criação do login e senha temporária) e agenda de serviços (lista no celular, semana no desktop).
3. Colaboradora: detalhe do serviço, iniciar/finalizar, checklist, observações, histórico.
4. Relatórios e indicadores (por período, cliente e colaboradora; margens).
5. RGPD na interface: exportar e anonimizar, aviso de privacidade, 2FA de admin.
6. Testes e publicação (hospedagem com funções na UE).

Git: branch `feat/web-fase-1`, PR yagokian/app-brillanza-1#1. Commit e push só quando o usuário pedir.
