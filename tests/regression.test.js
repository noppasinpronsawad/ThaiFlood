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
    if (weather) {
      assert(typeof weather.temp === 'number', 'Must return numeric temperature');
      assert(weather.weatherDesc, 'Must return weather description');
      assert(weather.icon, 'Must return weather icon');
    }
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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!insideStyle && line && line.includes('style: {')) {
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
    assert.ok(navbarCode.includes('traffy-layer-icon') || navbarCode.includes('minimal-road-layer-icon'), 'Navbar must render traffy layer icon');

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

  // 43. DOH Highway & Traffy Fondue Marker Clustering, Zoom Hierarchy, Tie-Breaker Majority Color, Expansion Zoom & Spiderfy
  await test('Marker Clustering, Zoom Hierarchy, Tie-Breaker Majority Color, Expansion Zoom & Spiderfy', async () => {
    const clusterService = await import(path.join(rootDir, 'src/services/markerClusterService.js'));
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const windLayerModule = await import(path.join(rootDir, 'src/components/WindFieldLayer.js'));

    // 1. Cluster Service Exports & Hierarchy
    assert.ok(typeof clusterService.clusterPointsByZoom === 'function', 'Must export clusterPointsByZoom');
    assert.ok(typeof clusterService.calculateSpiderfyOffsets === 'function', 'Must export calculateSpiderfyOffsets');
    assert.ok(typeof clusterService.computeDohClusterColor === 'function', 'Must export computeDohClusterColor');

    // 2. Strict Tie-Breaker Majority Color Rule: หากเท่ากันให้แสดงหมุดไอคอนสีแดง (#dc2626)
    const tieItems = [
      { properties: { passable: true } },
      { properties: { passable: false } }
    ];
    const tieRes = clusterService.computeDohClusterColor(tieItems);
    assert.strictEqual(tieRes.dominantColor, '#dc2626', 'Equal passable and impassable counts MUST result in Red (#dc2626)');
    assert.strictEqual(tieRes.dominantClass, 'impassable', 'Equal counts must have impassable class');

    const passMajority = [
      { properties: { passable: true } },
      { properties: { passable: true } },
      { properties: { passable: false } }
    ];
    const passRes = clusterService.computeDohClusterColor(passMajority);
    assert.strictEqual(passRes.dominantColor, '#ea580c', 'Passable majority must result in Orange (#ea580c)');

    const impassMajority = [
      { properties: { passable: false } },
      { properties: { passable: false } },
      { properties: { passable: true } }
    ];
    const impassRes = clusterService.computeDohClusterColor(impassMajority);
    assert.strictEqual(impassRes.dominantColor, '#dc2626', 'Impassable majority must result in Red (#dc2626)');

    // 3. Zoom-based Clustering Thresholds:
    // - Zoom < 7.0: ระดับภาค
    // - 7.0 <= Zoom < 9.5: รวมระดับจังหวัด
    // - Zoom >= 9.5: หมุดแต่ละจุด
    const mockPoints = [
      { properties: { province: 'พระนครศรีอยุธยา', passable: false }, geometry: { type: 'Point', coordinates: [100.56, 14.35] } },
      { properties: { province: 'พระนครศรีอยุธยา', passable: true }, geometry: { type: 'Point', coordinates: [100.57, 14.36] } },
      { properties: { province: 'เชียงใหม่', passable: false }, geometry: { type: 'Point', coordinates: [98.98, 18.79] } }
    ];

    const regClusters = clusterService.clusterPointsByZoom(mockPoints, 6.0, 'doh');
    assert.ok(regClusters.every(c => c.level === 'region'), 'Zoom < 7.0 must cluster at regional level (ระดับภาค)');
    assert.ok(regClusters.some(c => c.name === 'ภาคกลาง'), 'Must include ภาคกลาง');
    assert.ok(regClusters.some(c => c.name === 'ภาคเหนือ'), 'Must include ภาคเหนือ');

    const provClusters = clusterService.clusterPointsByZoom(mockPoints, 8.0, 'doh');
    assert.ok(provClusters.every(c => c.level === 'province'), '7.0 <= Zoom < 9.5 must cluster at provincial level (รวมระดับจังหวัด)');
    const ayuProv = provClusters.find(c => c.name === 'พระนครศรีอยุธยา');
    assert.ok(ayuProv, 'Must include พระนครศรีอยุธยา');
    assert.strictEqual(ayuProv.count, 2, 'Ayutthaya must combine 2 points');
    // In Ayutthaya: 1 passable, 1 impassable => tie-breaker = Red!
    assert.strictEqual(ayuProv.dohColor.dominantColor, '#dc2626', 'Ayutthaya equal points must use Red (#dc2626)');

    const indPins = clusterService.clusterPointsByZoom(mockPoints, 10.5, 'doh');
    assert.strictEqual(indPins.length, 3, 'Zoom >= 9.5 must show individual points (หมุดแต่ละจุด)');
    assert.ok(indPins.every(p => !p.isCluster), 'All pins at zoom >= 9.5 must not be clusters');

    // 4. Spiderfy Offsets
    const spiderOffsets = clusterService.calculateSpiderfyOffsets(4, 52);
    assert.strictEqual(spiderOffsets.length, 4, 'Must return 4 radial offsets for 4 overlapping items');
    assert.ok(spiderOffsets[0].radius >= 40, 'Spiderfy radius must be at least 40px');

    // 5. MapViewer & CSS Integration
    assert.ok(mapViewerCode.includes('doh-cluster-pin'), 'MapViewer must render doh-cluster-pin');
    assert.ok(mapViewerCode.includes('traffy-cluster-pin'), 'MapViewer must render traffy-cluster-pin');
    assert.ok(mapViewerCode.includes('handleClusterExpansionZoom'), 'MapViewer must implement handleClusterExpansionZoom');
    assert.ok(mapViewerCode.includes('spiderfyOverlappingPins'), 'MapViewer must implement spiderfyOverlappingPins');
    assert.ok(cssCode.includes('.doh-cluster-pin'), 'CSS must style .doh-cluster-pin');
    assert.ok(cssCode.includes('.traffy-cluster-pin'), 'CSS must style .traffy-cluster-pin');
    assert.ok(cssCode.includes('.spiderfy-spoke-line'), 'CSS must style .spiderfy-spoke-line');
    assert.ok(cssCode.includes('.spiderfy-center-dot'), 'CSS must style .spiderfy-center-dot');

    // 6. Windy Verification
    const windVec = windLayerModule.calculatePhysicalWindVector(13.75, 100.5);
    assert.ok(typeof windVec.speed === 'number' && windVec.speed > 0, 'Wind vector must have positive physical speed');
    assert.ok(typeof windVec.dirDeg === 'number' && windVec.dirDeg >= 0 && windVec.dirDeg <= 360, 'Wind direction must be in [0, 360]');
    const bInfo = windLayerModule.getBeaufortInfo(windVec.speed);
    assert.ok(bInfo.color && bInfo.label, 'Beaufort info must return color and label');
  });

  // 44. Direct Clean Map Initialization & Canvas Resize (No Cybernetic HUD)
  await test('TC-REG-44: Direct Clean Map Initialization & Canvas Resize (No Cybernetic HUD)', () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    assert.ok(!mainCode.includes('space-hud-overlay'), 'main.js must not render space-hud-overlay');
    assert.ok(!mainCode.includes('btn-skip-pov'), 'main.js must not render btn-skip-pov');
    assert.ok(mainCode.includes("window.dispatchEvent(new Event('resize'))"), 'Must trigger window resize immediately');
    assert.ok(mainCode.includes('appContainer.appendChild(mapViewer.element)'), 'Must mount map directly to container');
    assert.ok(mainCode.includes('runSpacePOVZoomAnimation'), 'Must trigger smooth camera zoom-in descent on download/load');
  });

  // 45. Space Station POV Camera Descent & Zoom-In Lifecycle (No HUD)
  await test('TC-REG-45: Space Station POV Camera Descent & Zoom-In Lifecycle (No HUD)', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('zoom: 1.6') || mapViewerCode.includes('zoom: 1.60'), 'Initial camera must start at Orbit zoom 1.6');
    assert.ok(mapViewerCode.includes('pitch: 52') || mapViewerCode.includes('pitch: 52.0'), 'Initial camera must start at pitch 52');
    assert.ok(mapViewerCode.includes('runSpacePOVZoomAnimation'), 'Must export runSpacePOVZoomAnimation');
  });

  // 46. CCTV & DOH Clean Cluster & Minimal Pin Styling (No cluster-qty text)
  await test('TC-REG-46: CCTV & DOH Clean Cluster & Minimal Pin Styling (No cluster-qty text)', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert.ok(!mapViewerCode.includes('doh-cluster-qty'), 'MapViewer must not include doh-cluster-qty');
    assert.ok(!mapViewerCode.includes('cctv-cluster-qty'), 'MapViewer must not include cctv-cluster-qty');
    assert.ok(mapViewerCode.includes('cctv-minimal-pin'), 'MapViewer must render cctv-minimal-pin');
    assert.ok(cssCode.includes('.cctv-minimal-pin'), 'CSS must style .cctv-minimal-pin');
    assert.ok(cssCode.includes('.cctv-cluster-pin'), 'CSS must style .cctv-cluster-pin');
  });

  // 47. Mobile Layer Grid Sync (GFS & Himawari & CCTV)
  await test('TC-REG-47: Mobile Layer Grid Sync (GFS & Himawari & CCTV)', () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes("id: 'gfs'"), 'MOBILE_LAYER_ITEMS must include gfs');
    assert.ok(navbarCode.includes("id: 'sat-clouds'"), 'MOBILE_LAYER_ITEMS must include sat-clouds');
    assert.ok(navbarCode.includes("id: 'cctv'"), 'MOBILE_LAYER_ITEMS must include cctv');
    assert.ok(navbarCode.includes('toggle-gfs'), 'Must sync with toggle-gfs');
    assert.ok(navbarCode.includes('toggle-sat-clouds'), 'Must sync with toggle-sat-clouds');
    assert.ok(navbarCode.includes('toggle-cctv'), 'Must sync with toggle-cctv');
  });

  // 48. Complete Removal of bma-roads
  await test('TC-REG-48: Complete Removal of bma-roads', () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(!navbarCode.includes('toggle-bma-roads'), 'Navbar must not contain toggle-bma-roads');
    assert.ok(!mainCode.includes('fetchLiveBmaRoadFloodGeoJSON'), 'main.js must not fetch BMA road flood');
    assert.ok(!mapViewerCode.includes("layerId === 'bma-roads'"), 'MapViewer setLayerVisibility must not reference bma-roads');
  });

  // 49. Legend Isolation to 5 Weather Layers
  await test('TC-REG-49: Legend Isolation to 5 Weather Layers', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const configMatch = mapViewerCode.match(/const LAYER_LEGEND_CONFIGS = \{([\s\S]*?)\n  \};/);
    assert.ok(configMatch, 'LAYER_LEGEND_CONFIGS must exist');
    const configBlock = configMatch[1];
    assert.ok(configBlock.includes("'ecmwf'"), 'Must contain ecmwf');
    assert.ok(configBlock.includes("'gfs'"), 'Must contain gfs');
    assert.ok(configBlock.includes("'sat-water'"), 'Must contain sat-water');
    assert.ok(configBlock.includes("'sat-clouds'"), 'Must contain sat-clouds');
    assert.ok(configBlock.includes("'wind-field'"), 'Must contain wind-field');
    assert.ok(!configBlock.includes("'doh-roads'"), 'Must NOT contain doh-roads in LAYER_LEGEND_CONFIGS');
    assert.ok(!configBlock.includes("'traffy-flood'"), 'Must NOT contain traffy-flood in LAYER_LEGEND_CONFIGS');
    assert.ok(!configBlock.includes("'cctv'"), 'Must NOT contain cctv in LAYER_LEGEND_CONFIGS');
  });

  // 50. CCTV GeoJSON & Marker Clustering
  await test('TC-REG-50: CCTV GeoJSON & Marker Clustering', async () => {
    const cctvService = await import(path.join(rootDir, 'src/services/cctvService.js'));
    const clusterService = await import(path.join(rootDir, 'src/services/markerClusterService.js'));
    assert.ok(typeof cctvService.getCctvGeoJSON === 'function', 'cctvService must export getCctvGeoJSON');
    const geo = await cctvService.getCctvGeoJSON();
    assert.ok(geo && geo.type === 'FeatureCollection', 'Must return valid GeoJSON FeatureCollection');
    assert.ok(Array.isArray(geo.features) && geo.features.length >= 10, 'Must have at least 10 authentic CCTV cameras');
    const cam = geo.features[0];
    assert.strictEqual(cam.geometry.type, 'Point', 'Geometry must be Point');
    assert.ok(cam.properties.id, 'Must have ID');
    assert.ok(cam.properties.snapshotUrl, 'Must have snapshot URL');
    assert.ok(cam.properties.agency, 'Must have agency');

    const regClusters = clusterService.clusterPointsByZoom(geo.features, 5.0, 'cctv');
    assert.ok(regClusters.every(c => c.level === 'region'), 'Zoom 5 must cluster at region level');
    const provClusters = clusterService.clusterPointsByZoom(geo.features, 8.0, 'cctv');
    assert.ok(provClusters.every(c => c.level === 'province'), 'Zoom 8 must cluster at province level');
    const pins = clusterService.clusterPointsByZoom(geo.features, 11.0, 'cctv');
    assert.ok(pins.every(p => !p.isCluster), 'Zoom 11 must return individual pins');

    // Verify Canal Snapping Accuracy for critical water gates
    const wangHinCam = geo.features.find(f => f.properties.id === 'bma-dds-204');
    assert.ok(wangHinCam, 'Must have Khlong Lat Phrao Wang Hin camera');
    assert.strictEqual(wangHinCam.geometry.coordinates[0], 100.5896, 'Wang Hin camera must snap to Khlong Lat Phrao lng 100.5896');
    assert.strictEqual(wangHinCam.geometry.coordinates[1], 13.8248, 'Wang Hin camera must snap to Khlong Lat Phrao lat 13.8248');

    const chulaCam = geo.features.find(f => f.properties.id === 'rid-cctv-303');
    assert.ok(chulaCam, 'Must have Chulalongkorn water gate camera');
    assert.strictEqual(chulaCam.geometry.coordinates[0], 100.6128, 'Chulalongkorn gate must snap to Phahonyothin/Rangsit canal lng 100.6128');
    assert.strictEqual(chulaCam.geometry.coordinates[1], 13.9858, 'Chulalongkorn gate must snap to Phahonyothin/Rangsit canal lat 13.9858');
  });

  // 51. CCTV Place Sheet Integration (renderCctvSheet)
  await test('TC-REG-51: CCTV Place Sheet Integration (renderCctvSheet)', () => {
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    assert.ok(stationListCode.includes('function renderCctvSheet()'), 'WaterStationList must implement renderCctvSheet');
    assert.ok(stationListCode.includes('selectCctv:'), 'WaterStationList must export selectCctv');
    assert.ok(mainCode.includes('placeSheetInstance.selectCctv(item)'), 'main.js must route isCctv to selectCctv');
    assert.ok(mainCode.includes('thaiflood:open-cctv-sheet'), 'main.js must handle thaiflood:open-cctv-sheet event');
  });

  // 52. Traffy Fondue Default OFF Integrity
  await test('TC-REG-52: Traffy Fondue Default OFF Integrity', () => {
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('let isTraffyFloodVisible = false'), 'Traffy visibility must default to false');
    assert.ok(!navbarCode.includes('id="toggle-traffy-flood" checked'), 'Toggle traffy flood must not have checked attribute by default');
  });

  // 53. Zero Mock Data Automated Static Analysis
  await test('TC-REG-53: Zero Mock Data Automated Static Analysis', () => {
    const filesToAudit = [
      'src/services/cctvService.js',
      'src/services/dohHighwayFloodService.js',
      'src/services/waterStationService.js',
      'src/services/damService.js',
      'src/services/traffyFondueService.js'
    ];
    filesToAudit.forEach((rel) => {
      const code = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
      assert.ok(!code.includes('Math.random() *'), `File ${rel} must not generate random fake data`);
      assert.ok(!code.includes('placeholder.com'), `File ${rel} must not use placeholder images`);
    });
  });

  // 54. Bilingual i18n & Language Switcher (TH/EN)
  await test('TC-REG-54: Bilingual i18n & Language Switcher (TH/EN)', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));
    assert.strictEqual(typeof i18n.getLanguage, 'function', 'Must export getLanguage');
    assert.strictEqual(typeof i18n.setLanguage, 'function', 'Must export setLanguage');
    assert.strictEqual(typeof i18n.t, 'function', 'Must export t');

    // Test Thai Translations
    i18n.setLanguage('th');
    assert.strictEqual(i18n.getLanguage(), 'th');
    assert.strictEqual(i18n.t('layer_flood_now'), 'น้ำท่วมปัจจุบัน');
    assert.strictEqual(i18n.t('basemap_street'), 'แผนที่');

    // Test English Translations
    i18n.setLanguage('en');
    assert.strictEqual(i18n.getLanguage(), 'en');
    assert.strictEqual(i18n.t('layer_flood_now'), 'Current Flood');
    assert.strictEqual(i18n.t('basemap_street'), 'Map');

    // Revert to th
    i18n.setLanguage('th');

    // Test Navbar markup
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('id="lang-toggle-container"'), 'Navbar must include lang-toggle-container');
    assert.ok(navbarCode.includes('id="btn-lang-th"'), 'Navbar must include btn-lang-th');
    assert.ok(navbarCode.includes('id="btn-lang-en"'), 'Navbar must include btn-lang-en');
    assert.ok(navbarCode.includes('updateNavbarLanguage'), 'Navbar must implement updateNavbarLanguage');
  });

  // 55. Edge Telemetry Ingestion Script & Scale Architecture
  await test('TC-REG-55: Edge Telemetry Ingestion Script & Scale Architecture', async () => {
    const scriptPath = path.join(rootDir, 'scripts/sync-telemetry.js');
    const workflowPath = path.join(rootDir, '.github/workflows/telemetry-sync.yml');
    assert.ok(fs.existsSync(scriptPath), 'Must have scripts/sync-telemetry.js');
    assert.ok(fs.existsSync(workflowPath), 'Must have .github/workflows/telemetry-sync.yml');

    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(workflowContent.includes('cron:'), 'Workflow must have cron schedule');
    assert.ok(workflowContent.includes('sync-telemetry.js'), 'Workflow must execute sync-telemetry.js');

    const metaPath = path.join(rootDir, 'public/api/meta.json');
    const stationsPath = path.join(rootDir, 'public/api/stations.json');

    // If cache files don't exist yet, run sync script to verify dynamic generation pipeline
    if (!fs.existsSync(metaPath) || !fs.existsSync(stationsPath)) {
      const { execSync } = await import('child_process');
      execSync('node scripts/sync-telemetry.js', { cwd: rootDir, stdio: 'pipe' });
    }

    // Verify generated public/api cache files
    assert.ok(fs.existsSync(metaPath), 'Must have generated public/api/meta.json');
    assert.ok(fs.existsSync(stationsPath), 'Must have generated public/api/stations.json');

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    assert.ok(meta.timestamp, 'Meta must contain timestamp');
    assert.ok(meta.stationsCount > 0, 'Meta must record positive station count');
  });

  // 56. Smart Telemetry Switching Logic (< 1 Hour Freshness & Direct Fallback)
  await test('TC-REG-56: Smart Telemetry Switching Logic (< 1 Hour Freshness & Direct Fallback)', async () => {
    const switchService = await import(path.join(rootDir, 'src/services/telemetrySwitchService.js'));
    assert.strictEqual(typeof switchService.isBotDataFresh, 'function');
    assert.strictEqual(typeof switchService.fetchWithSmartSwitching, 'function');

    // Verify service files wrap their loaders with fetchWithSmartSwitching
    const waterCode = fs.readFileSync(path.join(rootDir, 'src/services/waterStationService.js'), 'utf-8');
    const damCode = fs.readFileSync(path.join(rootDir, 'src/services/damService.js'), 'utf-8');
    const dohCode = fs.readFileSync(path.join(rootDir, 'src/services/dohHighwayFloodService.js'), 'utf-8');
    const cctvCode = fs.readFileSync(path.join(rootDir, 'src/services/cctvService.js'), 'utf-8');

    assert.ok(waterCode.includes("fetchWithSmartSwitching('stations'"), 'waterStationService must use smart switching');
    assert.ok(damCode.includes("fetchWithSmartSwitching('dams'"), 'damService must use smart switching');
    assert.ok(dohCode.includes("fetchWithSmartSwitching('doh-roads'"), 'dohHighwayFloodService must use smart switching');
    assert.ok(cctvCode.includes("fetchWithSmartSwitching('cctv'"), 'cctvService must use smart switching');
  });

  // 57. Comprehensive Bilingual Dynamic Fallback (EN with TH fallback)
  await test('TC-REG-57: Comprehensive Bilingual Dynamic Fallback (EN with TH fallback)', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));
    assert.strictEqual(typeof i18n.localizeName, 'function');
    assert.strictEqual(typeof i18n.localizeProvince, 'function');
    assert.strictEqual(typeof i18n.localizeBasin, 'function');

    const sampleBilingual = {
      name: 'เขื่อนภูมิพล',
      name_en: 'Bhumibol Dam',
      province: 'ตาก',
      province_en: 'Tak'
    };

    const sampleThaiOnly = {
      name: 'สถานีวัดน้ำคลองบางยอ',
      province: 'พื้นที่นิรนาม'
    };

    // Mode: English
    i18n.setLanguage('en');
    assert.strictEqual(i18n.localizeName(sampleBilingual), 'Bhumibol Dam');
    assert.strictEqual(i18n.localizeProvince(sampleBilingual), 'Tak');
    // Dictionary translation for known provinces without province_en
    assert.strictEqual(i18n.localizeProvince({ province: 'สมุทรปราการ' }), 'Samut Prakan');
    // Fallback: When English missing, must return Thai
    assert.strictEqual(i18n.localizeName(sampleThaiOnly), 'สถานีวัดน้ำคลองบางยอ');
    assert.strictEqual(i18n.localizeProvince(sampleThaiOnly), 'พื้นที่นิรนาม');

    // Mode: Thai
    i18n.setLanguage('th');
    assert.strictEqual(i18n.localizeName(sampleBilingual), 'เขื่อนภูมิพล');
    assert.strictEqual(i18n.localizeProvince(sampleBilingual), 'ตาก');
    assert.strictEqual(i18n.localizeName(sampleThaiOnly), 'สถานีวัดน้ำคลองบางยอ');
  });

  // 58. Daily Compressed Gzip Archive Integrity
  await test('TC-REG-58: Daily Compressed Gzip Archive Integrity', async () => {
    const zlib = await import('zlib');
    const archiveDir = path.join(rootDir, 'public/archive');
    assert.ok(fs.existsSync(archiveDir), 'public/archive must exist');

    const files = fs.readdirSync(archiveDir).filter((f) => f.endsWith('.json.gz'));
    assert.ok(files.length > 0, 'Must contain at least 1 daily .json.gz archive');

    const latestArchive = path.join(archiveDir, files[0]);
    const rawBuffer = fs.readFileSync(latestArchive);
    assert.ok(rawBuffer.length > 0, 'Archive file must not be empty');

    const decompressed = zlib.gunzipSync(rawBuffer);
    const parsed = JSON.parse(decompressed.toString('utf-8'));
    assert.ok(parsed.date, 'Archive must have date');
    assert.ok(Array.isArray(parsed.stations), 'Archive must contain stations array');
    assert.ok(Array.isArray(parsed.dams), 'Archive must contain dams array');
    assert.ok(parsed.dohRoads && parsed.dohRoads.features, 'Archive must contain dohRoads GeoJSON');
    assert.ok(parsed.cctv && parsed.cctv.features, 'Archive must contain cctv GeoJSON');
  });

  // 59. Static Layer Toggles Bilingual Text & Description Check (TH/EN)
  await test('TC-REG-59: Static Layer Toggles Bilingual Text & Description Check (TH/EN)', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');

    // Test Thai Translations for all static toggle items
    i18n.setLanguage('th');
    assert.strictEqual(i18n.t('layer_flow_direction'), 'ทิศทางน้ำไหล');
    assert.strictEqual(i18n.t('layer_flow_direction_desc'), 'ลูกศรเวกเตอร์ทิศทางกระแสน้ำ');
    assert.strictEqual(i18n.t('layer_stations'), 'สถานีวัดระดับน้ำ');
    assert.strictEqual(i18n.t('layer_geology'), 'ธรณีวิทยา (DMR 1:250k)');
    assert.strictEqual(i18n.t('layer_sat_clouds'), 'ดาวเทียมเมฆ (Himawari-9)');
    assert.strictEqual(i18n.t('layer_gfs'), 'แบบจำลอง GFS (NOAA)');
    assert.strictEqual(i18n.t('layer_ecmwf'), 'แบบจำลอง ECMWF IFS');
    assert.strictEqual(i18n.t('layer_wind_field'), 'กระแสลมผิวพื้น 10 ม.');

    // Test English Translations for all static toggle items
    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('layer_flow_direction'), 'Water Flow Direction');
    assert.strictEqual(i18n.t('layer_flow_direction_desc'), 'River current flow vector arrows');
    assert.strictEqual(i18n.t('layer_stations'), 'Water Telemetry Stations');
    assert.strictEqual(i18n.t('layer_geology'), 'DMR Geology (1:250k)');
    assert.strictEqual(i18n.t('layer_sat_clouds'), 'Satellite Clouds (Himawari-9)');
    assert.strictEqual(i18n.t('layer_gfs'), 'GFS Model (NOAA)');
    assert.strictEqual(i18n.t('layer_ecmwf'), 'ECMWF IFS Model');
    assert.strictEqual(i18n.t('layer_wind_field'), 'Surface Wind Field (10m)');

    // Revert to th
    i18n.setLanguage('th');

    // Verify Navbar binds all toggles
    assert.ok(navbarCode.includes('toggle-flow-direction'), 'Navbar must bind toggle-flow-direction');
    assert.ok(navbarCode.includes('toggle-stations'), 'Navbar must bind toggle-stations');
    assert.ok(navbarCode.includes('toggle-dmr-geology'), 'Navbar must bind toggle-dmr-geology');
    assert.ok(navbarCode.includes('toggle-sat-clouds'), 'Navbar must bind toggle-sat-clouds');
    assert.ok(navbarCode.includes('toggle-gfs'), 'Navbar must bind toggle-gfs');
    assert.ok(navbarCode.includes('toggle-ecmwf'), 'Navbar must bind toggle-ecmwf');
    assert.ok(navbarCode.includes('toggle-wind-field'), 'Navbar must bind toggle-wind-field');
  });

  // 60. Uniform Layer Icon Box Alignment (Current Flood, 7-Day Risk, Flow Direction, etc.)
  await test('TC-REG-60: Uniform Layer Icon Box Alignment (Current Flood, 7-Day Risk, Flow Direction, etc.)', () => {
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');

    // CSS must define .layer-icon-box with fixed 22x22 dimensions and centered flex layout
    assert.ok(cssCode.includes('.layer-icon-box'), 'CSS must define .layer-icon-box');
    assert.ok(cssCode.includes('width: 22px'), 'layer-icon-box must have width: 22px');
    assert.ok(cssCode.includes('height: 22px'), 'layer-icon-box must have height: 22px');
    assert.ok(cssCode.includes('flex-shrink: 0'), 'layer-icon-box must prevent shrinking with flex-shrink: 0');

    // All 15 layer toggles in Navbar must wrap their icons in .layer-icon-box
    const togglesToCheck = [
      'toggle-flood-now',
      'toggle-forecast-7d',
      'toggle-dams',
      'toggle-flow-direction',
      'toggle-stations',
      'toggle-dmr-geology',
      'toggle-sat-water',
      'toggle-sat-clouds',
      'toggle-wind-field',
      'toggle-gfs',
      'toggle-ecmwf',
      'toggle-traffic',
      'toggle-doh-roads',
      'toggle-cctv',
      'toggle-traffy-flood'
    ];

    togglesToCheck.forEach((toggleId) => {
      const regex = new RegExp(`for="${toggleId}"[\\s\\S]*?<span class="layer-icon-box">`, 'i');
      assert.ok(regex.test(navbarCode), `Toggle ${toggleId} must contain <span class="layer-icon-box">`);
    });
  });

  // 61. International Measurement Units & Dynamic Unit Formatter (TH/EN)
  await test('TC-REG-61: International Measurement Units & Dynamic Unit Formatter (TH/EN)', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));

    // English international units
    assert.strictEqual(i18n.formatUnit(12.5, 'm_msl', 'en'), '12.5 m MSL');
    assert.strictEqual(i18n.formatUnit(50, 'million_m3', 'en'), '50 Million m³');
    assert.strictEqual(i18n.formatUnit(120, 'm3_s', 'en'), '120 m³/s');
    assert.strictEqual(i18n.formatUnit(35, 'kmh', 'en'), '35 km/h');
    assert.strictEqual(i18n.formatUnit(28, 'celsius', 'en'), '28°C');
    assert.strictEqual(i18n.formatUnit(15.2, 'mm', 'en'), '15.2 mm');
    assert.strictEqual(i18n.formatUnit(2.5, 'm', 'en'), '2.5 m');
    assert.strictEqual(i18n.formatUnit(10, 'cm', 'en'), '10 cm');
    assert.strictEqual(i18n.formatUnit(5, 'km', 'en'), '5 km');

    // Thai localized units
    assert.strictEqual(i18n.formatUnit(12.5, 'm_msl', 'th'), '12.5 ม. (รทก.)');
    assert.strictEqual(i18n.formatUnit(50, 'million_m3', 'th'), '50 ล้าน ลบ.ม.');
    assert.strictEqual(i18n.formatUnit(120, 'm3_s', 'th'), '120 ลบ.ม./วินาที');
    assert.strictEqual(i18n.formatUnit(35, 'kmh', 'th'), '35 กม./ชม.');
    assert.strictEqual(i18n.formatUnit(28, 'celsius', 'th'), '28°C');
    assert.strictEqual(i18n.formatUnit(15.2, 'mm', 'th'), '15.2 มม.');
    assert.strictEqual(i18n.formatUnit(2.5, 'm', 'th'), '2.5 ม.');
    assert.strictEqual(i18n.formatUnit(10, 'cm', 'th'), '10 ซม.');
    assert.strictEqual(i18n.formatUnit(5, 'km', 'th'), '5 กม.');
  });

  // 62. Place Sheet & Apple Weather Pill Dual-Language with Thai Fallback
  await test('TC-REG-62: Place Sheet & Apple Weather Pill Dual-Language with Thai Fallback', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');

    // Apple Weather Pill bilingual handling in MapViewer
    assert.ok(mapViewerCode.includes('currentProvinceWeatherData'), 'MapViewer must retain currentProvinceWeatherData');
    assert.ok(mapViewerCode.includes('updateWeatherPillLanguage'), 'MapViewer must implement updateWeatherPillLanguage');
    assert.ok(mapViewerCode.includes('gmaps-apple-weather-pill'), 'MapViewer must reference #gmaps-apple-weather-pill');

    // Agency localization with English & fallback
    i18n.setLanguage('en');
    assert.strictEqual(i18n.localizeAgency('สสน.'), 'HII');
    assert.strictEqual(i18n.localizeAgency('กรมชลประทาน'), 'RID (Royal Irrigation Department)');
    assert.strictEqual(i18n.localizeAgency('หน่วยงานไม่รู้จัก'), 'หน่วยงานไม่รู้จัก'); // Thai Fallback

    // Basin localization with English & fallback
    assert.strictEqual(i18n.localizeBasin('เจ้าพระยา'), 'Chao Phraya');
    assert.strictEqual(i18n.localizeBasin('ลุ่มน้ำทดสอบ'), 'ลุ่มน้ำทดสอบ'); // Thai Fallback

    i18n.setLanguage('th');

    // Place sheet code integration
    assert.ok(stationListCode.includes('formatUnit('), 'WaterStationList must call formatUnit');
    assert.ok(stationListCode.includes('localizeDateTime('), 'WaterStationList must call localizeDateTime');
    assert.ok(stationListCode.includes('renderDamSheet'), 'WaterStationList must have renderDamSheet');
    assert.ok(stationListCode.includes('renderCctvSheet'), 'WaterStationList must have renderCctvSheet');
    assert.ok(stationListCode.includes('renderDohRoadSheet'), 'WaterStationList must have renderDohRoadSheet');
    assert.ok(stationListCode.includes('renderTraffySheet'), 'WaterStationList must have renderTraffySheet');
  });

  // 63. Common Era (CE / ค.ศ.) Date Formatting Enforcement (Zero +543)
  await test('TC-REG-63: Common Era (CE / ค.ศ.) Date Formatting Enforcement (Zero +543)', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));

    const testDate = new Date('2026-10-12T14:30:00Z');
    const formattedEn = i18n.formatDateTimeCE(testDate, 'en');
    const formattedTh = i18n.formatDateTimeCE(testDate, 'th');

    assert.ok(formattedEn.includes('2026'), 'English format must use 2026 CE year');
    assert.ok(!formattedEn.includes('2569'), 'English format must not use 2569');
    assert.ok(formattedTh.includes('2026'), 'Thai format must use 2026 CE year');
    assert.ok(!formattedTh.includes('2569'), 'Thai format must not use 2569');

    // Legacy date string sanitizer
    i18n.setLanguage('en');
    const sanitizedEn = i18n.localizeDateTime('12 ต.ค. 2569 14:30 น.');
    assert.ok(sanitizedEn.includes('2026'), 'localizeDateTime must sanitize 2569 to 2026 in EN mode');
    assert.ok(!sanitizedEn.includes('2569'), 'localizeDateTime must remove 2569');
    assert.ok(sanitizedEn.includes('Oct'), 'localizeDateTime must translate month to English');

    i18n.setLanguage('th');
    const sanitizedTh = i18n.localizeDateTime('12 ต.ค. 2569 14:30 น.');
    assert.ok(sanitizedTh.includes('2026'), 'localizeDateTime must sanitize 2569 to 2026 in TH mode');
    assert.ok(!sanitizedTh.includes('2569'), 'localizeDateTime must remove 2569 in TH mode');

    // Static code inspection across services for zero +543
    const filesToAudit = [
      'src/services/waterStationService.js',
      'src/services/damService.js',
      'src/services/traffyFondueService.js',
      'src/services/dohHighwayFloodService.js'
    ];

    filesToAudit.forEach((rel) => {
      const code = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
      assert.ok(!code.includes('+ 543') && !code.includes('+543'), `Service file ${rel} must NOT contain + 543 or +543`);
    });
  });

  // 64. Comprehensive Phase 2 Static i18n & 'Map' Basemap Verification
  await test('TC-REG-64: Comprehensive Phase 2 Static i18n & "Map" Basemap Verification', async () => {
    const i18n = await import(path.join(rootDir, 'src/services/i18nService.js'));
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');

    // 1. BaseMap street label in EN must be strictly 'Map'
    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('basemap_street'), 'Map', 'Basemap street label in EN must be strictly "Map"');

    // 2. Layer panel toggle button labels in EN & TH
    assert.strictEqual(i18n.t('layer_menu_show'), 'Show');
    assert.strictEqual(i18n.t('layer_menu_hide'), 'Hide');
    i18n.setLanguage('th');
    assert.strictEqual(i18n.t('layer_menu_show'), 'แสดง');
    assert.strictEqual(i18n.t('layer_menu_hide'), 'ซ่อน');

    // 3. Pin labels & Region / Province Localization
    i18n.setLanguage('en');
    assert.strictEqual(i18n.localizeRegion('ภาคเหนือ'), 'Northern Region');
    assert.strictEqual(i18n.localizeRegion('ภาคกลาง'), 'Central Region');
    assert.strictEqual(i18n.localizeRegion('ภาคตะวันออกเฉียงเหนือ'), 'Northeastern Region');
    assert.strictEqual(i18n.localizeRegion('ภาคใต้'), 'Southern Region');
    assert.strictEqual(i18n.localizeProvince('พระนครศรีอยุธยา'), 'Phra Nakhon Si Ayutthaya');
    assert.strictEqual(i18n.localizeName({ name: 'เขื่อนภูมิพล' }), 'ภูมิพล Dam');
    assert.strictEqual(i18n.localizeName({ name: 'อ่างเก็บน้ำห้วยหลวง' }), 'ห้วยหลวง Reservoir');

    // 4. Legend bilingual keys (Wind legend, DEM badge, Weather float bar)
    assert.strictEqual(i18n.t('wind_legend_title'), '10m Surface Wind Vectors (WMO Scale)');
    assert.strictEqual(i18n.t('wind_legend_calm'), '0 (Calm)');
    assert.strictEqual(i18n.t('dem_desc_basin'), 'Low-lying Basin / Flood Retarding Basin (High flood vulnerability)');
    assert.ok(mapViewerCode.includes('updateWindLegendUI'), 'MapViewer must include updateWindLegendUI');
    assert.ok(mapViewerCode.includes('updateBottomLegendBar'), 'MapViewer must include updateBottomLegendBar');
    assert.ok(mapViewerCode.includes('updateBasemapSwitcherCards'), 'MapViewer must include updateBasemapSwitcherCards');

    // 5. Toast notifications in EN & TH
    const toastKeys = [
      'toast_layer_flow',
      'toast_layer_stations',
      'toast_layer_cctv',
      'toast_layer_doh',
      'toast_layer_traffy',
      'toast_layer_traffic',
      'toast_layer_wind',
      'toast_north_reset',
      'toast_3d_on',
      'toast_3d_off'
    ];
    toastKeys.forEach((k) => {
      i18n.setLanguage('en');
      const enVal = i18n.t(k);
      assert.ok(enVal && enVal !== k, `EN key ${k} must exist and not equal fallback`);
      i18n.setLanguage('th');
      const thVal = i18n.t(k);
      assert.ok(thVal && thVal !== k, `TH key ${k} must exist and not equal fallback`);
    });

    // 6. Alert drawer static labels
    i18n.setLanguage('en');
    assert.strictEqual(i18n.t('alerts_datetime_label'), 'As of:');
    assert.strictEqual(i18n.t('alerts_fly_btn'), '📍 View on Map');
    assert.strictEqual(i18n.t('alerts_prov_prefix'), 'Prov.');
    assert.strictEqual(i18n.t('alerts_river_prefix'), 'River');
    assert.strictEqual(i18n.t('alerts_basin_prefix'), 'Basin');
    assert.strictEqual(i18n.t('alerts_empty_title'), 'No stations or roads currently in critical condition');
    assert.ok(navbarCode.includes('renderAlertCardHTML'), 'Navbar must include renderAlertCardHTML');
    assert.ok(navbarCode.includes('buildAlertItems'), 'Navbar must include buildAlertItems');

    // 7. Rule curve card bilingual texts (zoneLabelEn, adviceEn, 3-zone tooltips)
    assert.ok(stationListCode.includes('rc.zoneLabelEn || rc.zoneLabel'), 'WaterStationList must display zoneLabelEn when available');
    assert.ok(stationListCode.includes('rc.adviceEn || rc.advice'), 'WaterStationList must display adviceEn when available');
    assert.strictEqual(i18n.t('rc_gauge_low'), 'Low Water Zone (Below LRC): 0 - {lrc}%');
    assert.strictEqual(i18n.t('rc_gauge_normal'), 'Normal Control Zone (LRC - URC): {lrc}% - {urc}%');
    assert.strictEqual(i18n.t('rc_gauge_high'), 'Spill Risk Zone (Above URC): {urc}% - 100%');

    // Revert to th
    i18n.setLanguage('th');
  });

  // 65. TC-REG-65: Immediate "Show" Toggle, NWP English Dates, Immediate Reactive Pins & DMR Geology Sheet
  await test('TC-REG-65: Immediate "Show" Toggle, NWP English Dates, Immediate Reactive Pins & DMR Geology Sheet', async () => {
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    const stationListCode = fs.readFileSync(path.join(rootDir, 'src/components/WaterStationList.js'), 'utf-8');
    const { getFallbackNWPData } = await import('../src/services/nwpForecastService.js');

    // 1. Layer panel toggle button must target .toggle-btn-text and .toggle-btn-arrow, NOT span:last-child
    assert.ok(navbarCode.includes("togglePanelBtn.querySelector('.toggle-btn-text')"), 'Navbar must target .toggle-btn-text');
    assert.ok(navbarCode.includes("togglePanelBtn.querySelector('.toggle-btn-arrow')"), 'Navbar must target .toggle-btn-arrow');
    assert.ok(!navbarCode.includes("togglePanelBtn.querySelector('span:last-child')"), 'Navbar must not use span:last-child for togglePanelBtn');

    // 2. NWP Service must export displayDateEn and dayLabelEn
    const nwpData = getFallbackNWPData();
    assert.ok(Array.isArray(nwpData) && nwpData.length > 0, 'NWP fallback data must be non-empty');
    const firstForecast = nwpData[0].dailyForecasts[0];
    assert.ok(firstForecast.displayDateEn, 'NWP forecast must have displayDateEn');
    assert.strictEqual(firstForecast.dayLabelEn, 'Today', 'NWP forecast day 0 must have dayLabelEn = Today');

    // MapViewer bottom legend must use localized dateStr
    assert.ok(mapViewerCode.includes('disp = isEn ? (f.displayDateEn || f.displayDate) : f.displayDate'), 'MapViewer must use displayDateEn');
    assert.ok(mapViewerCode.includes('dLbl = isEn ? (f.dayLabelEn || f.dayLabel) : f.dayLabel'), 'MapViewer must use dayLabelEn');

    // 3. MapViewer dam marker separation and reactive pins update on language change
    assert.ok(mapViewerCode.includes('function updateDamMarkers()'), 'MapViewer must have separate updateDamMarkers function');
    assert.ok(mapViewerCode.includes("!mapInstance.getSource('thai-reservoirs')"), 'MapViewer must check existing thai-reservoirs source');
    assert.ok(mapViewerCode.includes('updateDamMarkers()'), 'Language changed listener must call updateDamMarkers');
    assert.ok(mapViewerCode.includes('updateDOHHighwayMarkers()'), 'Language changed listener must call updateDOHHighwayMarkers');
    assert.ok(mapViewerCode.includes('updateTraffyFloodMarkers()'), 'Language changed listener must call updateTraffyFloodMarkers');
    assert.ok(mapViewerCode.includes('updateCctvMarkers()'), 'Language changed listener must call updateCctvMarkers');

    // 4. DMR Geology layer must route to renderGeologySheet and avoid water telemetry UI
    assert.ok(stationListCode.includes('renderGeologySheet'), 'WaterStationList must have renderGeologySheet');
    assert.ok(stationListCode.includes('currentItem.isGeology'), 'WaterStationList must route isGeology');
    assert.ok(stationListCode.includes('selectGeology'), 'WaterStationList must provide selectGeology method');
    assert.ok(mapViewerCode.includes('isGeology: true'), 'MapViewer geology click handler must pass isGeology: true');
  });

  // 66. Continuous Meteorological Raster Field, Live Wind Vectors, and TMD Data Accuracy Standards
  await test('TC-REG-66: Continuous Meteorological Raster Field, Live Wind Vectors, and TMD Data Accuracy Standards', async () => {
    const { 
      generateContinuousWeatherRaster, 
      getNWPValueAtCoordinate, 
      getTmdRainColorRgba, 
      interpolateNWPContinuousValue,
      fetchNWPModelData,
      NWP_RASTER_BOUNDS 
    } = await import('../src/services/nwpForecastService.js');
    const { setLiveWindData, calculateLiveWindVector } = await import('../src/components/WindFieldLayer.js');

    // 1. Strict TMD / WMO Rain Color Scale
    const zeroRainRgba = getTmdRainColorRgba(0.0);
    assert.deepStrictEqual(zeroRainRgba, [0, 0, 0, 0], '0mm rain must be 100% transparent (no false color)');

    const lightRainRgba = getTmdRainColorRgba(5.0);
    assert.ok(lightRainRgba[3] > 0, 'Light rain must have non-zero alpha');
    assert.ok(lightRainRgba[0] < lightRainRgba[2], 'Light rain must have cyan/blue dominance');

    const moderateRainRgba = getTmdRainColorRgba(20.0);
    assert.ok(moderateRainRgba[1] > 100, 'Moderate rain must have green dominance');

    const heavyRainRgba = getTmdRainColorRgba(50.0);
    assert.ok(heavyRainRgba[0] > 200, 'Heavy rain must have orange/red dominance');

    const extremeRainRgba = getTmdRainColorRgba(110.0);
    assert.ok(extremeRainRgba[0] > 100 && extremeRainRgba[2] > 50, 'Extreme rain must have crimson/purple dominance');

    // 2. NWP Bounds check
    assert.strictEqual(NWP_RASTER_BOUNDS.length, 4, 'Must define 4 corner coordinates');
    assert.deepStrictEqual(NWP_RASTER_BOUNDS[0], [96.5, 21.0], 'NW coordinate matches Thailand bounds');

    // 3. Live NWP data fetch and continuous interpolation
    const nwpData = await fetchNWPModelData();
    const spot = interpolateNWPContinuousValue(nwpData, 13.75, 100.5, 0, 'ecmwf');
    assert.ok(typeof spot.rainMm === 'number', 'Interpolated rainMm must be a number');
    assert.ok(typeof spot.rainProb === 'number', 'Interpolated rainProb must be a number');

    const spotInspect = getNWPValueAtCoordinate(nwpData, 13.75, 100.5, 0, 'ecmwf');
    assert.ok(spotInspect.closestNodeName, 'Must identify closest node name');
    assert.ok(spotInspect.severity, 'Must include TMD severity');

    // 4. Live Wind Vector verification
    setLiveWindData(nwpData);
    const liveWind = calculateLiveWindVector(13.75, 100.5);
    assert.ok(typeof liveWind.speed === 'number' && liveWind.speed > 0, 'Live wind must return positive speed');
    assert.ok(liveWind.dirDeg >= 0 && liveWind.dirDeg <= 360, 'Live wind must have valid direction');

    // 5. MapViewer continuous raster sources and wireframe elimination
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
    assert.ok(mapViewerCode.includes('thai-ecmwf-raster'), 'MapViewer must include thai-ecmwf-raster image source');
    assert.ok(mapViewerCode.includes('layer-ecmwf-raster'), 'MapViewer must include layer-ecmwf-raster layer');
    assert.ok(mapViewerCode.includes('thai-gfs-raster'), 'MapViewer must include thai-gfs-raster image source');
    assert.ok(mapViewerCode.includes('layer-gfs-raster'), 'MapViewer must include layer-gfs-raster layer');
    assert.ok(mapViewerCode.includes("line-opacity': 0"), 'MapViewer must set stroke line-opacity to 0 to eliminate wireframes');
  });

  // 67. Statistics Dashboard, 4-Field Health Schema, and Max 30-Day Batch Download
  await test('TC-REG-67: Statistics Dashboard, 4-Field Health Schema, and Max 30-Day Batch Download', async () => {
    // 1. Meta JSON 4-field structure verification
    const metaPath = path.join(rootDir, 'public/api/meta.json');
    const archiveIndexPath = path.join(rootDir, 'public/api/archive-index.json');
    if (!fs.existsSync(metaPath) || !fs.existsSync(archiveIndexPath)) {
      const { execSync } = await import('child_process');
      execSync('node scripts/sync-telemetry.js', { cwd: rootDir, stdio: 'pipe' });
    }
    assert.ok(fs.existsSync(metaPath), 'meta.json must exist');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    assert.ok(meta.services, 'meta.json must have services object');

    const expectedServices = ['stations', 'dams', 'dohRoads', 'cctv', 'openMeteo', 'traffy', 'tmdRadar'];
    expectedServices.forEach(sKey => {
      const s = meta.services[sKey];
      assert.ok(s, `meta.services must track ${sKey}`);
      assert.ok(s.status === 'UP' || s.status === 'DOWN', `${sKey} status must be UP or DOWN`);
      assert.ok(s.lastAttempt, `${sKey} must have lastAttempt timestamp`);
      assert.ok(s.lastSuccess, `${sKey} must have lastSuccess timestamp`);
      assert.ok(typeof s.count === 'number', `${sKey} count must be a number`);
    });

    // 2. Archive index verification
    assert.ok(fs.existsSync(archiveIndexPath), 'archive-index.json must exist');
    const archiveIndex = JSON.parse(fs.readFileSync(archiveIndexPath, 'utf-8'));
    assert.ok(Array.isArray(archiveIndex), 'archive-index.json must be an array');
    assert.ok(archiveIndex.length > 0, 'archive-index.json must have indexed archives');
    assert.ok(archiveIndex[0].filename && archiveIndex[0].date && archiveIndex[0].sizeBytes, 'Index items must have filename, date, and sizeBytes');

    // 3. Navbar Statistics button in Data Sources verification
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    assert.ok(navbarCode.includes('btn-open-statistics'), 'Navbar must contain btn-open-statistics');
    assert.ok(navbarCode.includes('source-statistics-card'), 'Navbar must style source-statistics-card');
    assert.ok(navbarCode.includes('onNavigateToStatistics'), 'createNavbar must accept onNavigateToStatistics callback');

    // 4. Main.js SPA route handling
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    assert.ok(mainCode.includes('/statistics'), 'main.js must handle /statistics route');
    assert.ok(mainCode.includes('showStatisticsView'), 'main.js must implement showStatisticsView');
    assert.ok(mainCode.includes('showMapView'), 'main.js must implement showMapView');
    assert.ok(mainCode.includes('popstate'), 'main.js must listen to popstate event');

    // 5. StatisticsView Component verification
    const statsViewCode = fs.readFileSync(path.join(rootDir, 'src/components/StatisticsView.js'), 'utf-8');
    assert.ok(statsViewCode.includes('createStatisticsView'), 'StatisticsView.js must export createStatisticsView');
    assert.ok(statsViewCode.includes('fflate'), 'StatisticsView.js must import fflate for client zipping');
    assert.ok(statsViewCode.includes('diffDays > 30'), 'StatisticsView.js must enforce 30-day limit');
    assert.ok(statsViewCode.includes('getYesterdayDate'), 'StatisticsView.js must default to yesterday');
    assert.ok(statsViewCode.includes('thaiflood-telemetry'), 'StatisticsView.js must trigger zip download');
    assert.ok(statsViewCode.includes('verifyAdminSecret'), 'StatisticsView.js must implement verifyAdminSecret');
    assert.ok(statsViewCode.includes('ADMIN_AUTH_DIGEST'), 'StatisticsView.js must enforce salted SHA-256 hash verification');
    assert.ok(statsViewCode.includes('promptAdminAuth'), 'StatisticsView.js must include promptAdminAuth');
    assert.ok(statsViewCode.includes('renderStandbyTable'), 'StatisticsView.js must implement renderStandbyTable for normal visits');

    // 6. CSS Styles verification
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    assert.ok(cssCode.includes('.tf-stats-layout'), 'index.css must style .tf-stats-layout');
    assert.ok(cssCode.includes('.btn-statistics-link'), 'index.css must style .btn-statistics-link');
    assert.ok(cssCode.includes('.tf-stats-table'), 'index.css must style .tf-stats-table');
    assert.ok(cssCode.includes('.tf-btn-download-zip'), 'index.css must style .tf-btn-download-zip');
    assert.ok(cssCode.includes('.tf-modal-backdrop'), 'index.css must style .tf-modal-backdrop');
    assert.ok(cssCode.includes('.tf-admin-pass-input'), 'index.css must style .tf-admin-pass-input');
  });

  // 68. Zoom-Only Map Isolation, Traffy Fondue Rebranding & 3-Tier Zoom-Based Clustering
  await test('TC-REG-68: Zoom-Only Map Isolation, Traffy Fondue Rebranding & 3-Tier Zoom-Based Clustering', async () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');
    const i18nModule = await import(path.join(rootDir, 'src/services/i18nService.js'));
    const navbarCode = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.js'), 'utf-8');
    const clusterService = await import(path.join(rootDir, 'src/services/markerClusterService.js'));
    const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

    // 1. Zoom Isolation on UI Overlays
    assert.ok(mainCode.includes('gesturestart'), 'main.js must prevent gesturestart');
    assert.ok(mainCode.includes('gesturechange'), 'main.js must prevent gesturechange');
    assert.ok(mainCode.includes('gestureend'), 'main.js must prevent gestureend');
    assert.ok(mainCode.includes('e.ctrlKey'), 'main.js must intercept ctrlKey wheel events');
    assert.ok(mainCode.includes('touches.length > 1'), 'main.js must intercept multi-touch touches on UI overlays');
    assert.ok(mainCode.includes('lastTouchEnd'), 'main.js must prevent double-tap zoom on non-map UI');
    assert.ok(cssCode.includes('touch-action: pan-y;'), 'index.css must specify touch-action: pan-y on place sheet');
    assert.ok(cssCode.includes('overscroll-behavior: contain;'), 'index.css must contain overscroll on place sheet');
    assert.ok(cssCode.includes('touch-action: none;'), 'index.css must specify touch-action: none on disclaimer pill');

    // 2. Traffy Fondue Rebranding
    assert.ok(navbarCode.includes('รับแจ้งเรื่อง Traffy Fondue (กทม.)'), 'Navbar must show new Traffy title');
    assert.ok(navbarCode.includes('รับแจ้งเรื่องร้องเรียนจากประชาชน สวทช. / กทม. (ทุกประเภทปัญหา)'), 'Navbar must show new Traffy description');
    assert.ok(navbarCode.includes('ดำเนินการเสร็จสิ้น / แก้ไขแล้ว'), 'Navbar legend must show แก้ไขแล้ว');
    assert.strictEqual(i18nModule.TRANSLATIONS.th.layer_traffy, 'รับแจ้งเรื่อง Traffy Fondue (กทม.)', 'Thai layer_traffy must match');
    assert.strictEqual(i18nModule.TRANSLATIONS.en.layer_traffy, 'Traffy Fondue Citizen Reports (BMA)', 'English layer_traffy must match');
    assert.strictEqual(i18nModule.TRANSLATIONS.th.legend_traffy_resolved, '🟢 ดำเนินการเสร็จสิ้น / แก้ไขแล้ว', 'Thai legend_traffy_resolved must match');
    assert.strictEqual(i18nModule.TRANSLATIONS.en.legend_traffy_resolved, '🟢 Resolved / Completed', 'English legend_traffy_resolved must match');

    // 3. 3-Tier Zoom-Based Clustering for Traffy Fondue
    const mockTraffy = [
      { properties: { district: 'บางแค', state: 'กำลังดำเนินการ' }, geometry: { type: 'Point', coordinates: [100.40, 13.71] } },
      { properties: { district: 'บางแค', state: 'เสร็จสิ้น' }, geometry: { type: 'Point', coordinates: [100.41, 13.72] } },
      { properties: { district: 'จตุจักร', state: 'กำลังดำเนินการ' }, geometry: { type: 'Point', coordinates: [100.55, 13.82] } }
    ];

    // Tier 1: Zoom < 10.0 -> Exactly 1 single aggregate pin
    const tier1 = clusterService.clusterPointsByZoom(mockTraffy, 8.5, 'traffy');
    assert.strictEqual(tier1.length, 1, 'Zoom < 10.0 must return exactly 1 single cluster for Traffy');
    assert.strictEqual(tier1[0].level, 'overall', 'Tier 1 must have level overall');
    assert.strictEqual(tier1[0].name, 'กรุงเทพมหานคร', 'Tier 1 must have name กรุงเทพมหานคร');
    assert.strictEqual(tier1[0].count, 3, 'Tier 1 must aggregate all 3 items');

    // Tier 2: 10.0 <= Zoom < 12.5 -> Grouped by district
    const tier2 = clusterService.clusterPointsByZoom(mockTraffy, 11.0, 'traffy');
    assert.strictEqual(tier2.length, 2, 'Zoom 11.0 must group into 2 district clusters');
    assert.ok(tier2.every(c => c.isCluster && c.level === 'district'), 'All Tier 2 items must be district clusters');
    const bangKhae = tier2.find(c => c.name === 'เขตบางแค');
    assert.ok(bangKhae, 'Must have เขตบางแค cluster');
    assert.strictEqual(bangKhae.count, 2, 'เขตบางแค must have 2 items');
    const chatuchak = tier2.find(c => c.name === 'เขตจตุจักร');
    assert.ok(chatuchak, 'Must have เขตจตุจักร cluster');
    assert.strictEqual(chatuchak.count, 1, 'เขตจตุจักร must have 1 item');

    // Tier 3: Zoom >= 12.5 -> Individual pins
    const tier3 = clusterService.clusterPointsByZoom(mockTraffy, 13.0, 'traffy');
    assert.strictEqual(tier3.length, 3, 'Zoom 13.0 must return 3 individual pins');
    assert.ok(tier3.every(p => !p.isCluster && p.level === 'individual'), 'All Tier 3 items must be individual pins');

    // MapViewer integration & Zoom Indicator verification
    assert.ok(mapViewerCode.includes("entry.level === 'overall'"), 'MapViewer must handle overall level');
    assert.ok(mapViewerCode.includes("entry.level === 'district'"), 'MapViewer must handle district level');
    assert.ok(mapViewerCode.includes('gmaps-zoom-level-badge'), 'MapViewer must include gmaps-zoom-level-badge');
    assert.ok(mapViewerCode.includes('window.getZoom'), 'MapViewer must expose window.getZoom');
    assert.ok(cssCode.includes('.gmaps-zoom-level-badge'), 'index.css must style .gmaps-zoom-level-badge');
  });

  console.log(`\n🎉 Regression Tests Completed: ${passedTests} passed.\n`);
}

await runAllTests();

