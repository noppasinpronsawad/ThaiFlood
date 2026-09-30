/**
 * Regression Test Suite for ThaiFlood
 * Verifies core GIS data schemas, hydrology algorithms, and geographic flow direction bearings
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting ThaiFlood Regression Tests...\n');

let passedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  // 1. Check Stations Data from live service
  await test('Telemetry Stations Data schema & live normalization', async () => {
    const { fetchLiveWaterStations } = await import('../src/services/waterStationService.js');
    const stations = await fetchLiveWaterStations();

    assert(Array.isArray(stations), 'Stations must be an array');
    assert(stations.length >= 5, 'Expected at least 5 telemetry stations');

    stations.slice(0, 50).forEach((st) => {
      assert(st.id, `Station missing id`);
      assert(st.name, `Station ${st.id} missing name`);
      assert(typeof st.lat === 'number' && st.lat >= 5 && st.lat <= 21, `Invalid latitude for ${st.id}`);
      assert(typeof st.lng === 'number' && st.lng >= 97 && st.lng <= 106, `Invalid longitude for ${st.id}`);
      assert(typeof st.currentLevel === 'number', `Invalid currentLevel for ${st.id}`);
      assert(typeof st.bankCapacity === 'number', `Invalid bankCapacity for ${st.id}`);
      assert(typeof st.flowRate === 'number' && st.flowRate >= 0, `Invalid flowRate for ${st.id}`);
      assert(st.province, `Station ${st.id} missing province`);
    });
  });

  // 2. Check River Basins GeoJSON
  await test('Thailand River Basins GeoJSON valid geometries', () => {
    const raw = fs.readFileSync(path.join(rootDir, 'src/data/thailandBasins.json'), 'utf-8');
    const geojson = JSON.parse(raw);

    assert.strictEqual(geojson.type, 'FeatureCollection');
    assert(geojson.features.length >= 5, 'Must contain major rivers');

    geojson.features.forEach((feat) => {
      assert.strictEqual(feat.type, 'Feature');
      assert.strictEqual(feat.geometry.type, 'LineString');
      assert(feat.geometry.coordinates.length >= 10, 'LineString must have detailed meanders');
      feat.geometry.coordinates.forEach(([lon, lat]) => {
        assert(lon >= 97 && lon <= 106, `River coordinate lon ${lon} out of range`);
        assert(lat >= 5 && lat <= 21, `River coordinate lat ${lat} out of range`);
      });
    });

    // Specific Mae Klong River integrity check: continuous course from Kanchanaburi to Samut Songkhram
    const maeklong = geojson.features.find((f) => f.properties.id === 'river_maeklong');
    assert(maeklong, 'Must contain river_maeklong');
    const mkCoords = maeklong.geometry.coordinates;
    assert(mkCoords.length >= 100, `Mae Klong must have sufficient points, found ${mkCoords.length}`);
    const startPt = mkCoords[0];
    const endPt = mkCoords[mkCoords.length - 1];
    assert(startPt[1] >= 14.0 && startPt[0] >= 99.5 && startPt[0] <= 99.6, 'Mae Klong must start at Kanchanaburi confluence');
    assert(endPt[1] <= 13.4 && endPt[0] >= 99.9, 'Mae Klong must terminate at Gulf of Thailand in Samut Songkhram');

    // Ensure no cross-country teleportation jumps (> 4km)
    for (let i = 0; i < mkCoords.length - 1; i++) {
      const p1 = mkCoords[i];
      const p2 = mkCoords[i + 1];
      const dKm = Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) * 111;
      assert(dKm < 4.0, `Mae Klong jump at index ${i} is ${dKm.toFixed(2)} km, exceeds 4.0 km limit`);
    }
  });

  // 3. Check Current Flood Extent Dynamic Calculation
  await test('Current Flood Extent dynamic polygon calculation from sensor overflow', async () => {
    const { computeCurrentFloodPolygons } = await import('../src/services/floodRiskService.js');
    const sampleStations = [
      {
        id: 'OV1',
        name: 'สถานีทดสอบล้นตลิ่ง',
        shortName: 'ทดสอบ',
        province: 'สุโขทัย',
        river: 'แม่น้ำยม',
        lat: 17.0,
        lng: 99.8,
        diff: 0.8,
        isOverflow: true,
        situationLevel: 5,
        datetime: '2026-09-05 12:00'
      },
      {
        id: 'NM1',
        name: 'สถานีปกติ',
        shortName: 'ปกติ',
        province: 'พระนครศรีอยุธยา',
        river: 'แม่น้ำเจ้าพระยา',
        lat: 14.3,
        lng: 100.5,
        diff: -1.5,
        isOverflow: false,
        situationLevel: 3,
        datetime: '2026-09-05 12:00'
      }
    ];

    const geojson = computeCurrentFloodPolygons(sampleStations);
    assert.strictEqual(geojson.type, 'FeatureCollection');
    assert.strictEqual(geojson.features.length, 1, 'Only overflowing stations should generate flood extent');
    const feat = geojson.features[0];
    assert.strictEqual(feat.geometry.type, 'Polygon');
    assert.strictEqual(feat.properties.stationId, 'OV1');
    assert(feat.geometry.coordinates[0].length >= 4, 'Polygon must have ring coordinates');
  });

  // 4. Check 7-Day Forecast Risk dynamic computation
  await test('7-Day Flood Forecast risk dynamic computation', async () => {
    const { compute7DayRiskPolygons } = await import('../src/services/floodRiskService.js');
    const sampleStations = [
      {
        id: 'WRN1',
        province: 'เชียงใหม่',
        river: 'แม่น้ำปิง',
        lat: 18.7,
        lng: 98.9,
        status: 'warning',
        situationLevel: 4,
        isOverflow: false
      }
    ];

    const geojson = compute7DayRiskPolygons(sampleStations);
    assert.strictEqual(geojson.type, 'FeatureCollection');
    assert.strictEqual(geojson.features.length, 1);
    const feat = geojson.features[0];
    assert.strictEqual(feat.geometry.type, 'Polygon');
    assert(feat.properties.probabilityPct >= 70, 'Warning station must produce risk >= 70%');
  });

  // 5. Hydrology Calculation & Geographic Flow Bearing Verification
  await test('Hydrological Flow Vector bearing calculation logic (Southwards for Chao Phraya, East for Mun)', async () => {
    const { generateFlowVectorPoints, evaluateStationRisk } = await import('../src/services/hydrologyService.js');
    const rawBasins = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/thailandBasins.json'), 'utf-8'));

    const flowPoints = generateFlowVectorPoints(rawBasins.features);
    assert.strictEqual(flowPoints.type, 'FeatureCollection');
    assert(flowPoints.features.length > 0, 'Must generate flow vector points');

    // Verify Chao Phraya flows southward towards Gulf of Thailand
    const chaoPhrayaPoints = flowPoints.features.filter((p) => p.properties.riverName === 'แม่น้ำเจ้าพระยา');
    assert(chaoPhrayaPoints.length >= 8, 'Must have at least 8 Chao Phraya flow points');
    const southwardCount = chaoPhrayaPoints.filter((pt) => pt.properties.bearing >= 100 && pt.properties.bearing <= 260).length;
    assert(
      southwardCount >= Math.floor(chaoPhrayaPoints.length * 0.8),
      `Chao Phraya majority flow points (${southwardCount}/${chaoPhrayaPoints.length}) must point Southward`
    );

    // Verify Mun River flows East towards Mekong
    const munPoints = flowPoints.features.filter((p) => p.properties.riverName === 'แม่น้ำมูล');
    assert(munPoints.length >= 6, 'Must have Mun flow points');
    const eastwardCount = munPoints.filter((pt) => pt.properties.bearing >= 25 && pt.properties.bearing <= 155).length;
    assert(
      eastwardCount >= Math.floor(munPoints.length * 0.7),
      `Mun River majority flow points (${eastwardCount}/${munPoints.length}) must point Eastward`
    );

    // Test Station Risk logic
    const mockOverflowStation = {
      id: 'TEST_OVERFLOW',
      currentLevel: 10.5,
      warningLevel: 9.0,
      bankCapacity: 10.0,
      flowRate: 2000,
      capacityRate: 1800
    };
    const evalResult = evaluateStationRisk(mockOverflowStation, 150);
    assert.strictEqual(evalResult.riskCategory, 'overflow', 'Station above bankCapacity must be overflow');
    assert(evalResult.score >= 85, 'Overflow score must be >= 85');
  });

  // 6. Live Dam & Reservoir Service Verification
  await test('Dam & Reservoir telemetry service and GeoJSON generation', async () => {
    const { fetchLiveDams, buildDamGeoJSON } = await import('../src/services/damService.js');
    const dams = await fetchLiveDams();

    assert(Array.isArray(dams), 'Dams must be an array');
    assert(dams.length >= 10, 'Expected at least 10 live dams');

    const sampleDam = dams.find((d) => d.name.includes('ภูมิพล')) || dams[0];
    assert(sampleDam.id, 'Dam must have ID');
    assert(sampleDam.name, 'Dam must have name');
    assert(typeof sampleDam.lat === 'number' && sampleDam.lat > 0, 'Dam must have valid latitude');
    assert(typeof sampleDam.lng === 'number' && sampleDam.lng > 0, 'Dam must have valid longitude');
    assert(typeof sampleDam.currentStorage === 'number', 'Dam must have current storage');
    assert(typeof sampleDam.percentStorage === 'number', 'Dam must have percent storage');

    const { damPoints, reservoirPolygons } = buildDamGeoJSON(dams);
    assert.strictEqual(damPoints.type, 'FeatureCollection');
    assert.strictEqual(reservoirPolygons.type, 'FeatureCollection');
    assert(damPoints.features.length >= 10, 'Dam points GeoJSON must have features');
    assert(reservoirPolygons.features.length >= 10, 'Reservoir polygons GeoJSON must have features');
  });

  // 7. Water Station Bank Calibration & False Flood Prevention
  await test('Water Station Bank Calibration prevents false overflow on min_bank:0', async () => {
    const { fetchLiveWaterStations } = await import('../src/services/waterStationService.js');
    const stations = await fetchLiveWaterStations();

    // Verify TM.50 or any station with zero bank glitch is properly calibrated
    const tm50 = stations.find((s) => s.code === 'TM.50' || s.id.includes('TM.50'));
    if (tm50) {
      assert(
        !tm50.isOverflow,
        `TM.50 should NOT be marked as overflowing when waterlevel (200m) is below actual bank (201m)`
      );
      assert(tm50.bankCapacity > 100, `TM.50 bank capacity should resolve to ~201m MSL, not 0`);
      assert(!tm50.name.startsWith('ridhydro_'), `Station name should not have raw prefix 'ridhydro_'`);
    }

    // Verify overall nation overflow count is realistic (under 100 stations during monsoon, not 500+ false alarms)
    const overflowCount = stations.filter((s) => s.isOverflow).length;
    assert(
      overflowCount < 100,
      `Overflow station count should be realistic (<100), but found ${overflowCount} (false alarms)`
    );
  });

  // 8. Topo/DEM Alignment: Pa Sak River & Pasak Jolasid Dam Reservoir
  await test('Topo/DEM Alignment: Pa Sak River follows contours and passes key stations accurately', () => {
    const rawBasins = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/thailandBasins.json'), 'utf-8'));
    const pasak = rawBasins.features.find((f) => f.properties.id === 'river_pasak');
    assert(pasak, 'Must contain river_pasak');
    assert(pasak.geometry.coordinates.length >= 3000, `Pa Sak river must have high-density curve points, found ${pasak.geometry.coordinates.length}`);

    // Helper distance
    function dist(p1, p2) {
      return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) * 111000;
    }

    // Key stations along Pa Sak
    const stations = [
      { name: 'S.9 Kaeng Khoi', pt: [101.0144, 14.6292], maxAllowedMeters: 600 },
      { name: 'S.32 Saraburi', pt: [100.9242, 14.5575], maxAllowedMeters: 600 },
      { name: 'S.26 Rama VI Dam', pt: [100.7199, 14.5601], maxAllowedMeters: 600 },
      { name: 'S.5 Ayutthaya', pt: [100.5805, 14.3587], maxAllowedMeters: 600 }
    ];

    stations.forEach((st) => {
      let minDist = Infinity;
      pasak.geometry.coordinates.forEach((c) => {
        const d = dist(c, st.pt);
        if (d < minDist) minDist = d;
      });
      assert(
        minDist <= st.maxAllowedMeters,
        `Pa Sak River must pass through ${st.name} within ${st.maxAllowedMeters}m (actual: ${Math.round(minDist)}m)`
      );
    });

    // Check Pasak Jolasid Reservoir Polygon bounds (NASA SRTM SWBD authentic lake)
    const rawRes = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/thailandReservoirs.json'), 'utf-8'));
    const pasakRes = rawRes.features.find((f) => f.properties.damName.includes('ป่าสัก'));
    assert(pasakRes, 'Must contain Pasak Jolasid reservoir feature');
    const resCoords = pasakRes.geometry.coordinates[0];
    let minLat = Infinity, maxLat = -Infinity;
    resCoords.forEach(([, lat]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    assert(minLat <= 14.85, `Pasak reservoir south bound must be <= 14.85, found ${minLat}`);
    assert(maxLat >= 15.05, `Pasak reservoir north bound must be >= 15.05, found ${maxLat}`);
    assert(pasakRes.properties.areaKm2 >= 100, `Pasak reservoir must be genuine lake >= 100 km2, found ${pasakRes.properties.areaKm2}`);
  });

  // 9. Clean View Initial Landing State
  await test('Clean View: Initial place sheet starts closed on landing', () => {
    const code = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    assert(
      code.includes("sheet.className = 'gmaps-place-sheet';"),
      "sheet.className must be initialized to 'gmaps-place-sheet' without 'open'"
    );
    assert(
      code.includes('let isVisible = false;'),
      'isVisible must be initialized to false'
    );
  });

  // 10. DMR Geology 1:250,000 Scale (No 1:50,000)
  await test('DMR Geology Scale: 1:250,000 for both rock units and structures (No 1:50k)', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert(
      mapViewerCode.includes('ROCK_UNIT_250K'),
      'MapViewer must use 1:250k ROCK_UNIT_250K for rock units'
    );
    assert(
      mapViewerCode.includes('GEOL_STR_250K'),
      'MapViewer must use 1:250k GEOL_STR_250K for geological structures'
    );
    assert(
      !mapViewerCode.includes('50K_L7018'),
      'MapViewer must not use 1:50,000 services (50K_L7018)'
    );
    assert(
      mapViewerCode.includes('tileSize: 512'),
      'MapViewer must use 512px tiles for optimal fast loading'
    );
  });

  // 11. UI Clean View & Right-Hand Layer Panel with Dam Toggle
  await test('UI Layout: Quick locations removed, place sheet at 72px, right-side collapsible layer panel with dam toggle', () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    // Requirement 3: Quick shortcuts removed
    assert(!navbarCode.includes('gmaps-quick-locations'), 'Quick locations shortcut chips must be removed');
    assert(!navbarCode.includes('ลัดไปยัง:'), '"ลัดไปยัง:" must be removed');

    // Requirement 2: Dam toggle present
    assert(navbarCode.includes('data-layer="dams"'), 'Navbar must include dedicated toggle for dams');
    assert(navbarCode.includes('toggle-dams'), 'Navbar must have toggle-dams input');

    // Requirement 4: No overlap, docked at 72px
    assert(cssCode.includes('top: 72px;'), 'Place sheet must dock at 72px under search card (16px + 48px + 8px)');

    // Requirement 5: Right-hand collapsible layer panel
    assert(navbarCode.includes('gmaps-layer-panel'), 'Right-side layer panel must exist');
    assert(navbarCode.includes('btn-toggle-layer-panel'), 'Collapse / Hide menu bar button must exist');
    assert(cssCode.includes('.gmaps-layer-panel'), 'CSS must include .gmaps-layer-panel');
    assert(cssCode.includes('.gmaps-layer-panel.collapsed'), 'CSS must include collapsed state');
  });

  // 12. Weather Radar Quality, GFS & ECMWF Forecast Layers (Wind Vectors Removed)
  await test('Weather Radar Quality, GFS & ECMWF Forecast Layers: RainViewer 512px/Maxzoom7, GFS & ECMWF Day Adjustment', async () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');

    // 1. RainViewer Radar Quality & Overscaling Fix
    assert(
      mapViewerCode.includes('rainviewer.com') || mapViewerCode.includes('RainViewer Radar'),
      'MapViewer must include TMD RainViewer radar tile source'
    );
    assert(mapViewerCode.includes('tileSize: 512'), 'RainViewer source must use 512px tiles for high resolution');
    assert(mapViewerCode.includes('maxzoom: 7'), 'RainViewer source must cap maxzoom at 7 to prevent empty/broken over-zoom tiles');
    assert(mapViewerCode.includes('/512/{z}/{x}/{y}/2/1_1.png'), 'RainViewer tiles URL must request 512px high-res tiles');
    assert(mapViewerCode.includes("'raster-resampling': 'linear'"), 'RainViewer layer must use linear resampling for smooth overscaling');

    // 2. Wind direction vectors cleanly removed
    assert(!navbarCode.includes('data-layer="wind-vectors"'), 'Wind vectors toggle must be removed from Navbar');
    assert(!navbarCode.includes('toggle-wind-vectors'), 'toggle-wind-vectors input must be removed from Navbar');
    assert(!mapViewerCode.includes('windMarkers'), 'windMarkers must be removed from MapViewer');
    assert(!mapViewerCode.includes('initWindMarkers'), 'initWindMarkers must be removed from MapViewer');

    // 3. GFS Layer with Day Adjustment
    assert(navbarCode.includes('data-layer="gfs"'), 'Navbar must have switch for GFS layer');
    assert(navbarCode.includes('toggle-gfs'), 'Navbar must have toggle-gfs input');
    assert(navbarCode.includes('legend-gfs'), 'Navbar must include GFS legend');
    assert(navbarCode.includes('gfs-day-btn'), 'Navbar must include GFS day adjustment chips');
    assert(mapViewerCode.includes('layer-gfs-fill'), 'MapViewer must include layer-gfs-fill layer');
    assert(mapViewerCode.includes('setGFSDay'), 'MapViewer must expose setGFSDay');
    assert(mapViewerCode.includes("layerId === 'gfs'"), 'MapViewer toggleLayer must handle gfs');

    // 4. ECMWF Layer with Day Adjustment
    assert(navbarCode.includes('data-layer="ecmwf"'), 'Navbar must have switch for ECMWF layer');
    assert(navbarCode.includes('toggle-ecmwf'), 'Navbar must have toggle-ecmwf input');
    assert(navbarCode.includes('legend-ecmwf'), 'Navbar must include ECMWF legend');
    assert(navbarCode.includes('ecmwf-day-btn'), 'Navbar must include ECMWF day adjustment chips');
    assert(mapViewerCode.includes('layer-ecmwf-fill'), 'MapViewer must include layer-ecmwf-fill layer');
    assert(mapViewerCode.includes('gmaps-ecmwf-float-bar'), 'MapViewer must include floating on-map ECMWF day controller');
    assert(mapViewerCode.includes('setECMWFDay'), 'MapViewer must expose setECMWFDay');
    assert(mapViewerCode.includes("layerId === 'ecmwf'"), 'MapViewer toggleLayer must handle ecmwf');

    // 5. NWP Forecast Service Functions
    const { fetchNWPModelData, buildGFSGeoJSON, buildECMWFGeoJSON, getRainSeverityInfo, computeVoronoiCell, NWP_REGIONAL_NODES } = await import('../src/services/nwpForecastService.js');
    assert(Array.isArray(NWP_REGIONAL_NODES) && NWP_REGIONAL_NODES.length >= 30, 'NWP service must cover Thailand regional nodes');
    assert(typeof computeVoronoiCell === 'function', 'NWP service must export computeVoronoiCell for seamless cells');

    const sampleCell = computeVoronoiCell(NWP_REGIONAL_NODES[0], NWP_REGIONAL_NODES);
    assert(Array.isArray(sampleCell) && sampleCell.length >= 4, 'Voronoi cell must be a valid closed polygon ring');
    assert.deepStrictEqual(sampleCell[0], sampleCell[sampleCell.length - 1], 'Voronoi polygon must be closed');

    const nwpData = await fetchNWPModelData();
    assert(Array.isArray(nwpData) && nwpData.length >= 30, 'fetchNWPModelData must return regional nodes');
    const firstNode = nwpData[0];
    assert(Array.isArray(firstNode.dailyForecasts) && firstNode.dailyForecasts.length === 7, 'Must have 7 days of daily forecasts');

    const gfsGeoDay0 = buildGFSGeoJSON(nwpData, 0);
    assert.strictEqual(gfsGeoDay0.type, 'FeatureCollection');
    assert(gfsGeoDay0.features.length >= 30, 'GFS GeoJSON must contain features');
    assert(typeof gfsGeoDay0.features[0].properties.rainMm === 'number', 'GFS feature must contain rainMm');
    assert.strictEqual(gfsGeoDay0.features[0].properties.modelCode, 'GFS');

    const gfsGeoDay3 = buildGFSGeoJSON(nwpData, 3);
    assert.strictEqual(gfsGeoDay3.features[0].properties.dayIndex, 3, 'GFS Day 3 must have dayIndex 3');

    const ecmwfGeoDay0 = buildECMWFGeoJSON(nwpData, 0);
    assert.strictEqual(ecmwfGeoDay0.type, 'FeatureCollection');
    assert(ecmwfGeoDay0.features.length >= 30, 'ECMWF Day 0 GeoJSON must contain features');
    assert(typeof ecmwfGeoDay0.features[0].properties.rainMm === 'number', 'ECMWF feature must contain rainMm');
    assert.strictEqual(ecmwfGeoDay0.features[0].properties.modelCode, 'ECMWF');

    const ecmwfGeoDay3 = buildECMWFGeoJSON(nwpData, 3);
    assert.strictEqual(ecmwfGeoDay3.features[0].properties.dayIndex, 3, 'ECMWF Day 3 must have dayIndex 3');

    const light = getRainSeverityInfo(5);
    assert.strictEqual(light.level, 'light');
    const heavy = getRainSeverityInfo(35);
    assert.strictEqual(heavy.level, 'heavy');
  });

  // 13. UI Overflow & Word Wrap: Layer panel width, scrolling, and descriptions
  await test('UI Overflow & Word Wrap: Layer panel widened, scrolling enabled, descriptions wrap cleanly', () => {
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert(cssCode.includes('width: 320px;'), 'Layer panel must be widened to 320px to prevent clipping');
    assert(cssCode.includes('overflow-y: auto;'), 'Layer panel body must have vertical scrolling for legends');
    assert(cssCode.includes('white-space: normal;'), 'Layer descriptions must wrap normally without ellipsis clipping');
    assert(cssCode.includes('word-break: break-word;'), 'Layer descriptions must break words cleanly');
  });

  // 14. DMR Geology Rock Unit Inspection & Display
  await test('DMR Geology: Rock unit symbol decoder and interactive identification support', async () => {
    const { decodeRockSymbol } = await import('../src/services/geologyService.js');
    const qa = decodeRockSymbol('Qa');
    assert.strictEqual(qa.symbol, 'Qa');
    assert(qa.name.includes('ตะกอนน้ำพา'), 'Qa must decode to Alluvium description');
    assert(qa.age.includes('ควอเทอร์นารี'), 'Qa age must be Quaternary');

    const trgr = decodeRockSymbol('Trgr');
    assert(trgr.name.includes('หินแกรนิต'), 'Trgr must decode to Granite');

    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert(mapViewerCode.includes('setupGeologyClickHandler'), 'MapViewer must include geology click inspection');
    assert(mapViewerCode.includes('identifyRockUnit'), 'MapViewer must query identifyRockUnit');

    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    assert(stationListCode.includes('identifyRockUnit'), 'WaterStationList must include rock unit query');
    assert(stationListCode.includes('st-sheet-geol-row'), 'WaterStationList must have rock unit row for stations');
    assert(stationListCode.includes('dam-sheet-geol-row'), 'WaterStationList must have rock unit row for dams');
  });

  // 15. Basemap switcher modes (Street, Satellite, ภูมิประเทศ - DEM removed)
  await test('Basemap Switcher: DEM removed, contains Street, Satellite, and ภูมิประเทศ', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert(
      !mapViewerCode.includes('id="btn-mode-geology"'),
      'Bottom-right switcher must NOT contain btn-mode-geology'
    );
    assert(
      mapViewerCode.includes('id="btn-mode-street"'),
      'Basemap switcher must retain street mode'
    );
    assert(
      mapViewerCode.includes('id="btn-mode-satellite"'),
      'Basemap switcher must retain satellite mode'
    );
    assert(
      mapViewerCode.includes('id="btn-mode-topo"'),
      'Basemap switcher must retain topo mode'
    );
    assert(
      mapViewerCode.includes('data-name="ภูมิประเทศ"'),
      'Basemap switcher must name topo as ภูมิประเทศ'
    );
    assert(
      !mapViewerCode.includes('id="btn-mode-dem"'),
      'Basemap switcher must NOT contain DEM mode (removed because it duplicates contour)'
    );
    assert(
      mapViewerCode.includes('dem-elevation-layer'),
      'MapViewer must include dem-elevation-layer'
    );
    assert(
      mapViewerCode.includes('dem-elevation-source') && mapViewerCode.includes('terrarium'),
      'MapViewer must use high-resolution 30m Terrarium DEM dataset'
    );
    assert(
      mapViewerCode.includes('dem-contour-overlay-layer'),
      'MapViewer must include dem-contour-overlay-layer for floodplain contrast'
    );
    assert(
      mapViewerCode.includes('gmaps-dem-badge'),
      'MapViewer must include real-time DEM elevation inspector badge'
    );
  });

  // 16. Geology inspection gated on toggle
  await test('Geology Inspection: Gated to only query and display when #toggle-dmr-geology is active', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert(
      mapViewerCode.includes('isGeologyActive()'),
      'MapViewer must define and check isGeologyActive()'
    );
    assert(
      mapViewerCode.includes('if (!isGeologyActive()) return;'),
      'setupGeologyClickHandler must exit early if geology toggle is OFF'
    );

    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    assert(
      stationListCode.includes('isGeologyEnabled()'),
      'WaterStationList must check isGeologyEnabled() before showing rock rows'
    );
  });

  // 17. Apple Maps Style Weather Pill Widget at Province Zoom Level
  await test('Apple Maps Weather Pill Widget: Province-level zoom display & temperature lookup', async () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const { getNearestProvince, fetchCurrentProvinceWeather, THAI_PROVINCES } = await import('../src/services/weatherService.js');

    assert(mapViewerCode.includes('gmaps-apple-weather-pill'), 'MapViewer must create Apple weather pill element');
    assert(mapViewerCode.includes('zoom >= 8.0 && zoom <= 12.5'), 'MapViewer must show pill at closer province-level zoom (8.0 to 12.5)');
    assert(cssCode.includes('.gmaps-apple-weather-pill'), 'CSS must style .gmaps-apple-weather-pill with glassmorphic pill');

    assert(Array.isArray(THAI_PROVINCES) && THAI_PROVINCES.length >= 70, 'Must contain comprehensive Thai provinces list');
    const nearestAyutthaya = getNearestProvince(14.35, 100.56);
    assert.strictEqual(nearestAyutthaya.name, 'พระนครศรีอยุธยา');

    const nearestChiangMai = getNearestProvince(18.78, 98.98);
    assert.strictEqual(nearestChiangMai.name, 'เชียงใหม่');

    const weather = await fetchCurrentProvinceWeather(nearestAyutthaya.name, nearestAyutthaya.lat, nearestAyutthaya.lng);
    assert(typeof weather.temp === 'number', 'Must return numeric temperature');
    assert(weather.weatherDesc, 'Must return weather description');
    assert(weather.icon, 'Must return weather icon');
  });

  // 18. Locate Me (Current Location) Feature
  await test('Locate Me Feature: Geolocation button, blue pulse marker, and nearest station risk lookup', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    assert(mapViewerCode.includes("'gmaps-locate-me'"), 'MapViewer must include Locate Me button');
    assert(mapViewerCode.includes('navigator.geolocation.getCurrentPosition'), 'MapViewer must invoke browser Geolocation API');
    assert(mapViewerCode.includes('gmaps-user-marker'), 'MapViewer must render authentic user location marker');
    assert(mapViewerCode.includes('locateMe: locateUser'), 'MapViewer must export locateMe method');
    assert(mapViewerCode.includes('showUserLocationPopup'), 'MapViewer must show nearby risk popup on user location');

    assert(cssCode.includes('.gmaps-locate-btn'), 'CSS must style .gmaps-locate-btn');
    assert(cssCode.includes('.gmaps-user-dot'), 'CSS must style .gmaps-user-dot');
    assert(cssCode.includes('.gmaps-user-pulse'), 'CSS must include user pulsating animation');
    assert(cssCode.includes('.gmaps-toast'), 'CSS must include geolocation toast notification');
  });

  // 19. AI-Style Disclaimer Pill & Realistic River Meander Tracing
  await test('AI-Style Disclaimer Pill & River Meander Geometry: Subtle note at bottom & river corridor alignment', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const floodServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/floodRiskService.js'), 'utf-8');

    assert(mapViewerCode.includes('gmaps-disclaimer-pill'), 'MapViewer must render AI disclaimer pill');
    assert(mapViewerCode.includes('ภาพจำลองเชิงอุทกวิทยา'), 'Disclaimer text must clarify hydrological simulation');
    assert(cssCode.includes('.gmaps-disclaimer-pill'), 'CSS must style .gmaps-disclaimer-pill');

    assert(floodServiceCode.includes('buildRiverFollowingPolygon'), 'Flood service must trace physical river meanders');
    assert(floodServiceCode.includes('findNearestRiverReach'), 'Flood service must find nearest river reach');
    assert(floodServiceCode.includes('isGenuineInundation'), 'Flood service must filter tidal and bad bank capacity false positives');
  });

  // 20. MapViewer Interface & FlyToStation Integrity
  await test('MapViewer Interface: Exports valid flyToStation, locateMe, and layer controls without undefined reference errors', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

    assert(mapViewerCode.includes('function flyToStation(item)'), 'MapViewer must declare flyToStation as a function');
    assert(mapViewerCode.includes('flyToStation,'), 'MapViewer return object must include flyToStation');
    assert(mapViewerCode.includes('locateMe: locateUser,'), 'MapViewer return object must include locateMe');
    assert(mapViewerCode.includes('toggleLayer:'), 'MapViewer return object must include toggleLayer');
    assert(mapViewerCode.includes('setECMWFDay:'), 'MapViewer return object must include setECMWFDay');
    assert(mapViewerCode.includes('setGFSDay:'), 'MapViewer return object must include setGFSDay');
  });

  // 21. MapLibre Style Specification Compliance (Prevents Map Blank Out)
  await test('MapLibre Style Spec: Style object has 0 validation errors (e.g. hillshade-exaggeration <= 1)', async () => {
    const { default: styleSpec } = await import('@maplibre/maplibre-gl-style-spec');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

    const lines = mapViewerCode.split('\n');
    const styleLines = [];
    let insideStyle = false;
    let braceCount = 0;
    for (let i = 250; i < 700; i++) {
      const line = lines[i];
      if (line && line.includes('style: {')) {
        insideStyle = true;
        styleLines.push('{');
        braceCount = 1;
        continue;
      }
      if (insideStyle) {
        styleLines.push(line);
        for (const ch of line) {
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
        }
        if (braceCount === 0) break;
      }
    }
    const styleStr = styleLines.join('\n').replace(/,\s*$/, '');
    const styleObj = (new Function('return ' + styleStr))();

    const errors = styleSpec.validateStyleMin(styleObj);
    assert.strictEqual(errors.length, 0, `Map style has ${errors.length} validation errors: ${errors.map((e) => e.message).join(', ')}`);
  });

  await test('Basemap 50x50 Previews & "ประเภทแผนที่" Label', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('basemap-header-label'), 'Must have basemap-header-label');
    assert.ok(mapViewerCode.includes('ประเภทแผนที่:'), 'Must display "ประเภทแผนที่:" label');
    assert.ok(mapViewerCode.includes('basemap-thumb'), 'Must have 50x50 basemap thumbnail cards');
    assert.ok(mapViewerCode.includes('gmaps-basemap-container'), 'Must have gmaps-basemap-container');

    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert.ok(cssCode.includes('width: 44px;') && cssCode.includes('height: 44px;'), 'Thumbnails must be 44x44px');
  });

  await test('Dam Barrier Symbol Map Layer', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('dam-barrier-icon'), 'Must register dam-barrier-icon symbol');
    assert.ok(mapViewerCode.includes('layer-dams-symbol'), 'Must create layer-dams-symbol layer');
    assert.ok(mapViewerCode.includes('createDamIconCanvas'), 'Must have custom dam icon generator');
  });

  await test('Live Traffic Layer with Zoom Gating (Zoom 13+)', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('layer-traffic'), 'Must have layer-traffic');
    assert.ok(mapViewerCode.includes('minzoom: 13'), 'Traffic layer must display when zoomed close (minzoom: 13)');
    assert.ok(mapViewerCode.includes('google.com') && mapViewerCode.includes('traffic'), 'Must use live traffic tile source');

    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('toggle-traffic'), 'Must have toggle-traffic checkbox in Navbar');
  });

  await test('Hamburger Icon & Left Drawer (Alerts Stack, Sources, Developer)', () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('gmaps-hamburger-btn'), 'Must have hamburger button next to search');
    assert.ok(navbarCode.includes('gmaps-drawer'), 'Must have gmaps-drawer element');
    assert.ok(navbarCode.includes('tab-pane-alerts'), 'Must have alerts tab');
    assert.ok(navbarCode.includes('tab-pane-sources'), 'Must have sources tab');
    assert.ok(navbarCode.includes('tab-pane-developer'), 'Must have developer tab');
    assert.ok(navbarCode.includes('alerts-stack-container'), 'Must have stacked cards container');
    assert.ok(navbarCode.includes('Powered by Noppasin Pronsawad'), 'Developer card must have Powered by Noppasin Pronsawad');
    assert.ok(!navbarCode.includes('M.Sc. Petroleum Geoscience'), 'Developer card must NOT have M.Sc. Petroleum Geoscience');
    assert.ok(navbarCode.includes('linkedIn/noppasinp'), 'Must include LinkedIn linkedIn/noppasinp');
    assert.ok(navbarCode.includes('noppasinp.vercel.app'), 'Must include website noppasinp.vercel.app');
  });

  await test('Alert Cards Datetime and Mobile Responsiveness Support', () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    // 1. Alert cards include date & time
    assert.ok(navbarCode.includes('alert-card-datetime'), 'Alert cards must render datetime element');
    assert.ok(navbarCode.includes('ข้อมูล ณ วันที่/เวลา:'), 'Alert cards must display "ข้อมูล ณ วันที่/เวลา:" label');
    assert.ok(cssCode.includes('.alert-card-datetime'), 'CSS must style .alert-card-datetime');

    // 2. Mobile viewport & safe-area responsiveness
    assert.ok(htmlCode.includes('viewport-fit=cover'), 'HTML meta viewport must include viewport-fit=cover');
    assert.ok(htmlCode.includes('apple-mobile-web-app-capable'), 'HTML must include mobile-web-app-capable');
    assert.ok(cssCode.includes('env(safe-area-inset-top'), 'CSS must support iOS safe-area-inset-top');
    assert.ok(cssCode.includes('env(safe-area-inset-bottom'), 'CSS must support iOS safe-area-inset-bottom');
    assert.ok(cssCode.includes('pointer: coarse'), 'CSS must include touch device tap enhancements');
    assert.ok(cssCode.includes('max-width: 768px'), 'CSS must include mobile screen media query');
  });

  await test('Dam Symbols & Popups: Single small pin, water storage status colors, and high popup z-index', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('getDamStatusInfo'), 'Must implement getDamStatusInfo');
    assert.ok(mapViewerCode.includes('#dc2626') && mapViewerCode.includes('วิกฤต (น้ำมาก)'), 'Must assign red for critical high water (>= 80%)');
    assert.ok(mapViewerCode.includes('#ea580c') && mapViewerCode.includes('เฝ้าระวัง (น้ำมาก)'), 'Must assign orange for warning water (60-79%)');
    assert.ok(mapViewerCode.includes('#0284c7') && mapViewerCode.includes('เกณฑ์ปกติ'), 'Must assign blue for normal water (30-59%)');
    assert.ok(mapViewerCode.includes('#d97706') && mapViewerCode.includes('น้ำน้อย'), 'Must assign amber for low water (< 30%)');
    assert.ok(mapViewerCode.includes('gmaps-dam-marker-pin'), 'Must generate small HTML marker pins');
    assert.ok(mapViewerCode.includes("'visibility': 'none'"), 'Must hide large canvas dam symbol to avoid duplicate stacking');

    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert.ok(cssCode.includes('.maplibregl-popup') && cssCode.includes('z-index: 1000 !important;'), 'Popup must have z-index: 1000 !important to stay above all markers');
    assert.ok(cssCode.includes('.maplibregl-popup-content') && cssCode.includes('z-index: 1001 !important;'), 'Popup content must have z-index: 1001 !important');
  });

  await test('Basemap "แผนที่" & 3D Buildings vs 2D Pure Satellite', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('data-name="แผนที่"'), 'Basemap must be named แผนที่');
    assert.ok(mapViewerCode.includes('layer-3d-buildings'), 'MapViewer must include layer-3d-buildings');
    assert.ok(mapViewerCode.includes('openfreemap-buildings'), 'MapViewer must include vector source for 3D buildings');
    assert.ok(mapViewerCode.includes('fill-extrusion'), 'Must use fill-extrusion for 3D building rendering');
    assert.ok(mapViewerCode.includes("activeBasemap === 'satellite'"), 'Must check satellite mode for 2D enforcement');

    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('1. แผนที่ (Map - OpenStreetMap)'), 'Navbar sources must describe basemap as แผนที่');
  });

  await test('Hydrological Disclaimer Visibility & Clearance', () => {
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert.ok(cssCode.includes('.gmaps-disclaimer-pill'), 'Must style disclaimer pill');
    // Ensure float bar is raised above disclaimer so disclaimer is completely clear
    assert.ok(cssCode.includes('bottom: 54px;'), 'Float bar must be elevated to bottom: 54px to prevent covering disclaimer');
  });

  await test('Weather Pill Locate Clearance & Mobile Layer Panel Equal Width', () => {
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    // 1. Weather pill elevated to avoid covering locate button (top of stack is ~162-170px)
    assert.ok(cssCode.includes('.gmaps-apple-weather-pill'), 'Must style .gmaps-apple-weather-pill');
    assert.ok(cssCode.includes('bottom: 180px;'), 'Desktop weather pill must be at bottom: 180px to clear locate button');
    assert.ok(cssCode.includes('bottom: calc(186px + env(safe-area-inset-bottom, 0px));'), 'Mobile weather pill must clear locate button');

    // 2. Mobile layer panel has identical width whether collapsed or expanded
    assert.ok(cssCode.includes('.gmaps-layer-panel.collapsed'), 'Must have collapsed state for layer panel');
    const mobileMediaIdx = cssCode.indexOf('@media (max-width: 768px)');
    assert.ok(mobileMediaIdx !== -1, 'Must have max-width: 768px media query');
    const mobileSection = cssCode.slice(mobileMediaIdx);
    assert.ok(mobileSection.includes('width: 320px;'), 'Mobile layer panel must define width: 320px');
    assert.ok(mobileSection.includes('max-width: calc(100vw - 20px);'), 'Mobile layer panel must define max-width: calc(100vw - 20px)');
  });

  await test('Dam Rule Curve Assessment: Multi-reservoir seasonal profiles and 3-zone gauge', async () => {
    const { evaluateDamRuleCurve } = await import('../src/services/damRuleCurveService.js');
    
    // Test Bhumibol dam (Northern major profile)
    const bhumibol = { name: 'เขื่อนภูมิพล', percentStorage: 88, normalStorage: 13462 };
    const resBhumibol = evaluateDamRuleCurve(bhumibol, new Date('2026-09-15'));
    assert.strictEqual(resBhumibol.profileKey, 'northern_major');
    assert.ok(resBhumibol.urcPercent > 0, 'URC percent must be positive');
    assert.ok(resBhumibol.lrcPercent > 0, 'LRC percent must be positive');
    assert.ok(resBhumibol.urcPercent > resBhumibol.lrcPercent, 'URC must be greater than LRC');
    assert.ok(['above_urc', 'normal', 'below_lrc'].includes(resBhumibol.zone), 'Zone must be valid');

    // Test Pasak Jolasid (Flood retention profile)
    const pasak = { name: 'เขื่อนป่าสักชลสิทธิ์', percentStorage: 102, normalStorage: 960 };
    const resPasak = evaluateDamRuleCurve(pasak, new Date('2026-09-15'));
    assert.strictEqual(resPasak.profileKey, 'flood_retention');
    assert.strictEqual(resPasak.zone, 'above_urc', '102% storage must be above URC');
    assert.ok(resPasak.zoneLabel.includes('เหนือเกณฑ์ควบคุมตอนบน'), 'Must warn of above URC');

    // Test WaterStationList integrates Rule Curve
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    assert.ok(stationListCode.includes('evaluateDamRuleCurve'), 'Must import evaluateDamRuleCurve');
    assert.ok(stationListCode.includes('gmaps-rule-curve-card'), 'Must render Rule Curve card');
    assert.ok(stationListCode.includes('เกณฑ์ควบคุมน้ำในเขื่อน (Rule Curve)'), 'Must include Rule Curve title');
  });

  await test('GoatCounter Privacy Analytics: Script tag, service module, and drawer badge', () => {
    const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
    assert.ok(htmlCode.includes('data-goatcounter="https://thaiflood.goatcounter.com/count"'), 'Must configure GoatCounter data endpoint');
    assert.ok(htmlCode.includes('https://gc.zgo.at/count.js'), 'Must load GoatCounter script over HTTPS');

    const analyticsCode = fs.readFileSync(path.join(rootDir, 'src/services/analyticsService.js'), 'utf-8');
    assert.ok(analyticsCode.includes('getVisitorCount'), 'Must export getVisitorCount');
    assert.ok(analyticsCode.includes('trackEvent'), 'Must export trackEvent');

    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('visitor-count-badge'), 'Must display visitor count badge in drawer');
    assert.ok(navbarCode.includes('GoatCounter'), 'Must credit GoatCounter analytics');
  });

  await test('Wind Field Map Layer: WMO 10m surface vector physics, Beaufort scale, and interactive layer', async () => {
    const { calculatePhysicalWindVector, getBeaufortInfo, getWindColor } = await import('../src/components/WindFieldLayer.js');

    // Test vector physics
    const vector = calculatePhysicalWindVector(13.75, 100.5, new Date('2026-09-15'));
    assert.ok(typeof vector.u === 'number' && typeof vector.v === 'number', 'u and v components must be numbers');
    assert.ok(vector.speed > 0, 'Wind speed must be positive');
    assert.ok(vector.dirDeg >= 0 && vector.dirDeg <= 360, 'Wind direction must be between 0 and 360 degrees');

    // Test Beaufort scale color
    assert.strictEqual(getWindColor(1.5), '#38bdf8', 'Calm wind must be sky blue');
    assert.strictEqual(getWindColor(4.0), '#34d399', 'Light breeze must be emerald');
    const info = getBeaufortInfo(10.5);
    assert.ok(info.speedKmh > 0 && info.beaufort, 'Must return valid Beaufort info');

    // Test MapViewer and Navbar integration
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('createWindFieldLayer'), 'Must import and instantiate WindFieldLayer');
    assert.ok(mapViewerCode.includes('gmaps-wind-legend'), 'Must include floating wind legend');
    assert.ok(mapViewerCode.includes("layerId === 'wind-field'"), 'Must handle wind-field visibility toggle');

    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('toggle-wind-field'), 'Navbar must include #toggle-wind-field switch');
    assert.ok(navbarCode.includes('legend-wind-field'), 'Navbar must include #legend-wind-field');

    // Test geographic anchoring and 800 particles configuration
    const windLayerCode = fs.readFileSync(path.join(rootDir, 'src/components/WindFieldLayer.js'), 'utf-8');
    assert.ok(windLayerCode.includes('PARTICLE_COUNT = 800'), 'Must calibrate to exactly 800 particles');
    assert.ok(windLayerCode.includes('LINE_WIDTH = 2.4'), 'Must slightly increase line thickness to 2.4px');
    assert.ok(windLayerCode.includes('map.project') && windLayerCode.includes('map.unproject'), 'Must anchor particles to map coordinates via project and unproject');
  });

  await test('Place Sheet: Dam Status Rule Curve binding and 5km BMA Road Proximity Gating', () => {
    // 1. MapViewer getDamStatusInfo evaluates according to Rule Curve
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('evaluateDamRuleCurve'), 'MapViewer must import evaluateDamRuleCurve');
    assert.ok(mapViewerCode.includes('URC'), 'Must include URC reference in status');
    assert.ok(mapViewerCode.includes('LRC'), 'Must include LRC reference in status');

    // 2. WaterStationList suppresses BMA road card when entity is > 5 km away
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    assert.ok(stationListCode.includes('getMinDistanceToBMARoads'), 'Must calculate distance to BMA roads');
    assert.ok(stationListCode.includes('distToRoads <= 5.0'), 'Must gate BMA road card to 5km radius');
  });

  await test('Bangkok Default Center, Unified Bottom Legend Controller, Button Clearance, and Minimalist Mobile Layer Icon', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    // 1. Initial Map View: Center and Zoom to Bangkok (กรุงเทพมหานคร)
    assert.ok(mapViewerCode.includes('center: [100.5018, 13.7563]'), 'Default map center must be Bangkok [100.5018, 13.7563]');
    assert.ok(mapViewerCode.includes('zoom: 10.8'), 'Default zoom must be 10.8 to frame Bangkok metropolis');

    // 2. Unified Bottom Legend & Day Controller with Collapsible Description
    assert.ok(mapViewerCode.includes('gmaps-bottom-legend-card'), 'MapViewer must include gmaps-bottom-legend-card');
    assert.ok(mapViewerCode.includes('btn-toggle-legend-desc'), 'Must have btn-toggle-legend-desc for collapsing/expanding description');
    assert.ok(mapViewerCode.includes('bottom-legend-desc-panel'), 'Must have bottom-legend-desc-panel');
    assert.ok(mapViewerCode.includes('updateBottomLegendBar'), 'Must implement updateBottomLegendBar');
    assert.ok(mapViewerCode.includes('LAYER_LEGEND_CONFIGS'), 'Must have configs for color scale layers');

    // 3. Button Clearance: Must NOT overlap locate me, Zoom In/Out, 3D, and Weather pill
    assert.ok(cssCode.includes('max-width: min(560px, calc(100vw - 240px));'), 'Desktop bottom legend must clear controls stack and weather pill');
    assert.ok(cssCode.includes('calc(100vw - 52px)') || cssCode.includes('max-width: calc(100vw - 65px);'), 'Mobile bottom legend must clear right controls stack');
    assert.ok(cssCode.includes('bottom: calc(76px + env(safe-area-inset-bottom, 0px));'), 'Mobile bottom legend must sit above basemap button');
    assert.ok(cssCode.includes('.gmaps-layer-panel .layer-legend-box') && cssCode.includes('display: none !important;'), 'Right panel legends must be hidden to separate display to bottom');

    // 4. Minimalist Mobile Layer Icon (Vector image matching two stacked isometric diamond layers)
    assert.ok(navbarCode.includes('layer-icon-svg'), 'Navbar must render layer-icon-svg');
    assert.ok(navbarCode.includes('M12 3.5L21.5 8.8L12 14.1L2.5 8.8L12 3.5Z'), 'Must have top isometric diamond layer path');
    assert.ok(navbarCode.includes('M2.5 12.8L12 18.1L21.5 12.8L21.5 15.8L12 21.1L2.5 15.8L2.5 12.8Z'), 'Must have bottom isometric chevron layer path');
    assert.ok(cssCode.includes('.layer-icon-svg'), 'CSS must style .layer-icon-svg');
    assert.ok(cssCode.includes('.gmaps-layer-panel.collapsed .layer-icon-svg'), 'CSS must style collapsed mobile layer icon');

    // 5. Mobile & iPhone SE Legend Expansion and Basemap Icon Reduction
    assert.ok(cssCode.includes('width: 36px;') && cssCode.includes('height: 36px;'), 'Mobile basemap thumb must be reduced to 36x36px');
    assert.ok(cssCode.includes('width: 32px;') && cssCode.includes('height: 32px;'), 'iPhone SE basemap thumb must be reduced to 32x32px');
    assert.ok(cssCode.includes('.gmaps-bottom-legend-card .legend-day-section') && cssCode.includes('flex-direction: column;'), 'Mobile legend day section must stack vertically');
    assert.ok(cssCode.includes('touch-action: pan-x;'), 'Day chips must support horizontal touch swiping on mobile');
    assert.ok(cssCode.includes('width: calc(100vw - 52px) !important;'), 'Mobile legend must strictly enforce expanded width');
  });

  await test('Traffy Fondue Road Flood Layer & Minimalist Road Icon', async () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const traffyService = await import(path.join(rootDir, 'src/services/traffyFondueService.js'));

    // 1. Layer Toggle in Navbar & Mobile Panel
    assert.ok(navbarCode.includes('id="toggle-traffy-flood"'), 'Navbar must have toggle-traffy-flood');
    assert.ok(navbarCode.includes('data-layer="traffy-flood"'), 'Must have data-layer="traffy-flood"');
    assert.ok(navbarCode.includes('minimal-road-layer-icon'), 'Navbar must render minimal road layer icon');

    // 2. Traffy Fondue Flood Service
    assert.ok(typeof traffyService.getTraffyFloodGeoJSON === 'function', 'Service must export getTraffyFloodGeoJSON');
    const geo = await traffyService.getTraffyFloodGeoJSON();
    assert.ok(geo && geo.type === 'FeatureCollection', 'Must return valid GeoJSON FeatureCollection');
    assert.ok(Array.isArray(geo.features), 'Must return features array');
    if (geo.features.length > 0) {
      assert.ok(geo.features[0].geometry.type === 'Point', 'Incidents must be Point geometries');
    }

    // 3. Minimalist Road Icon & Map Markers
    assert.ok(mapViewerCode.includes('traffy-road-svg'), 'MapViewer must render traffy-road-svg minimal road icon');
    assert.ok(mapViewerCode.includes('traffy-road-marker-pin'), 'MapViewer must style traffy-road-marker-pin');
    assert.ok(mapViewerCode.includes("initTraffyFloodLayer"), 'MapViewer must implement initTraffyFloodLayer');
    assert.ok(mapViewerCode.includes("'traffy-flood'"), 'MapViewer must include traffy-flood in LAYER_LEGEND_CONFIGS');

    // 4. CSS Styling
    assert.ok(cssCode.includes('.minimal-road-layer-icon'), 'CSS must style .minimal-road-layer-icon');
    assert.ok(cssCode.includes('.traffy-road-marker-pin'), 'CSS must style .traffy-road-marker-pin');
  });

  // 36. Legend Synchronization, Auto-Collapse on Basemap Interaction & Traffy Fondue Place Sheet
  await test('Legend Sync, Basemap Auto-Collapse & Traffy Fondue Place Sheet', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    // 1. Legend Day Selector suppression for non-forecast layers
    assert.ok(mapViewerCode.includes("hasDaySelector: false"), 'Non-NWP layers must declare hasDaySelector: false');
    assert.ok(mapViewerCode.includes("daySection.classList.add('is-hidden')"), 'Must add is-hidden class when hasDaySelector is false');
    assert.ok(cssCode.includes('.legend-day-section.is-hidden') && cssCode.includes('display: none !important'), 'CSS must strictly hide day selector when is-hidden');

    // 2. Legend Auto-Collapse on Basemap interaction (same logic as layer panel)
    assert.ok(mapViewerCode.includes('function collapseLegendDesc()'), 'MapViewer must implement collapseLegendDesc');
    assert.ok(mapViewerCode.includes('autoCollapseLayerPanel') && mapViewerCode.includes('collapseLegendDesc();'), 'autoCollapseLayerPanel must trigger collapseLegendDesc');
    assert.ok(mapViewerCode.includes("mapInstance.on('dragstart'") && mapViewerCode.includes('collapseLegendDesc()'), 'Dragstart must collapse legend description');
    assert.ok(mapViewerCode.includes("mapInstance.on('touchstart'") && mapViewerCode.includes('collapseLegendDesc()'), 'Touchstart must collapse legend description');
    assert.ok(mapViewerCode.includes("mapInstance.on('click'") && mapViewerCode.includes('collapseLegendDesc()'), 'Map click must collapse legend description');

    // 3. Traffy Fondue displays as Place Sheet (not as popup message)
    assert.ok(stationListCode.includes('function renderTraffySheet()'), 'WaterStationList must implement renderTraffySheet');
    assert.ok(stationListCode.includes('selectTraffy:'), 'WaterStationList must export selectTraffy method');
    assert.ok(mainCode.includes('placeSheetInstance.selectTraffy(item)'), 'main.js must route isTraffy to selectTraffy');
    assert.ok(mapViewerCode.includes('isTraffy: true') && mapViewerCode.includes('options.onStationSelect'), 'MapViewer marker click must trigger onStationSelect with isTraffy: true');
    assert.ok(!mapViewerCode.includes('showTraffyPopup(p, coords)'), 'MapViewer must NOT display popup message for Traffy marker click');
  });

  // 37. DOH National Highway Flood, Medium Reservoir Zoom-Gating & Adaptive Sheet, Dynamic Basemap Label, and Mobile Layer Grid Sheet
  await test('DOH Highway Flood, Reservoir Zoom-Gating, Dynamic Basemap Label, and Mobile Details Sheet', async () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const { fetchLiveDams } = await import(path.join(rootDir, 'src/services/damService.js'));
    const dohService = await import(path.join(rootDir, 'src/services/dohHighwayFloodService.js'));

    // 1. Basemap Label replaces "เลเยอร์" with active map name
    assert.ok(mapViewerCode.includes('updateBasemapLabel'), 'MapViewer must implement updateBasemapLabel to update basemap name');
    assert.ok(mapViewerCode.includes('updateBasemapLabel(basemapNames[mode] || mode, mode)'), 'switchBasemap must update basemap label with active name');

    // 2. DOH Highway Flood Layer
    const dohGeo = await dohService.getDohHighwayGeoJSON();
    assert.ok(dohGeo && dohGeo.type === 'FeatureCollection', 'DOH highway service must return valid FeatureCollection');
    assert.ok(dohGeo.features.length >= 10, 'Must have at least 10 national highway flood segments');
    assert.strictEqual(dohGeo.features[0].geometry.type, 'LineString', 'Highway segments must have LineString geometry');
    assert.ok(dohGeo.features[0].properties.highwayNo, 'Must have highway number');
    assert.ok(dohGeo.metadata.hotline.includes('1586'), 'Must include hotline 1586');
    assert.ok(mapViewerCode.includes('source-doh-roads'), 'MapViewer must have source-doh-roads');
    assert.ok(mapViewerCode.includes('layer-doh-roads-line'), 'MapViewer must have layer-doh-roads-line');
    assert.ok(navbarCode.includes('id="toggle-doh-roads"'), 'Navbar must include toggle-doh-roads');
    assert.ok(stationListCode.includes('renderDohRoadSheet'), 'WaterStationList must implement renderDohRoadSheet');
    assert.ok(stationListCode.includes('selectDohRoad:'), 'WaterStationList must export selectDohRoad');

    // 3. Medium Reservoir & Major Dam (Zoom-Gating & Adaptive Place Sheet)
    const dams = await fetchLiveDams();
    const mediumReservoirs = dams.filter(d => d.isMediumReservoir);
    const majorDams = dams.filter(d => d.isMajorDam);
    assert.ok(dams.length >= 35, 'Must have live dams from ThaiWater API');
    assert.ok(majorDams.length >= 25, 'Must preserve major dams');
    assert.ok(mapViewerCode.includes('updateDamZoomGating'), 'MapViewer must implement updateDamZoomGating');
    assert.ok(mapViewerCode.includes('zoom >= 8.5'), 'Medium reservoirs must be zoom-gated with threshold 8.5');
    assert.ok(stationListCode.includes('dam.isMediumReservoir'), 'WaterStationList must branch on dam.isMediumReservoir');
    assert.ok(stationListCode.includes('สมดุลการไหลเข้า-ออก') && stationListCode.includes('น้ำไหลเข้าวันนี้'), 'Medium reservoir sheet must render storage progress bar and inflow/outflow balance without Rule curve');

    // 4. Mobile Google Maps Style "รายละเอียดแผนที่" 3-Column Sheet
    assert.ok(navbarCode.includes('id="gmaps-mobile-layer-sheet"'), 'Navbar must include gmaps-mobile-layer-sheet');
    assert.ok(navbarCode.includes('id="mobile-layer-grid"'), 'Navbar must include mobile-layer-grid');
    assert.ok(navbarCode.includes('openMobileLayerSheet'), 'Navbar must implement openMobileLayerSheet');
    assert.ok(navbarCode.includes('closeMobileLayerSheet'), 'Navbar must implement closeMobileLayerSheet');
    assert.ok(cssCode.includes('.gmaps-mobile-layer-sheet'), 'CSS must style .gmaps-mobile-layer-sheet');
    assert.ok(cssCode.includes('.mobile-layer-grid'), 'CSS must style .mobile-layer-grid with 3 columns');
    assert.ok(cssCode.includes('.mobile-layer-card-btn.active'), 'CSS must style active state with blue border/text');
    assert.ok(mapViewerCode.includes("gmaps-mobile-layer-sheet") && mapViewerCode.includes("autoCollapseLayerPanel"), 'MapViewer must auto-collapse mobile layer sheet on map pan/touch');
  });

  // 39. Layer Visibility Lexical Scoping & Defensive Gating
  await test('Layer Visibility Lexical Scoping & Defensive Gating: updateDamZoomGating in outer scope and defensive layer handlers', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

    // Verify updateDamZoomGating is NOT trapped inside initMap()
    const initMapStart = mapViewerCode.indexOf('function initMap()');
    const initMapEnd = mapViewerCode.indexOf('function renderGeoJSONLayers()');
    assert(initMapStart !== -1 && initMapEnd !== -1, 'initMap and renderGeoJSONLayers must exist');

    const initMapBody = mapViewerCode.substring(initMapStart, initMapEnd);
    assert(
      !initMapBody.includes('function updateDamZoomGating()'),
      'updateDamZoomGating must NOT be declared inside initMap(); it must be in outer createMapViewer scope'
    );

    // Verify updateDamZoomGating is declared before renderDamLayers
    assert(
      mapViewerCode.includes('function updateDamZoomGating()'),
      'updateDamZoomGating must be declared in createMapViewer scope'
    );

    // Verify defensive initialization in setLayerVisibility
    assert(
      mapViewerCode.includes("if (!mapInstance.getLayer('layer-traffic')) {\n        initTrafficLayer();\n      }"),
      'setLayerVisibility must defensively initialize traffic layer'
    );
    assert(
      mapViewerCode.includes("if (damMarkers.length === 0 && damsData && damsData.length > 0) {\n        renderDamLayers();\n      }"),
      'setLayerVisibility must defensively initialize dams layer'
    );
    assert(
      mapViewerCode.includes("if (!cachedNWPData) {\n        initNWPForecastLayers();\n      }"),
      'setLayerVisibility must defensively initialize NWP forecast layers'
    );
  });

  // 40. North Button & Dam Rule Curve Data Integrity
  await test('North Button & Dam Rule Curve Data Integrity: Compass control below layer panel and non-NaN Rule Curve outputs', async () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const { evaluateDamRuleCurve } = await import('../src/services/damRuleCurveService.js');

    // 1. Verify North Button exists in Navbar below layer panel
    assert.ok(navbarCode.includes('id="gmaps-btn-north"'), 'Navbar must include gmaps-btn-north');
    assert.ok(navbarCode.includes('gmaps-north-compass-icon'), 'Navbar must include gmaps-north-compass-icon');
    assert.ok(navbarCode.includes('id="gmaps-layer-panel-stack"'), 'Navbar must stack layer panel and north container');
    assert.ok(cssCode.includes('.gmaps-north-btn'), 'CSS must style .gmaps-north-btn');
    assert.ok(cssCode.includes('width: 32px;') && cssCode.includes('height: 32px;'), 'Desktop north btn must match zoom button 32px size');
    assert.ok(cssCode.includes('width: 38px;') && cssCode.includes('height: 38px;'), 'Mobile north btn must match mobile zoom button 38px size');

    // 2. Verify MapViewer exports resetNorth
    assert.ok(mapViewerCode.includes('resetNorth:'), 'MapViewer must export resetNorth');
    assert.ok(mapViewerCode.includes('mapInstance.rotateTo(0'), 'MapViewer resetNorth must rotateTo 0');

    // 3. Verify Rule Curve evaluates without NaN on Thai date strings
    const thaiDateDam = { name: 'เขื่อนภูมิพล', percentStorage: 65, date: '29 ก.ย. 2026 06:00 น.' };
    const rc = evaluateDamRuleCurve(thaiDateDam, thaiDateDam.date);
    assert.ok(rc, 'Rule Curve evaluation must not be null');
    assert.strictEqual(typeof rc.urcPercent, 'number', 'urcPercent must be number');
    assert.ok(!isNaN(rc.urcPercent), 'urcPercent must not be NaN');
    assert.strictEqual(typeof rc.lrcPercent, 'number', 'lrcPercent must be number');
    assert.ok(!isNaN(rc.lrcPercent), 'lrcPercent must not be NaN');
    assert.ok(!isNaN(rc.urcStorage), 'urcStorage must not be NaN');
    assert.ok(!isNaN(rc.lrcStorage), 'lrcStorage must not be NaN');
  });

  // 41. Mobile Basemap Flyout, Weather Pill Stacking & Traffy Fondue Pin Enlargement
  await test('Mobile Basemap Flyout, Weather Pill Stacking & Traffy Fondue Pin Enlargement', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

    // 1. Mobile basemap flyout to the right and hide header
    assert.ok(cssCode.includes('left: calc(100% + 8px);'), 'Mobile basemap flyout must position to the right');
    assert.ok(cssCode.includes('.gmaps-basemap-header') && cssCode.includes('display: none !important;'), 'Mobile basemap header must be hidden');

    // 2. Weather pill stacking above map data
    assert.ok(cssCode.includes('.gmaps-apple-weather-pill') && cssCode.includes('z-index: 60 !important;'), 'Weather pill must have elevated z-index: 60 !important');

    // 3. Traffy Fondue Pin Enlargement by 20% (28px * 1.2 = 33.6px -> 34px)
    assert.ok(cssCode.includes('.traffy-pin-inner') && cssCode.includes('width: 34px;'), 'Traffy pin inner width must be 34px');
    assert.ok(cssCode.includes('.traffy-fondue-pin-logo') && cssCode.includes('width: 34px;'), 'Traffy logo CSS width must be 34px');
    assert.ok(mapViewerCode.includes('class="traffy-fondue-pin-logo"') && mapViewerCode.includes('width="34" height="34"'), 'MapViewer must render Traffy pin img at 34x34');
  });

  // 42. Minimal DOH Highway Flood Pin, Basemap Stacking & Redesigned Cartographic Thumbnails
  await test('Minimal DOH Highway Flood Pin, Basemap Stacking & Redesigned Cartographic Thumbnails', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const traffyServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/traffyFondueService.js'), 'utf-8');

    // 1. Minimal DOH Highway Pin
    assert.ok(mapViewerCode.includes('doh-minimal-pin'), 'MapViewer must render doh-minimal-pin');
    assert.ok(mapViewerCode.includes('doh-minimal-tag'), 'MapViewer must render doh-minimal-tag');
    assert.ok(mapViewerCode.includes('doh-depth-label'), 'MapViewer must render doh-depth-label');
    assert.ok(cssCode.includes('.doh-minimal-pin'), 'CSS must style .doh-minimal-pin');
    assert.ok(cssCode.includes('.doh-minimal-tag'), 'CSS must style .doh-minimal-tag');

    // 2. Basemap Stacking above Bottom Legend Card on Click/Mouseover
    assert.ok(cssCode.includes('.gmaps-basemap-container:hover') && cssCode.includes('z-index: 85 !important;'), 'Basemap container must elevate to z-index 85 on hover/expanded');
    assert.ok(cssCode.includes('.gmaps-basemap-side-grid') && cssCode.includes('z-index: 90 !important;'), 'Basemap side grid must have z-index 90');

    // 3. Lower space reduction & Redesigned Satellite/Topo Cards
    assert.ok(cssCode.includes('padding: 6px 10px 4px 10px;'), 'Desktop side grid must have reduced lower space');
    assert.ok(cssCode.includes('.thumb-satellite') && cssCode.includes('rgba(255, 255, 255, 0.65)'), 'Satellite thumbnail must render atmospheric clouds and true orthophoto');
    assert.ok(cssCode.includes('.thumb-topo') && cssCode.includes('content: "▲";'), 'Topo thumbnail must render mountain peak summit symbol');

    // 4. Traffy Fondue Resilient Fallback
    assert.ok(traffyServiceCode.includes('realTraffySnapshot'), 'Traffy service must import real snapshot fallback');
    assert.ok(traffyServiceCode.includes('20000'), 'Traffy service must have resilient 20s timeout');
  });

  console.log(`\n🎉 Regression Tests Completed: ${passedTests} passed.\n`);
}

await runAllTests();
