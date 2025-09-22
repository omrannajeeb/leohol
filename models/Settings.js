import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Eva Curves Fashion Store'
  },
  email: {
    type: String,
    required: true,
    default: 'contact@evacurves.com'
  },
  phone: {
    type: String,
    default: '+1 (555) 123-4567'
  },
  address: {
    type: String,
    default: '123 Fashion Street, NY 10001'
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'EGP', 'IQD', 'ILS'],
    default: 'USD'
  },
  timezone: {
    type: String,
    required: true,
    default: 'UTC-5'
  },
  logo: {
    type: String,
    default: null
  },
  // Backend API base URL (e.g., https://api.example.com). Defaults to local dev server.
  apiBaseUrl: {
    type: String,
    default: 'http://localhost:5000'
  },
  
  // Design/Theme settings
  primaryColor: {
    type: String,
    default: '#3b82f6' // Blue
  },
  secondaryColor: {
    type: String,
    default: '#64748b' // Slate
  },
  accentColor: {
    type: String,
    default: '#f59e0b' // Amber
  },
  textColor: {
    type: String,
    default: '#1f2937' // Gray 800
  },
  backgroundColor: {
    type: String,
    default: '#ffffff' // White
  },
  // Navigation styles (top bar + mega menu)
  navCategoryFontColor: { type: String, default: '' },
  navCategoryFontSize: { type: String, enum: ['small','medium','large'], default: 'medium' },
  navPanelFontColor: { type: String, default: '' },
  navPanelColumnActiveBgColor: { type: String, default: '' },
  navPanelAccentColor: { type: String, default: '' },
  navPanelHeaderColor: { type: String, default: '' },
  fontFamily: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  headingFont: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  bodyFont: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  borderRadius: {
    type: String,
    default: '8px'
  },
  buttonStyle: {
    type: String,
    enum: ['rounded', 'square', 'pill'],
    default: 'rounded'
  },
  
  // Layout settings
  headerLayout: {
    type: String,
    enum: ['classic', 'modern', 'minimal'],
    default: 'modern'
  },
  headerBackgroundColor: {
    type: String,
    default: ''
  },
  headerTextColor: {
    type: String,
    default: ''
  },
  headerIcons: {
    showLanguage: { type: Boolean, default: true },
    showCurrency: { type: Boolean, default: true },
    showSearch: { type: Boolean, default: true },
    showWishlist: { type: Boolean, default: true },
    showCart: { type: Boolean, default: true },
    showAccount: { type: Boolean, default: true }
  },
  // Header icon style variants
  headerIconVariants: {
    cart: { type: String, enum: ['shoppingBag', 'shoppingCart'], default: 'shoppingBag' },
    wishlist: { type: String, enum: ['heart', 'bookmark'], default: 'heart' }
  },
  // Custom header icon URLs
  headerIconAssets: {
    cart: { type: String, default: '' },
    wishlist: { type: String, default: '' },
    account: { type: String, default: '' },
    search: { type: String, default: '' },
    language: { type: String, default: '' },
    currency: { type: String, default: '' }
  },
  footerStyle: {
    type: String,
    enum: ['simple', 'detailed', 'newsletter'],
    default: 'detailed'
  },
  productCardStyle: {
    type: String,
    enum: ['modern', 'classic', 'minimal'],
    default: 'modern'
  },
  // Product grid layout variants
  productGridStyle: {
    type: String,
    enum: ['standard', 'compact', 'masonry', 'list', 'wide', 'gallery', 'carousel'],
    default: 'standard'
  },
  
  // Social media links
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    tiktok: { type: String, default: '' }
  },
  
  // SEO settings
  siteTitle: {
    type: String,
    default: 'Eva Curves Fashion Store'
  },
  siteDescription: {
    type: String,
    default: 'Premium fashion store offering the latest trends in clothing and accessories'
  },
  keywords: [{
    type: String
  }],
  
  // Analytics
  facebookPixel: {
    pixelId: { type: String, default: '' },
    enabled: { type: Boolean, default: false }
  },
  googleAnalytics: {
    trackingId: { type: String, default: '' },
    enabled: { type: Boolean, default: false }
  },
  // Scroll-to-top button theme
  scrollTopBgColor: { type: String, default: '' },
  scrollTopTextColor: { type: String, default: '' },
  scrollTopHoverBgColor: { type: String, default: '' },
  scrollTopPingColor: { type: String, default: '' },
  // Hero carousel settings
  heroAutoplayMs: {
    type: Number,
    default: 5000, // 5 seconds
    min: 0
  }
}, {
  timestamps: true
});

// Cloudinary credentials (server-side use only). Do NOT expose secrets via public GET.
settingsSchema.add({
  cloudinary: {
    cloudName: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    apiSecret: { type: String, default: '' }
  }
});

// Checkout form customization (admin configurable)
settingsSchema.add({
  checkoutForm: {
    showEmail: { type: Boolean, default: false },
    showLastName: { type: Boolean, default: false },
    // Future toggles (currently not rendered in UI):
    showSecondaryMobile: { type: Boolean, default: false },
    showCountry: { type: Boolean, default: false },
    // Cities list for dropdown
    cities: {
      type: [String],
      default: [
        'Jerusalem','Ramallah','Nablus','Hebron','Bethlehem','Jenin',
        'Tulkarm','Qalqilya','Jericho','Gaza City','Rafah','Khan Younis',
        'Deir al-Balah','Beit Lahia','Beit Hanoun'
      ]
    },
    allowOtherCity: { type: Boolean, default: true }
  }
});

// Payments configuration (server-side; clientId may be exposed, secret must not be)
settingsSchema.add({
  payments: {
    paypal: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
      clientId: { type: String, default: '' },
      secret: { type: String, default: '' }
    }
  }
});

// Create default settings or migrate existing ones
settingsSchema.statics.createDefaultSettings = async function() {
  try {
    const settings = await this.findOne();
    if (!settings) {
      // No settings exist, create default ones
      await this.create({});
      console.log('Default store settings created successfully');
    } else {
      // Settings exist, check if we need to add new theme fields
  let needsUpdate = false;
  const updateData = {};
      
      // Check for missing theme fields and add defaults
      if (!settings.primaryColor) {
        updateData.primaryColor = '#3b82f6';
        needsUpdate = true;
      }
      if (!settings.secondaryColor) {
        updateData.secondaryColor = '#64748b';
        needsUpdate = true;
      }
      if (!settings.accentColor) {
        updateData.accentColor = '#f59e0b';
        needsUpdate = true;
      }
      if (!settings.textColor) {
        updateData.textColor = '#1f2937';
        needsUpdate = true;
      }
      if (!settings.backgroundColor) {
        updateData.backgroundColor = '#ffffff';
        needsUpdate = true;
      }
      if (!settings.fontFamily) {
        updateData.fontFamily = 'Inter, system-ui, sans-serif';
        needsUpdate = true;
      }
      if (!settings.productGridStyle) {
        updateData.productGridStyle = 'standard';
        needsUpdate = true;
      }
      // Ensure new nav style fields exist
      const ensureField = (k, val) => { if (typeof settings[k] === 'undefined') { updateData[k] = val; needsUpdate = true; } };
      ensureField('navCategoryFontColor', '');
      ensureField('navCategoryFontSize', 'medium');
      ensureField('navPanelFontColor', '');
      ensureField('navPanelColumnActiveBgColor', '');
      ensureField('navPanelAccentColor', '');
      ensureField('navPanelHeaderColor', '');
  // Ensure scroll-to-top fields exist
  ensureField('scrollTopBgColor', '');
  ensureField('scrollTopTextColor', '');
  ensureField('scrollTopHoverBgColor', '');
  ensureField('scrollTopPingColor', '');
      if (!settings.productCardStyle) {
        updateData.productCardStyle = 'modern';
        needsUpdate = true;
      }
      if (!settings.headerIcons) {
        updateData.headerIcons = {
          showLanguage: true,
          showCurrency: true,
          showSearch: true,
          showWishlist: true,
          showCart: true,
          showAccount: true
        };
        needsUpdate = true;
      }
      if (typeof settings.headerBackgroundColor === 'undefined') {
        updateData.headerBackgroundColor = '';
        needsUpdate = true;
      }
      if (typeof settings.headerTextColor === 'undefined') {
        updateData.headerTextColor = '';
        needsUpdate = true;
      }
      if (!settings.headerIconVariants) {
        updateData.headerIconVariants = {
          cart: 'shoppingBag',
          wishlist: 'heart'
        };
        needsUpdate = true;
      }
      if (!settings.headerIconAssets) {
        updateData.headerIconAssets = {
          cart: '',
          wishlist: '',
          account: '',
          search: '',
          language: '',
          currency: ''
        };
        needsUpdate = true;
      }
      // Ensure socialLinks.whatsapp exists
      if (!settings.socialLinks || typeof settings.socialLinks.whatsapp === 'undefined') {
        updateData.socialLinks = {
          ...(settings.socialLinks || {}),
          whatsapp: ''
        };
        needsUpdate = true;
      }
      // Ensure hero autoplay exists
      if (typeof settings.heroAutoplayMs === 'undefined') {
        updateData.heroAutoplayMs = 5000;
        needsUpdate = true;
      }
      // Ensure apiBaseUrl field exists
      if (typeof settings.apiBaseUrl === 'undefined') {
        updateData.apiBaseUrl = 'http://localhost:5000';
        needsUpdate = true;
      }
      // Ensure payments.paypal exists
      if (!settings.payments || !settings.payments.paypal) {
        updateData.payments = {
          ...(settings.payments || {}),
          paypal: {
            enabled: false,
            mode: 'sandbox',
            clientId: '',
            secret: ''
          }
        };
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await this.findByIdAndUpdate(settings._id, updateData);
        console.log('Existing settings migrated with new theme fields');
      }
    }
  } catch (error) {
    console.error('Error creating/migrating settings:', error);
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;