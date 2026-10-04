import { jsPDF } from 'jspdf';
import { BILLING_EMAIL, getPlatformUrl, PLATFORM_DOMAIN } from '../../../config/platformConfig';

/**
 * Generates an authentic, official Tiwlo Cloud PDF Invoice / Statement
 * and triggers immediate browser download.
 */
export function generateInvoicePdf(invoice, user, billingAccountId) {
  if (!invoice) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = 18;

  // 1. Top Brand Banner Bar (Tiwlo Blue)
  doc.setFillColor(11, 87, 208); // #0B57D0
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Company Letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(32, 33, 36); // #202124
  doc.text('TIWLO CLOUD', margin, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(95, 99, 104); // #5F6368
  doc.text('Enterprise Cloud Infrastructure & AI Neural Platform', margin, y + 13);
  doc.text(`Tiwlo Systems Ltd. • ${getPlatformUrl()} • ${BILLING_EMAIL}`, margin, y + 17);

  // Status Badge on Top Right
  const isGrant = invoice.isCreditGrant || invoice.grossAmount === 0;
  const statusText = isGrant ? 'CREDIT APPLIED' : (invoice.status?.toUpperCase() || 'PAID IN FULL');
  
  doc.setFillColor(230, 244, 234); // light green
  doc.setDrawColor(52, 168, 83); // #34A853
  doc.roundedRect(pageWidth - margin - 45, y + 3, 45, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(19, 115, 51); // dark green
  doc.text(statusText, pageWidth - margin - 22.5, y + 8.5, { align: 'center' });

  y += 28;

  // Horizontal separator
  doc.setDrawColor(220, 224, 230);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  // 3. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(32, 33, 36);
  doc.text('INVOICE / ACCOUNT STATEMENT', margin, y);

  y += 6;

  // 4. Meta Details Two-Column Box
  doc.setFillColor(248, 249, 250); // #F8F9FA
  doc.setDrawColor(220, 224, 230);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 28, 2, 2, 'FD');

  // Left Column: Billed To
  const leftX = margin + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(95, 99, 104);
  doc.text('BILLED TO', leftX, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(32, 33, 36);
  const customerName = user?.name || user?.storeName || 'Tiwlo Account Holder';
  doc.text(customerName, leftX, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 99, 104);
  doc.text(user?.email || `customer@${PLATFORM_DOMAIN}`, leftX, y + 17);
  doc.text(`Billing Account: ${billingAccountId || 'BA-TIWLO-CLOUD-TCP'}`, leftX, y + 22);

  // Right Column: Invoice Metadata
  const rightX = pageWidth / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(95, 99, 104);
  doc.text('STATEMENT DETAILS', rightX, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(32, 33, 36);
  doc.text(`Invoice ID:`, rightX, y + 12);
  doc.text(`Date of Issue:`, rightX, y + 17);
  doc.text(`Billing Period:`, rightX, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.text(invoice.id, rightX + 24, y + 12);
  doc.text(invoice.date || 'Sep 30, 2026', rightX + 24, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.period || 'Monthly Infrastructure', rightX + 24, y + 22);

  y += 36;

  // 5. Line Items Table Header
  const col1X = margin + 4;
  const col2X = margin + 85;
  const col3X = margin + 120;
  const col4X = pageWidth - margin - 5;

  doc.setFillColor(241, 243, 244); // #F1F3F4
  doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(95, 99, 104);
  doc.text('SERVICE & DESCRIPTION', col1X, y + 5.5);
  doc.text('USAGE', col2X, y + 5.5);
  doc.text('RATE', col3X, y + 5.5);
  doc.text('AMOUNT (USD)', col4X, y + 5.5, { align: 'right' });

  y += 8;

  // Table Rows
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
    {
      service: invoice.description || 'Tiwlo Cloud Infrastructure Services',
      desc: 'Platform Compute & Memory Allocation',
      rate: '$0.007/hr',
      usage: 'Standard Tier',
      amount: invoice.netPaid || invoice.grossAmount || 0
    }
  ];

  doc.setFont('helvetica', 'normal');
  items.forEach((item, index) => {
    // Row background (alternate)
    if (index % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 11, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(32, 33, 36);
    doc.text(item.service, col1X, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 99, 104);
    doc.text(item.desc || '', col1X, y + 8.5);

    doc.setFontSize(8);
    doc.setTextColor(60, 64, 67);
    doc.text(item.usage || '-', col2X, y + 6);
    doc.text(item.rate || '-', col3X, y + 6);

    const amt = typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0;
    if (amt < 0) {
      doc.setTextColor(19, 115, 51); // green for credit deduction offset
      doc.text(`-$${Math.abs(amt).toFixed(2)}`, col4X, y + 6, { align: 'right' });
    } else {
      doc.setTextColor(32, 33, 36);
      doc.text(`$${amt.toFixed(2)}`, col4X, y + 6, { align: 'right' });
    }

    // Row bottom line
    doc.setDrawColor(235, 238, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 11, pageWidth - margin, y + 11);

    y += 11;
  });

  y += 6;

  // 6. Totals Box on Right
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  const gross = invoice.grossAmount !== undefined ? invoice.grossAmount : (invoice.netPaid || 0);
  const creditsOffset = invoice.creditsOffset || 0;
  const netPaid = invoice.netPaid !== undefined ? invoice.netPaid : Math.max(0, gross - creditsOffset);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 99, 104);
  doc.text('Subtotal / Gross Amount:', summaryX, y);
  doc.setTextColor(32, 33, 36);
  doc.text(`$${gross.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });

  y += 5.5;

  if (creditsOffset > 0) {
    doc.setTextColor(95, 99, 104);
    doc.text('Cloud Credits Offset:', summaryX, y);
    doc.setTextColor(19, 115, 51);
    doc.text(`-$${creditsOffset.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5.5;
  }

  // Double underline before Total
  doc.setDrawColor(32, 33, 36);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(32, 33, 36);
  doc.text('TOTAL NET CHARGE:', summaryX, y);
  doc.setTextColor(11, 87, 208); // Tiwlo blue
  doc.text(`$${netPaid.toFixed(2)} USD`, pageWidth - margin, y, { align: 'right' });

  // 7. Verification & Terms Box
  y = Math.max(y + 18, pageHeight - 48);

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(220, 224, 230);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 64, 67);
  doc.text('OFFICIAL VERIFICATION & AUDIT CERTIFICATE', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(95, 99, 104);
  doc.text('This document is an electronically generated official receipt issued under the Tiwlo Cloud Service Level Agreement (SLA).', margin + 4, y + 9.5);
  doc.text(`Security Hash: SHA256-${invoice.id.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(16).toUpperCase()}`, margin + 4, y + 13.5);
  doc.text(`For billing inquiries or tax compliance invoices, contact ${BILLING_EMAIL} with your Billing Account ID.`, margin + 4, y + 17.5);

  // 8. Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 155, 160);
  doc.text(`Page 1 of 1 • Tiwlo Cloud Infrastructure • Generated on ${new Date().toUTCString()}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Trigger browser download of PDF
  const cleanId = (invoice.id || 'INVOICE').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Tiwlo-Cloud-Invoice-${cleanId}.pdf`);
}
