import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    name: String,
    image: String,
    size: String // Added for size-specific stock tracking
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'EGP', 'IQD', 'ILS'],
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1
  },
  shippingAddress: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      enum: ['JO', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'EG', 'IQ', 'LB', 'PS']
    }
  },
  customerInfo: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    mobile: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\+[0-9]{1,4}[0-9]{9,10}$/.test(v);
        },
        message: 'Invalid mobile number format'
      }
    },
    secondaryMobile: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^\+[0-9]{1,4}[0-9]{9,10}$/.test(v);
        },
        message: 'Invalid secondary mobile number format'
      }
    }
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cod'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  deliveryCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryCompany'
  },
  deliveryStatus: {
    type: String,
    enum: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned', 'cancelled'],
    default: null
  },
  deliveryTrackingNumber: {
    type: String
  },
  deliveryResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  deliveryAssignedAt: {
    type: Date
  },
  deliveryMappedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  deliveryFieldMappings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  deliveryStatusUpdated: {
    type: Date
  },
  deliveryCancellationReason: {
    type: String
  },
  deliveryEstimatedDate: {
    type: Date
  },
  deliveryActualDate: {
    type: Date
  },
  deliveryNotes: {
    type: String
  },
  // Legacy field for backward compatibility
  trackingNumber: {
    type: String
  }
}, {
  timestamps: true
});

// Add index for orderNumber
orderSchema.index({ orderNumber: 1 }, { unique: true });

// Add index for user to optimize queries
orderSchema.index({ user: 1 });

// Add compound index for status and createdAt for filtered queries
orderSchema.index({ status: 1, createdAt: -1 });

// Add delivery-related indexes
orderSchema.index({ deliveryCompany: 1 });
orderSchema.index({ deliveryStatus: 1 });
orderSchema.index({ deliveryTrackingNumber: 1 });
orderSchema.index({ deliveryCompany: 1, deliveryStatus: 1 });
orderSchema.index({ deliveryAssignedAt: -1 });

export default mongoose.model('Order', orderSchema);