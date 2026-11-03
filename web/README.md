# Brillanza Limpiezas (web)

App web responsivo: menu lateral no computador e barra inferior no celular. No celular dá para instalar
pela opção "Adicionar à tela inicial" (PWA). Interface em espanhol e português.

Stack: Next.js 16 · Tailwind 4 · shadcn/ui · Supabase (Postgres + Auth) · next-intl.

## Configuração do Supabase (uma vez)

1. Crie um projeto **novo** no Supabase na região **Central EU (Frankfurt)** ou **West EU (Paris)**.
2. No SQL Editor, rode `supabase/migrations/20261103120000_init.sql`.
3. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.
   As contas são criadas só pela administração.
4. Crie o primeiro admin em **Authentication → Users → Add user** e promova-o no SQL Editor:
   ```sql
   update public.profiles
   set tipo = 'admin', deve_trocar_senha = false, nome = 'Seu nome'
   where id = 'ID-DO-USUARIO';
   ```
5. Em **Authentication → Multi-Factor**, ative o TOTP (2FA). A tela de 2FA para admins entra na próxima fase.
6. Assine o DPA do Supabase (Settings → Legal Documents).

## Rodar localmente

```bash
cp .env.example .env.local   # preencha URL e chave publishable do projeto
npm install
npm run dev
```

## Segurança e RGPD: o que já está no código

- **Admin**: acesso às tabelas pelo RLS. **Trabalhadora**: sem acesso direto às tabelas; usa só as
  funções `rpc_*`, que nunca devolvem valores financeiros.
- Endereço e telefone do cliente só aparecem para a trabalhadora em serviços de ontem em diante.
- Todo usuário novo nasce `worker`. Promover a admin só via SQL.
- Admin ou trabalhadora com `ativo = false` perde o acesso na hora.
- Troca de senha obrigatória no primeiro acesso.
- `audit_log` registra quem alterou quais campos e quando, mas não os valores.
- Anonimização de clientes e trabalhadoras (direito de supressão), mantendo os serviços para estatística.
- Cabeçalhos de segurança (CSP, HSTS, anti-iframe), páginas `no-store` e nenhum cache offline de dados.

## Próximas fases

2. Administração: clientes, trabalhadoras e agenda (calendário).
3. Trabalhadora: detalhe do serviço, iniciar/finalizar, checklist, histórico.
4. Relatórios e indicadores.
5. RGPD na interface: exportar e anonimizar dados, registro do aviso de privacidade, 2FA de admin.
6. Testes e publicação (hospedagem com funções na UE).
