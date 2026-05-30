import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { createSupplier } from '@/lib/db/suppliers';
import { appendAuditLog } from '@/lib/db/audit-log';
import { adminLimiter } from '@/lib/rate-limit';
import type { SupplierInput } from '@/types';

const TEMPLATE_HEADERS = [
  'Supplier Name',
  'Tier',
  'Commodity Tags',
  'Address Line 1',
  'Address Line 2',
  'City',
  'State',
  'Pincode',
  'Country',
  'Buyer Links',
  'Contact Name',
  'Contact Email',
  'Contact Phone',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitList(v: unknown): string[] {
  if (!v) return [];
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface RowResult {
  row: number;
  valid: boolean;
  name: string;
  errors: string[];
}

function validateRow(row: Record<string, unknown>, rowNum: number): RowResult {
  const errors: string[] = [];
  const name = String(row['Supplier Name'] ?? '').trim();
  const tier = String(row['Tier'] ?? '').trim();
  const city = String(row['City'] ?? '').trim();
  const state = String(row['State'] ?? '').trim();
  const country = String(row['Country'] ?? '').trim();
  const contactName = String(row['Contact Name'] ?? '').trim();
  const contactEmail = String(row['Contact Email'] ?? '').trim();

  if (!name) errors.push("'Supplier Name' is required");
  if (!['1', '2', '3'].includes(tier)) errors.push("'Tier' must be 1, 2, or 3");
  if (!city) errors.push("'City' is required");
  if (!state) errors.push("'State' is required");
  if (!country) errors.push("'Country' is required");
  if (!contactName) errors.push("'Contact Name' is required");
  if (!contactEmail) errors.push("'Contact Email' is required");
  else if (!EMAIL_RE.test(contactEmail)) errors.push("'Contact Email' is not a valid email");

  return { row: rowNum, valid: errors.length === 0, name: name || `Row ${rowNum}`, errors };
}

function rowToInput(row: Record<string, unknown>): SupplierInput {
  const contactPhone = String(row['Contact Phone'] ?? '').trim();
  return {
    name: String(row['Supplier Name']).trim(),
    tier: String(row['Tier']).trim() as SupplierInput['tier'],
    commodity_tags: splitList(row['Commodity Tags']),
    address_line_1: String(row['Address Line 1'] ?? '').trim() || undefined,
    address_line_2: String(row['Address Line 2'] ?? '').trim() || undefined,
    city: String(row['City']).trim(),
    state: String(row['State']).trim(),
    pincode: String(row['Pincode'] ?? '').trim() || undefined,
    country: String(row['Country']).trim(),
    buyer_links: splitList(row['Buyer Links']),
    contacts: [
      {
        name: String(row['Contact Name']).trim(),
        email: String(row['Contact Email']).trim(),
        phone: contactPhone || undefined,
        role: 'Primary',
      },
    ],
    required_cert_ids: [],
    status: 'onboarding',
  };
}

export async function GET() {
  // Downloadable CSV template with the correct headers.
  const example =
    'Acme Foods Ltd,1,"rice,wheat",12 Industrial Ave,,Ahmedabad,Gujarat,380001,India,Reliance,Jane Doe,jane@acme.com,+91 9876543210';
  const csv = TEMPLATE_HEADERS.join(',') + '\n' + example + '\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="supplier_bulk_import_template.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = adminLimiter(req);
  if (limited) return limited;

  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const { searchParams } = new URL(req.url);
    const isPreview = searchParams.get('preview') === 'true';

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Only CSV and XLSX files are accepted' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    const results = rows.map((row, i) => validateRow(row, i + 2));
    const validIdx = results.map((r, i) => (r.valid ? i : -1)).filter((i) => i >= 0);

    if (isPreview) {
      return NextResponse.json({
        total: rows.length,
        valid: validIdx.length,
        invalid: rows.length - validIdx.length,
        rows: results,
      });
    }

    // Import valid rows only — createSupplier encrypts contact email/phone.
    let imported = 0;
    const importErrors: string[] = [];
    for (const i of validIdx) {
      try {
        await createSupplier(rowToInput(rows[i]));
        imported++;
      } catch {
        importErrors.push(`Failed to import "${results[i].name}"`);
      }
    }

    appendAuditLog({
      action_type: 'supplier.bulk_import',
      user_identifier: auth.username,
      detail: `Imported ${imported}/${validIdx.length} suppliers (${rows.length - validIdx.length} invalid)`,
      ip_address: ip,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped: validIdx.length - imported,
      invalid: rows.length - validIdx.length,
      errors: [
        ...results.filter((r) => !r.valid).map((r) => `Row ${r.row} (${r.name}): ${r.errors.join('; ')}`),
        ...importErrors,
      ],
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
