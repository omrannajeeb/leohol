import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Recipient from '../models/Recipient.js';
import Inventory from '../models/Inventory.js';
import { inventoryService } from '../services/inventoryService.js';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { realTimeEventService } from '../services/realTimeEventService.js';

// Create order
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    console.log('createOrder called with body:', JSON.stringify(req.body, null, 2));
    const { items, shippingAddress, paymentMethod, customerInfo, currency = 'USD' } = req.body;

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

    // Start transaction
    await session.startTransaction();

    // Calculate total and validate stock
    let totalAmount = 0;
    const orderItems = [];
    const exchangeRate = SUPPORTED_CURRENCIES[currency].exchangeRate;
    const stockUpdates = []; // Track stock updates for rollback

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      }

      let sizeName = item.size;
      let sizeStockOk = true;
      let sizeIndex = -1;

      // If size is specified, check and decrement size stock
      if (sizeName) {
        sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
        if (sizeIndex === -1) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Size '${sizeName}' not found for product ${product.name}` });
        }
        if (product.sizes[sizeIndex].stock < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for ${product.name} (size: ${sizeName}). Available: ${product.sizes[sizeIndex].stock}, Requested: ${item.quantity}` });
        }
        // Decrement size stock
        product.sizes[sizeIndex].stock -= item.quantity;
      } else {
        // No size specified, check main stock
        if (product.stock < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` });
        }
      }

      // Convert price to order currency
      const priceInOrderCurrency = product.price * exchangeRate;
      totalAmount += priceInOrderCurrency * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: priceInOrderCurrency,
        name: product.name,
        image: product.images[0],
        size: sizeName || undefined
      });

      // Track stock update for this product
      stockUpdates.push({
        productId: product._id,
        originalStock: product.stock,
        newStock: product.stock - item.quantity
      });

      // Update product stock within transaction (total stock is recalculated by pre-save hook)
      if (!sizeName) {
        product.stock -= item.quantity;
      }
      await product.save({ session });
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
    await Recipient.findOneAndUpdate(recipientQuery, recipientUpdate, { upsert: true, new: true, session });

    // Create order with auto-generated order number
    const order = new Order({
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
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'completed'
    });

    let savedOrder;
    try {
      savedOrder = await order.save({ session });
    } catch (err) {
      // Handle duplicate orderNumber edge case: regenerate and retry once
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNumber) {
        order.orderNumber = `ORD${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        savedOrder = await order.save({ session });
      } else {
        await session.abortTransaction();
        throw err;
      }
    }

    // Commit the transaction
    await session.commitTransaction();

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
    const orders = await Order.find()
      .populate('items.product')
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