import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Certificate } from '@/types/database';

export async function generateAuditReport(certs: Certificate[]): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const total = certs.length;
  const active = certs.filter((c) => c.status === 'active').length;
  const expiringSoon = certs.filter((c) => c.status === 'expiring_soon').length;
  const expired = certs.filter((c) => c.status === 'expired').length;

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(135, 134, 135);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RAGHUVIR EXIM LIMITED', 105, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Certification Compliance Report', 105, 28, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Generated: ${today}`, 105, 50, { align: 'center' });

  // Summary box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(249, 249, 249);
  doc.roundedRect(20, 58, 170, 40, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('SUMMARY', 105, 66, { align: 'center' });

  const stats = [
    { label: 'Total', value: String(total), x: 40 },
    { label: 'Active', value: String(active), x: 82 },
    { label: 'Expiring Soon', value: String(expiringSoon), x: 124 },
    { label: 'Expired', value: String(expired), x: 166 },
  ];
  for (const s of stats) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text(s.value, s.x, 80, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(s.label, s.x, 87, { align: 'center' });
  }

  // ── Cert table ──────────────────────────────────────────────────────────────
  const rows = certs.map((c) => [
    c.name,
    c.issuing_body ?? '—',
    c.category ?? '—',
    c.expiry_date,
    c.status.replace('_', ' '),
  ]);

  autoTable(doc, {
    startY: 108,
    head: [['Certificate Name', 'Issuing Body', 'Category', 'Expiry Date', 'Status']],
    body: rows,
    bodyStyles: { fontSize: 8 },
    headStyles: { fillColor: [135, 134, 135], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const cert = certs[data.row.index];
        if (!cert) return;
        if (cert.status === 'active') {
          data.cell.styles.fillColor = [240, 255, 244];
        } else if (cert.status === 'expiring_soon') {
          data.cell.styles.fillColor = [255, 251, 235];
        } else {
          data.cell.styles.fillColor = [255, 241, 241];
        }
      }
    },
    margin: { left: 15, right: 15 },
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
