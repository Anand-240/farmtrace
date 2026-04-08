const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const paymentRoutes = require('../routes/payment');
const User = require('../models/User');
const Produce = require('../models/Produce');
const Transfer = require('../models/Transfer');
const Escrow = require('../models/Escrow');
const ComplianceDocument = require('../models/ComplianceDocument');
const ComplianceAudit = require('../models/ComplianceAudit');

jest.setTimeout(45000);

describe('Compliance Document APIs', () => {
  let mongod;
  let app;
  let transfer;
  let seller;
  let buyer;
  let outsider;

  const signToken = (user) => jwt.sign(
    { id: String(user._id), phone: user.phone, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.GST_RATE_PERCENT = '5';

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    app = express();
    app.use(express.json());
    app.use('/api/payment', paymentRoutes);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Produce.deleteMany({}),
      Transfer.deleteMany({}),
      Escrow.deleteMany({}),
      ComplianceDocument.deleteMany({}),
      ComplianceAudit.deleteMany({})
    ]);

    seller = await User.create({
      name: 'Ravi Farmer',
      email: 'ravi@example.com',
      phone: '9000000001',
      role: 'FARMER',
      password: 'hashed',
      state: 'Uttar Pradesh',
      gstin: '09ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      pincode: '226001',
      businessName: 'Ravi Agro Farms'
    });

    buyer = await User.create({
      name: 'Amit Distributor',
      email: 'amit@example.com',
      phone: '9000000002',
      role: 'DISTRIBUTOR',
      password: 'hashed',
      state: 'Uttar Pradesh',
      gstin: '09PQRSX6789L1Z2',
      pan: 'PQRSX6789L',
      pincode: '201301',
      businessName: 'Amit Trading Co'
    });

    outsider = await User.create({
      name: 'Outside User',
      email: 'outside@example.com',
      phone: '9000000003',
      role: 'RETAILER',
      password: 'hashed',
      state: 'Delhi'
    });

    const produce = await Produce.create({
      farmerName: seller.name,
      cropType: 'Tomato',
      origin: 'Lucknow, Uttar Pradesh',
      quantity: 100,
      qualityGrade: 'A',
      farmPrice: 25,
      farmerPhone: seller.phone,
      currentOwner: buyer.phone,
      lotCode: 'LOT-TST-001',
      sourceType: 'REGISTER',
      lotStatus: 'ACTIVE',
      blockchainStatus: 'CONFIRMED'
    });

    transfer = await Transfer.create({
      produceId: String(produce._id),
      fromPhone: seller.phone,
      toPhone: buyer.phone,
      price: 30,
      location: 'Lucknow',
      currentLocation: 'Lucknow',
      transferType: 'FARM_TO_DISTRIBUTOR',
      paymentStatus: 'PAID',
      blockchainStatus: 'CONFIRMED',
      deliveryStatus: 'PICKUP_DISPATCHED',
      razorpayOrderId: 'order_test_123',
      razorpayPaymentId: 'pay_test_123',
      txHash: '0xtesthash'
    });

    await Escrow.create({
      transferId: transfer._id,
      totalAmount: 3000,
      bookingAmount: 1200,
      dispatchAmount: 900,
      deliveryAmount: 900,
      bookingPaid: true,
      bookingPaidAt: new Date(),
      dispatchReleased: true,
      dispatchReleasedAt: new Date(),
      deliveryReleased: false,
      status: 'ACTIVE',
      razorpayOrderId: 'order_test_123',
      razorpayPaymentId: 'pay_test_123'
    });
  });

  it('downloads invoice PDF and keeps persisted invoice number stable', async () => {
    const token = signToken(seller);

    const first = await request(app)
      .get(`/api/payment/docs/${transfer._id}/invoice`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(first.headers['content-type']).toMatch(/application\/pdf/);

    const docAfterFirst = await ComplianceDocument.findOne({
      transferId: transfer._id,
      documentType: 'INVOICE'
    });

    expect(docAfterFirst).toBeTruthy();
    expect(docAfterFirst.documentNumber).toMatch(/^INV\/[0-9]{4}-[0-9]{2}\/[0-9]{6}$/);

    await request(app)
      .get(`/api/payment/docs/${transfer._id}/invoice`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const docs = await ComplianceDocument.find({
      transferId: transfer._id,
      documentType: 'INVOICE'
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].documentNumber).toBe(docAfterFirst.documentNumber);

    const invoiceAudits = await ComplianceAudit.find({
      transferId: transfer._id,
      documentType: 'INVOICE'
    });
    expect(invoiceAudits.length).toBeGreaterThanOrEqual(4);
  });

  it('denies access for non-participant user', async () => {
    const token = signToken(outsider);

    const response = await request(app)
      .get(`/api/payment/docs/${transfer._id}/settlement`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body.message).toMatch(/Access denied/);
  });

  it('downloads audit trail in csv format', async () => {
    const token = signToken(buyer);

    const response = await request(app)
      .get(`/api/payment/docs/${transfer._id}/audit-trail?format=csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.text).toContain('event,timestamp,transferId,actor,details');
    expect(response.text).toContain('DOCS_GENERATED');
  });
});
