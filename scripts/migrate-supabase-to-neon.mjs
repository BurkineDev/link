// `.env.local` d'abord (secrets locaux, ignoré par Git), `.env` en repli.
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { randomUUID } from "node:crypto";
import pg from "pg";

// Les colonnes cibles sont en `timestamp` sans fuseau : node-postgres sérialise
// les dates dans le fuseau du processus, il doit donc être UTC pour ne pas
// décaler toutes les dates copiées.
process.env.TZ = "UTC";

// Colonnes obligatoires côté Neon qui n'existent pas côté Supabase.
const FILLERS = {
  orders: { tracking_token: () => randomUUID() },
};

const { Client } = pg;

const sourceUrl = process.env.SUPABASE_DATABASE_URL;
const targetUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL and DIRECT_URL (or DATABASE_URL) are required.",
  );
}

if (sourceUrl === targetUrl) {
  throw new Error("Source and target database URLs must be different.");
}

const source = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
const target = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });

const TABLES = [
  "profiles",
  "templates",
  "shops",
  "categories",
  "products",
  "product_variants",
  "orders",
  "order_items",
  "creator_subscriptions",
  "subscription_payments",
  "boost_purchases",
  "shop_links",
  "page_blocks",
  "shop_page_views",
  "promo_codes",
];

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

async function columns(client, table) {
  const result = await client.query(
    `select column_name, data_type
       from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [table],
  );
  return result.rows.map((row) => ({ name: row.column_name, type: row.data_type }));
}

// node-postgres sérialise les tableaux JS en tableaux Postgres ({...}) et non
// en JSON : les colonnes json/jsonb doivent être passées déjà sérialisées.
const isJson = (type) => type === "json" || type === "jsonb";

async function copyRows(table) {
  const [sourceColumns, targetColumns] = await Promise.all([
    columns(source, table),
    columns(target, table),
  ]);
  const targetTypes = new Map(targetColumns.map((c) => [c.name, c.type]));
  const shared = sourceColumns
    .map((c) => c.name)
    .filter((name) => targetTypes.has(name));
  if (shared.length === 0) {
    console.info(`[migration] ${table}: skipped (no common columns)`);
    return;
  }

  const selectSql = `select ${shared.map(quote).join(", ")} from public.${quote(table)}`;
  const rows = (await source.query(selectSql)).rows;
  const fillers = Object.entries(FILLERS[table] ?? {}).filter(
    ([name]) => targetTypes.has(name) && !shared.includes(name),
  );
  const inserted = [...shared, ...fillers.map(([name]) => name)];
  const columnSql = inserted.map(quote).join(", ");

  for (const row of rows) {
    for (const [name, make] of fillers) row[name] = make(row);
    const values = inserted.map((name) =>
      isJson(targetTypes.get(name)) && row[name] !== null
        ? JSON.stringify(row[name])
        : row[name],
    );
    const placeholders = inserted
      .map((name, index) =>
        isJson(targetTypes.get(name)) ? `$${index + 1}::jsonb` : `$${index + 1}`,
      )
      .join(", ");
    await target.query(
      `insert into public.${quote(table)} (${columnSql}) values (${placeholders}) on conflict do nothing`,
      values,
    );
  }

  console.info(`[migration] ${table}: ${rows.length} row(s)`);
}

async function copyUsers() {
  const result = await source.query(`
    select id, email, encrypted_password, email_confirmed_at,
           raw_user_meta_data, created_at, updated_at
      from auth.users
     where email is not null
  `);

  for (const sourceUser of result.rows) {
    const metadata = sourceUser.raw_user_meta_data ?? {};
    const name = metadata.full_name ?? metadata.name ?? null;
    const username = metadata.username ?? null;
    const referredBy = metadata.referred_by ?? null;

    await target.query(
      `insert into public."user"
        (id, name, email, "emailVerified", image, username, referred_by, "createdAt", "updatedAt")
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict do nothing`,
      [
        sourceUser.id,
        name,
        sourceUser.email.toLowerCase(),
        Boolean(sourceUser.email_confirmed_at),
        metadata.avatar_url ?? null,
        username,
        referredBy,
        sourceUser.created_at,
        sourceUser.updated_at ?? sourceUser.created_at,
      ],
    );

    if (sourceUser.encrypted_password) {
      await target.query(
        `insert into public.account
          (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         values ($1,$2,'credential',$3::uuid,$4,$5,$6)
         on conflict ("providerId", "accountId") do nothing`,
        [
          randomUUID(),
          sourceUser.id,
          sourceUser.id,
          sourceUser.encrypted_password,
          sourceUser.created_at,
          sourceUser.updated_at ?? sourceUser.created_at,
        ],
      );
    }
  }

  console.info(`[migration] auth users: ${result.rows.length} row(s)`);
}

try {
  await Promise.all([source.connect(), target.connect()]);
  await target.query("begin");
  await copyUsers();
  for (const table of TABLES) await copyRows(table);
  // Le username de référence est celui du profil (modifiable dans le
  // tableau de bord) ; celui des métadonnées d'inscription peut être périmé.
  const synced = await target.query(`
    update public."user" u
       set username = p.username
      from public.profiles p
     where p.id = u.id
       and p.username is not null
       and u.username is distinct from p.username
  `);
  console.info(`[migration] usernames alignés sur profiles: ${synced.rowCount}`);
  await target.query("commit");
  console.info("[migration] completed successfully");
} catch (error) {
  await target.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
