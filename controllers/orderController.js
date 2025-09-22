import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Recipient from '../models/Recipient.js';
import Inventory from '../models/Inventory.js';
import { inventoryService } from '../services/inventoryService.js';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { realTimeEventService } from '../services/realTimeEventService.js';
import Settings from '../models/Settings.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Create order
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  let useTransaction = false;

  try {
    console.log('createOrder called with body:', JSON.stringify(req.body, null, 2));
    const { items, shippingAddress, paymentMethod, customerInfo } = req.body;

    // If the request includes a Bearer token, attempt to associate the order with the authenticated user
    try {
      const authHeader = req.header('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (user) {
          // Attach to request for downstream usage
          req.user = user;
        }
      }
    } catch (e) {
      // Silently ignore token errors to allow guest checkout
      console.warn('Optional auth token invalid for createOrder; proceeding as guest if needed.');
    }

    // Determine order currency: prefer request body, else store settings, else USD
    let currency = req.body?.currency;
    if (!currency || !SUPPORTED_CURRENCIES[currency]) {
      try {
        const storeSettings = await Settings.findOne();
        const defaultCur = storeSettings?.currency;
        if (defaultCur && SUPPORTED_CURRENCIES[defaultCur]) {
          currency = defaultCur;
        } else {
          currency = 'USD';
        }
      } catch {
        currency = 'USD';
      }
    }

    // Validate required fields
    if (!items?.length) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (!customerInfo?.email || !customerInfo?.mobile) {
      return res.status(400).json({ message: 'Customer email and mobile number are required' });
    }

    if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.country) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    // Validate currency
    if (!SUPPORTED_CURRENCIES[currency]) {
      return res.status(400).json({ message: 'Invalid currency' });
    }

    // Attempt to start transaction; if not supported (e.g., standalone Mongo), continue without it
    try {
      await session.startTransaction();
      useTransaction = true;
    } catch (txnErr) {
      console.warn('MongoDB transactions not supported in current environment; proceeding without transaction. Reason:', txnErr?.message || txnErr);
    }

    // Calculate total and validate stock
    let totalAmount = 0;
    const orderItems = [];
  const exchangeRate = SUPPORTED_CURRENCIES[currency].exchangeRate;
    const stockUpdates = []; // Track stock updates for rollback

    for (const item of items) {
      const baseProductQuery = Product.findById(item.product);
      const product = useTransaction ? await baseProductQuery.session(session) : await baseProductQuery;

      if (!product) {
        if (session.inTransaction()) await session.abortTransaction();
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      }

      const qty = Number(item.quantity) || 0;
      if (qty <= 0) {
        if (session.inTransaction()) await session.abortTransaction();
        return res.status(400).json({ message: `Invalid quantity for product ${product.name}` });
      }

      const sizeName = item.size;
      const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;

      if (sizeName && hasSizes) {
        const sizeIndex = product.sizes.findIndex((s) => s.name === sizeName);
        if (sizeIndex === -1) {
          if (session.inTransaction()) await session.abortTransaction();
          return res.status(400).json({ message: `Size '${sizeName}' not found for product ${product.name}` });
        }
        const available = Number(product.sizes[sizeIndex].stock) || 0;
        if (available < qty) {
          if (session.inTransaction()) await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for ${product.name} (size: ${sizeName}). Available: ${available}, Requested: ${qty}` });
        }
        // Decrement size stock
        product.sizes[sizeIndex].stock = available - qty;
      } else {
        // No size specified, check main stock
        const mainStock = Number(product.stock) || 0;
        if (mainStock < qty) {
          if (session.inTransaction()) await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${mainStock}, Requested: ${qty}` });
        }
        // Decrement main stock
        product.stock = mainStock - qty;
      }

      // Convert price to order currency using product price in catalog
      const catalogPrice = Number(product.price);
      if (!isFinite(catalogPrice)) {
        if (session.inTransaction()) await session.abortTransaction();
        return res.status(400).json({ message: `Product ${product.name} has invalid price` });
      }
      const priceInOrderCurrency = catalogPrice * exchangeRate;
      totalAmount += priceInOrderCurrency * qty;

      orderItems.push({
        product: product._id,
        quantity: qty,
        price: priceInOrderCurrency,
        name: product.name,
        image: Array.isArray(product.images) && product.images.length ? product.images[0] : undefined,
        size: hasSizes ? (sizeName || undefined) : undefined
      });

      // Track stock update for this product
      stockUpdates.push({
        productId: product._id,
        originalStock: Number(product.stock) || 0,
        newStock: Number(product.stock) || 0 // This value is informational; actual inventory handled elsewhere
      });

      // Persist product stock changes
      if (useTransaction) {
        await product.save({ session });
      } else {
        await product.save();
      }
    }

    // Save or update recipient in Recipient collection
    const recipientQuery = {
      email: customerInfo.email,
      mobile: customerInfo.mobile
    };
    const recipientUpdate = {
      firstName: customerInfo.firstName,
      lastName: customerInfo.lastName,
      email: customerInfo.email,
      mobile: customerInfo.mobile,
      secondaryMobile: customerInfo.secondaryMobile,
      address: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        country: shippingAddress.country
      }
    };
    if (useTransaction) {
      await Recipient.findOneAndUpdate(recipientQuery, recipientUpdate, { upsert: true, new: true, session });
    } else {
      await Recipient.findOneAndUpdate(recipientQuery, recipientUpdate, { upsert: true, new: true });
    }

    // Create order with auto-generated order number
    const order = new Order({
      user: req.user?._id || undefined,
      items: orderItems,
      totalAmount,
      currency,
      exchangeRate,
      shippingAddress,
      paymentMethod,
      customerInfo: {
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        email: customerInfo.email,
        mobile: customerInfo.mobile,
        secondaryMobile: customerInfo.secondaryMobile
      },
      status: 'pending',
      orderNumber: `ORD${Date.now()}`,
  // For online payments (card/paypal), mark as pending until provider capture completes
  paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending'
    });

    let savedOrder;
    try {
      if (useTransaction) {
        savedOrder = await order.save({ session });
      } else {
        savedOrder = await order.save();
      }
    } catch (err) {
      // Handle duplicate orderNumber edge case: regenerate and retry once
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNumber) {
        order.orderNumber = `ORD${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        if (useTransaction) {
          savedOrder = await order.save({ session });
        } else {
          savedOrder = await order.save();
        }
      } else {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        throw err;
      }
    }

    // Commit the transaction
    if (session.inTransaction()) {
      await session.commitTransaction();
    }

    // Emit real-time event for new order
    realTimeEventService.emitNewOrder(savedOrder);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        totalAmount: savedOrder.totalAmount,
        currency: savedOrder.currency,
        status: savedOrder.status
      }
    });
  } catch (error) {
    // Ensure transaction is aborted if still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error('Error creating order:', error);
    const message = error?.message || 'Failed to create order';
    res.status(500).json({
      message,
      error: message
    });
  } finally {
    // End the session
    await session.endSession();
  }
};

// Get user orders
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userEmail = (req.user?.email || '').toLowerCase();

    // Filter orders to those created by this user or (legacy) guest orders matching their email
    const emailFilter = userEmail
      ? { 'customerInfo.email': new RegExp(`^${userEmail}$`, 'i') }
      : null;

    const query = emailFilter
      ? { $or: [ { user: userId }, emailFilter ] }
      : { user: userId };

    const orders = await Order.find(query)
      .populate('items.product')
      .populate('deliveryCompany')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Get all orders (admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .populate('deliveryCompany')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    // Find the order first to check previous status
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const prevStatus = order.status;

    // Update status
    order.status = status;
    await order.save();

    // Only auto-decrement inventory if status is first set to 'delivered' (or 'fulfilled')
    if ((status === 'delivered' || status === 'fulfilled') && prevStatus !== status) {
      for (const item of order.items) {
        // Find inventory record for product, size, color
        const inv = await Inventory.findOne({
          product: item.product,
          size: item.size || '',
          color: item.color || ''
        });
        if (inv) {
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await inventoryService.updateInventory(inv._id, newQty, req.user?._id || null);
        }
      }
    }

    // Emit real-time event for order update
    realTimeEventService.emitOrderUpdate(order);

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// Request delivery assignment for user's own order
export const requestDeliveryAssignment = async (req, res) => {
  return res.status(400).json({ 
    message: 'Delivery company assignment is no longer available' 
  });
};