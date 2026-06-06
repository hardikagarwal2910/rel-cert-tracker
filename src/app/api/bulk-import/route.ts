import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { createCertificate } from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';

const TEMPLATE_HEADERS = [
  'name',
  'cert_number',
  'expiry_date',
  'category',
  'location_id',
  'issuing_body',
  'buyer_visible',
  'notes',
  'renewal_cost',
];

function validateRow(row: Record<string, unknown>, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.name) errors.push(`Row ${index}: 'name' is required`);
  if (!row.expiry_date) errors.push(`Row ${index}: 'expiry_date' is required`);
  if (row.expiry_date && isNaN(Date.parse(String(row.expiry_date)))) {
    errors.push(`Row ${index}: 'expiry_date' must be a valid date (YYYY-MM-DD)`);
  }
  return { valid: errors.length === 0, errors };
}

export async function GET() {
  // Return downloadable template CSV
  const csv = TEMPLATE_HEADERS.join(',') + '\n' +
    'Example Cert,CERT-001,2025-12-31,Quality,,,TRUE,Some notes,5000\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bulk_import_template.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'BULK_IMPORT');
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
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Validate all rows
    const validRows: Record<string, unknown>[] = [];
    const allErrors: string[] = [];

    rows.forEach((row, i) => {
      const { valid, errors } = validateRow(row, i + 2); // +2 = header row + 1-based
      if (valid) validRows.push(row);
      else allErrors.push(...errors);
    });

    if (isPreview) {
      return NextResponse.json({
        total: rows.length,
        valid: validRows.length,
        invalid: allErrors.length > 0 ? rows.length - validRows.length : 0,
        errors: allErrors,
        preview: validRows.slice(0, 10),
      });
    }

    // Import valid rows
    let imported = 0;
    const importErrors: string[] = [];

    for (const row of validRows) {
      try {
        await createCertificate({
          name: String(row.name),
          expiry_date: String(row.expiry_date).split('T')[0], // normalize datetime to date
          cert_number: row.cert_number ? String(row.cert_number) : undefined,
          category: row.category ? String(row.category) : undefined,
          location_id: row.location_id ? String(row.location_id) : undefined,
          issuing_body: row.issuing_body ? String(row.issuing_body) : undefined,
          buyer_visible: String(row.buyer_visible).toLowerCase() === 'true',
          notes: row.notes ? String(row.notes) : undefined,
          renewal_cost: row.renewal_cost ? Number(row.renewal_cost) : undefined,
        });
        imported++;
      } catch {
        importErrors.push(`Failed to import row with name: ${row.name}`);
      }
    }

    appendAuditLog({
      action_type: 'bulk_import',
      user_identifier: auth.username,
      detail: `Imported ${imported}/${validRows.length} rows`,
      ip_address: ip,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped: validRows.length - imported,
      invalid: rows.length - validRows.length,
      errors: [...allErrors, ...importErrors],
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
