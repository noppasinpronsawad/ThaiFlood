/**
 * Marker Clustering & Zoom-Based Hierarchy Service for ThaiFlood
 * Supports:
 * - Zoom-based clustering:
 *   - Furthest zoom (zoom < 7.0): ระดับภาค (Regional clusters)
 *   - Regional zoom (7.0 <= zoom < 9.5): รวมระดับจังหวัด (Provincial clusters)
 *   - Provincial zoom (zoom >= 9.5): หมุดแต่ละจุด (Individual pins)
 * - Majority Color Rule for DOH Highway Flood:
 *   - passable > impassable => Orange (#ea580c)
 *   - impassable > passable => Red (#dc2626)
 *   - impassable === passable => RED (#dc2626) [Strict requirement: หากเท่ากันให้แสดงหมุดไอคอนสีแดง]
 * - Cluster Expansion Zoom & Spiderfy for overlapping pins (กางหมุดที่ทับซ้อนกัน)
 */

export const THAI_REGIONS = {
  CENTRAL: 'ภาคกลาง',
  NORTH: 'ภาคเหนือ',
  NORTHEAST: 'ภาคตะวันออกเฉียงเหนือ',
  EAST: 'ภาคตะวันออก',
  WEST: 'ภาคตะวันตก',
  SOUTH: 'ภาคใต้'
};

export const PROVINCE_TO_REGION = {
  // ภาคกลาง (Central)
  'กรุงเทพมหานคร': THAI_REGIONS.CENTRAL,
  'กรุงเทพ': THAI_REGIONS.CENTRAL,
  'กรุงเทพฯ': THAI_REGIONS.CENTRAL,
  'กทม': THAI_REGIONS.CENTRAL,
  'กทม.': THAI_REGIONS.CENTRAL,
  'นนทบุรี': THAI_REGIONS.CENTRAL,
  'ปทุมธานี': THAI_REGIONS.CENTRAL,
  'สมุทรปราการ': THAI_REGIONS.CENTRAL,
  'สมุทรสาคร': THAI_REGIONS.CENTRAL,
  'สมุทรสงคราม': THAI_REGIONS.CENTRAL,
  'นครปฐม': THAI_REGIONS.CENTRAL,
  'พระนครศรีอยุธยา': THAI_REGIONS.CENTRAL,
  'อยุธยา': THAI_REGIONS.CENTRAL,
  'สระบุรี': THAI_REGIONS.CENTRAL,
  'ลพบุรี': THAI_REGIONS.CENTRAL,
  'ชัยนาท': THAI_REGIONS.CENTRAL,
  'สิงห์บุรี': THAI_REGIONS.CENTRAL,
  'อ่างทอง': THAI_REGIONS.CENTRAL,
  'สุพรรณบุรี': THAI_REGIONS.CENTRAL,

  // ภาคเหนือ (North)
  'เชียงใหม่': THAI_REGIONS.NORTH,
  'เชียงราย': THAI_REGIONS.NORTH,
  'แม่ฮ่องสอน': THAI_REGIONS.NORTH,
  'ลำปาง': THAI_REGIONS.NORTH,
  'ลำพูน': THAI_REGIONS.NORTH,
  'น่าน': THAI_REGIONS.NORTH,
  'พะเยา': THAI_REGIONS.NORTH,
  'แพร่': THAI_REGIONS.NORTH,
  'อุตรดิตถ์': THAI_REGIONS.NORTH,
  'สุโขทัย': THAI_REGIONS.NORTH,
  'พิษณุโลก': THAI_REGIONS.NORTH,
  'พิจิตร': THAI_REGIONS.NORTH,
  'กำแพงเพชร': THAI_REGIONS.NORTH,
  'นครสวรรค์': THAI_REGIONS.NORTH,
  'อุทัยธานี': THAI_REGIONS.NORTH,
  'เพชรบูรณ์': THAI_REGIONS.NORTH,

  // ภาคตะวันออกเฉียงเหนือ (Isan)
  'นครราชสีมา': THAI_REGIONS.NORTHEAST,
  'โคราช': THAI_REGIONS.NORTHEAST,
  'ขอนแก่น': THAI_REGIONS.NORTHEAST,
  'อุดรธานี': THAI_REGIONS.NORTHEAST,
  'อุบลราชธานี': THAI_REGIONS.NORTHEAST,
  'บุรีรัมย์': THAI_REGIONS.NORTHEAST,
  'สุรินทร์': THAI_REGIONS.NORTHEAST,
  'ศรีสะเกษ': THAI_REGIONS.NORTHEAST,
  'ชัยภูมิ': THAI_REGIONS.NORTHEAST,
  'กาฬสินธุ์': THAI_REGIONS.NORTHEAST,
  'มหาสารคาม': THAI_REGIONS.NORTHEAST,
  'ร้อยเอ็ด': THAI_REGIONS.NORTHEAST,
  'สกลนคร': THAI_REGIONS.NORTHEAST,
  'นครพนม': THAI_REGIONS.NORTHEAST,
  'มุกดาหาร': THAI_REGIONS.NORTHEAST,
  'ยโสธร': THAI_REGIONS.NORTHEAST,
  'หนองคาย': THAI_REGIONS.NORTHEAST,
  'หนองบัวลำภู': THAI_REGIONS.NORTHEAST,
  'เลย': THAI_REGIONS.NORTHEAST,
  'บึงกาฬ': THAI_REGIONS.NORTHEAST,
  'อำนาจเจริญ': THAI_REGIONS.NORTHEAST,

  // ภาคตะวันออก (East)
  'ชลบุรี': THAI_REGIONS.EAST,
  'ระยอง': THAI_REGIONS.EAST,
  'จันทบุรี': THAI_REGIONS.EAST,
  'ตราด': THAI_REGIONS.EAST,
  'ฉะเชิงเทรา': THAI_REGIONS.EAST,
  'ปราจีนบุรี': THAI_REGIONS.EAST,
  'นครนายก': THAI_REGIONS.EAST,
  'สระแก้ว': THAI_REGIONS.EAST,

  // ภาคตะวันตก (West)
  'กาญจนบุรี': THAI_REGIONS.WEST,
  'ราชบุรี': THAI_REGIONS.WEST,
  'เพชรบุรี': THAI_REGIONS.WEST,
  'ประจวบคีรีขันธ์': THAI_REGIONS.WEST,
  'ตาก': THAI_REGIONS.WEST,

  // ภาคใต้ (South)
  'ชุมพร': THAI_REGIONS.SOUTH,
  'ระนอง': THAI_REGIONS.SOUTH,
  'สุราษฎร์ธานี': THAI_REGIONS.SOUTH,
  'พังงา': THAI_REGIONS.SOUTH,
  'ภูเก็ต': THAI_REGIONS.SOUTH,
  'กระบี่': THAI_REGIONS.SOUTH,
  'นครศรีธรรมราช': THAI_REGIONS.SOUTH,
  'ตรัง': THAI_REGIONS.SOUTH,
  'พัทลุง': THAI_REGIONS.SOUTH,
  'สงขลา': THAI_REGIONS.SOUTH,
  'สตูล': THAI_REGIONS.SOUTH,
  'ปัตตานี': THAI_REGIONS.SOUTH,
  'ยะลา': THAI_REGIONS.SOUTH,
  'นราธิวาส': THAI_REGIONS.SOUTH
};

/**
 * Approximate geographical boundary for Thai regions
 */
export function getRegionFromCoordinates(lat, lng) {
  if (lat < 11.5) return THAI_REGIONS.SOUTH;
  if (lat >= 16.5 && lng < 101.2) return THAI_REGIONS.NORTH;
  if (lat >= 14.2 && lng >= 101.4) return THAI_REGIONS.NORTHEAST;
  if (lng < 99.8 && lat >= 11.5 && lat < 17.5) return THAI_REGIONS.WEST;
  if (lng >= 101.0 && lat >= 11.5 && lat < 14.5) return THAI_REGIONS.EAST;
  return THAI_REGIONS.CENTRAL;
}

/**
 * Resolves province and region from feature properties and coordinates
 */
export function resolveLocationMeta(props, coords) {
  const [lng, lat] = coords || [100.5, 13.75];
  let province = (props?.province || props?.district || props?.address || '').trim();

  // Try matching known province names
  let matchedProvince = '';
  for (const prov of Object.keys(PROVINCE_TO_REGION)) {
    if (province && province.includes(prov)) {
      matchedProvince = prov;
      break;
    }
  }

  // Normalize aliases
  if (matchedProvince === 'กรุงเทพ' || matchedProvince === 'กรุงเทพฯ' || matchedProvince === 'กทม' || matchedProvince === 'กทม.') {
    matchedProvince = 'กรุงเทพมหานคร';
  } else if (matchedProvince === 'อยุธยา') {
    matchedProvince = 'พระนครศรีอยุธยา';
  } else if (matchedProvince === 'โคราช') {
    matchedProvince = 'นครราชสีมา';
  }

  if (!matchedProvince) {
    if (province && province !== 'ไม่ระบุ' && province !== 'พื้นที่เกิดเหตุ') {
      matchedProvince = province;
    } else {
      // Coordinate fallback
      matchedProvince = 'กรุงเทพมหานคร';
    }
  }

  const region = PROVINCE_TO_REGION[matchedProvince] || getRegionFromCoordinates(lat, lng);

  return {
    province: matchedProvince,
    region
  };
}

/**
 * Calculates majority color for DOH Highway clusters:
 * - impassableCount > passableCount => #dc2626 (Red)
 * - passableCount > impassableCount => #ea580c (Orange)
 * - impassableCount === passableCount => #dc2626 (Red - หากเท่ากันให้แสดงหมุดไอคอนสีแดง)
 */
export function computeDohClusterColor(items) {
  let passableCount = 0;
  let impassableCount = 0;

  items.forEach((item) => {
    const isPassable = !!item.properties?.passable;
    if (isPassable) {
      passableCount++;
    } else {
      impassableCount++;
    }
  });

  const isImpassableDominant = impassableCount >= passableCount; // Tie-breaker = RED
  return {
    passableCount,
    impassableCount,
    totalCount: items.length,
    dominantColor: isImpassableDominant ? '#dc2626' : '#ea580c',
    dominantClass: isImpassableDominant ? 'impassable' : 'passable'
  };
}

/**
 * Groups points according to current MapLibre zoom level:
 * - zoom < 7.0: ระดับภาค (Regional clusters)
 * - 7.0 <= zoom < 9.5: รวมระดับจังหวัด (Provincial clusters)
 * - zoom >= 9.5: หมุดแต่ละจุด (Individual pins) with overlapping detection for spiderfy
 */
export function clusterPointsByZoom(items, zoom, type = 'doh') {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Normalize items with coordinates, province and region
  const normalized = items.map((item) => {
    let coords = null;
    if (item.geometry?.type === 'LineString') {
      const lineCoords = item.geometry.coordinates;
      const mid = Math.floor(lineCoords.length / 2);
      coords = lineCoords[mid];
    } else if (item.geometry?.type === 'Point') {
      coords = item.geometry.coordinates;
    } else if (Array.isArray(item.coords)) {
      coords = [parseFloat(item.coords[0]), parseFloat(item.coords[1])];
    }
    if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return null;

    const locMeta = resolveLocationMeta(item.properties, coords);
    return {
      raw: item,
      properties: item.properties,
      coords,
      province: locMeta.province,
      region: locMeta.region
    };
  }).filter(Boolean);

  if (normalized.length === 0) return [];

  // Specific 3-tier Zoom-based Clustering for Traffy Fondue:
  // - zoom < 10.0 (มากกว่า 1 จังหวัด & ภาพรวมระดับจังหวัด): 1 หมุดแสดงตัวเลขรวมทั้งหมด (Overall Bangkok aggregate)
  // - 10.0 <= zoom < 12.5 (เจาะจงระดับจังหวัด/เขต กทม.): รวมหมุดย่อยแบ่งตามเขต กทม. (District clusters)
  // - zoom >= 12.5 (ระดับเขต/ถนน): แสดงหมุดแต่ละจุดชัดเจน (Individual pins with spiderfy)
  if (type === 'traffy') {
    // 1. Tier 1: Zoom < 10.0 (ภาพรวมทั้งจังหวัด / มากกว่า 1 จังหวัด -> 1 หมุดรวม)
    if (zoom < 10.0) {
      let sumLng = 0;
      let sumLat = 0;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

      normalized.forEach((it) => {
        const [lng, lat] = it.coords;
        sumLng += lng;
        sumLat += lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      const center = [sumLng / normalized.length, sumLat / normalized.length];
      const bounds = [[minLng, minLat], [maxLng, maxLat]];

      return [{
        isCluster: true,
        level: 'overall',
        name: 'กรุงเทพมหานคร',
        title: `กรุงเทพมหานคร (${normalized.length} เรื่อง)`,
        count: normalized.length,
        center,
        bounds,
        items: normalized
      }];
    }

    // 2. Tier 2: 10.0 <= Zoom < 12.5 (เจาะจงระดับจังหวัด/เขต กทม. -> แบ่งตามเขต)
    if (zoom < 12.5) {
      const districtGroups = {};
      normalized.forEach((item) => {
        let dist = (item.properties?.district || '').trim();
        if (!dist && item.properties?.address) {
          const m = item.properties.address.match(/เขต([^\s]+)/);
          if (m) dist = m[1].trim();
        }
        if (!dist) dist = 'ไม่ระบุเขต';
        const cleanDist = dist.replace(/^เขต/, '').trim();
        const distKey = cleanDist ? `เขต${cleanDist}` : 'ไม่ระบุเขต';

        if (!districtGroups[distKey]) districtGroups[distKey] = [];
        districtGroups[distKey].push(item);
      });

      return Object.entries(districtGroups).map(([districtName, groupItems]) => {
        let sumLng = 0;
        let sumLat = 0;
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

        groupItems.forEach((it) => {
          const [lng, lat] = it.coords;
          sumLng += lng;
          sumLat += lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });

        const center = [sumLng / groupItems.length, sumLat / groupItems.length];
        const bounds = [[minLng, minLat], [maxLng, maxLat]];

        return {
          isCluster: true,
          level: 'district',
          name: districtName,
          title: `${districtName} (${groupItems.length} เรื่อง)`,
          count: groupItems.length,
          center,
          bounds,
          items: groupItems
        };
      });
    }

    // 3. Tier 3: Zoom >= 11.5 (ระดับเขต/ถนน -> หมุดเดี่ยวชัดเจน พร้อมรองรับ spiderfy)
    const overlapMap = new Map();
    normalized.forEach((item) => {
      const key = `${item.coords[0].toFixed(4)}_${item.coords[1].toFixed(4)}`;
      if (!overlapMap.has(key)) overlapMap.set(key, []);
      overlapMap.get(key).push(item);
    });

    return normalized.map((item) => {
      const key = `${item.coords[0].toFixed(4)}_${item.coords[1].toFixed(4)}`;
      const group = overlapMap.get(key) || [item];
      const hasOverlap = group.length > 1;

      return {
        isCluster: false,
        level: 'individual',
        item: item.raw,
        properties: item.properties,
        coords: item.coords,
        province: item.province,
        region: item.region,
        hasOverlap,
        overlapKey: key,
        overlappingGroup: group
      };
    });
  }

  // 1. Zoom < 7.0: ระดับภาค (Regional clusters)
  if (zoom < 7.0) {
    const regionGroups = {};
    normalized.forEach((item) => {
      const reg = item.region || THAI_REGIONS.CENTRAL;
      if (!regionGroups[reg]) regionGroups[reg] = [];
      regionGroups[reg].push(item);
    });

    return Object.entries(regionGroups).map(([regionName, groupItems]) => {
      let sumLng = 0;
      let sumLat = 0;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

      groupItems.forEach((it) => {
        const [lng, lat] = it.coords;
        sumLng += lng;
        sumLat += lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      const center = [sumLng / groupItems.length, sumLat / groupItems.length];
      const bounds = [[minLng, minLat], [maxLng, maxLat]];
      const dohColor = type === 'doh' ? computeDohClusterColor(groupItems) : null;

      return {
        isCluster: true,
        level: 'region',
        name: regionName,
        title: `${regionName} (${groupItems.length} จุด)`,
        count: groupItems.length,
        center,
        bounds,
        items: groupItems,
        dohColor
      };
    });
  }

  // 2. 7.0 <= zoom < 9.5: รวมระดับจังหวัด (Provincial clusters)
  if (zoom < 9.5) {
    const provinceGroups = {};
    normalized.forEach((item) => {
      const prov = item.province || 'กรุงเทพมหานคร';
      if (!provinceGroups[prov]) provinceGroups[prov] = [];
      provinceGroups[prov].push(item);
    });

    return Object.entries(provinceGroups).map(([provinceName, groupItems]) => {
      let sumLng = 0;
      let sumLat = 0;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

      groupItems.forEach((it) => {
        const [lng, lat] = it.coords;
        sumLng += lng;
        sumLat += lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      const center = [sumLng / groupItems.length, sumLat / groupItems.length];
      const bounds = [[minLng, minLat], [maxLng, maxLat]];
      const dohColor = type === 'doh' ? computeDohClusterColor(groupItems) : null;

      return {
        isCluster: true,
        level: 'province',
        name: provinceName,
        regionName: groupItems[0]?.region || '',
        title: `จ.${provinceName} (${groupItems.length} จุด)`,
        count: groupItems.length,
        center,
        bounds,
        items: groupItems,
        dohColor
      };
    });
  }

  // 3. zoom >= 9.5: หมุดแต่ละจุด (Individual pins) with overlapping detection
  // Detect pins with overlapping / nearly identical coordinates (< 0.0003 deg)
  const overlapMap = new Map();
  normalized.forEach((item) => {
    const key = `${item.coords[0].toFixed(4)}_${item.coords[1].toFixed(4)}`;
    if (!overlapMap.has(key)) overlapMap.set(key, []);
    overlapMap.get(key).push(item);
  });

  return normalized.map((item) => {
    const key = `${item.coords[0].toFixed(4)}_${item.coords[1].toFixed(4)}`;
    const group = overlapMap.get(key) || [item];
    const hasOverlap = group.length > 1;

    return {
      isCluster: false,
      level: 'individual',
      item: item.raw,
      properties: item.properties,
      coords: item.coords,
      province: item.province,
      region: item.region,
      hasOverlap,
      overlapKey: key,
      overlappingGroup: group
    };
  });
}

/**
 * Computes radial offsets and angles for spiderfying overlapping markers
 * @param {number} count - number of overlapping markers
 * @param {number} baseRadius - radius in pixels (default 52px)
 * @returns {Array<{ x: number, y: number, angleRad: number, angleDeg: number, radius: number }>}
 */
export function calculateSpiderfyOffsets(count, baseRadius = 52) {
  if (count <= 1) return [{ x: 0, y: 0, angleRad: 0, angleDeg: 0, radius: 0 }];

  const radius = count <= 3 ? baseRadius : count <= 6 ? baseRadius + 14 : baseRadius + 26;
  const offsets = [];

  for (let i = 0; i < count; i++) {
    // Distribute evenly around the circle, starting from top (-PI/2)
    const angleRad = (2 * Math.PI * i) / count - Math.PI / 2;
    const angleDeg = (angleRad * 180) / Math.PI;
    const x = Math.round(Math.cos(angleRad) * radius);
    const y = Math.round(Math.sin(angleRad) * radius);

    offsets.push({
      x,
      y,
      angleRad,
      angleDeg,
      radius
    });
  }

  return offsets;
}
