/**
 * Geocode & Location Search Service for ThaiFlood
 * Provides fast local search for 77 Thai provinces and live administrative search
 * for districts (อำเภอ/เขต) and subdistricts (ตำบล/แขวง) via OSM Nominatim (HTTPS)
 */
import { THAI_PROVINCES } from './weatherService.js';

// Common province aliases and abbreviations in Thailand
const PROVINCE_ALIASES = {
  'กทม': 'กรุงเทพมหานคร',
  'กรุงเทพ': 'กรุงเทพมหานคร',
  'กทม.': 'กรุงเทพมหานคร',
  'อยุธยา': 'พระนครศรีอยุธยา',
  'โคราช': 'นครราชสีมา'
};

/**
 * Searches local 77 provinces instantly (0ms)
 * @param {string} query
 * @returns {Array} Matched province objects
 */
export function searchLocalProvinces(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Check alias match
  const aliasTarget = PROVINCE_ALIASES[q];

  return THAI_PROVINCES.filter((p) => {
    const pName = p.name.toLowerCase();
    if (aliasTarget && pName.includes(aliasTarget.toLowerCase())) return true;
    return pName.includes(q);
  }).map((p) => ({
    id: `prov-${p.name}`,
    name: `จ.${p.name}`,
    fullName: `จังหวัด${p.name}`,
    province: p.name,
    subtitle: 'ประเทศไทย',
    lat: p.lat,
    lng: p.lng,
    typeLabel: 'จังหวัด',
    icon: '🏛️',
    isLocation: true,
    isProvince: true,
    zoom: 9.5
  }));
}

/**
 * Searches Thai administrative locations (ตำบล, อำเภอ, เขต, แขวง, จังหวัด)
 * using HTTPS OpenStreetMap Nominatim with AbortController
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function searchThaiLocations(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=th&format=json&addressdetails=1&limit=6`;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'th,en',
        'User-Agent': 'ThaiFlood-Live-Portal/1.0'
      }
    });

    if (!res.ok) return [];
    const data = await res.json();

    return data.map((item) => {
      const addr = item.address || {};
      const subdistrict = addr.subdistrict || addr.village || addr.quarter || addr.suburb || '';
      const district = addr.district || addr.city || addr.county || addr.municipality || '';
      let province = (addr.province || addr.state || '').replace(/^จังหวัด/, '');

      if (!province && district === 'กรุงเทพมหานคร') {
        province = 'กรุงเทพมหานคร';
      }

      let typeLabel = 'สถานที่';
      let icon = '📍';
      let zoom = 12.5;
      const cleanName = item.name || '';

      if (cleanName.startsWith('ตำบล') || cleanName.startsWith('แขวง') || subdistrict) {
        typeLabel = 'ตำบล/แขวง';
        icon = '🏡';
        zoom = 13.5;
      } else if (cleanName.startsWith('อำเภอ') || cleanName.startsWith('เขต') || cleanName.startsWith('เทศบาล') || district) {
        typeLabel = 'อำเภอ/เขต';
        icon = '🏙️';
        zoom = 12;
      } else if (cleanName.startsWith('จังหวัด') || province) {
        typeLabel = 'จังหวัด';
        icon = '🏛️';
        zoom = 9.5;
      }

      // Build readable subtitle: e.g. "ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่"
      const parts = [];
      if (subdistrict && !cleanName.includes(subdistrict)) parts.push(`ต.${subdistrict}`);
      if (district && !cleanName.includes(district)) parts.push(district.startsWith('เขต') ? district : `อ.${district}`);
      if (province && !cleanName.includes(province)) parts.push(`จ.${province}`);

      let subtitle = parts.join(' · ');
      if (!subtitle) {
        const rawParts = (item.display_name || '').split(',').map((s) => s.trim());
        subtitle = rawParts.slice(1, 4).join(', ');
      }

      return {
        id: `geo-${item.place_id || Math.random()}`,
        name: cleanName,
        subtitle: subtitle || 'ประเทศไทย',
        province: province || 'ประเทศไทย',
        amphoe: district,
        tambon: subdistrict,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        typeLabel,
        icon,
        isLocation: true,
        isProvince: typeLabel === 'จังหวัด',
        isAmphoe: typeLabel === 'อำเภอ/เขต',
        isTambon: typeLabel === 'ตำบล/แขวง',
        zoom
      };
    });
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.warn('Geocoding search warning:', err.message);
    return [];
  }
}
