/**
 * BMA Flood Road Telemetry Service for ThaiFlood
 * Fetches 100% Real Live Road Surface Flood Telemetry from
 * Bangkok Metropolitan Administration (สำนักการระบายน้ำ กรุงเทพมหานคร / ThaiWater)
 * Covers 262 live telemetric road surface sensor stations across Bangkok & Vicinity
 * ZERO MOCK DATA
 */

const BMA_ROAD_CACHE_KEY = 'thaiflood_bma_road_live_cache_v1';
const BMA_ROAD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 mins

/**
 * Fetch real-time BMA road flood sensor data from official government API
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function fetchLiveBmaRoadFloodGeoJSON() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(BMA_ROAD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && (Date.now() - parsed.timestamp < BMA_ROAD_CACHE_TTL_MS) && parsed.data) {
          return parsed.data;
        }
      }
    } catch {}
  }

  const url = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/flood_road';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`BMA Road Flood API error HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawList = json?.data || [];

    if (!Array.isArray(rawList)) {
      throw new Error('Invalid BMA road flood response format');
    }

    const features = rawList.map((item, idx) => {
      const st = item.station;
      if (!st || !st.floodroad_lat || !st.floodroad_long) return null;

      const lat = parseFloat(st.floodroad_lat);
      const lng = parseFloat(st.floodroad_long);
      if (isNaN(lat) || isNaN(lng) || lat < 12.0 || lat > 15.0 || lng < 99.0 || lng > 102.0) {
        return null;
      }

      const waterDepthCm = Number(item.floodroad_value || 0);
      const isFlooded = waterDepthCm > 0;
      const roadName = st.floodroad_name?.th || st.floodroad_name?.en || 'จุดตรวจวัดน้ำท่วมขังบนถนน';
      const district = item.geocode?.amphoe_name?.th || '';
      const province = item.geocode?.province_name?.th || 'กรุงเทพมหานคร';
      const agencyName = item.agency?.agency_name?.th || 'สำนักการระบายน้ำ กรุงเทพมหานคร';
      const reportedTime = item.floodroad_datetime || 'ล่าสุด';

      // Correlate passability: water depth >= 20 cm causes traffic blockage for small vehicles
      const passable = waterDepthCm < 20;

      return {
        type: 'Feature',
        id: `bma-road-${st.id || idx}`,
        properties: {
          id: `bma-road-${st.id || idx}`,
          stationId: st.id,
          code: st.floodroad_oldcode || `BMA-${st.id}`,
          road: roadName,
          district,
          province,
          waterDepthCm,
          isFlooded,
          passable,
          statusLabel: isFlooded
            ? (passable ? `⚠️ มีน้ำท่วมขัง ${waterDepthCm} ซม. (ผ่านได้ระมัดระวัง)` : `⛔ น้ำท่วมขังสูง ${waterDepthCm} ซม. (รถเล็กโปรดหลีกเลี่ยง)`)
            : 'ผิวจราจรแห้งปกติ',
          severity: waterDepthCm >= 20 ? 'critical' : (waterDepthCm > 0 ? 'warning' : 'normal'),
          cause: isFlooded ? 'น้ำรอการระบายบนผิวจราจร' : 'ปกติ',
          agency: agencyName,
          datetime: reportedTime,
          reportedTime
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      };
    }).filter(Boolean);

    const geoData = {
      type: 'FeatureCollection',
      metadata: {
        agency: 'สำนักการระบายน้ำ กรุงเทพมหานคร (BMA Drainage Department / ThaiWater)',
        updatedAt: new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        count: features.length,
        floodedCount: features.filter((f) => f.properties.isFlooded).length
      },
      features
    };

    if (typeof window !== 'undefined' && window.localStorage && features.length > 0) {
      try {
        localStorage.setItem(BMA_ROAD_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: geoData
        }));
      } catch {}
    }

    return geoData;
  } catch (err) {
    console.warn('BMA Road Flood live API unavailable:', err.message);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(BMA_ROAD_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.data) return parsed.data;
        }
      } catch {}
    }

    // STRICT: ZERO MOCK DATA.
    return {
      type: 'FeatureCollection',
      metadata: {
        agency: 'สำนักการระบายน้ำ กรุงเทพมหานคร',
        updatedAt: 'ไม่สามารถเชื่อมต่อข้อมูลสดได้',
        count: 0,
        floodedCount: 0
      },
      features: []
    };
  }
}
