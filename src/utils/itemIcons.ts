import { ITEM_CODENAMES } from './itemCodenames';

// Build a reverse mapping from DisplayName to CodeName
const REVERSE_CODENAMES_MAP: Record<string, string> = {};

Object.entries(ITEM_CODENAMES).forEach(([code, displayName]) => {
  if (displayName) {
    const key = displayName.toLowerCase();
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanDisplay = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!REVERSE_CODENAMES_MAP[key] || cleanCode === cleanDisplay) {
      REVERSE_CODENAMES_MAP[key] = code;
    }
  }
});

/**
 * Returns the public URL for an item's PNG icon based on display name or codename.
 */
export function getItemIconUrl(itemName?: string | null): string | null {
  if (!itemName) return null;

  // Clean item name (remove " (Crate)" if present)
  let cleanName = itemName.replace(/\s*\(Crate\)$/i, '').trim();

  if (cleanName === 'Maintenance Supplies' || cleanName === 'Supplies' || cleanName === 'Garrison Supplies') {
    return '/item-icons/MaintenanceSupplies.png';
  }
  
  // If it's already a codename key in ITEM_CODENAMES
  if (ITEM_CODENAMES[cleanName]) {
    return `/item-icons/${cleanName}.png`;
  }

  // Lookup by display name (case-insensitive)
  const codeName = REVERSE_CODENAMES_MAP[cleanName.toLowerCase()];
  if (codeName) {
    return `/item-icons/${codeName}.png`;
  }

  return null;
}

/**
 * Returns the public URL for a category's PNG icon.
 */
export function getCategoryIconUrl(categoryKey?: string | null): string | null {
  if (!categoryKey) return '/category-icons/all.png';

  const keyMap: Record<string, string> = {
    'all': 'all',
    'small_arms': 'small_arms',
    'heavy_arms': 'heavy_arms',
    'heavy_ammunition': 'heavy_ammunition',
    'utility': 'utility',
    'medical': 'medical',
    'materials': 'materials',
    'uniforms': 'uniforms',
    'aircraft_parts': 'materials',
    'vehicles': 'vehicles',
    'shippables': 'shippables',
    'vehicle_crates': 'vehicles',
    'shippable_crates': 'shippables'
  };

  const fileKey = keyMap[categoryKey] || 'all';
  return `/category-icons/${fileKey}.png`;
}
