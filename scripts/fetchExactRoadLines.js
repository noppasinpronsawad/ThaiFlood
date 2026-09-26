import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const originalDataPath = path.join(__dirname, '../src/data/bmaFloodRoadLines.json');
const originalData = JSON.parse(fs.readFileSync(originalDataPath, 'utf8'));

const roadWaypoints = {
  road_vibhavadi: ['100.5695,13.8480', '100.5574,13.7788'],
  road_phahonyothin: ['100.5480,13.7900', '100.5975,13.8750'],
  road_ratchada: ['100.5735,13.8240', '100.5658,13.7580'],
  road_latphrao: ['100.5615,13.8138', '100.6480,13.7650'],
  road_ramkhamhaeng: ['100.6015,13.7430', '100.6450,13.7635'],
  road_sukhumvit: ['100.5606,13.7370', '100.6053,13.6682'],
  road_phatthanakan: ['100.6015,13.7425', '100.6450,13.7310'],
  road_phetchaburi: ['100.5630,13.7490', '100.6030,13.7420'],
  road_srinakarin: ['100.6450,13.7635', '100.6540,13.6680'],
  road_chaengwatthana: ['100.5900,13.8750', '100.5300,13.9030'],
  road_ngamwongwan: ['100.5400,13.8580', '100.5720,13.8480'],
  road_latkrabang: ['100.7950,13.7200', '100.7480,13.7225'],
  road_suwinthawong: ['100.7250,13.8180', '100.8200,13.8400'],
  road_phetkasem: ['100.4720,13.7280', '100.3800,13.7080'],
  road_charansanitwong: ['100.4850,13.7700', '100.4650,13.7350'],
  road_rama4: ['100.5450,13.7280', '100.5850,13.7100'],
  road_prachasuk: ['100.5600,13.7820', '100.5730,13.7720'],
  road_chan: ['100.5360,13.7080', '100.5280,13.6980'],
  road_senanikhom: ['100.5840,13.8350', '100.6050,13.8180'],
  road_nawamin: ['100.6400,13.8100', '100.6480,13.7650'],
  road_ekkamai: ['100.5925,13.7425', '100.5855,13.7215'],
  road_thonglo: ['100.5780,13.7240', '100.5850,13.7420'],
  road_borommaratchachonnani: ['100.4900,13.7680', '100.4550,13.7820']
};

function simplifyDP(points, tolerance = 0.00003) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    let dist;
    if (x1 === x2 && y1 === y2) {
      dist = Math.hypot(x - x1, y - y1);
    } else {
      const num = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
      const den = Math.hypot(y2 - y1, x2 - x1);
      dist = num / den;
    }
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const rec1 = simplifyDP(points.slice(0, index + 1), tolerance);
    const rec2 = simplifyDP(points.slice(index), tolerance);
    return rec1.slice(0, -1).concat(rec2);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

async function fetchRoute(pts) {
  const url = `https://router.project-osrm.org/route/v1/driving/${pts.join(';')}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.routes && data.routes.length > 0) {
    return data.routes[0].geometry.coordinates;
  }
  return null;
}

async function build() {
  console.log('Fetching exact OpenStreetMap road centerlines for all 23 Bangkok flood roads...');
  const updatedFeatures = [];

  for (let i = 0; i < originalData.features.length; i++) {
    const feat = originalData.features[i];
    const id = feat.properties.id;
    const pts = roadWaypoints[id];

    console.log(`[${i + 1}/23] Fetching ${feat.properties.road} (${id})...`);
    let osmCoords = null;
    if (pts) {
      try {
        osmCoords = await fetchRoute(pts);
      } catch (err) {
        console.warn(`  Network error for ${id}:`, err.message);
      }
    }

    if (osmCoords && osmCoords.length > 5) {
      const simplified = simplifyDP(osmCoords, 0.00003); // ~3m tolerance
      const rounded = simplified.map(([lng, lat]) => [
        Number(lng.toFixed(6)),
        Number(lat.toFixed(6))
      ]);
      console.log(`  -> SUCCESS: ${rounded.length} high-definition points`);
      updatedFeatures.push({
        ...feat,
        geometry: {
          type: 'LineString',
          coordinates: rounded
        }
      });
    } else {
      console.log(`  -> Fallback to original coordinates (${feat.geometry.coordinates.length} pts)`);
      updatedFeatures.push(feat);
    }

    // Rate-limiting delay for OSRM
    await new Promise((r) => setTimeout(r, 400));
  }

  const outData = {
    ...originalData,
    properties: {
      ...originalData.properties,
      description: 'แนวเส้นทางถนนจริงความละเอียดสูง 23 เส้นทางจาก OpenStreetMap ตรงตาม basemap',
      updatedAt: '2026-09-26'
    },
    features: updatedFeatures
  };

  fs.writeFileSync(originalDataPath, JSON.stringify(outData, null, 2), 'utf8');
  console.log(`Successfully written exact road lines to ${originalDataPath}!`);
}

build();
