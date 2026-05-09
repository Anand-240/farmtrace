const express = require('express');
const router = express.Router();
const { z } = require('zod');
const auth = require('../../middleware/authMiddleware');
const Warehouse = require('../../models/Warehouse');
const logger = require('../../utils/logger').child({ module: 'warehouse' });

// Create warehouse (admin/manager)
router.post('/', auth, async (req, res) => {
  try {
    const { name, location, state, capacity, warehouseType, facilities, pricePerQtlPerDay } = req.body;
    if (!name || !location || !capacity) return res.status(400).json({ message: 'Name, location, capacity required' });
    const warehouse = new Warehouse({ name, location, state, capacity, warehouseType, facilities, pricePerQtlPerDay, managerId: req.user.id, managerName: req.user.name });
    await warehouse.save();
    return res.status(201).json({ message: 'Warehouse create ho gaya', warehouse });
  } catch (err) {
    logger.error({ err }, 'Create warehouse error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Stock IN
router.post('/:id/stock-in', auth, async (req, res) => {
  try {
    const { produceId, cropType, quantity, notes } = req.body;
    if (!quantity || isNaN(quantity)) return res.status(400).json({ message: 'Quantity required' });

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    if (!warehouse.isActive) return res.status(400).json({ message: 'Warehouse active nahi hai' });
    if (warehouse.currentStock + Number(quantity) > warehouse.capacity) {
      return res.status(400).json({ message: 'Warehouse mein itni jagah nahi hai' });
    }

    warehouse.receiptCounter += 1;
    const receiptNo = `WR-${String(warehouse.receiptCounter).padStart(6, '0')}`;
    warehouse.stockMovements.push({ produceId, cropType, quantity: Number(quantity), type: 'IN', ownerId: req.user.id, ownerName: req.user.name, receiptNo, notes });
    warehouse.currentStock += Number(quantity);
    await warehouse.save();
    return res.json({ message: 'Stock in ho gaya', receiptNo, currentStock: warehouse.currentStock });
  } catch (err) {
    logger.error({ err }, 'Stock in error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// Stock OUT
router.post('/:id/stock-out', auth, async (req, res) => {
  try {
    const { produceId, cropType, quantity, notes } = req.body;
    if (!quantity || isNaN(quantity)) return res.status(400).json({ message: 'Quantity required' });

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    if (warehouse.currentStock < Number(quantity)) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    warehouse.stockMovements.push({ produceId, cropType, quantity: Number(quantity), type: 'OUT', ownerId: req.user.id, ownerName: req.user.name, notes });
    warehouse.currentStock -= Number(quantity);
    await warehouse.save();
    return res.json({ message: 'Stock out ho gaya', currentStock: warehouse.currentStock });
  } catch (err) {
    logger.error({ err }, 'Stock out error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// List warehouses
router.get('/', auth, async (req, res) => {
  try {
    const { state, type } = req.query;
    const filter = { isActive: true };
    if (state) filter.state = new RegExp(state, 'i');
    if (type) filter.warehouseType = type;
    const warehouses = await Warehouse.find(filter).sort({ createdAt: -1 });
    return res.json({ warehouses });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get single warehouse
router.get('/:id', auth, async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    return res.json({ warehouse });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
