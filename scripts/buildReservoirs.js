/**
 * Script to extract authentic reservoir polygons from NASA SRTM SWBD and OSM Waterway Polygons
 * Generates src/data/thailandReservoirs.json
 */
import fs from 'fs';
import readline from 'readline';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shapefile = require('/Users/noppasinp/.gemini/antigravity-ide/brain/a31b624f-d15b-43e9-aa64-f9153509ac2c/scratch/node_modules/shapefile');

async function build() {
  console.log('Fetching live dams list...');
  let liveDams = [];
  try {
    const res = await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam');
    const json = await res.json();
    liveDams = (json?.data?.dam_daily || []).map((d) => ({
      id: String(d.dam?.id),
      name: d.dam?.dam_name?.th || '',
      lat: Number(d.dam?.dam_lat),
      lng: Number(d.dam?.dam_long),
      province: d.geocode?.province_name?.th || ''
    }));
  } catch (err) {
    console.error('Fetch live dams failed:', err);
  }

  console.log(`Loaded ${liveDams.length} live dams from ThaiWater.`);

  // 1. Read NASA SRTM SWBD features
  console.log('Reading NASA SRTM SWBD shapefile...');
  const source = await shapefile.open('/Users/noppasinp/.gemini/antigravity-ide/brain/a31b624f-d15b-43e9-aa64-f9153509ac2c/scratch/TH_Reservoirs.shp');
  const swbdFeatures = [];
  let r;
  while (!(r = await source.read()).done) {
    swbdFeatures.push(r.value);
  }
  console.log(`Loaded ${swbdFeatures.length} NASA SWBD features.`);

  // Simplify/round coords helper
  function roundCoords(coords) {
    return coords.map(([lng, lat]) => [
      Math.round(lng * 100000) / 100000,
      Math.round(lat * 100000) / 100000
    ]);
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  const reservoirMap = {}; // damName -> feature

  // Match live dams with SWBD
  for (const dam of liveDams) {
    let bestDist = Infinity;
    let bestFeature = null;

    for (const f of swbdFeatures) {
      const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      for (const [lng, lat] of coords) {
        const d = dist(dam.lng, dam.lat, lng, lat);
        if (d < bestDist) {
          bestDist = d;
          bestFeature = f;
        }
      }
    }

    // SWBD match threshold within 0.12 deg (~13km)
    if (bestDist < 0.12 && bestFeature) {
      const coords = bestFeature.geometry.type === 'Polygon'
        ? bestFeature.geometry.coordinates[0]
        : bestFeature.geometry.coordinates[0][0];

      reservoirMap[dam.name] = {
        damName: dam.name,
        damId: dam.id,
        areaKm2: bestFeature.properties.AREA_SKM,
        source: 'NASA SRTM SWBD',
        coordinates: [roundCoords(coords)]
      };
      console.log(`Matched SWBD: ${dam.name} -> Area ${bestFeature.properties.AREA_SKM} km2 (${coords.length} pts)`);
    }
  }

  // 2. For remaining dams, search OSM Waterway Polygons
  const missingDams = liveDams.filter((d) => !reservoirMap[d.name]);
  console.log(`Remaining dams to search in OSM: ${missingDams.length}`);

  if (missingDams.length > 0) {
    const osmPath = '/Users/noppasinp/.gemini/antigravity-ide/brain/a31b624f-d15b-43e9-aa64-f9153509ac2c/scratch/waterways_polygons/hotosm_tha_waterways_polygons_geojson.geojson';
    if (fs.existsSync(osmPath)) {
      const fileStream = fs.createReadStream(osmPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.includes('"geometry"')) continue;
        try {
          const cleanLine = line.trim().replace(/,$/, '');
          const feat = JSON.parse(cleanLine);
          if (!feat.geometry) continue;

          let rawCoords = null;
          if (feat.geometry.type === 'Polygon') {
            rawCoords = feat.geometry.coordinates[0];
          } else if (feat.geometry.type === 'MultiPolygon') {
            rawCoords = feat.geometry.coordinates[0][0];
          }
          if (!rawCoords || rawCoords.length < 6) continue;

          for (const dam of missingDams) {
            if (reservoirMap[dam.name] && reservoirMap[dam.name].coordinates[0].length >= rawCoords.length) {
              continue;
            }

            for (const [lng, lat] of rawCoords) {
              const d = dist(dam.lng, dam.lat, lng, lat);
              if (d < 0.08) { // within ~8.8 km
                let sampledCoords = rawCoords;
                if (rawCoords.length > 1000) {
                  const step = Math.ceil(rawCoords.length / 1000);
                  sampledCoords = rawCoords.filter((_, idx) => idx % step === 0 || idx === rawCoords.length - 1);
                }

                reservoirMap[dam.name] = {
                  damName: dam.name,
                  damId: dam.id,
                  areaKm2: null,
                  source: 'OpenStreetMap Hydro',
                  coordinates: [roundCoords(sampledCoords)]
                };
                console.log(`Matched OSM: ${dam.name} (${sampledCoords.length} pts, dist ${(d * 111).toFixed(1)} km)`);
                break;
              }
            }
          }
        } catch (e) {}
      }
    }
  }

  // Also ensure Pasak Jolasid explicitly
  const pasakFeature = swbdFeatures.find((f) => f.properties.GRAND_ID === 5157);
  if (pasakFeature) {
    const coords = pasakFeature.geometry.coordinates[0];
    reservoirMap['ป่าสักชลสิทธิ์'] = {
      damName: 'ป่าสักชลสิทธิ์',
      damId: '3',
      areaKm2: 115.4,
      source: 'NASA SRTM SWBD (Pasak Jolasid Genuine 115km2)',
      coordinates: [roundCoords(coords)]
    };
  }

  // Build GeoJSON output
  const featureCollection = {
    type: 'FeatureCollection',
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'NASA SRTM Water Body Dataset (SWBD) & OpenStreetMap Hydrography',
      count: Object.keys(reservoirMap).length
    },
    features: Object.values(reservoirMap).map((res) => ({
      type: 'Feature',
      id: `res-${res.damId || res.damName}`,
      properties: {
        damName: res.damName,
        damId: res.damId,
        areaKm2: res.areaKm2,
        source: res.source
      },
      geometry: {
        type: 'Polygon',
        coordinates: res.coordinates
      }
    }))
  };

  const outputPath = '/Users/noppasinp/Developer/ThaiFlood/src/data/thailandReservoirs.json';
  fs.writeFileSync(outputPath, JSON.stringify(featureCollection, null, 2), 'utf-8');
  console.log(`✅ Successfully generated ${outputPath} with ${featureCollection.features.length} genuine reservoir polygons.`);
}

build().catch(console.error);
