#!/usr/bin/env node
/**
 * QR PDF for Jinan's Kitchen — opens the products page (not home).
 *
 *   node scripts/generateJinanStoreQrPdf.cjs
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const STORE_SLUG = 'jinans-kitchen';
const STORE_NAME = "Jinan's Kitchen";
/** Clean store URL — Jinan opens on Products tab by default */
const STORE_QR_URL = `https://${STORE_SLUG}.grabio.space/`;
/** Clean label on the PDF (no /products) */
const STORE_DISPLAY_URL = `${STORE_SLUG}.grabio.space`;
const OUT_PDF = path.join(process.cwd(), 'jinan', 'Jinan-Store-QR.pdf');

async function main() {
  const qrDataUrl = await QRCode.toDataURL(STORE_QR_URL, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const qrSize = 90;
  const qrX = (pageW - qrSize) / 2;
  const qrY = 55;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(STORE_NAME, pageW / 2, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Scan to view all products', pageW / 2, 42, { align: 'center' });

  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(STORE_DISPLAY_URL, pageW / 2, qrY + qrSize + 14, { align: 'center' });

  fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
  fs.writeFileSync(OUT_PDF, Buffer.from(doc.output('arraybuffer')));

  console.log('QR opens:', STORE_QR_URL);
  console.log('PDF shows:', STORE_DISPLAY_URL);
  console.log('Wrote', OUT_PDF);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
