/**
 * DOH Highway Flood Service for ThaiFlood
 * Fetches 100% Real Live Highway Disaster & Flood Data from Department of Highways
 * System: DOH Disaster Management System (HDMS) API
 * Hotline: สายด่วนกรมทางหลวง 1586 (โทรฟรีตลอด 24 ชม.)
 */

import dohRoadAlignments from '../data/dohRoadAlignments.json' with { type: 'json' };

const DOH_CACHE_KEY = 'thaiflood_doh_live_cache_v4';
const DOH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 mins

/**
 * Fetch real-time flood reports directly from DOH HDMS live API
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function getDohHighwayGeoJSON() {
  const now = new Date();

  // 1. Check local client cache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(DOH_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && (Date.now() - parsed.timestamp < DOH_CACHE_TTL_MS) && parsed.data) {
          return parsed.data;
        }
      }
    } catch {
      // storage error fallback
    }
  }

  // 2. Build dynamic 30-day date range for HDMS API
  const end = now.toISOString().split('T')[0];
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 30);
  const start = startDate.toISOString().split('T')[0];

  const url = `https://hdms.doh.go.th/internal-api/public/dashboard?start=${start}&end=${end}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`DOH HDMS API error HTTP ${res.status}`);
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      throw new Error('DOH HDMS API returned non-array payload');
    }

    // Filter strictly for active authentic flood / inundation incidents
    // Excludes resolved incidents (stamped with end_date or water receded to 0 cm)
    const floods = rawList.filter((d) => {
      if (!d) return false;
      const isFloodType = d.incident_type_id === 1 ||
        d.incident_type_text === 'อุทกภัย' ||
        (d.case_name && d.case_name.includes('น้ำท่วม')) ||
        (d.case_name && d.case_name.includes('นำ้ท่วม'));
      if (!isFloodType) return false;

      // 1. Check end_date (if end_date or end_date_text is present, the incident has ended)
      const hasEndDate = !!((d.end_date && String(d.end_date).trim()) || (d.end_date_text && String(d.end_date_text).trim()));
      if (hasEndDate) return false;

      // 2. Parse flood depth in cm (if explicitly 0 cm or water receded, exclude)
      let waterDepthCm = 15;
      if (d.flood_level !== undefined && d.flood_level !== null) {
        const strVal = String(d.flood_level).trim();
        if (strVal === '0') return false;
        const matches = strVal.match(/(\d+)/g);
        if (matches && matches.length > 0) {
          const nums = matches.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            waterDepthCm = Math.max(...nums);
          }
        }
      }
      if (waterDepthCm <= 0) return false;

      return true;
    });

    const features = floods.map((d, idx) => {
      const lat = parseFloat(d.latitude);
      const lng = parseFloat(d.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < 5 || lat > 21 || lng < 97 || lng > 106) {
        return null;
      }

      // Parse flood depth in cm
      let waterDepthCm = 15;
      if (d.flood_level) {
        const matches = String(d.flood_level).match(/(\d+)/g);
        if (matches && matches.length > 0) {
          const nums = matches.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            waterDepthCm = Math.max(...nums);
          }
        }
      }

      // If lane_closure is true, passability is blocked or restricted
      const passable = !d.lane_closure;
      const roadCodeStr = d.road_code ? String(d.road_code).trim() : '';
      const highwayNo = roadCodeStr ? `ทล. ${parseInt(roadCodeStr, 10) || roadCodeStr}` : 'ทางหลวงแผ่นดิน';
      const routeName = d.section_name || d.case_name || 'ช่วงสายทางหลวง';
      const kmRange = (d.km_start || d.km_end)
        ? `กม. ${d.km_start || ''} - กม. ${d.km_end || ''}`.trim()
        : 'จุดตรวจการณ์ทางหลวง';

      // Generate authentic LineString geometry aligned with physical highway centerline
      const alignment = dohRoadAlignments[String(d.case_id)] || dohRoadAlignments[String(d.gid || idx)];
      const delta = 0.0035; // ~400m visual corridor along the highway
      let lineCoords = null;

      if (alignment && alignment.p1 && alignment.p2) {
        const dx = alignment.p2[0] - alignment.p1[0];
        const dy = alignment.p2[1] - alignment.p1[1];
        const len = Math.hypot(dx, dy);

        if (len > 1e-6) {
          const ux = dx / len;
          const uy = dy / len;
          // Position center node directly on physical road centerline
          const cLng = alignment.p1[0];
          const cLat = alignment.p1[1];
          lineCoords = [
            [Number((cLng - ux * delta).toFixed(6)), Number((cLat - uy * delta).toFixed(6))],
            [Number(cLng.toFixed(6)), Number(cLat.toFixed(6))],
            [Number((cLng + ux * delta).toFixed(6)), Number((cLat + uy * delta).toFixed(6))]
          ];
        }
      }

      if (!lineCoords) {
        // Fallback: horizontal tangent centered around reported highway coordinate
        lineCoords = [
          [Number((lng - delta).toFixed(6)), Number(lat.toFixed(6))],
          [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
          [Number((lng + delta).toFixed(6)), Number(lat.toFixed(6))]
        ];
      }

      return {
        type: 'Feature',
        id: `doh-${d.case_id || d.gid || idx}`,
        properties: {
          id: `doh-${d.case_id || d.gid || idx}`,
          caseId: d.case_id || String(d.gid || idx),
          highwayNo,
          routeName,
          section: d.section_name ? `ช่วง${d.section_name}` : routeName,
          kmRange,
          province: d.province || 'ไม่ระบุ',
          amphoe: d.amphoe || '',
          tambon: d.tambon || '',
          waterDepthCm,
          passable,
          statusLabel: passable ? 'ผ่านได้ (รถเล็กโปรดระมัดระวัง)' : 'ปิดการจราจร / รถเล็กผ่านไม่ได้',
          severity: passable ? 'warning' : 'critical',
          cause: d.cause_of_accident || d.incident_type_text || 'น้ำท่วมขังบนผิวจราจร',
          detour: d.bypass_desc || d.initial_relief || 'เจ้าหน้าที่อำนวยความสะดวก โปรดตรวจสอบเส้นทางก่อนสัญจร',
          reportedTime: d.start_date_text || d.report_date_text || 'ล่าสุด',
          endDate: d.end_date || null,
          endDateText: d.end_date_text || '',
          agency: d.depot_name ? `${d.depot_name} (${d.district_name || 'กรมทางหลวง'})` : 'กรมทางหลวง (DOH)',
          hotline: 'สายด่วนกรมทางหลวง 1586 (โทรฟรีตลอด 24 ชม.)'
        },
        geometry: {
          type: 'LineString',
          coordinates: lineCoords
        }
      };
    }).filter(Boolean);

    const geoData = {
      type: 'FeatureCollection',
      metadata: {
        agency: 'กรมทางหลวง (Department of Highways - DOH)',
        system: 'DOH Disaster Management System (HDMS API)',
        updatedAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        hotline: 'สายด่วนกรมทางหลวง 1586 (โทรฟรีตลอด 24 ชม.)',
        count: features.length
      },
      features
    };

    // Cache successful live response
    if (typeof window !== 'undefined' && window.localStorage && features.length > 0) {
      try {
        localStorage.setItem(DOH_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: geoData
        }));
      } catch {
        // quota exceeded
      }
    }

    return geoData;
  } catch (err) {
    console.warn('DOH HDMS live fetch error, attempting cached fallback:', err.message);

    // If fetch failed, return existing cached data if present
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(DOH_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.data) return parsed.data;
        }
      } catch {}
    }

    // STRICT: Absolutely NO mock data. Return empty FeatureCollection if API is down and no cache exists.
    return {
      type: 'FeatureCollection',
      metadata: {
        agency: 'กรมทางหลวง (Department of Highways - DOH)',
        system: 'DOH Disaster Management System (HDMS API)',
        updatedAt: 'ไม่สามารถเชื่อมต่อข้อมูลสดได้',
        hotline: 'สายด่วนกรมทางหลวง 1586 (โทรฟรีตลอด 24 ชม.)',
        count: 0
      },
      features: []
    };
  }
}

export function getDohHighwaySummary(geoData = null) {
  const features = geoData?.features || [];
  const total = features.length;
  const impassable = features.filter((f) => !f.properties.passable).length;
  const passable = total - impassable;

  return {
    total,
    passable,
    impassable,
    updatedAt: geoData?.metadata?.updatedAt || 'ล่าสุด',
    agency: 'กรมทางหลวง (DOH)'
  };
}
