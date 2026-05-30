/**
 * v1.1.0 — cert_documents data layer.
 */

let mockRows: Array<Record<string, unknown>> = [];
let mockSingle: Record<string, unknown> | null = null;
let lastInsert: Record<string, unknown> | null = null;

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'order']) chain[m] = jest.fn(() => chain);
  chain.insert = jest.fn((payload: Record<string, unknown>) => { lastInsert = payload; return chain; });
  chain.single = jest.fn(() => Promise.resolve({ data: mockSingle, error: null }));
  (chain as { then: unknown }).then = (onF: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: mockRows, error: null }).then(onF);
  return { adminClient: chain };
});

import { createCertDocument, getCertDocuments } from '@/lib/db/cert-documents';

beforeEach(() => { mockRows = []; mockSingle = null; lastInsert = null; });

describe('createCertDocument', () => {
  it('inserts with defaults and returns the row', async () => {
    mockSingle = { id: 'd1', cert_id: 'c1', doc_type: 'test_report', file_name: 'report.pdf', google_drive_file_id: 'drive-1' };
    const doc = await createCertDocument({ cert_id: 'c1', doc_type: 'test_report', file_name: 'report.pdf', google_drive_file_id: 'drive-1', uploaded_by: 'u1' });
    expect(doc.id).toBe('d1');
    expect(lastInsert?.cert_id).toBe('c1');
    expect(lastInsert?.cert_type).toBe('internal'); // default
    expect(lastInsert?.doc_type).toBe('test_report');
    expect(lastInsert?.google_drive_file_id).toBe('drive-1');
  });
});

describe('getCertDocuments', () => {
  it('returns documents for a cert', async () => {
    mockRows = [
      { id: 'd1', cert_id: 'c1', doc_type: 'certificate', file_name: 'cert.pdf', google_drive_file_id: 'g1' },
      { id: 'd2', cert_id: 'c1', doc_type: 'test_report', file_name: 'report.pdf', google_drive_file_id: 'g2' },
    ];
    const docs = await getCertDocuments('c1');
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.doc_type)).toContain('test_report');
  });
});
