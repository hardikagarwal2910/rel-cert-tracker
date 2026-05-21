import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Supplier, SupplierCert } from '@/types/database';

export async function generateSupplierAuditPack(
  buyers: string[],
  suppliers: Supplier[],
  supplierCerts: SupplierCert[]
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(135, 134, 135);
  doc.rect(0, 0, 210, 50, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RAGHUVIR EXIM LIMITED', 105, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Supplier Audit Pack', 105, 28, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Prepared for: ${buyers.join(', ')}`, 105, 38, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Generated: ${today}`, 105, 58, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.text(
    `${suppliers.length} supplier(s) · ${supplierCerts.length} certificate(s)`,
    105,
    65,
    { align: 'center' }
  );

  // Build supplier id → supplier map
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  // ── Table ──────────────────────────────────────────────────────────────────
  const rows = supplierCerts.map((sc) => {
    const sup = supplierMap.get(sc.supplier_id);
    return [
      sup?.name ?? sc.supplier_id,
      sup?.tier ? `Tier ${sup.tier}` : '—',
      sc.cert_name,
      sc.expiry_date,
      sc.status.replace('_', ' '),
    ];
  });

  const statusFill = (status: string): [number, number, number] => {
    if (status === 'approved') return [240, 255, 244];
    if (status === 'pending_review') return [255, 251, 235];
    if (status === 'rejected') return [255, 241, 241];
    if (status === 'expiring_soon') return [255, 247, 230];
    return [245, 245, 245];
  };

  autoTable(doc, {
    startY: 75,
    head: [['Supplier Name', 'Tier', 'Cert Name', 'Expiry Date', 'Status']],
    body: rows,
    bodyStyles: { fontSize: 8 },
    headStyles: { fillColor: [135, 134, 135], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20 },
      2: { cellWidth: 55 },
      3: { cellWidth: 28 },
      4: { cellWidth: 27 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const sc = supplierCerts[data.row.index];
        if (sc) {
          data.cell.styles.fillColor = statusFill(sc.status);
        }
      }
    },
    margin: { left: 15, right: 15 },
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
