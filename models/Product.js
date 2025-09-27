import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  images: [{
    type: String,
    required: [true, 'At least one product image is required']
  }],
  // Optional product videos (e.g., MP4, WebM, hosted links or CDN)
  videoUrls: [{
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Basic URL or relative path check
        return /^(https?:\/\/|\/)/i.test(v);
      },
      message: 'Invalid video URL'
    }
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  colors: [{
    name: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    images: [{
      type: String
    }],
    sizes: [{
      name: {
        type: String,
        required: true
      },
      stock: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  }],
  isNew: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    photos: [{
      type: String
    }],
    helpful: {
      type: Number,
      default: 0
    },
    reported: {
      type: Boolean,
      default: false
    },
    verified: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  stock: {
    type: Number,
    required: [true, 'Product stock is required'],
    min: [0, 'Stock cannot be negative']
  },
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true
});

// Virtual for average rating
productSchema.virtual('averageRating').get(function() {
  if (!this.reviews || this.reviews.length === 0) return 0;
  const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
  return (sum / this.reviews.length).toFixed(1);
});

// Pre-save middleware to calculate discount
productSchema.pre('save', function(next) {
  if (this.originalPrice && this.price) {
    this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  next();
});

// Pre-save middleware to update total stock
productSchema.pre('save', function(next) {
  if (this.sizes && this.sizes.length > 0) {
    this.stock = this.sizes.reduce((total, size) => total + size.stock, 0);
  }
  next();
});

export default mongoose.model('Product', productSchema);
