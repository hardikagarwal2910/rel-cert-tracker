/**
 * scripts/migrate.ts
 *
 * Migrates existing data from /data/*.json flat files (old SQLite version)
 * into Supabase tables using the admin client.
 *
 * Run with: npx ts-node scripts/migrate.ts
 *
 * Safe to run multiple times — uses upsert with onConflict: 'id'.
 * Sensitive fields are encrypted during migration.
 * Password hashes are preserved as-is — NEVER re-hashed.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Validate required env vars before importing modules that use them
const required = ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'ENCRYPTION_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('FATAL: Missing environment variables:', missing.join(', '));
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ENC_KEY = (process.env.ENCRYPTION_KEY ?? '').substring(0, 32);
const SOURCE_DIR = process.env.MIGRATE_SOURCE_DIR ?? path.resolve(__dirname, '../data');

function encrypt(value: string): string {
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.enc.Utf8.parse(ENC_KEY);
  const encrypted = CryptoJS.AES.encrypt(value, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

function readJson<T>(filename: string): T[] {
  const filePath = path.join(SOURCE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  [skip] ${filename} — not found`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.data ?? [];
}

async function upsertTable(
  table: string,
  rows: Record<string, unknown>[],
  conflictKey = 'id'
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey });
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
}

async function migrateUsers(rows: Record<string, unknown>[]): Promise<number> {
  const mapped = rows.map((u) => ({
    id: u.id,
    username: u.username,
    // Preserve hash exactly — never re-hash
    password_hash: u.password_hash ?? u.password,
    display_name: u.display_name ?? u.displayName,
    email: u.email,
    role: u.role ?? 'staff',
    active: u.active ?? true,
    last_login: u.last_login ?? u.lastLogin,
    created_at: u.created_at ?? new Date().toISOString(),
    updated_at: u.updated_at ?? new Date().toISOString(),
  }));
  return upsertTable('users', mapped);
}

async function migrateSuppliers(rows: Record<string, unknown>[]): Promise<number> {
  const mapped = rows.map((s) => {
    // Encrypt contact emails and phones
    const contacts = Array.isArray(s.contacts)
      ? (s.contacts as Record<string, unknown>[]).map((c) => ({
          ...c,
          email: c.email ? encrypt(String(c.email)) : c.email,
          phone: c.phone ? encrypt(String(c.phone)) : c.phone,
        }))
      : [];

    return {
      id: s.id,
      name: s.name,
      tier: s.tier,
      commodity_tags: s.commodity_tags ?? [],
      address_line_1: s.address_line_1,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      country: s.country ?? 'India',
      buyer_links: s.buyer_links ?? [],
      contacts,
      required_cert_ids: s.required_cert_ids ?? [],
      status: s.status ?? 'onboarding',
      onboarding_checklist: s.onboarding_checklist ?? {
        contacts_added: false,
        required_certs_defined: false,
        invite_sent: false,
        invite_accepted: false,
        first_cert_uploaded: false,
      },
      portal_login: s.portal_login ?? {},
      scorecard: s.scorecard ?? {
        total_submissions: 0,
        approved: 0,
        rejected: 0,
        submitted_on_time: 0,
        submitted_late: 0,
      },
      created_at: s.created_at ?? new Date().toISOString(),
      updated_at: s.updated_at ?? new Date().toISOString(),
    };
  });
  return upsertTable('suppliers', mapped);
}

async function migrateBuyers(rows: Record<string, unknown>[]): Promise<number> {
  const mapped = rows.map((b) => ({
    id: b.id,
    name: b.name,
    company: b.company,
    email: b.email ? encrypt(String(b.email)) : b.email,
    designation: b.designation,
    ip_address: b.ip_address ? encrypt(String(b.ip_address)) : null,
    geolocation: b.geolocation,
    created_at: b.created_at ?? new Date().toISOString(),
    updated_at: b.updated_at ?? new Date().toISOString(),
  }));
  return upsertTable('buyers', mapped);
}

async function main() {
  console.log('\n=== REL Certification Tracker — Data Migration ===\n');
  console.log(`Source directory: ${SOURCE_DIR}`);
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  const results: Record<string, { migrated: number; source: number }> = {};

  try {
    // 1. Users
    const users = readJson<Record<string, unknown>>('users.json');
    const usersN = await migrateUsers(users);
    results.users = { migrated: usersN, source: users.length };

    // 2. Locations
    const locations = readJson<Record<string, unknown>>('locations.json');
    const locN = await upsertTable('locations', locations);
    results.locations = { migrated: locN, source: locations.length };

    // 3. Categories
    const cats = readJson<Record<string, unknown>>('categories.json');
    const catN = await upsertTable('categories', cats, 'name');
    results.categories = { migrated: catN, source: cats.length };

    // 4. Suppliers (with contact encryption)
    const suppliers = readJson<Record<string, unknown>>('suppliers.json');
    const supN = await migrateSuppliers(suppliers);
    results.suppliers = { migrated: supN, source: suppliers.length };

    // 5. Certificates
    const certs = readJson<Record<string, unknown>>('certificates.json');
    const certN = await upsertTable('certificates', certs);
    results.certificates = { migrated: certN, source: certs.length };

    // 6. Supplier certs
    const supplierCerts = readJson<Record<string, unknown>>('supplier_certs.json');
    const scN = await upsertTable('supplier_certs', supplierCerts);
    results.supplier_certs = { migrated: scN, source: supplierCerts.length };

    // 7. Buyers (with email / IP encryption)
    const buyers = readJson<Record<string, unknown>>('buyers.json');
    const buyN = await migrateBuyers(buyers);
    results.buyers = { migrated: buyN, source: buyers.length };

    // 8. Audit log
    const auditLog = readJson<Record<string, unknown>>('audit_log.json');
    const alN = await upsertTable('audit_log', auditLog);
    results.audit_log = { migrated: alN, source: auditLog.length };

    // 9. PDF requests
    const pdfReqs = readJson<Record<string, unknown>>('pdf_requests.json');
    const prN = await upsertTable('pdf_requests', pdfReqs);
    results.pdf_requests = { migrated: prN, source: pdfReqs.length };

    // Report
    console.log('Migration Results:');
    let allMatch = true;
    for (const [table, { migrated, source }] of Object.entries(results)) {
      const ok = migrated === source;
      if (!ok) allMatch = false;
      console.log(`  ${ok ? '✓' : '⚠'} ${table.padEnd(25)} ${migrated}/${source} rows`);
    }
    if (!allMatch) {
      console.warn('\n⚠ WARNING: Some row counts do not match. Check for duplicates or errors.');
      process.exit(1);
    }
    console.log('\n✓ Migration complete — all row counts match.\n');
  } catch (err) {
    console.error('\nMigration failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
