import DeliveryCompany from '../models/DeliveryCompany.js';

/**
 * Ensure all delivery companies have a boolean "paid" mapping using transform 'is_paid_online'.
 * If an existing mapping uses 'is_paid', upgrade it to 'is_paid_online'.
 * Idempotent across runs.
 */
export async function applyPaidMappingToAllCompanies() {
  const companies = await DeliveryCompany.find();
  let updated = 0;
  for (const company of companies) {
    try {
      const mappings = Array.isArray(company.fieldMappings) ? company.fieldMappings : [];
      let changed = false;
      // Upgrade any existing 'paid' mapping to use 'is_paid_online'
      for (const m of mappings) {
        if (!m) continue;
        const targetIsPaid = String(m.targetField || '') === 'paid';
        const isPaidTransform = m.transform === 'is_paid';
        const isPaidOnlineTransform = m.transform === 'is_paid_online';
        if (targetIsPaid && !isPaidOnlineTransform) {
          m.transform = 'is_paid_online';
          if (!m.sourceField) m.sourceField = 'paymentStatus';
          if (m.enabled === undefined) m.enabled = true;
          if (m.required === undefined) m.required = false;
          changed = true;
        } else if (isPaidTransform && !targetIsPaid) {
          // If someone created a mapping with transform but different target, keep transform upgrade
          m.transform = 'is_paid_online';
          changed = true;
        }
      }
      // If no mapping targets 'paid', add one
      const hasPaidTarget = mappings.some(m => m && String(m.targetField || '') === 'paid');
      if (!hasPaidTarget) {
        mappings.push({
          sourceField: 'paymentStatus',
          targetField: 'paid',
          transform: 'is_paid_online',
          required: false,
          enabled: true
        });
        changed = true;
      }
      if (changed) {
        company.fieldMappings = mappings;
        await company.save();
        updated++;
      }
    } catch {}
  }
  return { updated, total: companies.length };
}

export default { applyPaidMappingToAllCompanies };
