import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { adminAuth } from '../middleware/auth.js';
import Settings from '../models/Settings.js';
import { ensureCloudinaryConfig } from '../services/cloudinaryConfigService.js';

const router = express.Router();

// Configure multer for uploads (project-level /uploads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Get store settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    // Do not leak secrets when returning settings publicly
    const obj = settings.toObject();
    if (obj.cloudinary && obj.cloudinary.apiSecret) {
      obj.cloudinary = {
        cloudName: obj.cloudinary.cloudName || '',
        apiKey: obj.cloudinary.apiKey ? '***' : '',
        apiSecret: obj.cloudinary.apiSecret ? '***' : ''
      };
    }
    if (obj.payments && obj.payments.paypal) {
      obj.payments = {
        ...obj.payments,
        paypal: {
          enabled: !!obj.payments.paypal.enabled,
          mode: obj.payments.paypal.mode || 'sandbox',
          clientId: obj.payments.paypal.clientId ? obj.payments.paypal.clientId : '',
          secret: obj.payments.paypal.secret ? '***' : ''
        }
      };
    }
    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get analytics config (subset of settings)
router.get('/analytics', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const analytics = {
      facebookPixel: settings.facebookPixel || { pixelId: '', enabled: false },
      googleAnalytics: settings.googleAnalytics || { trackingId: '', enabled: false }
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Facebook Pixel config
router.get('/analytics/facebook-pixel', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const fb = settings.facebookPixel || { pixelId: '', enabled: false };
    res.json(fb);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Facebook Pixel config (admin only)
router.put('/analytics/facebook-pixel', adminAuth, async (req, res) => {
  try {
    const { pixelId = '', enabled = false } = req.body || {};

    // Basic validation: when enabled, require 15-16 digit numeric Pixel ID
    if (enabled && !/^\d{15,16}$/.test(String(pixelId))) {
      return res.status(400).json({ message: 'Invalid Facebook Pixel ID format' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.facebookPixel = { pixelId: String(pixelId), enabled: Boolean(enabled) };
    await settings.save();

    res.json(settings.facebookPixel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Update store settings (admin only)
router.put('/', adminAuth, async (req, res) => {
  try {
  console.log('[Settings PUT] Incoming payload:', req.body);
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Update settings
    Object.assign(settings, req.body);
    // Ensure Mongoose persists nested objects when replaced wholesale
    if (req.body && typeof req.body === 'object' && Object.prototype.hasOwnProperty.call(req.body, 'headerIcons')) {
      try {
        settings.markModified('headerIcons');
      } catch {}
    }
    await settings.save();

    // Emit real-time event to notify clients of settings change
    try {
      const broadcast = req.app.get('broadcastToClients');
      if (typeof broadcast === 'function') {
        broadcast({
          type: 'settings_updated',
          data: {
            // Currency default
            currency: settings.currency,
            // Send only fields that impact design/theme to avoid oversharing
            primaryColor: settings.primaryColor,
            secondaryColor: settings.secondaryColor,
            accentColor: settings.accentColor,
            textColor: settings.textColor,
            backgroundColor: settings.backgroundColor,
            // Navigation styles
            navCategoryFontColor: settings.navCategoryFontColor,
            navCategoryFontSize: settings.navCategoryFontSize,
            navPanelFontColor: settings.navPanelFontColor,
            navPanelColumnActiveBgColor: settings.navPanelColumnActiveBgColor,
            navPanelAccentColor: settings.navPanelAccentColor,
            navPanelHeaderColor: settings.navPanelHeaderColor,
            fontFamily: settings.fontFamily,
            borderRadius: settings.borderRadius,
            buttonStyle: settings.buttonStyle,
            headerLayout: settings.headerLayout,
            headerBackgroundColor: settings.headerBackgroundColor,
            headerTextColor: settings.headerTextColor,
            headerIcons: settings.headerIcons,
            headerIconVariants: settings.headerIconVariants,
            footerStyle: settings.footerStyle,
            productCardStyle: settings.productCardStyle,
            productGridStyle: settings.productGridStyle,
            // Component behavior
            heroAutoplayMs: settings.heroAutoplayMs,
            // Scroll-to-top
            scrollTopBgColor: settings.scrollTopBgColor,
            scrollTopTextColor: settings.scrollTopTextColor,
            scrollTopHoverBgColor: settings.scrollTopHoverBgColor,
            scrollTopPingColor: settings.scrollTopPingColor,
            // SEO fields
            siteTitle: settings.siteTitle,
            siteDescription: settings.siteDescription,
            keywords: settings.keywords,
            socialLinks: settings.socialLinks,
            // Contact info fields
            phone: settings.phone,
            address: settings.address,
            email: settings.email,
            name: settings.name,
          }
        });
      }
    } catch (e) {
      console.error('Failed to broadcast settings update:', e);
    }

    res.json(settings);
  } catch (error) {
  console.error('[Settings PUT] Error:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Upload custom header icon asset
router.post('/upload/header-icon/:key', adminAuth, upload.single('file'), async (req, res) => {
  try {
    const { key } = req.params; // cart|wishlist|account|search|language|currency
    const allowed = ['cart','wishlist','account','search','language','currency'];
    if (!allowed.includes(key)) {
      return res.status(400).json({ message: 'Invalid header icon key' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    const publicUrl = `/uploads/${req.file.filename}`;
    settings.headerIconAssets = settings.headerIconAssets || {};
    settings.headerIconAssets[key] = publicUrl;
    settings.markModified('headerIconAssets');
    await settings.save();

    // Broadcast minimal update
    try {
      const broadcast = req.app.get('broadcastToClients');
      if (typeof broadcast === 'function') {
        broadcast({
          type: 'settings_updated',
          data: { headerIconAssets: settings.headerIconAssets }
        });
      }
    } catch {}

    res.json({ key, url: publicUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

// Cloudinary admin config endpoints
router.get('/cloudinary', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    const c = settings.cloudinary || { cloudName: '', apiKey: '', apiSecret: '' };
    res.json({ cloudName: c.cloudName || '', apiKey: c.apiKey || '', apiSecret: c.apiSecret ? '***' : '' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/cloudinary', adminAuth, async (req, res) => {
  try {
    const { cloudName = '', apiKey = '', apiSecret = '' } = req.body || {};
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    settings.cloudinary = settings.cloudinary || {};
    if (typeof cloudName === 'string' && cloudName.trim().length) settings.cloudinary.cloudName = cloudName.trim();
    if (typeof apiKey === 'string') settings.cloudinary.apiKey = apiKey.trim();
    if (typeof apiSecret === 'string' && apiSecret !== '***') settings.cloudinary.apiSecret = apiSecret.trim();
    await settings.save();
    await ensureCloudinaryConfig();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/cloudinary/test', adminAuth, async (req, res) => {
  try {
    const ok = await ensureCloudinaryConfig();
    if (!ok) return res.status(400).json({ ok: false, message: 'Missing Cloudinary credentials' });
    // Simple API ping: list 1 image; if auth fails, it will throw
    await import('../services/cloudinaryClient.js');
    const { v2: sdk } = await import('cloudinary');
    const r = await sdk.api.resources({ max_results: 1, type: 'upload', resource_type: 'image' });
    res.json({ ok: true, count: (r.resources || []).length });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// PayPal admin config endpoints
router.get('/payments/paypal', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    const p = (settings.payments && settings.payments.paypal) || { enabled: false, mode: 'sandbox', clientId: '', secret: '' };
    res.json({ enabled: !!p.enabled, mode: p.mode || 'sandbox', clientId: p.clientId || '', secret: p.secret ? '***' : '' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/payments/paypal', adminAuth, async (req, res) => {
  try {
    const { enabled, mode, clientId, secret } = req.body || {};
    if (mode && !['sandbox', 'live'].includes(String(mode))) {
      return res.status(400).json({ message: 'Invalid mode. Use sandbox or live.' });
    }
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    settings.payments = settings.payments || {};
    settings.payments.paypal = settings.payments.paypal || { enabled: false, mode: 'sandbox', clientId: '', secret: '' };
    if (typeof enabled !== 'undefined') settings.payments.paypal.enabled = !!enabled;
    if (typeof mode === 'string') settings.payments.paypal.mode = mode;
    if (typeof clientId === 'string') settings.payments.paypal.clientId = clientId.trim();
    if (typeof secret === 'string' && secret !== '***') settings.payments.paypal.secret = secret.trim();
    settings.markModified('payments');
    await settings.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/payments/paypal/test', adminAuth, async (req, res) => {
  try {
// Checkout form customization endpoints
router.get('/checkout', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const cf = settings.checkoutForm || {};
    res.json({
      showEmail: !!cf.showEmail,
      showLastName: !!cf.showLastName,
      showSecondaryMobile: !!cf.showSecondaryMobile,
      showCountry: !!cf.showCountry,
      allowOtherCity: !!cf.allowOtherCity,
      cities: Array.isArray(cf.cities) ? cf.cities : []
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/checkout', adminAuth, async (req, res) => {
  try {
    const { showEmail, showLastName, showSecondaryMobile, showCountry, cities, allowOtherCity } = req.body || {};
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    settings.checkoutForm = settings.checkoutForm || {};
    if (typeof showEmail === 'boolean') settings.checkoutForm.showEmail = showEmail;
    if (typeof showLastName === 'boolean') settings.checkoutForm.showLastName = showLastName;
    if (typeof showSecondaryMobile === 'boolean') settings.checkoutForm.showSecondaryMobile = showSecondaryMobile;
    if (typeof showCountry === 'boolean') settings.checkoutForm.showCountry = showCountry;
    if (typeof allowOtherCity === 'boolean') settings.checkoutForm.allowOtherCity = allowOtherCity;
    if (Array.isArray(cities)) settings.checkoutForm.cities = cities.filter(c => typeof c === 'string' && c.trim().length).map(c => c.trim());
    settings.markModified('checkoutForm');
    await settings.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

    let settings = await Settings.findOne();
    if (!settings || !settings.payments || !settings.payments.paypal || !settings.payments.paypal.clientId || !settings.payments.paypal.secret) {
      return res.status(400).json({ ok: false, message: 'Missing PayPal credentials' });
    }
    // Simple auth test: get an access token via SDK by creating a minimal order and not executing
    const { getPayPalClient, paypalSdk } = await import('../services/paypalClient.js');
    try {
      const client = getPayPalClient();
      const request = new paypalSdk.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' } }] });
      await client.execute(request);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, message: e.message });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});