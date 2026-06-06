import { NextRequest, NextResponse } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { getSuppliers } from '@/lib/db/suppliers';
import { getSupplierCerts } from '@/lib/db/supplier-certs';
import { generateSupplierAuditPack } from '@/lib/pdf-generator/supplier-audit-pack';
import { appendAuditLog } from '@/lib/db/audit-log';
import type { SupplierCert } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'VIEW_DATA');
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const buyer = searchParams.get('buyer')?.trim();
    if (!buyer) {
      return NextResponse.json({ error: 'Buyer name is required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    // Suppliers linked to this buyer
    const suppliers = await getSuppliers({ buyer_link: buyer });

    // Gather their supplier certificates
    const certArrays = await Promise.all(suppliers.map((s) => getSupplierCerts(s.id)));
    const supplierCerts: SupplierCert[] = certArrays.flat();

    const pdf = await generateSupplierAuditPack([buyer], suppliers, supplierCerts);
    const dateStr = new Date().toISOString().split('T')[0];
    const safeBuyer = buyer.replace(/[^a-zA-Z0-9]+/g, '_');

    appendAuditLog({
      action_type: 'audit_pack.generate',
      user_identifier: auth.username,
      detail: `Audit pack for ${buyer} (${suppliers.length} suppliers, ${supplierCerts.length} certs)`,
      ip_address: ip,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="REL_Supplier_Audit_${safeBuyer}_${dateStr}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
