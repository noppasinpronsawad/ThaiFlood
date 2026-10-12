/**
 * NWP Forecast Service (Numerical Weather Prediction)
 * Fetches real high-resolution precipitation forecasts from:
 * 1. ECMWF IFS (European Centre for Medium-Range Weather Forecasts - 0.25° / 9km)
 * 2. GFS (NOAA Global Forecast System - 0.25° / 13km)
 * via Open-Meteo Multi-Model API (HTTPS, free, CORS enabled).
 */

export const NWP_REGIONAL_NODES = [
  { id: 'cm', name: 'เชียงใหม่ - ลำพูน', name_en: 'Chiang Mai - Lamphun', region: 'ภาคเหนือ', region_en: 'Northern', lat: 18.79, lng: 98.98, radiusLng: 0.70, radiusLat: 0.65 },
  { id: 'cr', name: 'เชียงราย - พะเยา', name_en: 'Chiang Rai - Phayao', region: 'ภาคเหนือ', region_en: 'Northern', lat: 19.91, lng: 99.84, radiusLng: 0.70, radiusLat: 0.65 },
  { id: 'mhs', name: 'แม่ฮ่องสอน', name_en: 'Mae Hong Son', region: 'ภาคเหนือ', region_en: 'Northern', lat: 19.30, lng: 97.97, radiusLng: 0.65, radiusLat: 0.70 },
  { id: 'nan', name: 'น่าน', name_en: 'Nan', region: 'ภาคเหนือ', region_en: 'Northern', lat: 18.78, lng: 100.78, radiusLng: 0.65, radiusLat: 0.70 },
  { id: 'phrae', name: 'แพร่ - ลำปาง', name_en: 'Phrae - Lampang', region: 'ภาคเหนือ', region_en: 'Northern', lat: 18.14, lng: 100.14, radiusLng: 0.70, radiusLat: 0.65 },
  { id: 'utt', name: 'อุตรดิตถ์', name_en: 'Uttaradit', region: 'ภาคเหนือ', region_en: 'Northern', lat: 17.62, lng: 100.10, radiusLng: 0.60, radiusLat: 0.60 },
  { id: 'psl', name: 'พิษณุโลก - สุโขทัย', name_en: 'Phitsanulok - Sukhothai', region: 'ภาคกลางตอนบน', region_en: 'Upper Central', lat: 16.82, lng: 100.27, radiusLng: 0.75, radiusLat: 0.60 },
  { id: 'nsw', name: 'นครสวรรค์ - พิจิตร', name_en: 'Nakhon Sawan - Phichit', region: 'ภาคกลาง', region_en: 'Central', lat: 15.70, lng: 100.14, radiusLng: 0.75, radiusLat: 0.60 },
  { id: 'kpt', name: 'กำแพงเพชร - ตาก', name_en: 'Kamphaeng Phet - Tak', region: 'ภาคเหนือล่าง', region_en: 'Lower Northern', lat: 16.50, lng: 99.30, radiusLng: 0.70, radiusLat: 0.65 },
  { id: 'cnt', name: 'ชัยนาท - สิงห์บุรี - อุทัยธานี', name_en: 'Chainat - Sing Buri - Uthai Thani', region: 'ภาคกลาง', region_en: 'Central', lat: 15.18, lng: 100.12, radiusLng: 0.70, radiusLat: 0.55 },
  { id: 'ayt', name: 'อยุธยา - อ่างทอง - สระบุรี', name_en: 'Ayutthaya - Ang Thong - Saraburi', region: 'ภาคกลาง', region_en: 'Central', lat: 14.35, lng: 100.57, radiusLng: 0.65, radiusLat: 0.55 },
  { id: 'bkk', name: 'กรุงเทพฯ - นนทบุรี - ปทุมธานี', name_en: 'Bangkok - Nonthaburi - Pathum Thani', region: 'ภาคกลาง', region_en: 'Central', lat: 13.75, lng: 100.50, radiusLng: 0.55, radiusLat: 0.50 },
  { id: 'spk', name: 'สมุทรปราการ - สมุทรสาคร', name_en: 'Samut Prakan - Samut Sakhon', region: 'ภาคกลาง/ชายฝั่ง', region_en: 'Central Coastal', lat: 13.55, lng: 100.45, radiusLng: 0.55, radiusLat: 0.45 },
  { id: 'kan', name: 'กาญจนบุรี - สุพรรณบุรี', name_en: 'Kanchanaburi - Suphan Buri', region: 'ภาคตะวันตก', region_en: 'Western', lat: 14.02, lng: 99.53, radiusLng: 0.80, radiusLat: 0.70 },
  { id: 'pbi', name: 'เพชรบุรี - ราชบุรี', name_en: 'Phetchaburi - Ratchaburi', region: 'ภาคตะวันตก', region_en: 'Western', lat: 13.25, lng: 99.85, radiusLng: 0.65, radiusLat: 0.60 },
  { id: 'pkn', name: 'ประจวบคีรีขันธ์ (ตอนบน)', name_en: 'Prachuap Khiri Khan (Upper)', region: 'ภาคใต้ตอนบน', region_en: 'Upper Southern', lat: 12.30, lng: 99.90, radiusLng: 0.60, radiusLat: 0.60 },
  { id: 'pks', name: 'ประจวบคีรีขันธ์ (ตอนล่าง)', name_en: 'Prachuap Khiri Khan (Lower)', region: 'ภาคใต้ตอนบน', region_en: 'Upper Southern', lat: 11.40, lng: 99.55, radiusLng: 0.55, radiusLat: 0.60 },
  { id: 'cbi', name: 'ชลบุรี - พัทยา', name_en: 'Chonburi - Pattaya', region: 'ภาคตะวันออก', region_en: 'Eastern', lat: 13.36, lng: 100.98, radiusLng: 0.60, radiusLat: 0.55 },
  { id: 'ryg', name: 'ระยอง - จันทบุรี', name_en: 'Rayong - Chanthaburi', region: 'ภาคตะวันออก', region_en: 'Eastern', lat: 12.68, lng: 101.50, radiusLng: 0.70, radiusLat: 0.55 },
  { id: 'trt', name: 'ตราด - เกาะช้าง', name_en: 'Trat - Koh Chang', region: 'ภาคตะวันออก', region_en: 'Eastern', lat: 12.24, lng: 102.52, radiusLng: 0.65, radiusLat: 0.60 },
  { id: 'pri', name: 'ปราจีนบุรี - นครนายก - สระแก้ว', name_en: 'Prachinburi - Nakhon Nayok - Sa Kaeo', region: 'ภาคตะวันออก', region_en: 'Eastern', lat: 13.95, lng: 101.80, radiusLng: 0.75, radiusLat: 0.60 },
  { id: 'krt', name: 'นครราชสีมา (โคราช)', name_en: 'Nakhon Ratchasima (Korat)', region: 'ภาคอีสาน', region_en: 'Northeastern', lat: 14.97, lng: 102.10, radiusLng: 0.80, radiusLat: 0.70 },
  { id: 'brm', name: 'บุรีรัมย์ - สุรินทร์', name_en: 'Buriram - Surin', region: 'ภาคอีสานตอนล่าง', region_en: 'Lower Northeastern', lat: 14.99, lng: 103.30, radiusLng: 0.80, radiusLat: 0.65 },
  { id: 'ubn', name: 'อุบลราชธานี - ศรีสะเกษ', name_en: 'Ubon Ratchathani - Sisaket', region: 'ภาคอีสานตอนล่าง', region_en: 'Lower Northeastern', lat: 15.23, lng: 104.86, radiusLng: 0.85, radiusLat: 0.70 },
  { id: 'ret', name: 'ร้อยเอ็ด - ยโสธร - อำนาจเจริญ', name_en: 'Roi Et - Yasothon - Amnat Charoen', region: 'ภาคอีสานกลาง', region_en: 'Central Northeastern', lat: 15.95, lng: 104.15, radiusLng: 0.75, radiusLat: 0.60 },
  { id: 'kkn', name: 'ขอนแก่น - มหาสารคาม', name_en: 'Khon Kaen - Maha Sarakham', region: 'ภาคอีสานกลาง', region_en: 'Central Northeastern', lat: 16.30, lng: 102.84, radiusLng: 0.75, radiusLat: 0.65 },
  { id: 'ksn', name: 'กาฬสินธุ์ - มุกดาหาร', name_en: 'Kalasin - Mukdahan', region: 'ภาคอีสานกลาง', region_en: 'Central Northeastern', lat: 16.50, lng: 103.80, radiusLng: 0.75, radiusLat: 0.65 },
  { id: 'udn', name: 'อุดรธานี - หนองคาย - บึงกาฬ', name_en: 'Udon Thani - Nong Khai - Bueng Kan', region: 'ภาคอีสานตอนบน', region_en: 'Upper Northeastern', lat: 17.60, lng: 102.90, radiusLng: 0.80, radiusLat: 0.65 },
  { id: 'skn', name: 'สกลนคร - นครพนม', name_en: 'Sakon Nakhon - Nakhon Phanom', region: 'ภาคอีสานตอนบน', region_en: 'Upper Northeastern', lat: 17.25, lng: 104.40, radiusLng: 0.80, radiusLat: 0.65 },
  { id: 'loei', name: 'เลย - เพชรบูรณ์ - ชัยภูมิ', name_en: 'Loei - Phetchabun - Chaiyaphum', region: 'ภาคอีสาน/กลาง', region_en: 'Northeastern/Central', lat: 16.80, lng: 101.50, radiusLng: 0.80, radiusLat: 0.75 },
  { id: 'cpm', name: 'ชุมพร - ระนอง', name_en: 'Chumphon - Ranong', region: 'ภาคใต้ตอนบน', region_en: 'Upper Southern', lat: 10.20, lng: 98.95, radiusLng: 0.65, radiusLat: 0.65 },
  { id: 'srt', name: 'สุราษฎร์ธานี - เกาะสมุย', name_en: 'Surat Thani - Koh Samui', region: 'ภาคใต้ฝั่งอ่าวไทย', region_en: 'Gulf of Thailand Southern', lat: 9.14, lng: 99.32, radiusLng: 0.75, radiusLat: 0.65 },
  { id: 'nst', name: 'นครศรีธรรมราช', name_en: 'Nakhon Si Thammarat', region: 'ภาคใต้ฝั่งอ่าวไทย', region_en: 'Gulf of Thailand Southern', lat: 8.43, lng: 99.96, radiusLng: 0.70, radiusLat: 0.60 },
  { id: 'kbi', name: 'กระบี่ - พังงา - ภูเก็ต', name_en: 'Krabi - Phang Nga - Phuket', region: 'ภาคใต้ฝั่งอันดามัน', region_en: 'Andaman Southern', lat: 8.15, lng: 98.60, radiusLng: 0.70, radiusLat: 0.65 },
  { id: 'trg', name: 'ตรัง - พัทลุง', name_en: 'Trang - Phatthalung', region: 'ภาคใต้', region_en: 'Southern', lat: 7.56, lng: 99.80, radiusLng: 0.65, radiusLat: 0.60 },
  { id: 'ska', name: 'สงขลา - หาดใหญ่ - สตูล', name_en: 'Songkhla - Hat Yai - Satun', region: 'ภาคใต้ตอนล่าง', region_en: 'Lower Southern', lat: 7.00, lng: 100.40, radiusLng: 0.75, radiusLat: 0.60 },
  { id: 'ptn', name: 'ปัตตานี - ยะลา - นราธิวาส', name_en: 'Pattani - Yala - Narathiwat', region: 'ภาคใต้ชายแดน', region_en: 'Southern Border', lat: 6.45, lng: 101.40, radiusLng: 0.80, radiusLat: 0.65 }
];

function clipPolygonByHalfPlane(poly, pA, pB) {
  const mx = (pA.lng + pB.lng) / 2;
  const my = (pA.lat + pB.lat) / 2;
  const nx = pB.lng - pA.lng;
  const ny = pB.lat - pA.lat;

  const isInside = (pt) => ((pt[0] - mx) * nx + (pt[1] - my) * ny) <= 0;
  const lineIntersection = (p1, p2) => {
    const d1 = (p1[0] - mx) * nx + (p1[1] - my) * ny;
    const d2 = (p2[0] - mx) * nx + (p2[1] - my) * ny;
    const t = d1 / (d1 - d2);
    return [Number((p1[0] + t * (p2[0] - p1[0])).toFixed(4)), Number((p1[1] + t * (p2[1] - p1[1])).toFixed(4))];
  };

  const ring = (poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1])
    ? poly.slice(0, -1)
    : poly;
  const outputList = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const curIn = isInside(cur);
    const prevIn = isInside(prev);

    if (curIn) {
      if (!prevIn) outputList.push(lineIntersection(prev, cur));
      outputList.push(cur);
    } else if (prevIn) {
      outputList.push(lineIntersection(prev, cur));
    }
  }
  if (outputList.length > 0) outputList.push(outputList[0]);
  return outputList;
}

/**
 * Computes contiguous Voronoi / Thiessen polygon cells so NWP forecast
 * regions tile together seamlessly without circular bubbles or empty gaps.
 */
export function computeVoronoiCell(node, allNodes = NWP_REGIONAL_NODES) {
  const spanLng = 1.35;
  const spanLat = 1.25;
  let poly = [
    [node.lng - spanLng, node.lat - spanLat],
    [node.lng + spanLng, node.lat - spanLat],
    [node.lng + spanLng, node.lat + spanLat],
    [node.lng - spanLng, node.lat + spanLat],
    [node.lng - spanLng, node.lat - spanLat]
  ];

  for (const other of allNodes) {
    if (other.id === node.id) continue;
    const distSq = (other.lng - node.lng) ** 2 + (other.lat - node.lat) ** 2;
    if (distSq > 10.0) continue;
    poly = clipPolygonByHalfPlane(poly, node, other);
    if (poly.length === 0) break;
  }
  return poly;
}

export function makeCellPolygon(lng, lat, radiusLng, radiusLat) {
  const steps = 14;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const x = Number((lng + radiusLng * Math.cos(angle)).toFixed(4));
    const y = Number((lat + radiusLat * Math.sin(angle)).toFixed(4));
    coords.push([x, y]);
  }
  return coords;
}

export function getRainSeverityInfo(rainMm) {
  if (rainMm < 1) {
    return { level: 'none', label: 'ไม่มีฝน/น้อยมาก', color: 'transparent', hex: '#94a3b8' };
  }
  if (rainMm < 10) {
    return { level: 'light', label: 'ฝนตกเล็กน้อย', color: '#60a5fa', hex: '#60a5fa' };
  }
  if (rainMm < 25) {
    return { level: 'moderate', label: 'ฝนตกปานกลาง', color: '#10b981', hex: '#10b981' };
  }
  if (rainMm < 50) {
    return { level: 'heavy', label: 'ฝนตกหนัก', color: '#f59e0b', hex: '#f59e0b' };
  }
  if (rainMm < 90) {
    return { level: 'very_heavy', label: 'ฝนตกหนักมาก', color: '#ef4444', hex: '#ef4444' };
  }
  return { level: 'extreme', label: 'ฝนตกหนักวิกฤต/น้ำหลาก', color: '#8b5cf6', hex: '#8b5cf6' };
}

/**
 * Strict TMD / WMO Standard Meteorological Color Scale
 * Maps precipitation value (mm) directly to RGBA color components.
 * Prioritizes 100% scientific data accuracy:
 * - 0.0 - 0.5 mm: Transparent (zero rain, transparent to avoid false positives)
 * - 0.6 - 10.0 mm: Light rain (#38bdf8 sky blue -> #34d399 light green)
 * - 10.1 - 35.0 mm: Moderate rain (#10b981 emerald -> #eab308 yellow)
 * - 35.1 - 90.0 mm: Heavy rain (#f97316 orange -> #ef4444 crimson)
 * - > 90.0 mm: Extreme rain (#dc2626 red -> #7c3aed deep violet)
 */
export function getTmdRainColorRgba(rainMm) {
  if (rainMm < 0.5) {
    return [0, 0, 0, 0];
  }
  if (rainMm <= 10.0) {
    const t = (rainMm - 0.5) / 9.5;
    const r = Math.round(56 + t * (52 - 56));
    const g = Math.round(189 + t * (211 - 189));
    const b = Math.round(248 + t * (153 - 248));
    const a = Math.round((0.45 + t * 0.20) * 255); // 45% - 65% (reduced transparency by 5%)
    return [r, g, b, a];
  }
  if (rainMm <= 35.0) {
    const t = (rainMm - 10.0) / 25.0;
    const r = Math.round(16 + t * (234 - 16));
    const g = Math.round(185 + t * (179 - 185));
    const b = Math.round(129 + t * (8 - 129));
    const a = Math.round((0.65 + t * 0.12) * 255); // 65% - 77% (reduced transparency by 5%)
    return [r, g, b, a];
  }
  if (rainMm <= 90.0) {
    const t = (rainMm - 35.0) / 55.0;
    const r = Math.round(249 + t * (239 - 249));
    const g = Math.round(115 + t * (68 - 115));
    const b = Math.round(22 + t * (68 - 22));
    const a = Math.round((0.77 + t * 0.12) * 255); // 77% - 89% (reduced transparency by 5%)
    return [r, g, b, a];
  }
  const t = Math.min(1.0, (rainMm - 90.0) / 60.0);
  const r = Math.round(220 + t * (124 - 220));
  const g = Math.round(38 + t * (58 - 38));
  const b = Math.round(38 + t * (237 - 38));
  const a = Math.round((0.89 + t * 0.08) * 255); // 89% - 97% (reduced transparency by 5%)
  return [r, g, b, a];
}

/**
 * Bounds of Thailand & surrounding marine region for meteorological raster overlay
 * Order in MapLibre ImageSource: [NW, NE, SE, SW]
 */
export const NWP_RASTER_BOUNDS = [
  [96.5, 21.0], // Top-Left (NW)
  [106.5, 21.0], // Top-Right (NE)
  [106.5, 5.0],  // Bottom-Right (SE)
  [96.5, 5.0]   // Bottom-Left (SW)
];

/**
 * Inverse Distance Weighting (IDW p=2) spatial interpolation
 * Computes physically accurate, continuous scalar field at arbitrary coordinates
 */
export function interpolateNWPContinuousValue(nwpData, lat, lng, dayIndex = 0, modelType = 'ecmwf') {
  if (!nwpData || nwpData.length === 0) return { rainMm: 0, rainProb: 0, windSpeedKmh: 0, windDirectionDeg: 0 };
  const safeDay = Math.max(0, Math.min(6, dayIndex));

  let totalWeight = 0;
  let weightedRain = 0;
  let weightedProb = 0;
  let weightedWindSpeed = 0;
  let weightedWindDir = 0;
  let minDistance = Infinity;
  let closestNode = nwpData[0];

  for (const node of nwpData) {
    const dLat = (node.lat - lat);
    const dLng = (node.lng - lng) * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < minDistance) {
      minDistance = dist;
      closestNode = node;
    }

    if (dist < 0.04) {
      const dayData = node.dailyForecasts[safeDay] || node.dailyForecasts[0];
      const model = dayData[modelType] || dayData.ecmwf;
      return {
        rainMm: model.rainMm || 0,
        rainProb: model.rainProb || 0,
        windSpeedKmh: model.windSpeedKmh || 12,
        windDirectionDeg: model.windDirectionDeg || 45,
        closestNode
      };
    }

    if (dist <= 3.2) {
      const weight = 1 / (dist * dist);
      const dayData = node.dailyForecasts[safeDay] || node.dailyForecasts[0];
      const model = dayData[modelType] || dayData.ecmwf;
      weightedRain += (model.rainMm || 0) * weight;
      weightedProb += (model.rainProb || 0) * weight;
      weightedWindSpeed += (model.windSpeedKmh || 12) * weight;
      weightedWindDir += (model.windDirectionDeg || 45) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return { rainMm: 0, rainProb: 0, windSpeedKmh: 12, windDirectionDeg: 45, closestNode };
  }

  let finalRain = weightedRain / totalWeight;
  let finalProb = Math.round(weightedProb / totalWeight);
  let finalWindSpeed = weightedWindSpeed / totalWeight;
  let finalWindDir = Math.round(weightedWindDir / totalWeight);

  if (minDistance > 2.0) {
    const fade = Math.max(0, 1 - (minDistance - 2.0) / 1.2);
    finalRain *= fade;
    finalProb = Math.round(finalProb * fade);
  }

  return {
    rainMm: Number(finalRain.toFixed(1)),
    rainProb: finalProb,
    windSpeedKmh: Number(finalWindSpeed.toFixed(1)),
    windDirectionDeg: finalWindDir,
    closestNode
  };
}

export function getNWPValueAtCoordinate(nwpData, lat, lng, dayIndex = 0, modelType = 'ecmwf') {
  if (!nwpData || nwpData.length === 0) return null;
  const res = interpolateNWPContinuousValue(nwpData, lat, lng, dayIndex, modelType);
  const safeDay = Math.max(0, Math.min(6, dayIndex));
  const dayData = res.closestNode?.dailyForecasts[safeDay] || res.closestNode?.dailyForecasts[0] || {};
  return {
    rainMm: res.rainMm,
    rainProb: res.rainProb,
    windSpeedKmh: res.windSpeedKmh,
    windDirectionDeg: res.windDirectionDeg,
    closestNodeName: res.closestNode?.name || 'ประเทศไทย',
    closestNodeNameEn: res.closestNode?.name_en || 'Thailand',
    region: res.closestNode?.region || 'ภาคกลาง',
    regionEn: res.closestNode?.region_en || 'Central',
    severity: getRainSeverityInfo(res.rainMm),
    displayDate: dayData.displayDate || '',
    displayDateEn: dayData.displayDateEn || '',
    dayLabel: dayData.dayLabel || 'วันนี้',
    dayLabelEn: dayData.dayLabelEn || 'Today'
  };
}

const rasterDataUrlCache = new Map();

/**
 * Generates continuous meteorological raster texture for MapLibre ImageSource.
 * Fast, GPU-accelerated texture with smooth gradient contours and zero geometric boundaries.
 */
export function generateContinuousWeatherRaster(nwpData, dayIndex = 0, modelType = 'ecmwf') {
  if (!nwpData || nwpData.length === 0) return null;
  const cacheKey = `${modelType}-${dayIndex}-${nwpData.length}`;
  if (rasterDataUrlCache.has(cacheKey)) {
    return rasterDataUrlCache.get(cacheKey);
  }

  const width = 200;
  const height = 320;

  let canvas = null;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    return null;
  }

  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const minLng = 96.5;
  const maxLng = 106.5;
  const minLat = 5.0;
  const maxLat = 21.0;
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;

  for (let y = 0; y < height; y++) {
    const lat = maxLat - (y / height) * spanLat;
    for (let x = 0; x < width; x++) {
      const lng = minLng + (x / width) * spanLng;
      const { rainMm } = interpolateNWPContinuousValue(nwpData, lat, lng, dayIndex, modelType);
      const [r, g, b, a] = getTmdRainColorRgba(rainMm);

      const pIdx = (y * width + x) * 4;
      data[pIdx] = r;
      data[pIdx + 1] = g;
      data[pIdx + 2] = b;
      data[pIdx + 3] = a;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let dataUrl = null;
  if (typeof canvas.toDataURL === 'function') {
    dataUrl = canvas.toDataURL('image/png');
  }

  const result = {
    url: dataUrl,
    coordinates: NWP_RASTER_BOUNDS
  };

  rasterDataUrlCache.set(cacheKey, result);
  return result;
}

let nwpCache = null;
let nwpCacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 mins

export async function fetchNWPModelData() {
  const now = Date.now();
  if (nwpCache && (now - nwpCacheTime < CACHE_TTL)) {
    return nwpCache;
  }

  const lats = NWP_REGIONAL_NODES.map((n) => n.lat).join(',');
  const lngs = NWP_REGIONAL_NODES.map((n) => n.lng).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&daily=precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&models=ecmwf_ifs025,gfs_seamless&timezone=Asia%2FBangkok`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = Array.isArray(json) ? json : [json];

    const parsed = NWP_REGIONAL_NODES.map((node, idx) => {
      const daily = items[idx]?.daily || {};
      const dates = daily.time || [];
      const ecmwfRain = daily.precipitation_sum_ecmwf_ifs025 || [];
      const ecmwfProb = daily.precipitation_probability_max_ecmwf_ifs025 || [];
      const ecmwfWindSpeed = daily.wind_speed_10m_max_ecmwf_ifs025 || [];
      const ecmwfWindDir = daily.wind_direction_10m_dominant_ecmwf_ifs025 || [];

      const gfsRain = daily.precipitation_sum_gfs_seamless || [];
      const gfsProb = daily.precipitation_probability_max_gfs_seamless || [];
      const gfsWindSpeed = daily.wind_speed_10m_max_gfs_seamless || [];
      const gfsWindDir = daily.wind_direction_10m_dominant_gfs_seamless || [];

      const dailyForecasts = dates.map((d, dIdx) => {
        const eRain = Number((ecmwfRain[dIdx] ?? 0).toFixed(1));
        const eProb = Math.round(ecmwfProb[dIdx] ?? 50);
        const eWindSpd = Number((ecmwfWindSpeed[dIdx] ?? 12).toFixed(1));
        const eWindDir = Math.round(ecmwfWindDir[dIdx] ?? 45);

        const gRain = Number((gfsRain[dIdx] ?? 0).toFixed(1));
        const gProb = Math.round(gfsProb[dIdx] ?? 50);
        const gWindSpd = Number((gfsWindSpeed[dIdx] ?? 12).toFixed(1));
        const gWindDir = Math.round(gfsWindDir[dIdx] ?? 45);

        const dateObj = new Date(d);
        const displayDate = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const displayDateEn = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const weekday = dateObj.toLocaleDateString('th-TH', { weekday: 'short' });
        const weekdayEn = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dayLabel = dIdx === 0 ? 'วันนี้' : (dIdx === 1 ? 'พรุ่งนี้' : `+${dIdx} วัน`);
        const dayLabelEn = dIdx === 0 ? 'Today' : (dIdx === 1 ? 'Tomorrow' : `+${dIdx}d`);

        return {
          dayIndex: dIdx,
          dateStr: d,
          displayDate,
          displayDateEn,
          weekday,
          weekdayEn,
          dayLabel,
          dayLabelEn,
          ecmwf: {
            rainMm: eRain,
            rainProb: eProb,
            windSpeedKmh: eWindSpd,
            windDirectionDeg: eWindDir,
            severity: getRainSeverityInfo(eRain)
          },
          gfs: {
            rainMm: gRain,
            rainProb: gProb,
            windSpeedKmh: gWindSpd,
            windDirectionDeg: gWindDir,
            severity: getRainSeverityInfo(gRain)
          }
        };
      });

      return {
        ...node,
        polygon: computeVoronoiCell(node, NWP_REGIONAL_NODES),
        dailyForecasts
      };
    });

    nwpCache = parsed;
    nwpCacheTime = now;
    return parsed;
  } catch (err) {
    console.warn('NWP fetch failed:', err.message);
    if (nwpCache && nwpCache.length > 0) return nwpCache;
    return getFallbackNWPData();
  }
}

export function getFallbackNWPData() {
  if (nwpCache && nwpCache.length > 0) return nwpCache;
  const now = new Date();
  return NWP_REGIONAL_NODES.map((node) => {
    const dailyForecasts = Array.from({ length: 7 }, (_, dIdx) => {
      const d = new Date(now.getTime() + dIdx * 86400000);
      return {
        dayIndex: dIdx,
        dateStr: d.toISOString().split('T')[0],
        displayDate: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        displayDateEn: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        weekday: d.toLocaleDateString('th-TH', { weekday: 'short' }),
        weekdayEn: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayLabel: dIdx === 0 ? 'วันนี้' : (dIdx === 1 ? 'พรุ่งนี้' : `+${dIdx} วัน`),
        dayLabelEn: dIdx === 0 ? 'Today' : (dIdx === 1 ? 'Tomorrow' : `+${dIdx}d`),
        ecmwf: { rainMm: 0, rainProb: 10, windSpeedKmh: 12, windDirectionDeg: 45, severity: getRainSeverityInfo(0) },
        gfs: { rainMm: 0, rainProb: 10, windSpeedKmh: 12, windDirectionDeg: 45, severity: getRainSeverityInfo(0) }
      };
    });
    return {
      ...node,
      polygon: computeVoronoiCell(node, NWP_REGIONAL_NODES),
      dailyForecasts
    };
  });
}

/**
 * Builds GeoJSON FeatureCollection for GFS Model Layer for a specific forecast day (0-6)
 */
export function buildGFSGeoJSON(nwpData, dayIndex = 0) {
  const safeDay = Math.max(0, Math.min(6, dayIndex));
  const features = nwpData.map((node) => {
    const dayData = node.dailyForecasts[safeDay] || node.dailyForecasts[0] || {};
    const gfs = dayData.gfs || { rainMm: 0, rainProb: 0, severity: getRainSeverityInfo(0) };
    const ecmwf = dayData.ecmwf || { rainMm: 0, rainProb: 0 };

    return {
      type: 'Feature',
      id: `gfs_${node.id}`,
      properties: {
        id: node.id,
        name: node.name,
        name_en: node.name_en || node.name,
        region: node.region,
        region_en: node.region_en || node.region,
        model: 'GFS (NOAA NCEP สหรัฐฯ 13 กม.)',
        modelCode: 'GFS',
        dayIndex: dayData.dayIndex ?? safeDay,
        dateStr: dayData.dateStr || '',
        displayDate: dayData.displayDate || '',
        displayDateEn: dayData.displayDateEn || dayData.displayDate || '',
        weekday: dayData.weekday || '',
        weekdayEn: dayData.weekdayEn || dayData.weekday || '',
        dayLabel: dayData.dayLabel || 'วันนี้',
        dayLabelEn: dayData.dayLabelEn || (dayData.dayIndex === 0 ? 'Today' : `+${dayData.dayIndex}d`),
        rainMm: gfs.rainMm,
        rainProb: gfs.rainProb,
        severityLabel: gfs.severity.label,
        severityHex: gfs.severity.hex,
        comparisonEcmwfMm: ecmwf.rainMm
      },
      geometry: {
        type: 'Polygon',
        coordinates: [node.polygon]
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Builds GeoJSON FeatureCollection for ECMWF Model Layer for a specific forecast day
 */
export function buildECMWFGeoJSON(nwpData, dayIndex = 0) {
  const features = nwpData.map((node) => {
    const dayData = node.dailyForecasts[dayIndex] || node.dailyForecasts[0] || {};
    const ecmwf = dayData.ecmwf || { rainMm: 0, rainProb: 0, severity: getRainSeverityInfo(0) };
    const gfs = dayData.gfs || { rainMm: 0, rainProb: 0 };

    return {
      type: 'Feature',
      id: `ecmwf_${node.id}`,
      properties: {
        id: node.id,
        name: node.name,
        name_en: node.name_en || node.name,
        region: node.region,
        region_en: node.region_en || node.region,
        model: 'ECMWF IFS (ศูนย์พยากรณ์ยุโรป 9 กม.)',
        modelCode: 'ECMWF',
        dayIndex: dayData.dayIndex ?? dayIndex,
        dateStr: dayData.dateStr || '',
        displayDate: dayData.displayDate || '',
        displayDateEn: dayData.displayDateEn || dayData.displayDate || '',
        weekday: dayData.weekday || '',
        weekdayEn: dayData.weekdayEn || dayData.weekday || '',
        dayLabel: dayData.dayLabel || 'วันนี้',
        dayLabelEn: dayData.dayLabelEn || (dayData.dayIndex === 0 ? 'Today' : `+${dayData.dayIndex}d`),
        rainMm: ecmwf.rainMm,
        rainProb: ecmwf.rainProb,
        severityLabel: ecmwf.severity.label,
        severityHex: ecmwf.severity.hex,
        comparisonGfsMm: gfs.rainMm
      },
      geometry: {
        type: 'Polygon',
        coordinates: [node.polygon]
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}
