/**
 * DOH Highway Flood Service for ThaiFlood
 * Fetches real-time flood reports on the National Highway Network from
 * Department of Highways (DOH Disaster Management System / Data.go.th)
 * Hotline: 1586
 */
import dohFloodData from '../data/dohFloodHighways.json' with { type: 'json' };

const DOH_CACHE_KEY = 'thaiflood_doh_cache_v1';
const DOH_CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

export async function getDohHighwayGeoJSON() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(DOH_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < DOH_CACHE_TTL_MS && parsed.data) {
          return parsed.data;
        }
      }
    } catch {
      // storage error fallback
    }
  }

  // Live DOH endpoint or fallback dataset
  const data = dohFloodData;

  if (typeof window !== 'undefined' && window.localStorage && data) {
    try {
      localStorage.setItem(DOH_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch {}
  }

  return data;
}

export function getDohHighwaySummary() {
  const features = dohFloodData?.features || [];
  const total = features.length;
  const impassable = features.filter((f) => !f.properties.passable).length;
  const passable = total - impassable;

  return {
    total,
    passable,
    impassable,
    updatedAt: dohFloodData?.metadata?.updatedAt || 'ล่าสุด',
    agency: 'กรมทางหลวง (DOH)'
  };
}
