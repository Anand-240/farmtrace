const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const DEFAULT_GST_RATE = Number(process.env.GST_RATE_PERCENT || 5);

function normalizeValue(value = '') {
  return String(value || '').trim();
}

function normalizeState(state = '') {
  return normalizeValue(state).toLowerCase().replace(/\s+/g, ' ');
}

function formatInr(value = 0) {
  const safe = Number(value) || 0;
  return `INR ${safe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function makeDocumentNumber(prefix, transfer, issuedAt = new Date()) {
  const year = issuedAt.getFullYear();
  const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
  const day = String(issuedAt.getDate()).padStart(2, '0');
  const suffix = String(transfer?._id || '').slice(-6).toUpperCase();
  return `${prefix}-${year}${month}${day}-${suffix || 'NA'}`;
}

function buildTaxBreakdown({ subtotal, supplierState, buyerState }) {
  const gstRatePercent = Number.isFinite(DEFAULT_GST_RATE) && DEFAULT_GST_RATE > 0
    ? DEFAULT_GST_RATE
    : 0;

  const sameState = Boolean(
    normalizeState(supplierState) &&
    normalizeState(buyerState) &&
    normalizeState(supplierState) === normalizeState(buyerState)
  );

  const gstTotal = Number(((subtotal * gstRatePercent) / 100).toFixed(2));
  if (!gstTotal) {
    return {
      gstRatePercent,
      gstTotal: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      sameState
    };
  }

  if (sameState) {
    const half = Number((gstTotal / 2).toFixed(2));
    return {
      gstRatePercent,
      gstTotal,
      cgst: half,
      sgst: Number((gstTotal - half).toFixed(2)),
      igst: 0,
      sameState
    };
  }

  return {
    gstRatePercent,
    gstTotal,
    cgst: 0,
    sgst: 0,
    igst: gstTotal,
    sameState
  };
}

function buildInvoicePayload({ transfer, produce, fromUser, toUser, escrow, documentNumber }) {
  const quantity = Number(produce?.quantity || 0);
  const unitPrice = Number(transfer?.price || 0);
  const subtotal = Number((quantity * unitPrice).toFixed(2));
  const tax = buildTaxBreakdown({
    subtotal,
    supplierState: fromUser?.state,
    buyerState: toUser?.state
  });
  const grossTotal = Number((subtotal + tax.gstTotal).toFixed(2));

  return {
    documentType: 'INVOICE',
    documentNumber: documentNumber || makeDocumentNumber('INV', transfer, transfer?.createdAt ? new Date(transfer.createdAt) : new Date()),
    transferId: String(transfer?._id || ''),
    paymentStatus: transfer?.paymentStatus || 'PENDING',
    blockchainStatus: transfer?.blockchainStatus || 'PENDING',
    issueDate: formatDate(new Date()),
    orderDate: formatDate(transfer?.createdAt),
    supplier: {
      name: fromUser?.name || produce?.farmerName || '-',
      businessName: fromUser?.businessName || '-',
      gstin: fromUser?.gstin || '-',
      phone: transfer?.fromPhone || '-',
      address: [fromUser?.village, fromUser?.city || fromUser?.district, fromUser?.state, fromUser?.pincode].filter(Boolean).join(', ') || '-'
    },
    buyer: {
      name: toUser?.name || '-',
      businessName: toUser?.businessName || '-',
      gstin: toUser?.gstin || '-',
      phone: transfer?.toPhone || '-',
      address: [toUser?.village, toUser?.city || toUser?.district, toUser?.state, toUser?.pincode].filter(Boolean).join(', ') || '-'
    },
    lineItem: {
      cropType: produce?.cropType || '-',
      lotCode: produce?.lotCode || '-',
      qualityGrade: produce?.qualityGrade || '-',
      quantityKg: quantity,
      unitPrice,
      subtotal
    },
    tax,
    grossTotal,
    payment: {
      razorpayOrderId: transfer?.razorpayOrderId || escrow?.razorpayOrderId || '-',
      razorpayPaymentId: transfer?.razorpayPaymentId || escrow?.razorpayPaymentId || '-',
      txHash: transfer?.txHash || '-',
      transferType: transfer?.transferType || '-'
    }
  };
}

function buildChallanPayload({ transfer, produce, fromUser, toUser, documentNumber }) {
  return {
    documentType: 'CHALLAN',
    documentNumber: documentNumber || makeDocumentNumber('CHL', transfer),
    transferId: String(transfer?._id || ''),
    issueDate: formatDate(new Date()),
    pickupDate: formatDate(transfer?.pickupDispatchedAt || transfer?.createdAt),
    expectedDeliveryTime: formatDate(transfer?.expectedDeliveryTime),
    deliveryStatus: transfer?.deliveryStatus || 'PENDING_DISPATCH',
    shipFrom: {
      name: fromUser?.name || produce?.farmerName || '-',
      phone: transfer?.fromPhone || '-',
      address: [produce?.origin || fromUser?.village, fromUser?.city || fromUser?.district, fromUser?.state].filter(Boolean).join(', ') || '-'
    },
    shipTo: {
      name: toUser?.name || '-',
      phone: transfer?.toPhone || '-',
      address: [toUser?.village, toUser?.city || toUser?.district, toUser?.state].filter(Boolean).join(', ') || '-'
    },
    transport: {
      mode: transfer?.vehicleType || '-',
      vehicleNumber: transfer?.vehicleNumber || '-',
      driverName: transfer?.driverName || '-',
      driverPhone: transfer?.driverPhone || '-',
      currentLocation: transfer?.currentLocation || transfer?.location || '-'
    },
    item: {
      cropType: produce?.cropType || '-',
      lotCode: produce?.lotCode || '-',
      quantityKg: Number(produce?.quantity || 0),
      qualityGrade: produce?.qualityGrade || '-',
      ratePerKg: Number(transfer?.price || 0)
    }
  };
}

function buildSettlementPayload({ transfer, produce, escrow, fromUser, toUser, documentNumber }) {
  const totalAmount = Number(escrow?.totalAmount || Number(transfer?.price || 0) * Number(produce?.quantity || 0));
  const bookingAmount = Number(escrow?.bookingAmount || 0);
  const dispatchAmount = Number(escrow?.dispatchAmount || 0);
  const deliveryAmount = Number(escrow?.deliveryAmount || 0);

  return {
    documentType: 'SETTLEMENT',
    documentNumber: documentNumber || makeDocumentNumber('SET', transfer),
    transferId: String(transfer?._id || ''),
    generatedAt: formatDate(new Date()),
    transferDate: formatDate(transfer?.createdAt),
    status: escrow?.status || 'ACTIVE',
    participants: {
      sellerName: fromUser?.name || produce?.farmerName || '-',
      sellerPhone: transfer?.fromPhone || '-',
      buyerName: toUser?.name || '-',
      buyerPhone: transfer?.toPhone || '-'
    },
    shipment: {
      cropType: produce?.cropType || '-',
      lotCode: produce?.lotCode || '-',
      quantityKg: Number(produce?.quantity || 0),
      transferType: transfer?.transferType || '-',
      deliveryStatus: transfer?.deliveryStatus || '-'
    },
    milestoneSummary: {
      totalAmount,
      booking: {
        amount: bookingAmount,
        paid: Boolean(escrow?.bookingPaid),
        paidAt: formatDate(escrow?.bookingPaidAt)
      },
      dispatch: {
        amount: dispatchAmount,
        paid: Boolean(escrow?.dispatchReleased),
        paidAt: formatDate(escrow?.dispatchReleasedAt)
      },
      delivery: {
        amount: deliveryAmount,
        paid: Boolean(escrow?.deliveryReleased),
        paidAt: formatDate(escrow?.deliveryReleasedAt)
      },
      refund: {
        amount: Number(escrow?.refundAmount || 0),
        reason: escrow?.refundReason || '-',
        requestedAt: formatDate(escrow?.refundRequestedAt),
        completedAt: formatDate(escrow?.refundCompletedAt)
      }
    },
    refs: {
      paymentId: transfer?.razorpayPaymentId || escrow?.razorpayPaymentId || '-',
      orderId: transfer?.razorpayOrderId || escrow?.razorpayOrderId || '-',
      txHash: transfer?.txHash || '-'
    }
  };
}

function stableSortObject(input) {
  if (Array.isArray(input)) return input.map(stableSortObject);
  if (!input || typeof input !== 'object') return input;

  return Object.keys(input).sort().reduce((acc, key) => {
    acc[key] = stableSortObject(input[key]);
    return acc;
  }, {});
}

function createChecksum(payload) {
  const canonical = JSON.stringify(stableSortObject(payload));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function writeKeyValue(doc, key, value) {
  doc.font('Helvetica-Bold').text(`${key}: `, { continued: true });
  doc.font('Helvetica').text(String(value || '-'));
}

function asPdfBuffer(renderFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderFn(doc);
    doc.end();
  });
}

async function buildInvoicePdf(payload) {
  return asPdfBuffer((doc) => {
    doc.fontSize(18).font('Helvetica-Bold').text('FarmTrace Tax Invoice');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    writeKeyValue(doc, 'Invoice No', payload.documentNumber);
    writeKeyValue(doc, 'Issue Date', payload.issueDate);
    writeKeyValue(doc, 'Order Date', payload.orderDate);
    writeKeyValue(doc, 'Transfer ID', payload.transferId);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Supplier');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Name', payload.supplier.name);
    writeKeyValue(doc, 'Business', payload.supplier.businessName);
    writeKeyValue(doc, 'GSTIN', payload.supplier.gstin);
    writeKeyValue(doc, 'Phone', payload.supplier.phone);
    writeKeyValue(doc, 'Address', payload.supplier.address);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Buyer');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Name', payload.buyer.name);
    writeKeyValue(doc, 'Business', payload.buyer.businessName);
    writeKeyValue(doc, 'GSTIN', payload.buyer.gstin);
    writeKeyValue(doc, 'Phone', payload.buyer.phone);
    writeKeyValue(doc, 'Address', payload.buyer.address);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Line Item');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Crop', payload.lineItem.cropType);
    writeKeyValue(doc, 'Lot Code', payload.lineItem.lotCode);
    writeKeyValue(doc, 'Grade', payload.lineItem.qualityGrade);
    writeKeyValue(doc, 'Quantity (kg)', payload.lineItem.quantityKg);
    writeKeyValue(doc, 'Rate (per kg)', formatInr(payload.lineItem.unitPrice));
    writeKeyValue(doc, 'Subtotal', formatInr(payload.lineItem.subtotal));

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Tax Summary');
    doc.font('Helvetica');
    writeKeyValue(doc, 'GST Rate', `${payload.tax.gstRatePercent}%`);
    writeKeyValue(doc, 'CGST', formatInr(payload.tax.cgst));
    writeKeyValue(doc, 'SGST', formatInr(payload.tax.sgst));
    writeKeyValue(doc, 'IGST', formatInr(payload.tax.igst));
    writeKeyValue(doc, 'Total GST', formatInr(payload.tax.gstTotal));
    writeKeyValue(doc, 'Grand Total', formatInr(payload.grossTotal));

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Payment References');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Razorpay Order ID', payload.payment.razorpayOrderId);
    writeKeyValue(doc, 'Razorpay Payment ID', payload.payment.razorpayPaymentId);
    writeKeyValue(doc, 'Blockchain Tx', payload.payment.txHash);
    writeKeyValue(doc, 'Payment Status', payload.paymentStatus);

    doc.moveDown();
    doc.fontSize(9).fillColor('#555555').text('System-generated invoice for compliance and B2B settlement records.');
  });
}

async function buildChallanPdf(payload) {
  return asPdfBuffer((doc) => {
    doc.fontSize(18).font('Helvetica-Bold').text('FarmTrace Delivery Challan');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    writeKeyValue(doc, 'Challan No', payload.documentNumber);
    writeKeyValue(doc, 'Issue Date', payload.issueDate);
    writeKeyValue(doc, 'Pickup Date', payload.pickupDate);
    writeKeyValue(doc, 'Expected Delivery', payload.expectedDeliveryTime);
    writeKeyValue(doc, 'Transfer ID', payload.transferId);
    writeKeyValue(doc, 'Delivery Status', payload.deliveryStatus);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Ship From');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Name', payload.shipFrom.name);
    writeKeyValue(doc, 'Phone', payload.shipFrom.phone);
    writeKeyValue(doc, 'Address', payload.shipFrom.address);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Ship To');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Name', payload.shipTo.name);
    writeKeyValue(doc, 'Phone', payload.shipTo.phone);
    writeKeyValue(doc, 'Address', payload.shipTo.address);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Transport Details');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Vehicle Type', payload.transport.mode);
    writeKeyValue(doc, 'Vehicle Number', payload.transport.vehicleNumber);
    writeKeyValue(doc, 'Driver', payload.transport.driverName);
    writeKeyValue(doc, 'Driver Phone', payload.transport.driverPhone);
    writeKeyValue(doc, 'Current Location', payload.transport.currentLocation);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Consignment');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Crop', payload.item.cropType);
    writeKeyValue(doc, 'Lot Code', payload.item.lotCode);
    writeKeyValue(doc, 'Quantity (kg)', payload.item.quantityKg);
    writeKeyValue(doc, 'Quality Grade', payload.item.qualityGrade);
    writeKeyValue(doc, 'Rate (per kg)', formatInr(payload.item.ratePerKg));

    doc.moveDown();
    doc.fontSize(9).fillColor('#555555').text('This challan serves as movement proof for stock and logistics reconciliation.');
  });
}

async function buildSettlementPdf(payload) {
  return asPdfBuffer((doc) => {
    doc.fontSize(18).font('Helvetica-Bold').text('FarmTrace Settlement Statement');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    writeKeyValue(doc, 'Settlement No', payload.documentNumber);
    writeKeyValue(doc, 'Generated At', payload.generatedAt);
    writeKeyValue(doc, 'Transfer Date', payload.transferDate);
    writeKeyValue(doc, 'Transfer ID', payload.transferId);
    writeKeyValue(doc, 'Escrow Status', payload.status);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Participants');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Seller', `${payload.participants.sellerName} (${payload.participants.sellerPhone})`);
    writeKeyValue(doc, 'Buyer', `${payload.participants.buyerName} (${payload.participants.buyerPhone})`);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Shipment');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Crop', payload.shipment.cropType);
    writeKeyValue(doc, 'Lot Code', payload.shipment.lotCode);
    writeKeyValue(doc, 'Quantity (kg)', payload.shipment.quantityKg);
    writeKeyValue(doc, 'Transfer Type', payload.shipment.transferType);
    writeKeyValue(doc, 'Delivery Status', payload.shipment.deliveryStatus);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Milestone Amounts');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Total Value', formatInr(payload.milestoneSummary.totalAmount));
    writeKeyValue(doc, 'Booking', `${formatInr(payload.milestoneSummary.booking.amount)} | Paid: ${payload.milestoneSummary.booking.paid ? 'Yes' : 'No'} | ${payload.milestoneSummary.booking.paidAt}`);
    writeKeyValue(doc, 'Dispatch', `${formatInr(payload.milestoneSummary.dispatch.amount)} | Paid: ${payload.milestoneSummary.dispatch.paid ? 'Yes' : 'No'} | ${payload.milestoneSummary.dispatch.paidAt}`);
    writeKeyValue(doc, 'Delivery', `${formatInr(payload.milestoneSummary.delivery.amount)} | Paid: ${payload.milestoneSummary.delivery.paid ? 'Yes' : 'No'} | ${payload.milestoneSummary.delivery.paidAt}`);
    writeKeyValue(doc, 'Refund', `${formatInr(payload.milestoneSummary.refund.amount)} | ${payload.milestoneSummary.refund.reason}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('References');
    doc.font('Helvetica');
    writeKeyValue(doc, 'Payment ID', payload.refs.paymentId);
    writeKeyValue(doc, 'Order ID', payload.refs.orderId);
    writeKeyValue(doc, 'Blockchain Tx', payload.refs.txHash);

    doc.moveDown();
    doc.fontSize(9).fillColor('#555555').text('System-generated settlement statement for accounting, audit and payout reconciliation.');
  });
}

function toAuditRows({ transfer, produce, escrow, invoice, challan, settlement, requestedByPhone }) {
  return [
    {
      event: 'TRANSFER_CREATED',
      timestamp: formatDate(transfer?.createdAt),
      transferId: String(transfer?._id || ''),
      actor: transfer?.fromPhone || '-',
      details: `Transfer ${transfer?.transferType || '-'} created for ${produce?.cropType || '-'}`
    },
    {
      event: 'BOOKING_PAID',
      timestamp: formatDate(escrow?.bookingPaidAt),
      transferId: String(transfer?._id || ''),
      actor: transfer?.toPhone || '-',
      details: `Booking milestone paid: ${formatInr(escrow?.bookingAmount || 0)}`
    },
    {
      event: 'DISPATCH_RELEASED',
      timestamp: formatDate(escrow?.dispatchReleasedAt),
      transferId: String(transfer?._id || ''),
      actor: transfer?.fromPhone || '-',
      details: `Dispatch milestone released: ${formatInr(escrow?.dispatchAmount || 0)}`
    },
    {
      event: 'DELIVERY_RELEASED',
      timestamp: formatDate(escrow?.deliveryReleasedAt),
      transferId: String(transfer?._id || ''),
      actor: transfer?.fromPhone || '-',
      details: `Delivery milestone released: ${formatInr(escrow?.deliveryAmount || 0)}`
    },
    {
      event: 'DOCS_GENERATED',
      timestamp: formatDate(new Date()),
      transferId: String(transfer?._id || ''),
      actor: requestedByPhone || '-',
      details: `Invoice ${invoice.documentNumber}, Challan ${challan.documentNumber}, Settlement ${settlement.documentNumber}`
    }
  ];
}

function toAuditCsv(rows) {
  const headers = ['event', 'timestamp', 'transferId', 'actor', 'details'];
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const values = headers.map((header) => {
      const val = String(row[header] || '');
      return `"${val.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });
  return lines.join('\n');
}

module.exports = {
  buildInvoicePayload,
  buildChallanPayload,
  buildSettlementPayload,
  buildInvoicePdf,
  buildChallanPdf,
  buildSettlementPdf,
  toAuditRows,
  toAuditCsv,
  createChecksum,
  formatInr
};
