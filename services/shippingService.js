import ShippingZone from '../models/ShippingZone.js';
import ShippingRate from '../models/ShippingRate.js';

/**
 * Calculate shipping fee based on order details
 * @param {Object} params - Shipping calculation parameters
 * @param {number} params.subtotal - Order subtotal
 * @param {number} params.weight - Total weight of items
 * @param {string} params.country - Destination country
 * @param {string} params.region - Destination region (optional)
 * @returns {Promise<number>} Calculated shipping fee
 */
export const calculateShippingFee = async ({ subtotal, weight, country, region }) => {
  try {
    // Find shipping zones that match the country or region
    let zones = await ShippingZone.findByCountry(country);
    
    if (zones.length === 0 && region) {
      zones = await ShippingZone.findByRegion(region);
    }
    
    if (zones.length === 0) {
      throw new Error('No shipping zones found for the specified location');
    }
    
    // Get all shipping rates for the matching zones
    const allRates = [];
    for (const zone of zones) {
      const rates = await ShippingRate.findByZone(zone._id);
      allRates.push(...rates);
    }
    
    if (allRates.length === 0) {
      throw new Error('No shipping rates found for the specified location');
    }
    
    // Calculate costs for all applicable rates
    const applicableRates = [];
    
    for (const rate of allRates) {
      const cost = rate.calculateCost(subtotal, weight);
      if (cost !== null) {
        applicableRates.push({
          rate,
          cost,
          method: rate.method,
          name: rate.name
        });
      }
    }
    
    if (applicableRates.length === 0) {
      throw new Error('No applicable shipping rates found for the order criteria');
    }
    
    // Sort by cost (cheapest first) and return the lowest cost
    applicableRates.sort((a, b) => a.cost - b.cost);
    
    return applicableRates[0].cost;
  } catch (error) {
    console.error('Error calculating shipping fee:', error);
    throw new Error(`Failed to calculate shipping fee: ${error.message}`);
  }
};

/**
 * Get available shipping options for a location
 * @param {Object} params - Location parameters
 * @param {string} params.country - Destination country
 * @param {string} params.region - Destination region (optional)
 * @param {number} params.subtotal - Order subtotal (optional)
 * @param {number} params.weight - Total weight (optional)
 * @returns {Promise<Array>} Available shipping options
 */
export const getAvailableShippingOptions = async ({ country, region, subtotal = 0, weight = 0 }) => {
  try {
    // Find shipping zones that match the country or region
    let zones = await ShippingZone.findByCountry(country);
    
    if (zones.length === 0 && region) {
      zones = await ShippingZone.findByRegion(region);
    }
    
    if (zones.length === 0) {
      return [];
    }
    
    // Get all shipping rates for the matching zones
    const allRates = [];
    for (const zone of zones) {
      const rates = await ShippingRate.findByZone(zone._id);
      allRates.push(...rates);
    }
    
    // Calculate costs for all applicable rates
    const options = [];
    
    for (const rate of allRates) {
      const cost = rate.calculateCost(subtotal, weight);
      if (cost !== null) {
        options.push({
          id: rate._id,
          name: rate.name,
          description: rate.description,
          method: rate.method,
          cost,
          zone: rate.zone.name,
          estimatedDays: rate.estimatedDays || null
        });
      }
    }
    
    // Sort by cost (cheapest first)
    options.sort((a, b) => a.cost - b.cost);
    
    return options;
  } catch (error) {
    console.error('Error getting shipping options:', error);
    throw new Error(`Failed to get shipping options: ${error.message}`);
  }
};

/**
 * Validate shipping address
 * @param {Object} address - Shipping address
 * @param {string} address.country - Country
 * @param {string} address.region - State/Province/Region
 * @param {string} address.city - City
 * @param {string} address.postalCode - Postal/ZIP code
 * @returns {Promise<boolean>} Whether address is valid for shipping
 */
export const validateShippingAddress = async (address) => {
  try {
    const { country, region } = address;
    
    if (!country) {
      return false;
    }
    
    // Check if we have shipping zones for this location
    let zones = await ShippingZone.findByCountry(country);
    
    if (zones.length === 0 && region) {
      zones = await ShippingZone.findByRegion(region);
    }
    
    return zones.length > 0;
  } catch (error) {
    console.error('Error validating shipping address:', error);
    return false;
  }
};

/**
 * Create default shipping zones and rates
 * This function can be used for initial setup
 */
export const createDefaultShippingData = async () => {
  try {
    // Check if zones already exist
    const existingZones = await ShippingZone.find();
    if (existingZones.length > 0) {
      console.log('Shipping zones already exist, skipping default creation');
      return;
    }
    
    // Create default zones
    const domesticZone = new ShippingZone({
      name: 'Domestic',
      description: 'Local shipping within the country',
      countries: ['US'], // Adjust based on your primary country
      isActive: true,
      order: 1
    });
    
    const internationalZone = new ShippingZone({
      name: 'International',
      description: 'International shipping',
      countries: ['CA', 'MX', 'GB', 'FR', 'DE', 'AU', 'JP'], // Add more as needed
      isActive: true,
      order: 2
    });
    
    await domesticZone.save();
    await internationalZone.save();
    
    // Create default rates
    const domesticStandard = new ShippingRate({
      zone: domesticZone._id,
      name: 'Standard Shipping',
      description: 'Standard domestic shipping (5-7 business days)',
      method: 'flat_rate',
      cost: 9.99,
      conditions: {
        minOrderValue: 0
      },
      isActive: true,
      order: 1
    });
    
    const domesticExpress = new ShippingRate({
      zone: domesticZone._id,
      name: 'Express Shipping',
      description: 'Express domestic shipping (2-3 business days)',
      method: 'flat_rate',
      cost: 19.99,
      conditions: {
        minOrderValue: 0
      },
      isActive: true,
      order: 2
    });
    
    const domesticFree = new ShippingRate({
      zone: domesticZone._id,
      name: 'Free Shipping',
      description: 'Free shipping on orders over $50',
      method: 'free',
      cost: 0,
      conditions: {
        minOrderValue: 50
      },
      isActive: true,
      order: 0
    });
    
    const internationalStandard = new ShippingRate({
      zone: internationalZone._id,
      name: 'International Standard',
      description: 'Standard international shipping (10-15 business days)',
      method: 'flat_rate',
      cost: 24.99,
      conditions: {
        minOrderValue: 0
      },
      isActive: true,
      order: 1
    });
    
    await domesticStandard.save();
    await domesticExpress.save();
    await domesticFree.save();
    await internationalStandard.save();
    
    console.log('Default shipping zones and rates created successfully');
  } catch (error) {
    console.error('Error creating default shipping data:', error);
    throw error;
  }
};
