// Get stock levels for a product (including per-size)
export const getProductStock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const stockInfo = {
      productId: product._id,
      name: product.name,
      stock: product.stock,
      sizes: product.sizes?.map(size => ({ name: size.name, stock: size.stock })) || []
    };
    res.json(stockInfo);
  } catch (error) {
    console.error('Error fetching product stock:', error);
    res.status(500).json({ message: 'Failed to fetch product stock' });
  }
};

import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import InventoryHistory from '../models/InventoryHistory.js';
import Category from '../models/Category.js';
import Warehouse from '../models/Warehouse.js';
import { validateProductData } from '../utils/validation.js';
import { handleProductImages } from '../utils/imageHandler.js';
import cloudinary from '../services/cloudinaryClient.js';
// Currency conversion disabled for product storage/display; prices are stored and served as-is in store currency

// Get all products
export const getProducts = async (req, res) => {
  try {
  const { search, category, isNew, isFeatured, onSale } = req.query;
    
    let query = {};
    
    // Apply filters
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ]
      };
    }

    if (category) {
      query.category = category;
    }

    if (isNew === 'true') {
      query.isNew = true;
    }

    if (isFeatured === 'true') {
      query.isFeatured = true;
    }

    // New: onSale filter (products where originalPrice > price)
    if (onSale === 'true') {
      // Use $expr so it works even if discount field wasn't computed yet
      query.$expr = { $gt: ["$originalPrice", "$price"] };
    }

    const products = await Product.find(query)
      .populate('relatedProducts')
      .populate({
        path: 'reviews.user',
        select: 'name email image'
      })
      .sort({ isFeatured: -1, order: 1, createdAt: -1 });

    // Get inventory data for each product
    const productsWithInventory = await Promise.all(
      products.map(async (product) => {
        const inventory = await Inventory.find({ product: product._id });
        const productObj = product.toObject();
        
        // Add inventory data to each product
        productObj.inventory = inventory;
        
        // No runtime currency conversion
        
        return productObj;
      })
    );

    res.json(productsWithInventory);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Get single product
export const getProduct = async (req, res) => {
  try {
  // Currency query param ignored; no conversion performed
    
    const product = await Product.findById(req.params.id)
      .populate('relatedProducts')
      .populate({
        path: 'reviews.user',
        select: 'name email image'
      });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get inventory data
    const inventory = await Inventory.find({ product: product._id });
    const productObj = product.toObject();
    productObj.inventory = inventory;

    // No runtime currency conversion

    res.json(productObj);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create product
export const createProduct = async (req, res) => {
  try {
    // Validate product data
    const { isValid, errors } = validateProductData(req.body);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid product data', errors });
    }

    // Normalize video URLs if provided (filter out empty strings)
    let videoUrls = Array.isArray(req.body.videoUrls) ? req.body.videoUrls.filter(v => typeof v === 'string' && v.trim()) : [];
    // Basic length cap to prevent abuse
    if (videoUrls.length > 8) videoUrls = videoUrls.slice(0, 8);

    const product = new Product({
      ...req.body,
      videoUrls,
      order: req.body.isFeatured ? await Product.countDocuments({ isFeatured: true }) : 0
    });
    const savedProduct = await product.save();


    // Find or create a default warehouse
    let warehouse = await Warehouse.findOne();
    if (!warehouse) {
      warehouse = await Warehouse.create({ name: 'Main Warehouse' });
    }

    // Create inventory records for each color/size
    let totalQty = 0;
    const inventoryPromises = (req.body.colors || []).flatMap(color =>
      (color.sizes || []).map(size => {
        totalQty += Number(size.stock) || 0;
        return new Inventory({
          product: savedProduct._id,
          size: size.name,
          color: color.name,
          quantity: size.stock,
          warehouse: warehouse._id,
          location: warehouse.name,
          lowStockThreshold: 5
        }).save();
      })
    );
    await Promise.all(inventoryPromises);

    // Create inventory history record
    await new InventoryHistory({
      product: savedProduct._id,
      type: 'increase',
      quantity: totalQty,
      reason: 'Initial stock',
      user: req.user?._id
    }).save();

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
  const { sizes, colors, videoUrls: incomingVideoUrls, ...updateData } = req.body;

    // Sanitize and normalize incoming fields
    const updateDataSanitized = { ...updateData };

    if (incomingVideoUrls !== undefined) {
      if (!Array.isArray(incomingVideoUrls)) {
        return res.status(400).json({ message: 'videoUrls must be an array of strings' });
      }
      const cleaned = incomingVideoUrls
        .filter(v => typeof v === 'string' && v.trim())
        .slice(0, 8); // enforce max 8
      updateDataSanitized.videoUrls = cleaned;
    }

    // Coerce numeric fields if provided as strings
    if (updateDataSanitized.price != null) {
      const n = Number(updateDataSanitized.price);
      if (Number.isNaN(n) || n < 0) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
      updateDataSanitized.price = n;
    }

    if (updateDataSanitized.originalPrice !== undefined) {
      if (updateDataSanitized.originalPrice === '' || updateDataSanitized.originalPrice === null) {
        // If empty string/null provided, unset originalPrice
        delete updateDataSanitized.originalPrice;
      } else {
        const on = Number(updateDataSanitized.originalPrice);
        if (Number.isNaN(on) || on < 0) {
          return res.status(400).json({ message: 'Invalid originalPrice value' });
        }
        updateDataSanitized.originalPrice = on;
      }
    }

    // Accept category as either ObjectId or case-insensitive name
    if (updateDataSanitized.category) {
      const catVal = updateDataSanitized.category;
      const isObjectId = typeof catVal === 'string' && /^[a-fA-F0-9]{24}$/.test(catVal);
      if (!isObjectId) {
        const cat = await Category.findOne({ name: new RegExp(`^${String(catVal).trim()}$`, 'i') });
        if (!cat) {
          return res.status(400).json({ message: `Category not found: ${catVal}` });
        }
        updateDataSanitized.category = cat._id;
      }
    }

    // Update product document with sanitized data
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateDataSanitized,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update inventory if sizes or colors changed
    if (Array.isArray(sizes) && Array.isArray(colors)) {
      // Get current inventory
      const currentInventory = await Inventory.find({ product: product._id });

      // Create new inventory records for new size/color combinations
      const newCombinations = sizes.flatMap(size =>
        colors.map(color => ({
          size: size.name,
          color: color.name,
          stock: Number(size.stock) || 0
        }))
      );

      // Update or create inventory records
      await Promise.all(
        newCombinations.map(async ({ size, color, stock }) => {
          const existing = currentInventory.find(inv => 
            inv.size === size && inv.color === color
          );

          if (existing) {
            const oldQuantity = existing.quantity;
            existing.quantity = stock;
            await existing.save();

            // Create history record for quantity change
            if (oldQuantity !== stock) {
              await new InventoryHistory({
                product: product._id,
                type: stock > oldQuantity ? 'increase' : 'decrease',
                quantity: Math.abs(stock - oldQuantity),
                reason: 'Stock update',
                user: req.user?._id
              }).save();
            }
          } else {
            const newInventory = await new Inventory({
              product: product._id,
              size,
              color,
              quantity: stock,
              location: 'Main Warehouse',
              lowStockThreshold: 5
            }).save();

            // Create history record for new inventory
            await new InventoryHistory({
              product: product._id,
              type: 'increase',
              quantity: stock,
              reason: 'New size/color added',
              user: req.user?._id
            }).save();
          }
        })
      );
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete associated inventory records
    await Inventory.deleteMany({ product: product._id });
    
    // Create history record for deletion
    await new InventoryHistory({
      product: product._id,
      type: 'decrease',
      quantity: product.stock,
      reason: 'Product deleted',
      user: req.user._id
    }).save();
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
};

// Search products
export const searchProducts = async (req, res) => {
  try {
    let { query } = req.query;

    // Basic sanitization
    if (typeof query !== 'string') query = '';
    query = query.trim();

    if (!query) {
      return res.json([]);
    }

    // Prevent excessively long regex causing performance issues
    if (query.length > 64) {
      query = query.slice(0, 64);
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Attempt to match categories by name first (case-insensitive exact or partial)
    let categoryIds = [];
    try {
      const catMatches = await Category.find({ name: regex }).select('_id');
      categoryIds = catMatches.map(c => c._id);
    } catch (e) {
      console.warn('Category lookup failed during search:', e.message);
    }

    // Build $or conditions only for valid fields
    const orConditions = [
      { name: regex },
      { description: regex }
    ];
    if (categoryIds.length) {
      orConditions.push({ category: { $in: categoryIds } });
    }

    const products = await Product.find({ $or: orConditions })
      .select('name price images category')
      .limit(12)
      .sort('-createdAt');
    if (process.env.NODE_ENV !== 'production') {
      console.log(`searchProducts query="${query}" matches=${products.length} categoriesMatched=${categoryIds.length}`);
    }
    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ message: 'Failed to search products' });
  }
};

// Update related products
export const updateRelatedProducts = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { relatedProducts: req.body.relatedProducts },
      { new: true }
    ).populate('relatedProducts');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error updating related products:', error);
    res.status(400).json({ message: error.message });
  }
};

// Upload a single video and append its URL to product.videoUrls
export const uploadProductVideo = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (!req.file) return res.status(400).json({ message: 'No video file provided' });

    // Limit number of videos
    if (product.videoUrls && product.videoUrls.length >= 8) {
      return res.status(400).json({ message: 'Maximum of 8 videos reached' });
    }

    // Cloudinary upload via upload_stream using buffer
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        resource_type: 'video',
        folder: 'products/videos'
      }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(req.file.buffer);
    });

    const url = uploadResult.secure_url;
    product.videoUrls = product.videoUrls || [];
    product.videoUrls.push(url);
    await product.save();

    res.status(201).json({ url, videoUrls: product.videoUrls });
  } catch (error) {
    console.error('Error uploading product video:', error);
    res.status(500).json({ message: 'Failed to upload video', error: error.message });
  }
};

// Standalone video upload (for use before product exists). Returns Cloudinary URL so client can include it in createProduct videoUrls.
export const uploadTempProductVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No video file provided' });

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        resource_type: 'video',
        folder: 'products/videos'
      }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(req.file.buffer);
    });

    res.status(201).json({ url: uploadResult.secure_url });
  } catch (error) {
    console.error('Error uploading temporary product video:', error);
    res.status(500).json({ message: 'Failed to upload video', error: error.message });
  }
};

// Reorder featured products
export const reorderFeaturedProducts = async (req, res) => {
  try {
    const { products } = req.body;
    await Promise.all(
      products.map(({ id, order }) => 
        Product.findByIdAndUpdate(id, { order })
      )
    );
    res.json({ message: 'Featured products reordered successfully' });
  } catch (error) {
    console.error('Error reordering featured products:', error);
    res.status(500).json({ message: 'Failed to reorder featured products' });
  }
};

// Bulk create products from parsed data (JSON from client-parsed Excel/CSV)
export const bulkCreateProducts = async (req, res) => {
  try {
    const { products } = req.body || {};
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    const results = [];

    // Helper to resolve category input (ObjectId string or category name)
    const resolveCategory = async (input) => {
      if (!input) return null;
      // Treat as ObjectId if 24-hex
      if (typeof input === 'string' && /^[a-fA-F0-9]{24}$/.test(input)) {
        const cat = await Category.findById(input);
        return cat ? cat._id : null;
      }
      // Otherwise find by name case-insensitive
      const cat = await Category.findOne({ name: new RegExp(`^${String(input).trim()}$`, 'i') });
      return cat ? cat._id : null;
    };

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      try {
        const resolvedCategoryId = await resolveCategory(row.category);
        if (!resolvedCategoryId) {
          throw new Error(`Category not found: ${row.category}`);
        }

        // Normalize booleans and arrays if client sent strings
        const normalizeColors = (colors) => {
          if (Array.isArray(colors)) return colors;
          if (typeof colors === 'string') {
            // Accept formats like "Red:#FF0000 | Blue:#0000FF" or CSV
            return colors
              .split(/\|\s*|,\s*/)
              .map((part) => part.trim())
              .filter(Boolean)
              .map((pair) => {
                const [name, code] = pair.split(/[:\-]\s*/);
                return { name: name?.trim(), code: code?.trim() };
              });
          }
          return [];
        };

        const normalizeSizes = (sizes) => {
          if (Array.isArray(sizes)) return sizes;
          if (typeof sizes === 'string') {
            // Accept formats like "S:10 | M:5" or CSV
            return sizes
              .split(/\|\s*|,\s*/)
              .map((part) => part.trim())
              .filter(Boolean)
              .map((pair) => {
                const [name, stockStr] = pair.split(':');
                const stock = Number(stockStr);
                return { name: name?.trim(), stock: Number.isFinite(stock) ? stock : 0 };
              });
          }
          return [];
        };

        const images = Array.isArray(row.images)
          ? row.images
          : typeof row.images === 'string'
            ? row.images.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
            : [];

        const body = {
          name: row.name,
          description: row.description,
          price: Number(row.price),
          originalPrice: row.originalPrice != null && row.originalPrice !== '' ? Number(row.originalPrice) : undefined,
          images,
          category: resolvedCategoryId,
          colors: normalizeColors(row.colors),
          sizes: normalizeSizes(row.sizes),
          isNew: typeof row.isNew === 'string' ? /^(true|1|yes)$/i.test(row.isNew) : Boolean(row.isNew),
          isFeatured: typeof row.isFeatured === 'string' ? /^(true|1|yes)$/i.test(row.isFeatured) : Boolean(row.isFeatured),
          currency: row.currency || 'USD'
        };

        // Validate product data
        const { isValid, errors } = validateProductData(body);
        if (!isValid) {
          throw new Error(errors.join('; '));
        }

        // Handle image validation
        const validatedImages = await handleProductImages(body.images);

        // Store provided prices directly
        const priceInUSD = body.price;
        const originalInUSD = body.originalPrice;

        // Create product
        const product = new Product({
          name: body.name,
          description: body.description,
          price: priceInUSD,
          originalPrice: originalInUSD,
          images: validatedImages,
          category: body.category,
          colors: body.colors,
          sizes: body.sizes,
          isNew: body.isNew,
          isFeatured: body.isFeatured,
          order: body.isFeatured ? await Product.countDocuments({ isFeatured: true }) : 0
        });

        const savedProduct = await product.save();

        // Create inventory per size/color combination
        const sizes = body.sizes || [];
        const colors = body.colors || [];
        const inventoryPromises = sizes.flatMap((size) =>
          (colors.length ? colors : [{ name: 'Default', code: '#000000' }]).map((color) =>
            new Inventory({
              product: savedProduct._id,
              size: size.name,
              color: color.name,
              quantity: size.stock,
              location: 'Main Warehouse',
              lowStockThreshold: 5
            }).save()
          )
        );

        await Promise.all(inventoryPromises);

        // Inventory history
        const totalQty = sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
        await new InventoryHistory({
          product: savedProduct._id,
          type: 'increase',
          quantity: totalQty,
          reason: 'Bulk upload initial stock',
          user: req.user?._id
        }).save();

        results.push({ index: i, status: 'success', id: savedProduct._id });
      } catch (err) {
        console.error(`Bulk product row ${i} failed:`, err);
        results.push({ index: i, status: 'failed', error: err.message });
      }
    }

    const summary = {
      total: products.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    };

    const status = summary.failed === 0 ? 201 : (summary.success > 0 ? 207 : 400);
    res.status(status).json(summary);
  } catch (error) {
    console.error('Error in bulkCreateProducts:', error);
    res.status(500).json({ message: 'Failed to bulk create products' });
  }
};
