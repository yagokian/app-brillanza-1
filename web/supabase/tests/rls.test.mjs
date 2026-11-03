// Database permission tests (RLS, grants, RPCs), run against an in-memory Postgres (PGlite)
// with minimal stand-ins for Supabase's auth schema and roles.
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const db = new PGlite();
const q = (s, p) => db.query(s, p);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function expectErr(fn, m) { try { await fn(); ok(false, m); } catch (e) { ok(true, m + ' -> ' + e.message); } }

// Minimal Supabase stand-ins
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
// Apply every migration in order, as Supabase would.
const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, file), 'utf8'));
}
ok((await q(`select count(*)::int n from information_schema.columns where table_schema='public' and column_name like '%trabalhadora%'`)).rows[0].n === 0, 'no column keeps the old "trabalhadora" name');
ok(true, 'migration applied');

const A = '00000000-0000-0000-0000-00000000000a', W1 = '00000000-0000-0000-0000-0000000000b1', W2 = '00000000-0000-0000-0000-0000000000b2';
await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'a@x.es','{"nome":"Ana","tipo":"admin"}'),($2,'w1@x.es','{"nome":"Lu"}'),($3,'w2@x.es','{}')`, [A, W1, W2]);
const p = (await q(`select id,tipo,deve_trocar_senha from public.profiles order by id`)).rows;
ok(p.every(r => r.tipo === 'worker'), 'signup metadata cannot create an admin');
await q(`update public.profiles set tipo='admin' where id=$1`, [A]);
const [t1, t2] = [(await q(`insert into public.colaboradoras (user_id,nome,valor_pagamento) values ($1,'Lu',12) returning id`, [W1])).rows[0].id,
                  (await q(`insert into public.colaboradoras (user_id,nome) values ($1,'Bea') returning id`, [W2])).rows[0].id];
const c = (await q(`insert into public.clientes (nome,endereco,telefone,valor_acordado) values ('Casa Gràcia','C/ Verdi 1','600111222',80) returning id`)).rows[0].id;
const old = (await q(`insert into public.clientes (nome,endereco) values ('Antiga','C/ Vella 2') returning id`)).rows[0].id;
const today = (await q(`select (now() at time zone 'Europe/Madrid')::date as d`)).rows[0].d.toISOString().slice(0,10);
const s1 = (await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico,valor_cliente,valor_colaboradora) values ($1,$2,$3,80,40) returning id`, [c, t1, today])).rows[0].id;
const s2 = (await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico) values ($1,$2,$3) returning id`, [c, t2, today])).rows[0].id;
await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico) values ($1,$2,$3::date - 30)`, [old, t1, today]);

async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}

// Worker
await as(W1, async () => {
  ok((await q(`select * from public.servicos`)).rows.length === 0, 'worker sees no rows in servicos table');
  ok((await q(`select * from public.clientes`)).rows.length === 0, 'worker sees no rows in clientes table');
  ok((await q(`select * from public.colaboradoras`)).rows.length === 0, 'worker sees no rows in colaboradoras table');
  const ag = (await q(`select * from public.rpc_minha_agenda($1::date - 40, $1::date)`, [today])).rows;
  ok(ag.length === 2, 'agenda returns only own services (2)');
  ok(!('valor_cliente' in ag[0]) && !('valor_colaboradora' in ag[0]), 'agenda has no financial columns');
  const oldRow = ag.find(r => r.cliente_nome === 'Antiga');
  ok(oldRow && oldRow.cliente_endereco === null, 'old service hides client address');
  ok(ag.find(r => r.id === s1).cliente_telefone === '600111222', 'today service shows client phone');
  const det = (await q(`select * from public.rpc_meu_servico($1)`, [s1])).rows;
  ok(det.length === 1 && det[0].cliente_telefone === '600111222', 'detail returns own service');
  ok((await q(`select * from public.rpc_meu_servico($1)`, [s2])).rows.length === 0, 'detail hides other worker service');
  ok((await q(`select * from public.rpc_meu_servico($1)`, [oldRow.id])).rows[0].cliente_endereco === null, 'detail of old service hides client address');
  // No worker-callable RPC may return a column named like a financial value.
  const fin = (await q(`select p.proname, a.n from pg_proc p cross join lateral unnest(p.proargnames) a(n)
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname like 'rpc\\_%' and p.proname not like 'rpc\\_admin\\_%'
      and a.n ~ '(valor|preco|pagamento|cobranca|margem)'`)).rows;
  ok(fin.length === 0, 'no worker RPC exposes financial columns' + (fin.length ? ' ' + JSON.stringify(fin) : ''));
  ok((await q(`select public.rpc_iniciar_servico($1) r`, [s1])).rows[0].r === true, 'worker starts own service');
  ok((await q(`select public.rpc_iniciar_servico($1) r`, [s2])).rows[0].r === false, 'worker cannot start other worker service');
  ok((await q(`select public.rpc_salvar_checklist($1,'{"Cocina":true}') r`, [s1])).rows[0].r === true, 'worker saves checklist');
  ok((await q(`select public.rpc_finalizar_servico($1,'ok') r`, [s1])).rows[0].r === true, 'worker finishes service');
  await q(`update public.profiles set tipo='admin' where id=$1`, [W1]);
  await expectErr(() => q(`select public.rpc_admin_anonimizar_cliente($1)`, [c]), 'worker cannot call admin RPC');
  await q(`select public.rpc_concluir_troca_senha()`); await q(`select public.rpc_definir_idioma('pt')`);
  const me = (await q(`select tipo,idioma,deve_trocar_senha from public.profiles`)).rows;
  ok(me.length === 1 && me[0].tipo === 'worker', 'worker reads only own profile and cannot self-promote');
  ok(me[0].idioma === 'pt' && me[0].deve_trocar_senha === false, 'worker updates own language/password flag via RPC');
  await expectErr(() => q(`select * from public.audit_log`).then(r => { if (r.rows.length === 0) throw new Error('0 rows'); }), 'worker cannot read audit log');
});

// Anonymous
await db.exec(`set role anon`);
await expectErr(() => q(`select * from public.clientes`), 'anon has no table access');
await expectErr(() => q(`select * from public.rpc_minha_agenda(current_date, current_date)`), 'anon cannot call RPC');
await db.exec(`reset role`);

// Admin
await as(A, async () => {
  ok((await q(`select * from public.servicos`)).rows.length === 3, 'admin sees all services');
  const s = (await q(`select status,checklist,hora_fim_real from public.servicos where id=$1`, [s1])).rows[0];
  ok(s.status === 'concluido' && s.checklist.Cocina === true && s.hora_fim_real, 'worker updates persisted');
  const log = (await q(`select acao,campos,usuario_id from public.audit_log where registro_id=$1 order by id`, [s1])).rows;
  ok(log.length === 4 && log[1].usuario_id === W1 && log[1].campos.includes('status'), 'audit log records who/which fields');
  ok((await q(`select public.rpc_admin_anonimizar_cliente($1) r`, [c])).rows[0].r === true, 'admin anonymises client');
  const cc = (await q(`select nome,telefone,anonimizado_em from public.clientes where id=$1`, [c])).rows[0];
  ok(cc.nome === 'Cliente anonimizado' && cc.telefone === null && cc.anonimizado_em, 'client personal data removed');
  ok((await q(`select public.rpc_admin_anonimizar_colaboradora($1) r`, [t2])).rows[0].r === W2, 'worker anonymised, returns login id');
  await expectErr(() => q(`delete from public.clientes where id=$1`, [c]), 'client with services cannot be hard-deleted');
});
await q(`update public.profiles set ativo=false where id=$1`, [A]);
await as(A, async () => ok((await q(`select * from public.servicos`)).rows.length === 0, 'deactivated admin loses access'));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
