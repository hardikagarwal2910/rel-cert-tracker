/**
 * Exercises the real PDF generators end-to-end so their branch logic
 * (status colour mapping, tier labels, fallbacks) is covered.
 */

import { generateAuditReport } from '@/lib/pdf-generator/audit-report';
import { generateSupplierAuditPack } from '@/lib/pdf-generator/supplier-audit-pack';
import type { Certificate, Supplier, SupplierCert } from '@/types/database';

function cert(partial: Partial<Certificate>): Certificate {
  return {
    id: 'c',
    name: 'Cert',
    expiry_date: '2027-01-01',
    status: 'active',
    buyer_tags: [],
    version_history: [],
    submitted_by_supplier: false,
    buyer_visible: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...partial,
  } as Certificate;
}

describe('generateAuditReport', () => {
  it('produces a non-empty PDF buffer covering all status branches', async () => {
    const certs = [
      cert({ id: 'a', name: 'ISO 9001', status: 'active', issuing_body: 'BIS', category: 'Quality' }),
      cert({ id: 'b', name: 'ISO 14001', status: 'expiring_soon' }),
      cert({ id: 'c', name: 'ISO 45001', status: 'expired', issuing_body: undefined, category: undefined }),
    ];
    const pdf = await generateAuditReport(certs);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
    // PDF magic header
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('handles an empty certificate list', async () => {
    const pdf = await generateAuditReport([]);
    expect(pdf.length).toBeGreaterThan(100);
  });
});

describe('generateSupplierAuditPack', () => {
  function supplier(partial: Partial<Supplier>): Supplier {
    return {
      id: 's1',
      name: 'Supplier One',
      tier: '1',
      commodity_tags: [],
      country: 'IN',
      buyer_links: ['Acme'],
      contacts: [],
      required_cert_ids: [],
      status: 'active',
      onboarding_checklist: {} as Supplier['onboarding_checklist'],
      portal_login: {} as Supplier['portal_login'],
      scorecard: {} as Supplier['scorecard'],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      ...partial,
    } as Supplier;
  }

  function scert(partial: Partial<SupplierCert>): SupplierCert {
    return {
      id: 'sc',
      supplier_id: 's1',
      cert_name: 'ISO 9001',
      expiry_date: '2027-01-01',
      status: 'approved',
      buyer_links: [],
      ocr_result: {},
      review: {},
      version_history: [],
      notification_log: [],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      ...partial,
    } as SupplierCert;
  }

  it('produces a PDF covering all supplier-cert status colours', async () => {
    const suppliers = [supplier({ id: 's1', tier: '1' }), supplier({ id: 's2', name: 'Supplier Two', tier: null })];
    const certs = [
      scert({ id: 'x1', supplier_id: 's1', status: 'approved' }),
      scert({ id: 'x2', supplier_id: 's1', status: 'pending_review' }),
      scert({ id: 'x3', supplier_id: 's2', status: 'rejected' }),
      scert({ id: 'x4', supplier_id: 's2', status: 'expiring_soon' }),
      scert({ id: 'x5', supplier_id: 'unknown', status: 'expired' }), // missing supplier → fallback
    ];
    const pdf = await generateSupplierAuditPack(['Acme'], suppliers, certs);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
