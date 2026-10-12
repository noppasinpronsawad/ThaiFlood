import { realTraffySnapshot } from '../data/traffyLiveSnapshot.js';
import { fetchWithSmartSwitching } from './telemetrySwitchService.js';

/**
 * Traffy Fondue Citizen Reports Service
 * 100% Real Live Crowd-Sourced Citizen Issue Reports from NECTEC Traffy Fondue Open API
 * ZERO MOCK DATA: Never injects fake or synthetic reports.
 */

const TRAFFY_LIVE_API_URL = 'https://api.traffy.in.th/postgrest/rpc/get_bkk_geojson_feed?p_limit=300';
const TRAFFY_API_URL = 'https://publicapi.traffy.in.th/share/teamchadchart/search?limit=100';
const TRAFFY_CACHE_KEY = 'thaiflood_traffy_live_cache_v2';
const TRAFFY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 mins

function formatThaiTimestamp(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = months[d.getMonth()];
    const year = d.getFullYear(); // Strictly CE / ค.ศ.
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins} น.`;
  } catch {
    return dateStr;
  }
}

/**
 * Normalizes raw Traffy incident into standard GeoJSON Feature
 */
function normalizeTraffyItem(item) {
  if (!item) return null;
  let lng = 0;
  let lat = 0;
  if (Array.isArray(item.coords) && item.coords.length >= 2) {
    lng = parseFloat(item.coords[0]);
    lat = parseFloat(item.coords[1]);
  } else if (typeof item.coords === 'string' && item.coords.includes(',')) {
    const parts = item.coords.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > 90) {
        lng = parts[0];
        lat = parts[1];
      } else {
        lat = parts[0];
        lng = parts[1];
      }
    }
  } else if (item.coords && item.coords.coordinates) {
    lng = item.coords.coordinates[0];
    lat = item.coords.coordinates[1];
  }

  // Validate coordinates (Thailand bounding box)
  if (isNaN(lng) || isNaN(lat) || lng < 97.0 || lng > 106.0 || lat < 5.0 || lat > 21.0) {
    return null;
  }

  const state = item.state || 'รอรับเรื่อง';
  const isResolved = state.includes('เสร็จสิ้น') || state.includes('ยุติ') || state.includes('เรียบร้อย');
  const statusClass = isResolved ? 'status-resolved' : 'status-warning';
  const statusLabel = isResolved ? 'แก้ไขแล้ว' : state;
  const typeName = item.type || (Array.isArray(item.problem_type_fondue) ? item.problem_type_fondue.filter(Boolean).join(', ') : item.problem_type_fondue) || (Array.isArray(item.problem_type_abdul) ? item.problem_type_abdul.filter(Boolean).join(', ') : item.problem_type_abdul) || 'เรื่องร้องเรียน';

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    properties: {
      id: item.ticket_id || `traffy-${item.message_id || Date.now()}`,
      ticket_id: item.ticket_id || 'TF-REPORT',
      title: `Traffy Fondue: ${typeName}`,
      description: item.description || item.ai?.summary || typeName,
      address: item.address || item.district || 'พื้นที่เกิดเหตุ',
      district: item.district || '',
      type: typeName,
      state: statusLabel,
      stateClass: statusClass,
      isResolved,
      timestamp: item.timestamp || '',
      formattedTime: formatThaiTimestamp(item.timestamp),
      photo_url: item.photo_url || '',
      traffy_url: item.ticket_id ? `https://share.traffy.in.th/share/teamchadchart/ticket?id=${item.ticket_id}` : 'https://www.traffy.in.th',
      line_url: 'https://line.me/R/ti/p/@traffyfondue'
    }
  };
}

/**
 * Fetch incident reports from Traffy Fondue Open API
 * 100% Real Live Data Only - returns real cached data if network times out
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function getTraffyFloodGeoJSON() {
  return await fetchWithSmartSwitching('traffy', getTraffyFloodGeoJSONDirect);
}

export async function getTraffyFloodGeoJSONDirect() {
  let staleCachedData = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(TRAFFY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < TRAFFY_CACHE_TTL_MS && parsed.data && parsed.data.features?.length > 0) {
          return parsed.data;
        }
        if (parsed.data && Array.isArray(parsed.data.features) && parsed.data.features.length > 0) {
          staleCachedData = parsed.data;
        }
      }
    } catch {}
  }

  let liveFeatures = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // 1. Primary: Official Live Traffy Fondue BMA Feed (All citizen issues)
    const res = await fetch(TRAFFY_LIVE_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.features)) {
        liveFeatures = data.features.filter((f) => f && f.geometry && f.properties).map((f) => {
          const p = f.properties;
          const state = p.state || 'รอรับเรื่อง';
          const isResolved = state.includes('เสร็จสิ้น') || state.includes('ยุติ') || state.includes('เรียบร้อย');
          const statusClass = isResolved ? 'status-resolved' : 'status-warning';
          const statusLabel = isResolved ? 'แก้ไขแล้ว' : state;
          const typeName = p.type || (Array.isArray(p.problem_type_fondue) ? p.problem_type_fondue.filter(Boolean).join(', ') : p.problem_type_fondue) || (Array.isArray(p.problem_type_abdul) ? p.problem_type_abdul.filter(Boolean).join(', ') : p.problem_type_abdul) || 'เรื่องร้องเรียน';
          return {
            type: 'Feature',
            geometry: f.geometry,
            properties: {
              id: p.ticket_id || `traffy-${p.message_id || Date.now()}`,
              ticket_id: p.ticket_id || 'TF-REPORT',
              title: `Traffy Fondue: ${typeName}`,
              description: p.description || p.ai?.summary || typeName,
              address: p.address || p.district || 'พื้นที่เกิดเหตุ',
              district: p.district || '',
              type: typeName,
              state: statusLabel,
              stateClass: statusClass,
              isResolved,
              timestamp: p.timestamp || '',
              formattedTime: formatThaiTimestamp(p.timestamp),
              photo_url: p.photo_url || '',
              traffy_url: p.ticket_id ? `https://share.traffy.in.th/share/teamchadchart/ticket?id=${p.ticket_id}` : 'https://www.traffy.in.th',
              line_url: 'https://line.me/R/ti/p/@traffyfondue'
            }
          };
        }).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn('Traffy Fondue live API primary fetch:', err.message);
  }

  // 2. Secondary fallback if primary yielded no features
  if (liveFeatures.length === 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(TRAFFY_API_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const rawList = data?.results || (Array.isArray(data) ? data : []);
        if (Array.isArray(rawList)) {
          liveFeatures = rawList.map(normalizeTraffyItem).filter(Boolean);
        }
      }
    } catch {}
  }

  // Fallback to stale cache if live fetch yielded no features
  if (liveFeatures.length === 0 && staleCachedData) {
    return staleCachedData;
  }

  // Fallback to real snapshot if cold load and network timed out
  if (liveFeatures.length === 0 && Array.isArray(realTraffySnapshot)) {
    liveFeatures = realTraffySnapshot.map(normalizeTraffyItem).filter(Boolean);
  }

  const result = {
    type: 'FeatureCollection',
    metadata: {
      agency: 'Traffy Fondue (NECTEC / สวทช.)',
      updatedAt: new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      count: liveFeatures.length
    },
    features: liveFeatures
  };

  if (typeof window !== 'undefined' && window.localStorage && liveFeatures.length > 0) {
    try {
      localStorage.setItem(TRAFFY_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
    } catch {}
  }

  return result;
}
