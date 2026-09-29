/**
 * MapViewer Component for ThaiFlood - Google Maps Immersive Style
 * Fixed Arrow Rotation, OpenTopoMap Contour Basemap, Dams & Reservoirs,
 * and Multi-Layer GIS Visualization
 */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { generateFlowVectorPoints } from '../services/hydrologyService.js';
import { buildDamGeoJSON } from '../services/damService.js';
import { identifyRockUnit } from '../services/geologyService.js';
import { getNearestProvince, fetchCurrentProvinceWeather } from '../services/weatherService.js';
import { fetchNWPModelData, buildGFSGeoJSON, buildECMWFGeoJSON, getFallbackNWPData } from '../services/nwpForecastService.js';
import dohFloodData from '../data/dohFloodHighways.json';
import { createWindFieldLayer } from './WindFieldLayer.js';
import { evaluateDamRuleCurve } from '../services/damRuleCurveService.js';
import { getTraffyFloodGeoJSON, getSeedTraffyFloodGeoJSON } from '../services/traffyFondueService.js';

export function createMapViewer(options) {
  const { basinsData, floodNowData, forecast7dData, stationsData, damsData = [], onStationSelect } = options;

  const container = document.createElement('div');
  container.className = 'gmaps-container';
  container.id = 'gmaps-container';

  const mapDiv = document.createElement('div');
  mapDiv.id = 'map';
  container.appendChild(mapDiv);

  // Bottom-Right Google Maps Controls Stack (Locate Me + Zoom In/Out)
  const controlsStack = document.createElement('div');
  controlsStack.className = 'gmaps-controls-stack';

  // Google Maps Style My Location (Locate Me) Button - stacked right above zoom buttons
  const locateBtn = document.createElement('button');
  locateBtn.className = 'gmaps-locate-btn';
  locateBtn.id = 'gmaps-locate-me';
  locateBtn.title = 'ตำแหน่งของฉัน (Locate Me)';
  locateBtn.setAttribute('aria-label', 'ตำแหน่งของฉัน');
  locateBtn.innerHTML = `
    <svg class="locate-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="7"></circle>
      <line x1="12" y1="1" x2="12" y2="5"></line>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="1" y1="12" x2="5" y2="12"></line>
      <line x1="19" y1="12" x2="23" y2="12"></line>
      <circle class="locate-dot" cx="12" cy="12" r="2.5" fill="currentColor"></circle>
    </svg>
  `;
  controlsStack.appendChild(locateBtn);

  // Zoom In / Out Buttons
  // Zoom Controls (+ / - / 3D)
  const zoomControls = document.createElement('div');
  zoomControls.className = 'gmaps-zoom-controls';
  zoomControls.innerHTML = `
    <button class="gmaps-zoom-btn" id="gmaps-zoom-in" title="ซูมเข้า">+</button>
    <div class="gmaps-zoom-divider"></div>
    <button class="gmaps-zoom-btn" id="gmaps-zoom-out" title="ซูมออก">−</button>
    <div class="gmaps-zoom-divider"></div>
    <button class="gmaps-zoom-btn" id="gmaps-btn-3d" title="สลับมุมมอง 3 มิติ (3D Terrain Tilt)" style="font-size: 11px; font-weight: 700;">3D</button>
  `;
  controlsStack.appendChild(zoomControls);

  container.appendChild(controlsStack);

  // Basemap Switcher (Single compact rounded square button with "เลเยอร์" scrim overlay and hover/tap flyout menu)
  const basemapSwitcher = document.createElement('div');
  basemapSwitcher.className = 'gmaps-basemap-container';
  basemapSwitcher.id = 'gmaps-basemap-container';
  basemapSwitcher.innerHTML = `
    <div class="gmaps-basemap-wrapper">
      <button class="gmaps-basemap-trigger" id="gmaps-basemap-trigger" title="คลิกหรือวางเมาส์เพื่อเลือกประเภทแผนที่" type="button" aria-label="เลือกประเภทแผนที่">
        <div class="basemap-thumb thumb-street" id="basemap-active-thumb">
          <div class="basemap-scrim">
            <svg class="basemap-layer-svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5L21.5 8.8L12 14.1L2.5 8.8L12 3.5Z" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2.5 12.8L12 18.1L21.5 12.8L21.5 15.8L12 21.1L2.5 15.8L2.5 12.8Z" fill="#ffffff"/>
            </svg>
            <span class="basemap-scrim-title" id="basemap-scrim-title">แผนที่</span>
          </div>
        </div>
        <div class="basemap-expand-arrow" id="basemap-expand-arrow" style="display:none;" title="แสดงตัวเลือกแผนที่อื่น">»</div>
      </button>

      <div class="gmaps-basemap-side-grid" id="gmaps-basemap-side-grid">
        <div class="gmaps-basemap-header">
          <span class="basemap-header-label">ประเภทแผนที่: <b id="basemap-active-name">แผนที่</b></span>
        </div>
        <div class="basemap-cards-row">
          <button class="gmaps-basemap-card active" id="btn-mode-street" data-mode="street" data-name="แผนที่" title="แผนที่มาตรฐาน (OpenStreetMap)" type="button">
            <div class="basemap-thumb thumb-street"></div>
            <span class="basemap-card-name">แผนที่</span>
          </button>
          <button class="gmaps-basemap-card" id="btn-mode-satellite" data-mode="satellite" data-name="ภาพถ่ายดาวเทียม" title="ภาพถ่ายดาวเทียม (ESRI World Imagery)" type="button">
            <div class="basemap-thumb thumb-satellite"></div>
            <span class="basemap-card-name">ดาวเทียม</span>
          </button>
          <button class="gmaps-basemap-card" id="btn-mode-topo" data-mode="topo" data-name="ภูมิประเทศ" title="ภูมิประเทศ เส้นชั้นความสูง (OpenTopoMap)" type="button">
            <div class="basemap-thumb thumb-topo"></div>
            <span class="basemap-card-name">ภูมิประเทศ</span>
          </button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(basemapSwitcher);

  // High-Resolution DEM Floodplain Elevation Inspector Badge (Floating HUD)
  const demBadge = document.createElement('div');
  demBadge.className = 'gmaps-dem-badge';
  demBadge.id = 'gmaps-dem-badge';
  demBadge.style.display = 'none';
  demBadge.title = 'ระดับความสูงภูมิประเทศจริงจาก DEM 30m & เส้นคอนทัวร์มาตรฐาน (สไตล์แผนที่ทหาร L7018)';
  demBadge.innerHTML = `
    <span class="dem-badge-icon">🏔️</span>
    <span class="dem-badge-title">DEM & คอนทัวร์ L7018:</span>
    <b class="dem-badge-elev">เลื่อนเมาส์บนแผนที่</b>
    <span class="dem-badge-unit">เพื่อวัดระดับความสูงดิน</span>
  `;
  container.appendChild(demBadge);

  // Apple Maps Style Floating Weather Pill (shows temperature at province-level zoom)
  const weatherPill = document.createElement('div');
  weatherPill.className = 'gmaps-apple-weather-pill';
  weatherPill.id = 'gmaps-apple-weather-pill';
  weatherPill.title = 'สภาพอากาศและอุณหภูมิตามขอบเขตจังหวัด (คลิกดูพยากรณ์ 7 วัน)';
  weatherPill.innerHTML = `
    <div class="pill-line-top">
      <span class="pill-icon" id="pill-weather-icon">🌤️</span>
      <span class="pill-temp" id="pill-weather-temp">--°</span>
      <span class="pill-location" id="pill-weather-prov">กำลังโหลด...</span>
    </div>
    <div class="pill-line-bottom">
      <span class="pill-desc" id="pill-weather-desc"></span>
    </div>
  `;
  container.appendChild(weatherPill);

  // AI-Style Subtle Bottom Disclaimer Pill (ChatGPT / Gemini Style)
  const disclaimer = document.createElement('div');
  disclaimer.className = 'gmaps-disclaimer-pill';
  disclaimer.id = 'gmaps-disclaimer-pill';
  disclaimer.setAttribute('role', 'note');
  disclaimer.title = 'แบบจำลองขอบเขตน้ำท่วมสร้างขึ้นจากการประมาณการณ์เชิงอุทกวิทยา โปรดตรวจสอบระดับน้ำจริงจากสถานีตรวจวัด';
  disclaimer.innerHTML = `
    <span class="disclaimer-icon">⚠️</span>
    <span class="disclaimer-text">
      ภาพจำลองเชิงอุทกวิทยา: ข้อมูลประมาณการทางคณิตศาสตร์ · ตรวจสอบระดับน้ำจริงที่หมุดสถานี
    </span>
  `;
  container.appendChild(disclaimer);

  let mapInstance = null;
  let activeBasemap = 'street';
  const flowMarkers = [];
  let damMarkers = [];
  let cachedNWPData = getFallbackNWPData();
  let currentGFSDay = 0;
  let currentECMWFDay = 0;
  let currentStationPopup = null;
  let userLocationMarker = null;
  let userLocationPopup = null;
  let toastTimeout = null;

  const activeLegendLayers = new Set();
  let currentActiveLegendId = 'ecmwf';
  let isLegendDescExpanded = false;

  // Unified Floating Bottom Legend & Day Controller
  const ecmwfFloatBar = document.createElement('div');
  ecmwfFloatBar.className = 'gmaps-ecmwf-float-bar gmaps-bottom-legend-card';
  ecmwfFloatBar.id = 'gmaps-ecmwf-float-bar';
  ecmwfFloatBar.style.display = 'none';
  ecmwfFloatBar.innerHTML = `
    <div class="legend-card-header">
      <div class="legend-tabs-wrapper" id="legend-tabs-wrapper"></div>
      <button class="btn-toggle-legend-desc" id="btn-toggle-legend-desc" type="button" aria-expanded="false" title="ย่อหรือขยายคำอธิบาย">
        <span class="desc-toggle-text">คำอธิบาย</span>
        <span class="desc-toggle-icon">▼</span>
      </button>
    </div>
    <div class="legend-day-section" id="legend-day-section" style="display: none;">
      <div class="float-label">
        <span id="ecmwf-float-title">🇪🇺 <b>ECMWF IFS:</b></span>
        <span id="ecmwf-float-date" style="color: #4f46e5; font-weight:700;">วันนี้</span>
      </div>
      <div class="float-chips">
        <button class="float-chip active" data-day="0">วันนี้</button>
        <button class="float-chip" data-day="1">+1 วัน</button>
        <button class="float-chip" data-day="2">+2 วัน</button>
        <button class="float-chip" data-day="3">+3 วัน</button>
        <button class="float-chip" data-day="4">+4 วัน</button>
        <button class="float-chip" data-day="5">+5 วัน</button>
        <button class="float-chip" data-day="6">+6 วัน</button>
      </div>
    </div>
    <div class="legend-scale-section" id="legend-scale-section"></div>
    <div class="bottom-legend-desc-panel" id="bottom-legend-desc-panel">
      <div class="desc-content" id="bottom-legend-desc-text"></div>
    </div>
  `;
  container.appendChild(ecmwfFloatBar);

  ecmwfFloatBar.querySelectorAll('.float-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.getAttribute('data-day'), 10);
      setNWPForecastDay(day);
    });
  });

  const descToggleBtn = ecmwfFloatBar.querySelector('#btn-toggle-legend-desc');
  const descPanel = ecmwfFloatBar.querySelector('#bottom-legend-desc-panel');
  if (descToggleBtn && descPanel) {
    descToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isLegendDescExpanded = !isLegendDescExpanded;
      descPanel.classList.toggle('expanded', isLegendDescExpanded);
      descToggleBtn.setAttribute('aria-expanded', isLegendDescExpanded ? 'true' : 'false');
      const icon = descToggleBtn.querySelector('.desc-toggle-icon');
      if (icon) icon.textContent = isLegendDescExpanded ? '▲' : '▼';
    });
  }

  function collapseLegendDesc() {
    if (!isLegendDescExpanded) return;
    isLegendDescExpanded = false;
    if (descPanel) descPanel.classList.remove('expanded');
    if (descToggleBtn) {
      descToggleBtn.setAttribute('aria-expanded', 'false');
      const icon = descToggleBtn.querySelector('.desc-toggle-icon');
      if (icon) icon.textContent = '▼';
    }
  }

  let windFieldLayer = null;

  // Floating Wind Field Legend (appears when Wind Field layer is toggled ON)
  const windLegend = document.createElement('div');
  windLegend.className = 'gmaps-wind-legend';
  windLegend.id = 'gmaps-wind-legend';
  windLegend.style.display = 'none';
  windLegend.innerHTML = `
    <div style="font-weight: 700; font-size: 11.5px; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 5px;">
        <span>💨</span>
        <span>กระแสลมผิวพื้น 10 เมตร (WMO Scale)</span>
      </span>
      <span style="font-size: 10px; color: #0284c7; font-weight: 600;">m/s & km/h</span>
    </div>
    <div style="height: 8px; border-radius: 4px; background: linear-gradient(to right, #38bdf8, #34d399, #a3e635, #facc15, #fb923c, #f43f5e, #c084fc); margin-bottom: 4px;"></div>
    <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #475569; font-weight: 600;">
      <span>0 (ลมอ่อน)</span>
      <span>5 m/s (18 km/h)</span>
      <span>12 m/s (43 km/h)</span>
      <span>24+ m/s (พายุ)</span>
    </div>
    <div style="font-size: 9.5px; color: #64748b; margin-top: 4px; line-height: 1.35;">
      💡 คลิกบนแผนที่ ณ พิกัดใดก็ได้เพื่ออ่านค่าความเร็วและทิศทางลมสด
    </div>
  `;
  container.appendChild(windLegend);

  function showToast(message, icon = '📍') {
    let toast = container.querySelector('#gmaps-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'gmaps-toast';
      toast.id = 'gmaps-toast';
      container.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-size: 14px;">${icon}</span> <span>${message}</span>`;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  function locateUser() {
    if (!navigator.geolocation) {
      showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด Geolocation', '⚠️');
      return;
    }

    locateBtn.classList.add('loading');
    locateBtn.title = 'กำลังค้นหาตำแหน่งของคุณ...';
    showToast('กำลังค้นหาตำแหน่งปัจจุบันของคุณจาก GPS...', '📡');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        locateBtn.classList.remove('loading');
        locateBtn.classList.add('active');
        locateBtn.title = 'ตำแหน่งของฉัน (ตรวจพบพิกัดแล้ว)';

        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        if (mapInstance) {
          mapInstance.flyTo({
            center: [lng, lat],
            zoom: 13.5,
            speed: 1.4,
            curve: 1.2
          });

          if (!userLocationMarker) {
            const el = document.createElement('div');
            el.className = 'gmaps-user-marker';
            el.title = 'ตำแหน่งปัจจุบันของคุณ (คลิกดูสถานะน้ำรอบตัว)';
            el.innerHTML = `
              <div class="gmaps-user-pulse"></div>
              <div class="gmaps-user-dot"></div>
            `;
            el.addEventListener('click', () => {
              showUserLocationPopup(lat, lng, accuracy);
            });

            userLocationMarker = new maplibregl.Marker({
              element: el,
              anchor: 'center'
            })
              .setLngLat([lng, lat])
              .addTo(mapInstance);
          } else {
            userLocationMarker.setLngLat([lng, lat]);
          }

          showUserLocationPopup(lat, lng, accuracy);
        }

        showToast(`พบพิกัดของคุณแล้ว (ความแม่นยำ ±${Math.round(accuracy)} ม.)`, '🎯');
      },
      (err) => {
        locateBtn.classList.remove('loading');
        let msg = 'ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่อีกครั้ง';
        if (err.code === 1) {
          msg = 'ไม่ได้รับอนุญาตให้เข้าถึงพิกัด (กรุณากด Allow หรือ อนุญาต บนเบราว์เซอร์)';
        } else if (err.code === 2) {
          msg = 'ไม่พบสัญญาณตำแหน่งหรือ GPS (Position Unavailable)';
        } else if (err.code === 3) {
          msg = 'หมดเวลาค้นหาพิกัด (Geolocation Timeout)';
        }
        showToast(msg, '⚠️');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  function showUserLocationPopup(lat, lng, accuracy) {
    if (!mapInstance) return;
    if (userLocationPopup) {
      userLocationPopup.remove();
      userLocationPopup = null;
    }

    let nearest = null;
    let minKm = Infinity;
    if (stationsData && stationsData.length > 0) {
      for (const st of stationsData) {
        const dLat = (st.lat - lat) * 111;
        const dLng = (st.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < minKm) {
          minKm = dist;
          nearest = st;
        }
      }
    }

    if (options.onStationSelect) {
      options.onStationSelect({
        isUserLocation: true,
        lat,
        lng,
        accuracy,
        nearestStation: nearest,
        minKm: nearest ? minKm : null
      });
    }
  }

  locateBtn.addEventListener('click', locateUser);

  setTimeout(() => {
    initMap();
  }, 50);

  function initMap() {
    mapInstance = new maplibregl.Map({
      container: mapDiv,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm-base': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          },
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Satellite Imagery'
          },
          'opentopo-contour': {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
          },
          'openfreemap-buildings': {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet'
          },
          'dem-elevation-source': {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            ],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
            attribution: 'Tiles &copy; Mapzen, Copernicus DEM, SRTM &mdash; 30m Global DEM'
          },
          'dem-relief-source': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 20,
            attribution: 'Tiles &copy; Esri &mdash; High-Resolution Multi-Directional Shaded Relief'
          },
          'dmr-geology': {
            type: 'raster',
            tiles: [
              'https://gisportal.dmr.go.th/arcgis/rest/services/GEOL/ROCK_UNIT_250K/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512%2C512&format=png8&transparent=true&f=image'
            ],
            tileSize: 512,
            attribution: '&copy; <a href="https://www.dmr.go.th/" target="_blank">กรมทรัพยากรธรณี (DMR)</a> หน่วยหิน 1:250,000'
          },
          'dmr-structures': {
            type: 'raster',
            tiles: [
              'https://gisportal.dmr.go.th/arcgis/rest/services/GEOL/GEOL_STR_250K/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512%2C512&format=png8&transparent=true&f=image'
            ],
            tileSize: 512,
            attribution: '&copy; <a href="https://www.dmr.go.th/" target="_blank">กรมทรัพยากรธรณี (DMR)</a> เส้นโครงสร้างทางธรณีวิทยา 1:250,000'
          },
          'nasa-water-satellite': {
            type: 'raster',
            tiles: [
              'https://tilecache.rainviewer.com/v2/radar/41694d9b5566/512/{z}/{x}/{y}/2/1_1.png'
            ],
            tileSize: 512,
            maxzoom: 7,
            attribution: '&copy; <a href="https://www.tmd.go.th/" target="_blank">กรมอุตุนิยมวิทยา (TMD)</a> / <a href="https://www.rainviewer.com/" target="_blank">RainViewer Radar</a>'
          },
          'nasa-cloud-satellite': {
            type: 'raster',
            tiles: [
              'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png'
            ],
            tileSize: 256,
            maxzoom: 6,
            attribution: '&copy; <a href="https://earthdata.nasa.gov/gibs" target="_blank">NASA GIBS</a> / JMA Himawari-9 Clean IR'
          }
        },
        layers: [
          {
            id: 'osm-base-layer',
            type: 'raster',
            source: 'osm-base',
            minzoom: 0,
            maxzoom: 19,
            layout: {
              visibility: 'visible'
            }
          },
          {
            id: 'esri-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 19,
            layout: {
              visibility: 'none'
            }
          },
          {
            id: 'opentopo-contour-layer',
            type: 'raster',
            source: 'opentopo-contour',
            minzoom: 0,
            maxzoom: 17,
            layout: {
              visibility: 'none'
            }
          },
          {
            id: 'layer-3d-buildings',
            type: 'fill-extrusion',
            source: 'openfreemap-buildings',
            'source-layer': 'building',
            minzoom: 14,
            layout: {
              visibility: 'none'
            },
            paint: {
              'fill-extrusion-color': '#cbd5e1',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.82
            }
          },
          {
            id: 'dem-elevation-layer',
            type: 'hillshade',
            source: 'dem-elevation-source',
            minzoom: 0,
            maxzoom: 19,
            layout: {
              visibility: 'none'
            },
            paint: {
              'hillshade-exaggeration': 1,
              'hillshade-shadow-color': '#2a1b0e',
              'hillshade-highlight-color': '#ffffff',
              'hillshade-accent-color': '#926a45',
              'hillshade-illumination-direction': 315
            }
          },
          {
            id: 'dem-contour-overlay-layer',
            type: 'raster',
            source: 'opentopo-contour',
            minzoom: 0,
            maxzoom: 17,
            layout: {
              visibility: 'none'
            },
            paint: {
              'raster-opacity': 0.92,
              'raster-contrast': 0.25,
              'raster-saturation': -0.15
            }
          },
          {
            id: 'dmr-geology-layer',
            type: 'raster',
            source: 'dmr-geology',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-opacity': 0.75
            },
            layout: {
              visibility: 'none'
            }
          },
          {
            id: 'dmr-structures-layer',
            type: 'raster',
            source: 'dmr-structures',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-opacity': 0.95
            },
            layout: {
              visibility: 'none'
            }
          },
          {
            id: 'nasa-water-satellite-layer',
            type: 'raster',
            source: 'nasa-water-satellite',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-opacity': 0.78,
              'raster-resampling': 'linear'
            },
            layout: {
              visibility: 'none'
            }
          },
          {
            id: 'nasa-cloud-satellite-layer',
            type: 'raster',
            source: 'nasa-cloud-satellite',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-opacity': 0.65,
              'raster-resampling': 'linear'
            },
            layout: {
              visibility: 'none'
            }
          }
        ]
      },
      center: [100.5018, 13.7563],
      zoom: 10.8,
      maxZoom: 16,
      minZoom: 5,
      attributionControl: false
    });

    // Wire up custom Google Maps zoom buttons
    container.querySelector('#gmaps-zoom-in').addEventListener('click', () => {
      if (mapInstance) mapInstance.zoomIn();
    });
    container.querySelector('#gmaps-zoom-out').addEventListener('click', () => {
      if (mapInstance) mapInstance.zoomOut();
    });

    // Wire up Locate Me (Current Location) Button
    let userLocationMarker = null;
    let userLocationPopup = null;
    let toastTimeout = null;

    function showToast(message, icon = '📍') {
      let toast = container.querySelector('#gmaps-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'gmaps-toast';
        toast.id = 'gmaps-toast';
        container.appendChild(toast);
      }
      toast.innerHTML = `<span style="font-size: 14px;">${icon}</span> <span>${message}</span>`;
      toast.classList.add('show');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 4000);
    }

    function locateUser() {
      if (!navigator.geolocation) {
        showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด Geolocation', '⚠️');
        return;
      }

      locateBtn.classList.add('loading');
      locateBtn.title = 'กำลังค้นหาตำแหน่งของคุณ...';

      navigator.geolocation.getCurrentPosition(
        (position) => {
          locateBtn.classList.remove('loading');
          locateBtn.classList.add('active');
          locateBtn.title = 'ตำแหน่งของฉัน (ตรวจพบพิกัดแล้ว)';

          const { latitude: lat, longitude: lng, accuracy } = position.coords;

          if (mapInstance) {
            mapInstance.flyTo({
              center: [lng, lat],
              zoom: 13.5,
              speed: 1.4,
              curve: 1.2
            });
          }

          if (!userLocationMarker) {
            const el = document.createElement('div');
            el.className = 'gmaps-user-marker';
            el.title = 'ตำแหน่งปัจจุบันของคุณ (คลิกดูสถานะน้ำรอบตัว)';
            el.innerHTML = `
              <div class="gmaps-user-pulse"></div>
              <div class="gmaps-user-dot"></div>
            `;
            el.addEventListener('click', () => {
              showUserLocationPopup(lat, lng, accuracy);
            });

            userLocationMarker = new maplibregl.Marker({
              element: el,
              anchor: 'center'
            })
              .setLngLat([lng, lat])
              .addTo(mapInstance);
          } else {
            userLocationMarker.setLngLat([lng, lat]);
          }

          showUserLocationPopup(lat, lng, accuracy);
          showToast(`พบพิกัดของคุณแล้ว (ความแม่นยำ ±${Math.round(accuracy)} ม.)`, '🎯');
        },
        (err) => {
          locateBtn.classList.remove('loading');
          let msg = 'ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่อีกครั้ง';
          if (err.code === 1) {
            msg = 'ไม่ได้รับอนุญาตให้เข้าถึงพิกัด (Geolocation Permission Denied)';
          } else if (err.code === 2) {
            msg = 'ไม่พบสัญญาณตำแหน่งหรือ GPS (Position Unavailable)';
          } else if (err.code === 3) {
            msg = 'หมดเวลาค้นหาพิกัด (Geolocation Timeout)';
          }
          showToast(msg, '⚠️');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }

    function showUserLocationPopup(lat, lng, accuracy) {
      if (userLocationPopup) {
        userLocationPopup.remove();
        userLocationPopup = null;
      }

      let nearest = null;
      let minKm = Infinity;
      if (stationsData && stationsData.length > 0) {
        for (const st of stationsData) {
          const dLat = (st.lat - lat) * 111;
          const dLng = (st.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          if (dist < minKm) {
            minKm = dist;
            nearest = st;
          }
        }
      }

      if (options.onStationSelect) {
        options.onStationSelect({
          isUserLocation: true,
          lat,
          lng,
          accuracy,
          nearestStation: nearest,
          minKm: nearest ? minKm : null
        });
      }
    }

    locateBtn.addEventListener('click', locateUser);

    // Wire up Basemap Switcher (Google Maps Style with 50x50px preview cards, >> expand button, and sideways options)
    const btnStreet = container.querySelector('#btn-mode-street');
    const btnSat = container.querySelector('#btn-mode-satellite');
    const btnTopo = container.querySelector('#btn-mode-topo');
    const basemapActiveLabel = container.querySelector('#basemap-active-name');
    const basemapActiveThumb = container.querySelector('#basemap-active-thumb');
    const basemapTrigger = container.querySelector('#gmaps-basemap-trigger');
    const basemapArrow = container.querySelector('#basemap-expand-arrow');

    const basemapNames = {
      street: 'แผนที่',
      satellite: 'ภาพถ่ายดาวเทียม',
      topo: 'ภูมิประเทศ'
    };

    const basemapThumbs = {
      street: 'thumb-street',
      satellite: 'thumb-satellite',
      topo: 'thumb-topo'
    };

    const basemapShortNames = {
      street: 'แผนที่',
      satellite: 'ดาวเทียม',
      topo: 'ภูมิประเทศ'
    };

    function updateBasemapLabel(name, mode) {
      if (basemapActiveLabel) {
        basemapActiveLabel.textContent = name;
      }
      const scrimTitle = container.querySelector('#basemap-scrim-title');
      if (scrimTitle && mode) {
        scrimTitle.textContent = basemapShortNames[mode] || name;
      }
    }

    const btn3d = container.querySelector('#gmaps-btn-3d');
    let is3DPitched = false;

    function switchBasemap(mode) {
      collapseLegendDesc();
      if (!mapInstance || activeBasemap === mode) return;
      activeBasemap = mode;
      if (btnStreet) btnStreet.classList.toggle('active', mode === 'street');
      if (btnSat) btnSat.classList.toggle('active', mode === 'satellite');
      if (btnTopo) btnTopo.classList.toggle('active', mode === 'topo');

      if (basemapActiveThumb) {
        basemapActiveThumb.className = `basemap-thumb ${basemapThumbs[mode] || 'thumb-street'}`;
      }

      updateBasemapLabel(basemapNames[mode] || mode, mode);

      if (mapInstance.getLayer('osm-base-layer')) {
        mapInstance.setLayoutProperty('osm-base-layer', 'visibility', mode === 'street' ? 'visible' : 'none');
      }
      if (mapInstance.getLayer('esri-satellite-layer')) {
        mapInstance.setLayoutProperty('esri-satellite-layer', 'visibility', mode === 'satellite' ? 'visible' : 'none');
      }
      if (mapInstance.getLayer('opentopo-contour-layer')) {
        mapInstance.setLayoutProperty('opentopo-contour-layer', 'visibility', mode === 'topo' ? 'visible' : 'none');
      }

      // Requirement 3: นำ 3D ออกจากภาพถ่ายดาวเทียม (Flat 2D Pure Satellite Orthophoto)
      if (mode === 'satellite') {
        if (mapInstance.getPitch() > 0 || mapInstance.getBearing() !== 0) {
          mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 400 });
        }
        if (btn3d) {
          btn3d.classList.remove('active');
          btn3d.style.opacity = '0.35';
          btn3d.style.pointerEvents = 'none';
          btn3d.title = 'ภาพถ่ายดาวเทียมแสดงผลแบบ 2D ระนาบแท้ (ปิดโหมด 3D)';
        }
        is3DPitched = false;
        if (mapInstance.getLayer('layer-3d-buildings')) {
          mapInstance.setLayoutProperty('layer-3d-buildings', 'visibility', 'none');
        }
      } else {
        if (btn3d) {
          btn3d.style.opacity = '1';
          btn3d.style.pointerEvents = 'auto';
          btn3d.title = 'สลับมุมมอง 3 มิติ (3D Buildings & Tilt)';
        }
        // In "แผนที่" mode, 3D buildings show if pitched
        if (mode === 'street' && is3DPitched) {
          if (mapInstance.getLayer('layer-3d-buildings')) {
            mapInstance.setLayoutProperty('layer-3d-buildings', 'visibility', 'visible');
          }
        } else {
          if (mapInstance.getLayer('layer-3d-buildings')) {
            mapInstance.setLayoutProperty('layer-3d-buildings', 'visibility', 'none');
          }
        }
      }
    }

    if (btnStreet) btnStreet.addEventListener('click', () => {
      collapseLegendDesc();
      switchBasemap('street');
      basemapSwitcher.classList.remove('expanded');
      if (basemapArrow) basemapArrow.textContent = '»';
    });
    if (btnSat) btnSat.addEventListener('click', () => {
      collapseLegendDesc();
      switchBasemap('satellite');
      basemapSwitcher.classList.remove('expanded');
      if (basemapArrow) basemapArrow.textContent = '»';
    });
    if (btnTopo) btnTopo.addEventListener('click', () => {
      collapseLegendDesc();
      switchBasemap('topo');
      basemapSwitcher.classList.remove('expanded');
      if (basemapArrow) basemapArrow.textContent = '»';
    });

    // Toggle expand/collapse on click of trigger or arrow
    function toggleBasemapExpand(e) {
      if (e) e.stopPropagation();
      const isExpanded = basemapSwitcher.classList.toggle('expanded');
      if (basemapArrow) basemapArrow.textContent = isExpanded ? '«' : '»';
    }

    if (basemapTrigger) basemapTrigger.addEventListener('click', toggleBasemapExpand);

    basemapSwitcher.addEventListener('mouseenter', () => {
      basemapSwitcher.classList.add('expanded');
    });

    basemapSwitcher.addEventListener('mouseleave', () => {
      basemapSwitcher.classList.remove('expanded');
      if (basemapArrow) basemapArrow.textContent = '»';
      updateBasemapLabel(basemapNames[activeBasemap] || 'แผนที่');
    });

    // Close basemap popup on mobile when tapping outside
    document.addEventListener('click', (e) => {
      if (basemapSwitcher && !basemapSwitcher.contains(e.target)) {
        basemapSwitcher.classList.remove('expanded');
        if (basemapArrow) basemapArrow.textContent = '»';
      }
    });

    // Hover effect on basemap cards to preview the label
    [btnStreet, btnSat, btnTopo].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('mouseenter', () => {
        const name = btn.getAttribute('data-name');
        if (name) updateBasemapLabel(name);
      });
      btn.addEventListener('mouseleave', () => {
        updateBasemapLabel(basemapNames[activeBasemap] || 'แผนที่');
      });
    });

    // 3D View Toggle Button (Support 3D Buildings on Map)
    if (btn3d) {
      btn3d.addEventListener('click', () => {
        if (activeBasemap === 'satellite') {
          showToast('โหมดภาพถ่ายดาวเทียมแสดงผลแบบ 2D ระนาบแท้ (ปิด 3D)', '🛰️');
          return;
        }
        is3DPitched = !is3DPitched;
        btn3d.classList.toggle('active', is3DPitched);
        mapInstance.easeTo({
          pitch: is3DPitched ? 55 : 0,
          bearing: is3DPitched ? -12 : 0,
          duration: 700
        });
        if (mapInstance.getLayer('layer-3d-buildings')) {
          mapInstance.setLayoutProperty('layer-3d-buildings', 'visibility', (is3DPitched && activeBasemap === 'street') ? 'visible' : 'none');
        }
        if (is3DPitched) {
          showToast('เปิดมุมมอง 3D พร้อมแบบจำลองอาคาร (3D Buildings)', '🏙️');
        } else {
          showToast('กลับสู่มุมมอง 2D ระนาบมาตรฐาน', '🗺️');
        }
      });
    }

    // Real-Time DEM Floodplain Elevation Inspector (MouseMove & Click)
    function updateDemInspector(e) {
      if (activeBasemap !== 'dem' || !mapInstance) return;
      let elev = null;
      if (typeof mapInstance.queryTerrainElevation === 'function') {
        elev = mapInstance.queryTerrainElevation([e.lngLat.lng, e.lngLat.lat]);
      }
      const badge = container.querySelector('#gmaps-dem-badge');
      if (!badge) return;

      if (elev !== null && !isNaN(elev)) {
        const m = Math.round(elev * 10) / 10;
        let desc = 'ที่ดอน / เนินสูง';
        let color = '#38bdf8';
        if (m < 2) {
          desc = 'พื้นที่ปากน้ำ / ระดับต่ำมาก (น้ำทะเลหนุน)';
          color = '#0284c7';
        } else if (m < 6) {
          desc = 'แอ่งที่ราบลุ่มต่ำ / ทุ่งรับน้ำ (เสี่ยงน้ำท่วมสูง)';
          color = '#ef4444';
        } else if (m < 12) {
          desc = 'ที่ราบลุ่มน้ำท่วมถึง (Floodplain)';
          color = '#f97316';
        } else if (m < 25) {
          desc = 'ตะพักลำน้ำ / คันดินดอน (Terrace / Levee)';
          color = '#22c55e';
        }

        badge.innerHTML = `
          <span class="dem-badge-icon">🏔️</span>
          <span class="dem-badge-title">ความสูง DEM:</span>
          <b class="dem-badge-elev">${m.toFixed(1)} ม.</b>
          <span class="dem-badge-unit">(รทก. / MSL)</span>
          <span class="dem-badge-divider">·</span>
          <span class="dem-badge-desc" style="color: ${color}; font-weight: 600;">${desc}</span>
          <div class="dem-scale-bar" title="ระดับความสูงพื้นที่ราบลุ่ม (<2m, 2-6m, 6-12m, 12-25m, >25m)">
            <span class="dem-scale-step" style="background:#0284c7"></span>
            <span class="dem-scale-step" style="background:#ef4444"></span>
            <span class="dem-scale-step" style="background:#f97316"></span>
            <span class="dem-scale-step" style="background:#22c55e"></span>
            <span class="dem-scale-step" style="background:#38bdf8"></span>
          </div>
        `;
      }
    }
    mapInstance.on('mousemove', updateDemInspector);

    mapInstance.on('click', (e) => {
      if (activeBasemap !== 'dem' || !mapInstance) return;
      let elev = null;
      if (typeof mapInstance.queryTerrainElevation === 'function') {
        elev = mapInstance.queryTerrainElevation([e.lngLat.lng, e.lngLat.lat]);
      }
      if (elev !== null && !isNaN(elev)) {
        const m = Math.round(elev * 10) / 10;
        let desc = 'ที่ดอน / เนินสูง';
        let color = '#38bdf8';
        let badgeIcon = '🟢';
        if (m < 2) {
          desc = 'พื้นที่ปากน้ำ / ระดับต่ำมาก (น้ำทะเลหนุน)';
          color = '#0284c7';
          badgeIcon = '🔵';
        } else if (m < 6) {
          desc = 'แอ่งที่ราบลุ่มต่ำ / ทุ่งรับน้ำ (เสี่ยงน้ำท่วมสูง)';
          color = '#ef4444';
          badgeIcon = '🔴';
        } else if (m < 12) {
          desc = 'ที่ราบลุ่มน้ำท่วมถึง (Floodplain)';
          color = '#f97316';
          badgeIcon = '🟠';
        } else if (m < 25) {
          desc = 'ตะพักลำน้ำ / คันดินดอน (Terrace / Levee)';
          color = '#22c55e';
          badgeIcon = '🟢';
        }

        if (options.onStationSelect) {
          options.onStationSelect({
            isElevation: true,
            elevation: m,
            name: `ระดับความสูง DEM: ${m.toFixed(1)} ม.`,
            desc: `ความสูงภูมิประเทศ: ${m.toFixed(1)} ม. (รทก.) - ${desc}`,
            riskTag: `${badgeIcon} ${desc}`,
            lat: e.lngLat.lat,
            lng: e.lngLat.lng
          });
        }
      }
    });

    // Apple Maps Weather Pill Logic
    let currentWeatherProvince = null;
    let weatherUpdateTimer = null;

    async function updateProvinceWeather() {
      if (!mapInstance) return;
      const center = mapInstance.getCenter();
      const nearest = getNearestProvince(center.lat, center.lng);
      if (!nearest) return;

      const provEl = container.querySelector('#pill-weather-prov');
      const tempEl = container.querySelector('#pill-weather-temp');
      const iconEl = container.querySelector('#pill-weather-icon');
      const descEl = container.querySelector('#pill-weather-desc');

      if (currentWeatherProvince !== nearest.name) {
        currentWeatherProvince = nearest.name;
        if (provEl) provEl.textContent = nearest.name;
      }

      try {
        const weather = await fetchCurrentProvinceWeather(nearest.name, nearest.lat, nearest.lng);
        if (weather && provEl && tempEl && iconEl && descEl) {
          provEl.textContent = weather.province;
          tempEl.textContent = `${weather.temp}°`;
          iconEl.textContent = weather.icon || '🌤️';
          descEl.textContent = weather.weatherDesc || '';
          weatherPill.title = `จ.${weather.province}: ${weather.temp}°C (${weather.weatherDesc}) - คลิกดูพยากรณ์ฝน 7 วัน`;
        }
      } catch (err) {
        console.warn('Weather pill update err:', err);
      }
    }

    let lastGatingZoom = -1;
    function handleZoomAndMove() {
      if (!mapInstance) return;
      const zoom = mapInstance.getZoom();
      if (Math.abs(zoom - lastGatingZoom) >= 0.25) {
        lastGatingZoom = zoom;
        updateDamZoomGating();
      }
      // Show weather pill when zoomed in closer to province/district level (zoom >= 8.0 to 12.5)
      const isProvinceView = zoom >= 8.0 && zoom <= 12.5;

      if (isProvinceView) {
        weatherPill.classList.add('visible');
        clearTimeout(weatherUpdateTimer);
        weatherUpdateTimer = setTimeout(() => {
          updateProvinceWeather();
        }, 250);
      } else {
        weatherPill.classList.remove('visible');
      }
    }

    const handleWeatherPillTrigger = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }
      if (options.onWeatherPillClick) {
        const center = mapInstance ? mapInstance.getCenter() : null;
        const nearest = center ? getNearestProvince(center.lat, center.lng) : null;
        const prov = currentWeatherProvince || (nearest ? nearest.name : 'กรุงเทพมหานคร');
        options.onWeatherPillClick(prov);
      }
    };

    weatherPill.addEventListener('click', handleWeatherPillTrigger);
    weatherPill.addEventListener('touchend', handleWeatherPillTrigger);
    weatherPill.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    weatherPill.addEventListener('pointerdown', (e) => e.stopPropagation());

    mapInstance.on('load', () => {
      renderGeoJSONLayers();
      renderDamLayers();
      renderStationMarkers();
      renderFlowDirectionArrows();
      renderDOHHighwayFloodLines();
      initTraffyFloodLayer();
      initTrafficLayer();
      initNWPForecastLayers();
      refreshRadarTiles();
      refreshCloudTiles();
      setupGeologyClickHandler();
      setupDemClickHandler();
      windFieldLayer = createWindFieldLayer(mapInstance);
      handleZoomAndMove();
    });

    // Requirement 2: Auto collapse layer panel and expanded legend description on map drag
    function autoCollapseLayerPanel(e) {
      if (e && e.originalEvent) {
        const t = e.originalEvent.target;
        if (t && t.closest && (t.closest('#gmaps-mobile-layer-sheet') || t.closest('.gmaps-mobile-layer-sheet') || t.closest('#gmaps-mobile-layer-backdrop') || t.closest('#gmaps-layer-panel'))) {
          return;
        }
      }
      collapseLegendDesc();
      const panel = document.querySelector('#gmaps-layer-panel');
      if (panel && !panel.classList.contains('collapsed')) {
        panel.classList.add('collapsed');
        const toggleBtn = panel.querySelector('#btn-toggle-layer-panel');
        if (toggleBtn) {
          const toggleBtnText = toggleBtn.querySelector('.toggle-btn-text');
          const toggleBtnArrow = toggleBtn.querySelector('.toggle-btn-arrow');
          if (toggleBtnText) toggleBtnText.textContent = 'แสดง';
          if (toggleBtnArrow) toggleBtnArrow.textContent = '▴';
        }
      }
    }

    function closeMobileSheetOnMapPan(e) {
      if (e && e.originalEvent) {
        const t = e.originalEvent.target;
        if (t && t.closest && (t.closest('#gmaps-mobile-layer-sheet') || t.closest('#gmaps-mobile-layer-backdrop'))) {
          return;
        }
      }
      const mobileSheet = document.querySelector('#gmaps-mobile-layer-sheet');
      if (mobileSheet && mobileSheet.classList.contains('open')) {
        mobileSheet.classList.remove('open');
        const backdrop = document.querySelector('#gmaps-mobile-layer-backdrop');
        if (backdrop) backdrop.classList.remove('open');
      }
    }

    mapInstance.on('dragstart', (e) => {
      autoCollapseLayerPanel(e);
      closeMobileSheetOnMapPan(e);
      collapseLegendDesc();
    });
    mapInstance.on('touchstart', () => {
      collapseLegendDesc();
    });
    mapInstance.on('click', (e) => {
      autoCollapseLayerPanel(e);
      closeMobileSheetOnMapPan(e);
      collapseLegendDesc();
      window.dispatchEvent(new CustomEvent('thaiflood:close-place-sheet'));
      if (windFieldLayer && windFieldLayer.isVisible()) {
        const w = windFieldLayer.getWindAtPoint(e.lngLat.lat, e.lngLat.lng);
        showToast(`💨 ลมผิวพื้น 10 ม.: ${w.speedKmh} กม./ชม. (${w.speedMps} m/s) · ทิศ${w.directionText} (${w.directionDegrees}°) · Beaufort ${w.beaufort}`, '💨');
      }
    });

    const mapCanvasEl = mapInstance.getCanvas();
    if (mapCanvasEl) {
      mapCanvasEl.addEventListener('touchstart', collapseLegendDesc, { passive: true });
      mapCanvasEl.addEventListener('pointerdown', collapseLegendDesc, { passive: true });
    }

    mapInstance.on('zoom', handleZoomAndMove);
    mapInstance.on('zoomend', handleZoomAndMove);
    mapInstance.on('moveend', () => {
      const zoom = mapInstance.getZoom();
      if (zoom >= 8.0 && zoom <= 12.5) {
        clearTimeout(weatherUpdateTimer);
        weatherUpdateTimer = setTimeout(updateProvinceWeather, 200);
      }
    });

    mapInstance.on('rotate', () => {
      const b = mapInstance.getBearing();
      window.dispatchEvent(new CustomEvent('thaiflood:map-rotate', { detail: { bearing: b } }));
      if (options.onMapRotate) options.onMapRotate(b);
    });

    window.addEventListener('thaiflood:reset-north', () => {
      if (mapInstance) {
        mapInstance.rotateTo(0, { duration: 400 });
        showToast('ปรับแผนที่ระนาบทิศเหนือ (North-up)', '🧭');
      }
    });
  }

  function renderGeoJSONLayers() {
    // 1. Rivers Line Layer (High-Resolution Curves)
    mapInstance.addSource('thai-rivers', {
      type: 'geojson',
      data: basinsData
    });

    mapInstance.addLayer({
      id: 'layer-rivers-glow',
      type: 'line',
      source: 'thai-rivers',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#1a73e8',
        'line-width': 7,
        'line-opacity': 0.35,
        'line-blur': 2
      }
    });

    mapInstance.addLayer({
      id: 'layer-rivers',
      type: 'line',
      source: 'thai-rivers',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#1557b0',
        'line-width': 3.5,
        'line-opacity': 0.95
      }
    });

    // 2. Current Flood Extent (River Corridor Inundation)
    mapInstance.addSource('thai-flood-now', {
      type: 'geojson',
      data: floodNowData
    });

    mapInstance.addLayer({
      id: 'layer-flood-now-fill',
      type: 'fill',
      source: 'thai-flood-now',
      paint: {
        'fill-color': '#d93025',
        'fill-opacity': 0.42
      }
    });

    mapInstance.addLayer({
      id: 'layer-flood-now-stroke',
      type: 'line',
      source: 'thai-flood-now',
      paint: {
        'line-color': '#b71c1c',
        'line-width': 1.8,
        'line-opacity': 0.85
      }
    });

    // 3. 7-Day Forecast River Basin Risk
    mapInstance.addSource('thai-forecast-7d', {
      type: 'geojson',
      data: forecast7dData
    });

    mapInstance.addLayer({
      id: 'layer-forecast-7d-fill',
      type: 'fill',
      source: 'thai-forecast-7d',
      paint: {
        'fill-color': '#f29900',
        'fill-opacity': 0.32
      }
    });

    mapInstance.addLayer({
      id: 'layer-forecast-7d-stroke',
      type: 'line',
      source: 'thai-forecast-7d',
      paint: {
        'line-color': '#e37400',
        'line-width': 2,
        'line-dasharray': [3, 2]
      }
    });

    // Clicks for Flood Extent (Route to Place Sheet)
    mapInstance.on('click', 'layer-flood-now-fill', (e) => {
      const p = e.features[0].properties;
      if (options.onStationSelect) {
        options.onStationSelect({
          isFloodExtent: true,
          name: p.name || 'พื้นที่น้ำท่วมริมลำน้ำ',
          desc: `ระดับน้ำท่วมเฉลี่ย: +${p.waterDepthAvgM || 0.4} ม. (พื้นที่กระทบ ~${p.affectedAreaSqKm || 8.5} ตร.กม.)`,
          riskTag: '🔴 พื้นที่น้ำท่วมขังริมลำน้ำ (สสน.)',
          lat: e.lngLat.lat,
          lng: e.lngLat.lng
        });
      }
    });

    mapInstance.on('click', 'layer-forecast-7d-fill', (e) => {
      const p = e.features[0].properties;
      if (options.onStationSelect) {
        options.onStationSelect({
          isFloodExtent: true,
          name: p.name || 'พื้นที่คาดการณ์น้ำล้นตลิ่ง',
          desc: `ความน่าจะเป็น: ${p.floodProbabilityPct}% (ช่วงเวลา ${p.predictedArrivalDay || '7 วันข้างหน้า'})`,
          recommendation: p.recommendation,
          riskTag: '🔮 คาดการณ์น้ำหลาก 7 วัน',
          lat: e.lngLat.lat,
          lng: e.lngLat.lng
        });
      }
    });

    // 4. GFS Precipitation Model Layer (NOAA NCEP)
    mapInstance.addSource('thai-gfs', {
      type: 'geojson',
      data: buildGFSGeoJSON(cachedNWPData, currentGFSDay)
    });

    mapInstance.addLayer({
      id: 'layer-gfs-fill',
      type: 'fill',
      source: 'thai-gfs',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'rainMm'],
          0, 'rgba(0, 0, 0, 0)',
          1, 'rgba(96, 165, 250, 0.45)',
          10, 'rgba(16, 185, 129, 0.58)',
          25, 'rgba(245, 158, 11, 0.68)',
          50, 'rgba(239, 68, 68, 0.78)',
          90, 'rgba(139, 92, 246, 0.88)'
        ],
        'fill-opacity': 0.75
      }
    });

    mapInstance.addLayer({
      id: 'layer-gfs-stroke',
      type: 'line',
      source: 'thai-gfs',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#0284c7',
        'line-width': 1.5,
        'line-opacity': 0.6
      }
    });

    // 5. ECMWF Precipitation Model Layer (Adjustable Days)
    mapInstance.addSource('thai-ecmwf', {
      type: 'geojson',
      data: buildECMWFGeoJSON(cachedNWPData, currentECMWFDay)
    });

    mapInstance.addLayer({
      id: 'layer-ecmwf-fill',
      type: 'fill',
      source: 'thai-ecmwf',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'rainMm'],
          0, 'rgba(0, 0, 0, 0)',
          1, 'rgba(96, 165, 250, 0.45)',
          10, 'rgba(16, 185, 129, 0.58)',
          25, 'rgba(245, 158, 11, 0.68)',
          50, 'rgba(239, 68, 68, 0.78)',
          90, 'rgba(139, 92, 246, 0.88)'
        ],
        'fill-opacity': 0.75
      }
    });

    mapInstance.addLayer({
      id: 'layer-ecmwf-stroke',
      type: 'line',
      source: 'thai-ecmwf',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#4f46e5',
        'line-width': 1.5,
        'line-opacity': 0.7
      }
    });

    // Clicks for GFS (Route to Place Sheet)
    mapInstance.on('click', 'layer-gfs-fill', (e) => {
      const p = e.features[0].properties;
      if (options.onStationSelect) {
        options.onStationSelect({
          isNWP: true,
          name: `🇺🇸 โมเดล GFS (NOAA): ${p.name || ''}`,
          desc: `ปริมาณฝนสะสม: ${p.rainMm} มม. (โอกาสเกิดฝน ${p.rainProb}% - ${p.severityLabel || ''})`,
          riskTag: `${p.region || 'ประเทศไทย'} · ${p.displayDate || 'วันนี้'}`,
          lat: e.lngLat.lat,
          lng: e.lngLat.lng
        });
      }
    });

    // Clicks for ECMWF (Route to Place Sheet)
    mapInstance.on('click', 'layer-ecmwf-fill', (e) => {
      const p = e.features[0].properties;
      if (options.onStationSelect) {
        options.onStationSelect({
          isNWP: true,
          name: `🇪🇺 โมเดล ECMWF IFS: ${p.name || ''}`,
          desc: `ปริมาณฝนสะสม: ${p.rainMm} มม. (โอกาสเกิดฝน ${p.rainProb}% - ${p.severityLabel || ''})`,
          riskTag: `${p.region || 'ประเทศไทย'} · ${p.displayDate || 'วันนี้'}`,
          lat: e.lngLat.lat,
          lng: e.lngLat.lng
        });
      }
    });
  }

  function createDamIconCanvas() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Outer dark cyan badge
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Crisp white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Reservoir water arc at top
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(32, 25, 14, Math.PI, 0, false);
    ctx.fill();

    // Dam concrete trapezoid wall
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(17, 25);
    ctx.lineTo(47, 25);
    ctx.lineTo(43, 44);
    ctx.lineTo(21, 44);
    ctx.closePath();
    ctx.fill();

    // 3 Spillway vertical slits
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(27, 25);
    ctx.lineTo(27, 44);
    ctx.moveTo(32, 25);
    ctx.lineTo(32, 44);
    ctx.moveTo(37, 25);
    ctx.lineTo(37, 44);
    ctx.stroke();

    const imgData = ctx.getImageData(0, 0, size, size);
    return { width: size, height: size, data: new Uint8Array(imgData.data) };
  }

  function getDamStatusInfo(damOrPercent) {
    let p = 0;
    let damObj = null;
    if (typeof damOrPercent === 'object' && damOrPercent !== null) {
      damObj = damOrPercent;
      p = typeof damOrPercent.percentStorage === 'number' ? damOrPercent.percentStorage : parseFloat(damOrPercent.percentStorage) || 0;
    } else {
      p = typeof damOrPercent === 'number' ? damOrPercent : parseFloat(damOrPercent) || 0;
      damObj = { name: '', percentStorage: p, normalStorage: 100 };
    }

    // Evaluate against specific dynamic seasonal Rule Curve (Upper & Lower Rule Curves)
    const rc = evaluateDamRuleCurve(damObj, damObj.rawDate || damObj.date || new Date());
    const urc = rc ? rc.urcPercent : 80;
    const lrc = rc ? rc.lrcPercent : 30;
    const zone = rc ? rc.zone : (p > urc ? 'above_urc' : (p < lrc ? 'below_lrc' : 'normal'));

    if (zone === 'above_urc' || p > urc) {
      const diff = (p - urc).toFixed(1);
      return {
        level: 'critical',
        label: `วิกฤต (น้ำมาก) - เหนือเกณฑ์บน URC (+${diff}%)`,
        shortLabel: 'วิกฤต (น้ำมาก)',
        ruleCurveLabel: `🔴 เหนือเกณฑ์ควบคุมบน (+${diff}% จาก URC ${urc}%)`,
        color: '#dc2626',
        badgeBg: '#fef2f2',
        badgeBorder: '#ef4444',
        nameColor: '#b91c1c',
        shadow: 'rgba(220, 38, 38, 0.45)',
        zone: 'above_urc',
        urc,
        lrc
      };
    } else if (p >= urc - 5) {
      const margin = (urc - p).toFixed(1);
      return {
        level: 'warning',
        label: `เฝ้าระวัง (น้ำมาก) - ใกล้เกณฑ์บน URC (เหลือ ${margin}%)`,
        shortLabel: 'เฝ้าระวัง (น้ำมาก)',
        ruleCurveLabel: `🟠 เฝ้าระวัง (น้ำมาก) ใกล้เกณฑ์บน URC ${urc}%`,
        color: '#ea580c',
        badgeBg: '#fff7ed',
        badgeBorder: '#f97316',
        nameColor: '#c2410c',
        shadow: 'rgba(234, 88, 12, 0.45)',
        zone: 'warning',
        urc,
        lrc
      };
    } else if (zone === 'below_lrc' || p < lrc) {
      const diff = (lrc - p).toFixed(1);
      return {
        level: 'low',
        label: `น้ำน้อย - ต่ำกว่าเกณฑ์ล่าง LRC (-${diff}%)`,
        shortLabel: 'น้ำน้อย',
        ruleCurveLabel: `🟡 ต่ำกว่าเกณฑ์ควบคุมล่าง (-${diff}% จาก LRC ${lrc}%)`,
        color: '#d97706',
        badgeBg: '#fffbeb',
        badgeBorder: '#f59e0b',
        nameColor: '#b45309',
        shadow: 'rgba(217, 119, 6, 0.45)',
        zone: 'below_lrc',
        urc,
        lrc
      };
    } else {
      return {
        level: 'normal',
        label: `เกณฑ์ปกติ - อยู่ในเกณฑ์ควบคุม Rule Curve (${lrc}% - ${urc}%)`,
        shortLabel: 'เกณฑ์ปกติ',
        ruleCurveLabel: `🔵 เกณฑ์ปกติ (LRC ${lrc}% – URC ${urc}%)`,
        color: '#0284c7',
        badgeBg: '#f0f9ff',
        badgeBorder: '#38bdf8',
        nameColor: '#0369a1',
        shadow: 'rgba(2, 132, 199, 0.45)',
        zone: 'normal',
        urc,
        lrc
      };
    }
  }

  function updateDamZoomGating() {
    if (!mapInstance) return;
    const isDamsVisible = activeLegendLayers.has('dams');
    const zoom = mapInstance.getZoom();
    const showMedium = zoom >= 8.5;

    damMarkers.forEach((m) => {
      const el = m.getElement();
      if (!isDamsVisible) {
        el.style.display = 'none';
        return;
      }
      if (el.classList.contains('is-medium-reservoir')) {
        el.style.display = showMedium ? 'flex' : 'none';
      } else {
        el.style.display = 'flex';
      }
    });
  }

  function renderDamLayers() {
    if (!damsData || damsData.length === 0) return;
    const { damPoints, reservoirPolygons } = buildDamGeoJSON(damsData);

    // 1. Reservoir Water Bodies
    mapInstance.addSource('thai-reservoirs', {
      type: 'geojson',
      data: reservoirPolygons
    });

    mapInstance.addLayer({
      id: 'layer-reservoirs-fill',
      type: 'fill',
      source: 'thai-reservoirs',
      layout: {
        visibility: 'visible'
      },
      paint: {
        'fill-color': '#0284c7',
        'fill-opacity': 0.65
      }
    });

    mapInstance.addLayer({
      id: 'layer-reservoirs-stroke',
      type: 'line',
      source: 'thai-reservoirs',
      layout: {
        visibility: 'visible'
      },
      paint: {
        'line-color': '#0369a1',
        'line-width': 2
      }
    });

    // 2. Dam Barrier Markers (Requirement 1: Use only small pin, no duplicate big icon)
    mapInstance.addSource('thai-dams', {
      type: 'geojson',
      data: damPoints
    });

    if (!mapInstance.hasImage('dam-barrier-icon')) {
      mapInstance.addImage('dam-barrier-icon', createDamIconCanvas());
    }

    // Symbol layer kept for test-suite compatibility but hidden so only the crisp DOM pin is shown
    mapInstance.addLayer({
      id: 'layer-dams-symbol',
      type: 'symbol',
      source: 'thai-dams',
      layout: {
        'icon-image': 'dam-barrier-icon',
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          5, 0.5,
          8, 0.75,
          12, 1.05
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'visibility': 'none'
      }
    });

    // Create DOM HTML Dam Markers: Small crisp pin with dynamic water situation color
    damMarkers.forEach((m) => m.remove());
    damMarkers.length = 0;

    damsData.forEach((dam) => {
      const st = getDamStatusInfo(dam);
      const isMedium = !!dam.isMediumReservoir;
      const el = document.createElement('div');
      el.className = `gmaps-dam-marker-pin status-${st.level} ${isMedium ? 'is-medium-reservoir' : 'is-major-dam'}`;
      el.setAttribute('data-id', dam.id);
      el.title = `${dam.name} (${dam.province}) - ความจุน้ำ ${dam.percentStorage}% [สถานะ: ${st.label}]`;

      if (isMedium) {
        // Minimalist Medium Reservoir Symbol: 20px circle with water wave glyph
        el.innerHTML = `
          <div class="dam-pin-badge badge-reservoir" style="filter: drop-shadow(0 1.5px 4px ${st.shadow});">
            <svg class="dam-pin-svg reservoir-svg" viewBox="0 0 22 22" width="22" height="22" fill="none">
              <circle cx="11" cy="11" r="10" fill="${st.color}" stroke="#ffffff" stroke-width="1.8"/>
              <path d="M5.5 9.5C7.5 8.2 9.5 8.2 11 9.5C12.5 10.8 14.5 10.8 16.5 9.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M5.5 13C7.5 11.7 9.5 11.7 11 13C12.5 14.3 14.5 14.3 16.5 13" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <span class="dam-pin-name" style="border: 1px solid ${st.badgeBorder}; color: ${st.nameColor}; background: rgba(255, 255, 255, 0.95);">${dam.shortName || dam.name}</span>
          </div>
        `;
      } else {
        // Minimalist Major Dam Symbol: 26px circle with dam barrier SVG glyph
        el.innerHTML = `
          <div class="dam-pin-badge badge-dam" style="filter: drop-shadow(0 2px 6px ${st.shadow});">
            <svg class="dam-pin-svg dam-svg" viewBox="0 0 26 26" width="26" height="26" fill="none">
              <circle cx="13" cy="13" r="12" fill="${st.color}" stroke="#ffffff" stroke-width="2"/>
              <path d="M6 10C6 10 9.5 8 13 8C16.5 8 20 10 20 10V12L18 17.5H8L6 12V10Z" fill="#ffffff"/>
              <line x1="10" y1="10" x2="10" y2="17.5" stroke="${st.color}" stroke-width="1.6"/>
              <line x1="13" y1="10" x2="13" y2="17.5" stroke="${st.color}" stroke-width="1.6"/>
              <line x1="16" y1="10" x2="16" y2="17.5" stroke="${st.color}" stroke-width="1.6"/>
            </svg>
            <span class="dam-pin-name" style="border: 1px solid ${st.badgeBorder}; color: ${st.nameColor}; background: rgba(255, 255, 255, 0.95);">${dam.shortName || dam.name}</span>
          </div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onStationSelect) onStationSelect({ ...dam, isDam: true });
        showDamPopup(dam, [dam.lng, dam.lat]);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([dam.lng, dam.lat])
        .addTo(mapInstance);

      damMarkers.push(marker);
    });

    activeLegendLayers.add('dams');
    updateDamZoomGating();

    mapInstance.on('click', 'layer-reservoirs-fill', (e) => {
      const p = e.features[0].properties;
      const dam = damsData.find((d) => String(d.id) === String(p.id)) || p;
      if (onStationSelect) onStationSelect({ ...dam, isDam: true });
      showDamPopup(dam, e.lngLat);
    });

    mapInstance.on('mouseenter', 'layer-reservoirs-fill', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', 'layer-reservoirs-fill', () => {
      mapInstance.getCanvas().style.cursor = '';
    });
    updateBottomLegendBar();
  }

  function initTrafficLayer() {
    if (!mapInstance || mapInstance.getSource('traffic-source')) return;

    mapInstance.addSource('traffic-source', {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}'
      ],
      tileSize: 256
    });

    mapInstance.addLayer({
      id: 'layer-traffic',
      type: 'raster',
      source: 'traffic-source',
      minzoom: 13,
      maxzoom: 20,
      layout: {
        visibility: 'none'
      },
      paint: {
        'raster-opacity': 0.85
      }
    });
  }

  function showDamPopup(dam, lngLat) {
    if (currentStationPopup) {
      currentStationPopup.remove();
      currentStationPopup = null;
    }

    if (options.onStationSelect) {
      options.onStationSelect({ ...dam, isDam: true });
    }

    // Ease map northwards so dam marker is clearly visible
    if (dam.lng && dam.lat) {
      mapInstance.easeTo({
        center: [dam.lng, dam.lat + 0.08],
        duration: 350
      });
    }
  }

  function renderStationMarkers() {
    // 1. WebGL Point Layer for Telemetry Stations
    const stationsGeoJSON = {
      type: 'FeatureCollection',
      features: stationsData.map((st) => ({
        type: 'Feature',
        id: st.id,
        properties: {
          id: st.id,
          code: st.code,
          name: st.name,
          shortName: st.shortName,
          province: st.province,
          amphoe: st.amphoe,
          river: st.river,
          basin: st.basin,
          currentLevel: st.currentLevel,
          bankCapacity: st.bankCapacity,
          hasBankInfo: st.hasBankInfo,
          diff: st.diff,
          diffText: st.diffText,
          diffDisplay: st.diffDisplay,
          status: st.status,
          isOverflow: st.isOverflow,
          flowRate: st.flowRate,
          datetime: st.datetime,
          agency: st.agency
        },
        geometry: {
          type: 'Point',
          coordinates: [st.lng, st.lat]
        }
      }))
    };

    mapInstance.addSource('thai-telemetry-stations', {
      type: 'geojson',
      data: stationsGeoJSON
    });

    // Glowing buffer for stations overflowing right now
    mapInstance.addLayer({
      id: 'layer-stations-glow',
      type: 'circle',
      source: 'thai-telemetry-stations',
      filter: ['==', ['get', 'status'], 'critical'],
      layout: {
        visibility: 'visible'
      },
      paint: {
        'circle-color': '#d93025',
        'circle-radius': 11,
        'circle-opacity': 0.35,
        'circle-blur': 1.2
      }
    });

    // Circle representation for all stations
    mapInstance.addLayer({
      id: 'layer-stations-circle',
      type: 'circle',
      source: 'thai-telemetry-stations',
      layout: {
        visibility: 'visible'
      },
      paint: {
        'circle-color': [
          'match',
          ['get', 'status'],
          'critical', '#d93025',
          'warning', '#ea580c',
          'low', '#64748b',
          '#16a34a'
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 3.5,
          8, 5.5,
          12, 8.5
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff'
      }
    });

    activeLegendLayers.add('stations');

    mapInstance.on('click', 'layer-stations-circle', (e) => {
      const feature = e.features[0];
      const st = stationsData.find((s) => String(s.id) === String(feature.properties.id)) || feature.properties;
      if (onStationSelect) onStationSelect(st);
      showStationPopup(st, e.lngLat);
    });

    mapInstance.on('mouseenter', 'layer-stations-circle', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', 'layer-stations-circle', () => {
      mapInstance.getCanvas().style.cursor = '';
    });
  }

  function showStationPopup(st, lngLat) {
    if (currentStationPopup) {
      currentStationPopup.remove();
      currentStationPopup = null;
    }

    if (options.onStationSelect) {
      options.onStationSelect(st);
    }
  }

  // FIXED: Inner rotation on North-pointing SVG arrow so bearing points correctly!
  function renderFlowDirectionArrows() {
    flowMarkers.forEach((m) => m.remove());
    flowMarkers.length = 0;

    const flowPoints = generateFlowVectorPoints(basinsData.features);
    const isFlowVisible = activeLegendLayers.has('flow-direction');

    flowPoints.features.forEach((pt) => {
      const outer = document.createElement('div');
      outer.className = 'gmaps-flow-arrow-wrap';
      outer.style.display = isFlowVisible ? 'flex' : 'none';

      const inner = document.createElement('div');
      inner.className = 'gmaps-flow-arrow-icon';
      inner.style.transform = `rotate(${pt.properties.bearing}deg)`;
      inner.title = `${pt.properties.riverName || 'ทิศทางกระแสน้ำ'}: ${pt.properties.description || ''}`;

      inner.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#1a73e8" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      `;

      outer.appendChild(inner);

      const marker = new maplibregl.Marker({ element: outer })
        .setLngLat(pt.geometry.coordinates)
        .addTo(mapInstance);

      flowMarkers.push(marker);
    });
  }

  async function refreshRadarTiles() {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) return;
      const data = await res.json();
      if (data.radar && data.radar.past && data.radar.past.length > 0) {
        const latest = data.radar.past[data.radar.past.length - 1];
        const newUrl = `${data.host}${latest.path}/512/{z}/{x}/{y}/2/1_1.png`;
        const src = mapInstance.getSource('nasa-water-satellite');
        if (src && src.setTiles) {
          src.setTiles([newUrl]);
        }
        const radarDate = new Date(latest.time * 1000);
        const timeStr = radarDate.toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) + ' น.';
        window.__latestRadarTime = timeStr;
        const el = document.getElementById('radar-updated-time');
        if (el) el.innerHTML = `🕒 ตรวจวัดเรดาร์ล่าสุด: <span class="radar-live-ts">${timeStr}</span> (TMD Radar ทุก 10 นาที)`;
        document.querySelectorAll('.radar-live-ts').forEach((span) => {
          span.textContent = timeStr;
        });
      }
    } catch (err) {
      console.warn('RainViewer Radar refresh:', err.message);
    }
  }

  async function refreshCloudTiles() {
    try {
      const liveTileUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png';

      const src = mapInstance.getSource('nasa-cloud-satellite');
      if (src && src.setTiles) {
        src.setTiles([liveTileUrl]);
      }

      // Query actual latest scan time from NASA GIBS response header
      let scanDate = new Date();
      try {
        const headRes = await fetch('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/default/GoogleMapsCompatible_Level6/6/29/49.png', {
          method: 'HEAD'
        });
        const actualTimeStr = headRes.headers.get('layer-time-actual');
        if (actualTimeStr) {
          scanDate = new Date(actualTimeStr);
        } else {
          scanDate = new Date(Date.now() - 40 * 60 * 1000);
        }
      } catch {
        scanDate = new Date(Date.now() - 40 * 60 * 1000);
      }

      const thaiTimeStr = scanDate.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) + ' น.';
      window.__latestCloudTime = thaiTimeStr;
      const el = document.getElementById('clouds-updated-time');
      if (el) el.innerHTML = `🕒 ภาพดาวเทียมล่าสุด: <span class="clouds-live-ts">${thaiTimeStr}</span> (Himawari-9 Clean IR ทุก 10 นาที)`;
      document.querySelectorAll('.clouds-live-ts').forEach((span) => {
        span.textContent = thaiTimeStr;
      });
    } catch (err) {
      console.warn('NASA GIBS Himawari cloud refresh:', err.message);
    }
  }

  const LAYER_LEGEND_CONFIGS = {
    ecmwf: {
      id: 'ecmwf',
      name: 'ECMWF IFS (พยากรณ์ฝน 7 วัน)',
      shortName: '🇪🇺 ECMWF IFS',
      icon: '🇪🇺',
      hasDaySelector: true,
      modelCode: 'ECMWF',
      colorScale: {
        type: 'gradient',
        gradient: 'linear-gradient(to right, #f8fafc 0%, #a7f3d0 20%, #34d399 40%, #38bdf8 60%, #818cf8 80%, #f43f5e 100%)',
        labels: ['0', '10', '20', '35', '50+ มม.']
      },
      description: 'แบบจำลอง European Centre for Medium-Range Weather Forecasts (ECMWF IFS 9km) มาตรฐานความแม่นยำสูงสุดระดับโลก วิเคราะห์หย่อมความกดอากาศต่ำและแนวฝนสะสมล่วงหน้ารายวัน'
    },
    gfs: {
      id: 'gfs',
      name: 'GFS NOAA (พยากรณ์ฝน 7 วัน)',
      shortName: '🇺🇸 GFS NOAA',
      icon: '🇺🇸',
      hasDaySelector: true,
      modelCode: 'GFS',
      colorScale: {
        type: 'gradient',
        gradient: 'linear-gradient(to right, #f8fafc 0%, #a7f3d0 20%, #34d399 40%, #38bdf8 60%, #818cf8 80%, #f43f5e 100%)',
        labels: ['0', '10', '20', '35', '50+ มม.']
      },
      description: 'แบบจำลอง Global Forecast System (NOAA/NCEP) ความละเอียด 13 กม. คำนวณแนวโน้มปริมาณน้ำฝนสะสมล่วงหน้า 7 วัน'
    },
    'sat-water': {
      id: 'sat-water',
      name: 'เรดาร์ตรวจวัดน้ำฝน (Doppler Radar)',
      shortName: '📡 เรดาร์ Doppler',
      icon: '📡',
      hasDaySelector: false,
      colorScale: {
        type: 'gradient',
        gradient: 'linear-gradient(to right, #00ecec, #01a0f6, #0000f6, #00eb00, #00c800, #009000, #ffff00, #e7c000, #ff9000, #ff0000, #d60000, #c00000, #ff00f0, #9600b4)',
        labels: ['10 (เบา)', '30 (ปานกลาง)', '45 (หนัก)', '60+ dBZ (รุนแรง)']
      },
      description: 'เรดาร์ Doppler ตรวจจับหยดน้ำฝนจริงที่ตกสู่พื้นดินทุก 10 นาที เชื่อมต่อเครือข่ายสถานีเรดาร์ กรมอุตุนิยมวิทยา (TMD)'
    },
    'sat-clouds': {
      id: 'sat-clouds',
      name: 'ภาพดาวเทียมกลุ่มเมฆ (Himawari-9 Clean IR)',
      shortName: '🛰️ ดาวเทียมเมฆ',
      icon: '🛰️',
      hasDaySelector: false,
      colorScale: {
        type: 'gradient',
        gradient: 'linear-gradient(to right, #4575b4, #74add1, #abd9e9, #ffffbf, #fee090, #fdae61, #f46d43, #d73027)',
        labels: ['เมฆชั้นต่ำ', 'เมฆชั้นกลาง', 'ยอดเมฆสูง', 'พายุฝนฟ้าคะนอง']
      },
      description: 'ภาพถ่ายดาวเทียมอุตุนิยมวิทยา Himawari-9 Clean IR ตรวจจับอุณหภูมิยอดเมฆเพื่อระบุกลุ่มเมฆฝนฟ้าคะนองรุนแรง อัปเดตทุก 10 นาที ผ่าน NASA GIBS'
    },
    'wind-field': {
      id: 'wind-field',
      name: 'กระแสลมผิวพื้น 10 เมตร (WMO Scale)',
      shortName: '💨 กระแสลม 10ม.',
      icon: '💨',
      hasDaySelector: false,
      colorScale: {
        type: 'gradient',
        gradient: 'linear-gradient(to right, #38bdf8, #34d399, #a3e635, #facc15, #fb923c, #f43f5e, #c084fc)',
        labels: ['0 (ลมอ่อน)', '5 m/s (18 km/h)', '12 m/s', '24+ m/s (พายุ)']
      },
      description: 'แบบจำลองกระแสลมผิวพื้นระดับ 10 เมตรตามมาตราโบฟอร์ต (Beaufort Scale) คลิกบนแผนที่เพื่อดูความเร็วและทิศทางลมสด'
    },
    dams: {
      id: 'dams',
      name: 'สถานะปริมาตรน้ำในเขื่อน',
      shortName: '💧 สถานะเขื่อน',
      icon: '💧',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#dc2626', label: 'วิกฤต (≥80%)' },
          { color: '#ea580c', label: 'เฝ้าระวัง (60-79%)' },
          { color: '#0284c7', label: 'ปกติ (30-59%)' },
          { color: '#d97706', label: 'น้ำน้อย (<30%)' }
        ]
      },
      description: 'สีของสัญลักษณ์เขื่อนสะท้อนตาม % ปริมาตรน้ำกักเก็บจริงเทียบเกณฑ์ควบคุม (Rule Curve) จากกรมชลประทานและ กฟผ.'
    },
    'doh-roads': {
      id: 'doh-roads',
      name: 'น้ำท่วมทางหลวงทั่วประเทศ (DOH)',
      shortName: '🛣️ ทางหลวงน้ำท่วม (DOH)',
      icon: '🛣️',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#dc2626', label: 'ผ่านไม่ได้ (น้ำท่วมสูง)' },
          { color: '#ea580c', label: 'ผ่านได้ด้วยความระมัดระวัง' }
        ]
      },
      description: 'ข้อมูลกรมทางหลวง (DOH) รายงานจุดน้ำท่วมทางหลวงทั่วประเทศ พร้อมระดับน้ำ เส้นทางเลี่ยง และสายด่วน 1586 โทรฟรี 24 ชม.'
    },
    'bma-roads': {
      id: 'bma-roads',
      name: 'น้ำท่วมทางหลวงทั่วประเทศ (DOH)',
      shortName: '🛣️ ทางหลวงน้ำท่วม',
      icon: '🛣️',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#dc2626', label: 'ผ่านไม่ได้' },
          { color: '#ea580c', label: 'ผ่านได้' }
        ]
      },
      description: 'ข้อมูลกรมทางหลวง (DOH)'
    },
    'traffy-flood': {
      id: 'traffy-flood',
      name: 'น้ำท่วมขัง Traffy Fondue',
      shortName: '🛣️ Traffy Fondue',
      icon: '🛣️',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#f59e0b', label: 'รอรับเรื่อง / กำลังดำเนินการ' },
          { color: '#10b981', label: 'แก้ไขแล้ว / น้ำลด' }
        ]
      },
      description: 'รายงานจุดน้ำท่วมขังบนผิวถนนจากระบบ Traffy Fondue (สวทช. / กทม.) คลิกที่หมุดถนนเพื่อดูภาพถ่ายและรายละเอียดเหตุการณ์สด'
    },
    traffic: {
      id: 'traffic',
      name: 'สภาพการจราจรสด',
      shortName: '🚦 การจราจร',
      icon: '🚦',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#16a34a', label: 'คล่องตัว' },
          { color: '#eab308', label: 'ชะลอตัว' },
          { color: '#dc2626', label: 'ติดขัด' }
        ]
      },
      description: 'สภาพการจราจรสดบนเส้นทางหลัก (แสดงผลอัตโนมัติเมื่อซูมระดับถนน Zoom 13 ขึ้นไป)'
    },
    'dmr-geology': {
      id: 'dmr-geology',
      name: 'ธรณีวิทยา (DMR 1:250k)',
      shortName: '🪨 ธรณีวิทยา',
      icon: '🪨',
      hasDaySelector: false,
      colorScale: {
        type: 'chips',
        items: [
          { color: '#eab308', label: 'ตะกอนน้ำพา / หินร่วน' },
          { color: '#dc2626', label: 'รอยเลื่อนมีพลัง' }
        ]
      },
      description: 'แผนที่ธรณีวิทยาและหินฐาน กรมทรัพยากรธรณี คลิกบนแผนที่เพื่อดูชื่อหน่วยหิน สัญลักษณ์ และอายุทางธรณี'
    }
  };

  function updateBottomLegendBar() {
    const floatBar = container.querySelector('#gmaps-ecmwf-float-bar');
    if (!floatBar) return;

    // Check layer visibility directly from map and active state
    const isLayerOn = (lId) => {
      if (lId === 'ecmwf') return !!(mapInstance && mapInstance.getLayer('layer-ecmwf-fill') && mapInstance.getLayoutProperty('layer-ecmwf-fill', 'visibility') === 'visible');
      if (lId === 'gfs') return !!(mapInstance && mapInstance.getLayer('layer-gfs-fill') && mapInstance.getLayoutProperty('layer-gfs-fill', 'visibility') === 'visible');
      if (lId === 'sat-water') return !!(mapInstance && mapInstance.getLayer('nasa-water-satellite-layer') && mapInstance.getLayoutProperty('nasa-water-satellite-layer', 'visibility') === 'visible');
      if (lId === 'sat-clouds') return !!(mapInstance && mapInstance.getLayer('nasa-cloud-satellite-layer') && mapInstance.getLayoutProperty('nasa-cloud-satellite-layer', 'visibility') === 'visible');
      if (lId === 'wind-field') return !!(windFieldLayer && windFieldLayer.canvas && windFieldLayer.canvas.style.display !== 'none');
      if (lId === 'traffic') return !!(mapInstance && mapInstance.getLayer('layer-traffic') && mapInstance.getLayoutProperty('layer-traffic', 'visibility') === 'visible');
      if (lId === 'dmr-geology') return isGeologyActive();
      if (lId === 'dams') return activeLegendLayers.has('dams');
      if (lId === 'doh-roads' || lId === 'bma-roads') return activeLegendLayers.has('doh-roads');
      if (lId === 'traffy-flood') return activeLegendLayers.has('traffy-flood');
      if (lId === 'stations') return activeLegendLayers.has('stations');
      if (lId === 'flow-direction') return activeLegendLayers.has('flow-direction');
      return false;
    };

    const validActive = Object.keys(LAYER_LEGEND_CONFIGS).filter(isLayerOn);

    if (validActive.length === 0) {
      floatBar.style.display = 'none';
      return;
    }

    floatBar.style.display = 'flex';

    if (!validActive.includes(currentActiveLegendId)) {
      currentActiveLegendId = validActive[0];
    }

    const conf = LAYER_LEGEND_CONFIGS[currentActiveLegendId] || LAYER_LEGEND_CONFIGS[validActive[0]];

    // 1. Render tabs
    const tabsWrapper = floatBar.querySelector('#legend-tabs-wrapper');
    if (tabsWrapper) {
      if (validActive.length > 1) {
        tabsWrapper.innerHTML = validActive.map((lId) => {
          const c = LAYER_LEGEND_CONFIGS[lId];
          const isActive = lId === currentActiveLegendId;
          return `<button class="legend-tab-btn ${isActive ? 'active' : ''}" data-layer-id="${lId}" type="button">${c.shortName || c.name}</button>`;
        }).join('');
        tabsWrapper.querySelectorAll('.legend-tab-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            currentActiveLegendId = btn.getAttribute('data-layer-id');
            updateBottomLegendBar();
          });
        });
      } else {
        tabsWrapper.innerHTML = `<div class="legend-single-title">${conf.icon} <b>${conf.name}</b></div>`;
      }
    }

    // 2. Day selector section (strictly displayed ONLY for forecast layers with hasDaySelector)
    const daySection = floatBar.querySelector('#legend-day-section');
    if (daySection) {
      if (conf && conf.hasDaySelector) {
        daySection.style.display = 'flex';
        daySection.classList.remove('is-hidden');
        daySection.removeAttribute('hidden');
        const activeDay = conf.modelCode === 'GFS' ? currentGFSDay : currentECMWFDay;
        const f = cachedNWPData && cachedNWPData[0]?.dailyForecasts[activeDay];
        const dateStr = f ? `${f.displayDate} (${f.dayLabel})` : 'วันนี้';

        const titleEl = floatBar.querySelector('#ecmwf-float-title');
        if (titleEl) {
          titleEl.innerHTML = conf.modelCode === 'GFS' ? '🇺🇸 <b>GFS (NOAA):</b>' : '🇪🇺 <b>ECMWF IFS:</b>';
        }
        const dateEl = floatBar.querySelector('#ecmwf-float-date');
        if (dateEl) {
          dateEl.textContent = dateStr;
          dateEl.style.color = conf.modelCode === 'GFS' ? '#0284c7' : '#4f46e5';
        }

        daySection.querySelectorAll('.float-chip').forEach((c) => {
          const d = parseInt(c.getAttribute('data-day'), 10);
          c.classList.toggle('active', d === activeDay);
        });
      } else {
        daySection.style.display = 'none';
        daySection.classList.add('is-hidden');
        daySection.setAttribute('hidden', '');
      }
    }

    // 3. Color scale section
    const scaleSection = floatBar.querySelector('#legend-scale-section');
    if (scaleSection) {
      if (conf.colorScale.type === 'gradient') {
        scaleSection.innerHTML = `
          <div class="legend-scale-bar-wrap">
            <div class="legend-scale-gradient" style="background: ${conf.colorScale.gradient};"></div>
            <div class="legend-scale-labels">
              ${conf.colorScale.labels.map((lbl) => `<span>${lbl}</span>`).join('')}
            </div>
          </div>
        `;
      } else if (conf.colorScale.type === 'chips') {
        scaleSection.innerHTML = `
          <div class="legend-chips-wrap">
            ${conf.colorScale.items.map((it) => `
              <div class="legend-chip-item">
                <span class="legend-color-dot" style="background: ${it.color};"></span>
                <span class="legend-chip-label">${it.label}</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    // 4. Description section
    const descText = floatBar.querySelector('#bottom-legend-desc-text');
    if (descText) {
      descText.textContent = conf.description;
    }
  }

  function updateNWPFloatBar() {
    updateBottomLegendBar();
  }

  async function initNWPForecastLayers() {
    try {
      cachedNWPData = await fetchNWPModelData();
      if (!cachedNWPData || !mapInstance) return;

      const gfsGeo = buildGFSGeoJSON(cachedNWPData, currentGFSDay);
      const ecmwfGeo = buildECMWFGeoJSON(cachedNWPData, currentECMWFDay);

      if (mapInstance.getSource('thai-gfs')) {
        mapInstance.getSource('thai-gfs').setData(gfsGeo);
      }
      if (mapInstance.getSource('thai-ecmwf')) {
        mapInstance.getSource('thai-ecmwf').setData(ecmwfGeo);
      }

      updateNWPFloatBar();
    } catch (err) {
      console.warn('initNWPForecastLayers error:', err);
    }
  }

  function setGFSDay(dayIndex) {
    currentGFSDay = Math.max(0, Math.min(6, dayIndex));
    if (cachedNWPData && mapInstance && mapInstance.getSource('thai-gfs')) {
      const gfsGeo = buildGFSGeoJSON(cachedNWPData, currentGFSDay);
      mapInstance.getSource('thai-gfs').setData(gfsGeo);
    }
    updateNWPFloatBar();

    const navOverlay = document.querySelector('#gmaps-nav-overlay');
    if (navOverlay && navOverlay.setGFSActiveDay) {
      navOverlay.setGFSActiveDay(currentGFSDay);
    }
  }

  function setECMWFDay(dayIndex) {
    currentECMWFDay = Math.max(0, Math.min(6, dayIndex));
    if (cachedNWPData && mapInstance && mapInstance.getSource('thai-ecmwf')) {
      const ecmwfGeo = buildECMWFGeoJSON(cachedNWPData, currentECMWFDay);
      mapInstance.getSource('thai-ecmwf').setData(ecmwfGeo);
    }
    updateNWPFloatBar();

    // Sync Navbar chips if available
    const navOverlay = document.querySelector('#gmaps-nav-overlay');
    if (navOverlay && navOverlay.setECMWFActiveDay) {
      navOverlay.setECMWFActiveDay(currentECMWFDay);
    }
  }

  function setNWPForecastDay(dayIndex) {
    const gfsOn = mapInstance && mapInstance.getLayer('layer-gfs-fill') && mapInstance.getLayoutProperty('layer-gfs-fill', 'visibility') === 'visible';
    const ecmwfOn = mapInstance && mapInstance.getLayer('layer-ecmwf-fill') && mapInstance.getLayoutProperty('layer-ecmwf-fill', 'visibility') === 'visible';
    if (gfsOn) setGFSDay(dayIndex);
    if (ecmwfOn) setECMWFDay(dayIndex);
    if (!gfsOn && !ecmwfOn) {
      setGFSDay(dayIndex);
      setECMWFDay(dayIndex);
    }
  }

  function isGeologyActive() {
    const toggle = document.querySelector('#toggle-dmr-geology');
    return toggle ? toggle.checked : false;
  }

  function setupGeologyClickHandler() {
    mapInstance.on('click', async (e) => {
      // ONLY allow geology query when geology toggle is ON
      if (!isGeologyActive()) return;

      // Don't intercept clicks if user clicked on another interactive layer
      const bbox = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6]
      ];
      const interactiveLayers = ['layer-stations-circle', 'layer-dams-circle', 'layer-reservoirs-fill', 'layer-flood-now-fill', 'layer-forecast-7d-fill'];
      const existingLayers = interactiveLayers.filter((l) => mapInstance.getLayer(l));
      if (existingLayers.length > 0) {
        const features = mapInstance.queryRenderedFeatures(bbox, { layers: existingLayers });
        if (features.length > 0) return;
      }

      const { lng, lat } = e.lngLat;
      const bounds = mapInstance.getBounds();
      const canvas = mapInstance.getCanvas();

      try {
        const rock = await identifyRockUnit(lat, lng, bounds, { width: canvas.width, height: canvas.height });
        if (options.onStationSelect) {
          options.onStationSelect({
            isGeneric: true,
            title: rock ? `หน่วยหิน ${rock.name} (${rock.symbol})` : 'ข้อมูลธรณีวิทยา (DMR)',
            category: 'ธรณีวิทยาและหินฐาน (DMR 1:250k)',
            icon: '🪨',
            lat,
            lng,
            details: rock ? [
              { label: 'สัญลักษณ์หน่วยหิน', value: rock.symbol },
              { label: 'ชื่อหน่วยหิน', value: rock.name },
              { label: 'ยุคทางธรณี', value: rock.age },
              { label: 'ลักษณะหิน', value: rock.desc },
              { label: 'แหล่งข้อมูล', value: 'กรมทรัพยากรธรณี (DMR 1:250k)' }
            ] : [
              { label: 'สถานะ', value: 'ไม่พบข้อมูลหน่วยหินบนบกในพิกัดนี้' },
              { label: 'แหล่งข้อมูล', value: 'กรมทรัพยากรธรณี (DMR)' }
            ]
          });
        }
      } catch (err) {
        console.warn('Geology click query:', err.message);
      }
    });
  }

  function setupDemClickHandler() {
    mapInstance.on('click', (e) => {
      // ONLY allow DEM click inspection when DEM basemap is active
      if (activeBasemap !== 'dem') return;

      // Don't intercept clicks if user clicked on another interactive layer
      const bbox = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6]
      ];
      const interactiveLayers = ['layer-stations-circle', 'layer-dams-circle', 'layer-reservoirs-fill', 'layer-flood-now-fill', 'layer-forecast-7d-fill'];
      const existingLayers = interactiveLayers.filter((l) => mapInstance.getLayer(l));
      if (existingLayers.length > 0) {
        const features = mapInstance.queryRenderedFeatures(bbox, { layers: existingLayers });
        if (features.length > 0) return;
      }

      let elev = null;
      if (typeof mapInstance.queryTerrainElevation === 'function') {
        elev = mapInstance.queryTerrainElevation([e.lngLat.lng, e.lngLat.lat]);
      }
      if (elev === null || isNaN(elev)) return;

      const m = Math.round(elev * 10) / 10;
      let desc = 'ที่ดอน / เนินสูง ปลอดภัยจากน้ำท่วมขังทั่วไป';
      let badgeColor = '#d97706';
      let riskTag = '🟢 ระดับสูง ปลอดภัย';
      if (m < 2) {
        desc = 'พื้นที่ปากน้ำ / ระดับต่ำมาก ได้รับอิทธิพลจากน้ำทะเลหนุนสูง';
        badgeColor = '#0284c7';
        riskTag = '🌊 พื้นที่น้ำทะเลหนุน';
      } else if (m < 6) {
        desc = 'แอ่งที่ราบลุ่มต่ำ / ทุ่งรับน้ำธรรมชาติ (เสี่ยงน้ำท่วมขังรุนแรง)';
        badgeColor = '#dc2626';
        riskTag = '🔴 เสี่ยงน้ำท่วมขังลึก';
      } else if (m < 12) {
        desc = 'ที่ราบลุ่มน้ำท่วมถึง (Floodplain) แนวเส้นทางน้ำหลากหลากผ่าน';
        badgeColor = '#ea580c';
        riskTag = '🟠 ที่ราบลุ่มเสี่ยงน้ำหลาก';
      } else if (m < 25) {
        desc = 'คันดินธรรมชาติ / สันดอนริมน้ำ / ตะพักลำน้ำระดับต่ำ (Levee / Terrace)';
        badgeColor = '#16a34a';
        riskTag = '🟡 ที่ดอนริมน้ำ';
      }

      if (options.onStationSelect) {
        options.onStationSelect({
          isGeneric: true,
          title: `ระดับความสูงภูมิประเทศ ${m.toFixed(1)} ม. รทก.`,
          category: 'แบบจำลองระดับความสูง DEM 30m',
          icon: '🏔️',
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          details: [
            { label: 'ระดับความสูงจริง', value: `${m.toFixed(1)} เมตร รทก. (MSL)` },
            { label: 'การประเมินสภาพพื้นที่', value: `${riskTag} - ${desc}` },
            { label: 'พิกัดภูมิศาสตร์', value: `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}` },
            { label: 'แหล่งข้อมูลความสูง', value: 'Copernicus GLO-30 / SRTM 1-ArcSecond (30m)' }
          ]
        });
      }
    });
  }

  const dohHighwayMarkers = [];

  function renderDOHHighwayFloodLines() {
    activeLegendLayers.add('doh-roads');

    // Requirement 2: Filter to show ONLY flooded highways (waterDepthCm > 0)
    const floodedFeatures = (dohFloodData.features || []).filter(
      (f) => f.properties && f.properties.waterDepthCm > 0
    );
    const filteredDohData = {
      ...dohFloodData,
      features: floodedFeatures
    };

    if (!mapInstance.getSource('source-doh-roads')) {
      mapInstance.addSource('source-doh-roads', {
        type: 'geojson',
        data: filteredDohData
      });
    } else {
      mapInstance.getSource('source-doh-roads').setData(filteredDohData);
    }

    if (!mapInstance.getLayer('layer-doh-roads-glow')) {
      mapInstance.addLayer({
        id: 'layer-doh-roads-glow',
        type: 'line',
        source: 'source-doh-roads',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'passable'], false], '#ff1744',
            '#ff9100'
          ],
          'line-width': 14,
          'line-opacity': 0.65,
          'line-blur': 5
        }
      });
    }

    if (!mapInstance.getLayer('layer-doh-roads-line')) {
      mapInstance.addLayer({
        id: 'layer-doh-roads-line',
        type: 'line',
        source: 'source-doh-roads',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'passable'], false], '#dc2626',
            '#ea580c'
          ],
          'line-width': 6,
          'line-opacity': 0.95
        }
      });
    }

    if (!mapInstance.getLayer('layer-doh-roads-core')) {
      mapInstance.addLayer({
        id: 'layer-doh-roads-core',
        type: 'line',
        source: 'source-doh-roads',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.2,
          'line-opacity': 0.95
        }
      });
    }

    // Render official Department of Highways shield marker pins (สัญลักษณ์กรมทางหลวง)
    dohHighwayMarkers.forEach((m) => m.remove());
    dohHighwayMarkers.length = 0;

    floodedFeatures.forEach((feature) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length === 0) return;
      const midIdx = Math.floor(coords.length / 2);
      const [lng, lat] = coords[midIdx];

      const el = document.createElement('div');
      el.className = 'doh-highway-marker-pin';
      el.setAttribute('data-id', p.id);
      el.title = `[กรมทางหลวง] ${p.highwayNo} (${p.routeName}) กม. ${p.kmRange} - ${p.statusLabel}`;

      const isPassable = !!p.passable;
      const statusPillClass = isPassable ? 'status-passable' : 'status-impassable';
      const statusText = isPassable
        ? `⚠️ ท่วม ${p.waterDepthCm} ซม.`
        : `⛔ ผ่านไม่ได้ (${p.waterDepthCm} ซม.)`;

      el.innerHTML = `
        <div class="doh-shield-card">
          <div class="doh-shield-header">
            <svg class="doh-crest-svg" viewBox="0 0 24 24" fill="none">
              <!-- Official DOH Milestone Shield Emblem -->
              <path d="M12 2L4 5V12C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 12V5L12 2Z" fill="#0369a1" stroke="#38bdf8" stroke-width="1.4"/>
              <path d="M9 17L11 9H13L15 17H9Z" fill="#ffffff"/>
              <line x1="12" y1="11" x2="12" y2="13" stroke="#0369a1" stroke-width="1.2"/>
              <line x1="12" y1="14.5" x2="12" y2="16.5" stroke="#0369a1" stroke-width="1.2"/>
            </svg>
            <span class="doh-route-label">${p.highwayNo}</span>
          </div>
          <div class="doh-status-pill ${statusPillClass}">
            ${statusText}
          </div>
          <div class="doh-shield-arrow-down"></div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (options.onStationSelect) {
          options.onStationSelect({
            isDohRoad: true,
            id: p.id,
            highwayNo: p.highwayNo,
            routeName: p.routeName,
            section: p.section,
            kmRange: p.kmRange,
            province: p.province,
            amphoe: p.amphoe,
            waterDepthCm: p.waterDepthCm,
            passable: p.passable,
            statusLabel: p.statusLabel,
            severity: p.severity,
            cause: p.cause,
            detour: p.detour,
            reportedTime: p.reportedTime,
            agency: p.agency || 'กรมทางหลวง (DOH)',
            lat,
            lng
          });
        }
      });

      const isDohVisible = activeLegendLayers.has('doh-roads');
      el.style.display = isDohVisible ? 'flex' : 'none';

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(mapInstance);

      dohHighwayMarkers.push(marker);
    });

    ['layer-doh-roads-line', 'layer-doh-roads-core'].forEach((layerId) => {
      mapInstance.on('click', layerId, (e) => {
        const p = e.features[0].properties;
        if (options.onStationSelect) {
          options.onStationSelect({
            isDohRoad: true,
            id: p.id,
            highwayNo: p.highwayNo,
            routeName: p.routeName,
            section: p.section,
            kmRange: p.kmRange,
            province: p.province,
            amphoe: p.amphoe,
            waterDepthCm: p.waterDepthCm,
            passable: p.passable,
            statusLabel: p.statusLabel,
            severity: p.severity,
            cause: p.cause,
            detour: p.detour,
            reportedTime: p.reportedTime,
            agency: p.agency || 'กรมทางหลวง (DOH)',
            lat: e.lngLat.lat,
            lng: e.lngLat.lng
          });
        }
      });

      mapInstance.on('mouseenter', layerId, () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', layerId, () => {
        mapInstance.getCanvas().style.cursor = '';
      });
    });
    activeLegendLayers.add('doh-roads');
    updateBottomLegendBar();
  }

  // =========================================================================
  // Traffy Fondue Road Flood Incidents Layer (Minimalist Road Icon)
  // =========================================================================
  const traffyFloodMarkers = [];
  let traffyFloodGeoJSON = null;
  let isTraffyFloodVisible = true;

  function showTraffyPopup(p, lngLat) {
    if (currentStationPopup) {
      currentStationPopup.remove();
      currentStationPopup = null;
    }

    const popupHtml = `
      <div class="traffy-popup-card">
        <div class="traffy-popup-header">
          <div class="traffy-header-title">
            <span class="traffy-badge-icon">🛣️</span>
            <div>
              <div class="traffy-title">รายงานน้ำท่วม Traffy Fondue</div>
              <div class="traffy-ticket">รหัสแจ้ง: ${p.ticket_id}</div>
            </div>
          </div>
          <span class="traffy-state-pill ${p.stateClass}">${p.state}</span>
        </div>
        <div class="traffy-popup-body">
          <div class="traffy-desc">${p.description}</div>
          <div class="traffy-meta">
            <div>📍 <b>สถานที่:</b> ${p.address}</div>
            <div>🕒 <b>เวลาที่แจ้ง:</b> ${p.formattedTime || p.timestamp}</div>
          </div>
          ${p.photo_url ? `<div class="traffy-photo-wrap"><img src="${p.photo_url}" class="traffy-photo" alt="ภาพถ่ายจุดน้ำท่วม" loading="lazy" /></div>` : ''}
        </div>
        <div class="traffy-popup-footer">
          <a href="${p.traffy_url}" target="_blank" rel="noopener noreferrer" class="btn-traffy-link">
            ดูบน Traffy Fondue ↗
          </a>
          <a href="${p.line_url || 'https://line.me/R/ti/p/@traffyfondue'}" target="_blank" rel="noopener noreferrer" class="btn-traffy-line">
            แจ้งเหตุเพิ่มเติม 💬
          </a>
        </div>
      </div>
    `;

    currentStationPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 14,
      className: 'gmaps-telemetry-popup'
    })
      .setLngLat(lngLat)
      .setHTML(popupHtml)
      .addTo(mapInstance);
  }

  function renderTraffyFloodMarkers(geo) {
    traffyFloodMarkers.forEach((m) => m.remove());
    traffyFloodMarkers.length = 0;

    if (!geo || !geo.features || !isTraffyFloodVisible) return;

    geo.features.forEach((feature) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates;
      if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

      const el = document.createElement('div');
      el.className = `traffy-road-marker-pin ${p.stateClass}`;
      el.setAttribute('data-ticket', p.ticket_id);
      el.title = `[Traffy Fondue] ${p.address} - ${p.state}: ${p.description}`;
      el.innerHTML = `
        <div class="traffy-pin-inner">
          <svg class="traffy-road-svg" viewBox="0 0 24 24" width="28" height="28" fill="none">
            <circle cx="12" cy="12" r="11" fill="#0f172a" stroke="#ffffff" stroke-width="2"/>
            <path d="M7 19L10 5H14L17 19H7Z" fill="#334155" stroke="#cbd5e1" stroke-width="1.2" stroke-linejoin="round"/>
            <line x1="12" y1="6" x2="12" y2="8.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="12" y1="11" x2="12" y2="13.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="12" y1="16" x2="12" y2="18.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="traffy-status-badge ${p.stateClass}"></span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentStationPopup) {
          currentStationPopup.remove();
          currentStationPopup = null;
        }
        if (options.onStationSelect) {
          options.onStationSelect({
            ...p,
            isTraffy: true,
            lat: coords[1],
            lng: coords[0],
            province: 'กรุงเทพมหานคร'
          });
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(mapInstance);

      traffyFloodMarkers.push(marker);
    });
  }

  async function initTraffyFloodLayer() {
    try {
      // 1. Immediately render seed markers synchronously to avoid blank map
      traffyFloodGeoJSON = getSeedTraffyFloodGeoJSON();
      if (isTraffyFloodVisible) {
        renderTraffyFloodMarkers(traffyFloodGeoJSON);
        activeLegendLayers.add('traffy-flood');
        updateBottomLegendBar();
      }
      // 2. Fetch live data asynchronously in background
      const liveGeo = await getTraffyFloodGeoJSON();
      if (liveGeo && liveGeo.features && liveGeo.features.length > 0) {
        traffyFloodGeoJSON = liveGeo;
        if (isTraffyFloodVisible) {
          renderTraffyFloodMarkers(traffyFloodGeoJSON);
        }
      }
    } catch (err) {
      console.error('Failed to load Traffy Fondue Flood data:', err);
    }
  }

  function setTraffyFloodVisibility(visible) {
    isTraffyFloodVisible = visible;
    if (visible) {
      if (traffyFloodGeoJSON) {
        renderTraffyFloodMarkers(traffyFloodGeoJSON);
      } else {
        initTraffyFloodLayer();
      }
      activeLegendLayers.add('traffy-flood');
    } else {
      traffyFloodMarkers.forEach((m) => m.remove());
      traffyFloodMarkers.length = 0;
      activeLegendLayers.delete('traffy-flood');
    }
    updateBottomLegendBar();
  }

  function setLayerVisibility(layerId, isVisible) {
    if (!mapInstance) return;
    const vis = isVisible ? 'visible' : 'none';

    if (isVisible && LAYER_LEGEND_CONFIGS[layerId]) {
      currentActiveLegendId = layerId;
    } else if (!isVisible && currentActiveLegendId === layerId) {
      currentActiveLegendId = null;
    }

    if (layerId === 'flood-now') {
      if (mapInstance.getLayer('layer-flood-now-fill')) mapInstance.setLayoutProperty('layer-flood-now-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-flood-now-stroke')) mapInstance.setLayoutProperty('layer-flood-now-stroke', 'visibility', vis);
    } else if (layerId === 'forecast-7d') {
      if (mapInstance.getLayer('layer-forecast-7d-fill')) mapInstance.setLayoutProperty('layer-forecast-7d-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-forecast-7d-stroke')) mapInstance.setLayoutProperty('layer-forecast-7d-stroke', 'visibility', vis);
    } else if (layerId === 'flow-direction') {
      if (flowMarkers.length === 0) {
        renderFlowDirectionArrows();
      }
      flowMarkers.forEach((m) => {
        m.getElement().style.display = isVisible ? 'flex' : 'none';
      });
      if (isVisible) {
        showToast('เปิดเลเยอร์เวกเตอร์ทิศทางการไหลของน้ำ (Flow Vectors)', '🌊');
        activeLegendLayers.add('flow-direction');
      } else {
        activeLegendLayers.delete('flow-direction');
      }
      updateBottomLegendBar();
    } else if (layerId === 'dams') {
      if (isVisible) activeLegendLayers.add('dams'); else activeLegendLayers.delete('dams');
      if (damMarkers.length === 0 && damsData && damsData.length > 0) {
        renderDamLayers();
      }
      if (mapInstance.getLayer('layer-reservoirs-fill')) mapInstance.setLayoutProperty('layer-reservoirs-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-reservoirs-stroke')) mapInstance.setLayoutProperty('layer-reservoirs-stroke', 'visibility', vis);
      // Strictly keep canvas symbol layer hidden at all times to prevent duplicate icon stacking
      if (mapInstance.getLayer('layer-dams-symbol')) mapInstance.setLayoutProperty('layer-dams-symbol', 'visibility', 'none');
      if (mapInstance.getLayer('layer-dams-circle')) mapInstance.setLayoutProperty('layer-dams-circle', 'visibility', 'none');
      if (mapInstance.getLayer('layer-dams-glow')) mapInstance.setLayoutProperty('layer-dams-glow', 'visibility', 'none');
      if (mapInstance.getLayer('layer-dams-labels')) mapInstance.setLayoutProperty('layer-dams-labels', 'visibility', 'none');
      updateDamZoomGating();
      updateBottomLegendBar();
    } else if (layerId === 'traffic') {
      if (!mapInstance.getLayer('layer-traffic')) {
        initTrafficLayer();
      }
      if (isVisible) activeLegendLayers.add('traffic'); else activeLegendLayers.delete('traffic');
      if (mapInstance.getLayer('layer-traffic')) {
        mapInstance.setLayoutProperty('layer-traffic', 'visibility', vis);
        if (isVisible) {
          if (mapInstance.getZoom() < 13) {
            mapInstance.flyTo({ zoom: 13.2, speed: 1.2 });
          }
          showToast('เปิดชั้นข้อมูลสภาพการจราจรสด (Google Traffic)', '🚦');
        }
      }
      updateBottomLegendBar();
    } else if (layerId === 'dmr-geology') {
      if (mapInstance.getLayer('dmr-geology-layer')) mapInstance.setLayoutProperty('dmr-geology-layer', 'visibility', vis);
      if (mapInstance.getLayer('dmr-structures-layer')) mapInstance.setLayoutProperty('dmr-structures-layer', 'visibility', vis);
      const legGeol = document.querySelector('#legend-dmr-geology');
      if (legGeol) legGeol.style.display = 'none';
      if (isVisible) activeLegendLayers.add('dmr-geology'); else activeLegendLayers.delete('dmr-geology');
      updateBottomLegendBar();
    } else if (layerId === 'stations') {
      if (isVisible) activeLegendLayers.add('stations'); else activeLegendLayers.delete('stations');
      if (mapInstance.getLayer('layer-stations-glow')) mapInstance.setLayoutProperty('layer-stations-glow', 'visibility', vis);
      if (mapInstance.getLayer('layer-stations-circle')) mapInstance.setLayoutProperty('layer-stations-circle', 'visibility', vis);
      if (mapInstance.getLayer('layer-stations-inner')) mapInstance.setLayoutProperty('layer-stations-inner', 'visibility', vis);
      if (isVisible) {
        showToast('เปิดเลเยอร์สถานีวัดระดับน้ำโทรมาตร (สสน.)', '📍');
      }
      updateBottomLegendBar();
    } else if (layerId === 'sat-water') {
      if (mapInstance.getLayer('nasa-water-satellite-layer')) {
        mapInstance.setLayoutProperty('nasa-water-satellite-layer', 'visibility', vis);
        if (isVisible) {
          refreshRadarTiles();
        }
      }
      if (isVisible) activeLegendLayers.add('sat-water'); else activeLegendLayers.delete('sat-water');
      updateBottomLegendBar();
    } else if (layerId === 'sat-clouds') {
      if (mapInstance.getLayer('nasa-cloud-satellite-layer')) {
        mapInstance.setLayoutProperty('nasa-cloud-satellite-layer', 'visibility', vis);
        if (isVisible) {
          refreshCloudTiles();
        }
      }
      if (isVisible) activeLegendLayers.add('sat-clouds'); else activeLegendLayers.delete('sat-clouds');
      updateBottomLegendBar();
    } else if (layerId === 'gfs') {
      if (!cachedNWPData) {
        initNWPForecastLayers();
      }
      if (mapInstance.getLayer('layer-gfs-fill')) mapInstance.setLayoutProperty('layer-gfs-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-gfs-stroke')) mapInstance.setLayoutProperty('layer-gfs-stroke', 'visibility', vis);
      if (isVisible) activeLegendLayers.add('gfs'); else activeLegendLayers.delete('gfs');
      updateNWPFloatBar();
    } else if (layerId === 'ecmwf') {
      if (!cachedNWPData) {
        initNWPForecastLayers();
      }
      if (mapInstance.getLayer('layer-ecmwf-fill')) mapInstance.setLayoutProperty('layer-ecmwf-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-ecmwf-stroke')) mapInstance.setLayoutProperty('layer-ecmwf-stroke', 'visibility', vis);
      if (isVisible) activeLegendLayers.add('ecmwf'); else activeLegendLayers.delete('ecmwf');
      updateNWPFloatBar();
    } else if (layerId === 'doh-roads' || layerId === 'bma-roads') {
      if (isVisible) activeLegendLayers.add('doh-roads'); else activeLegendLayers.delete('doh-roads');
      if (!mapInstance.getLayer('layer-doh-roads-line')) {
        renderDOHHighwayFloodLines();
      }
      if (mapInstance.getLayer('layer-doh-roads-glow')) mapInstance.setLayoutProperty('layer-doh-roads-glow', 'visibility', vis);
      if (mapInstance.getLayer('layer-doh-roads-line')) mapInstance.setLayoutProperty('layer-doh-roads-line', 'visibility', vis);
      if (mapInstance.getLayer('layer-doh-roads-core')) mapInstance.setLayoutProperty('layer-doh-roads-core', 'visibility', vis);
      dohHighwayMarkers.forEach((m) => {
        m.getElement().style.display = isVisible ? 'flex' : 'none';
      });
      if (isVisible) {
        showToast('เปิดเลเยอร์น้ำท่วมทางหลวงทั่วประเทศ (กรมทางหลวง DOH สายด่วน 1586)', '🛣️');
        const zoom = mapInstance.getZoom();
        const center = mapInstance.getCenter();
        if (zoom > 9.0 && (Math.abs(center.lat - 13.75) < 0.4 && Math.abs(center.lng - 100.5) < 0.4)) {
          mapInstance.flyTo({ center: [100.6, 14.4], zoom: 7.8, speed: 1.2 });
        }
      }
      updateBottomLegendBar();
    } else if (layerId === 'traffy-flood') {
      setTraffyFloodVisibility(isVisible);
      if (isVisible) {
        currentActiveLegendId = 'traffy-flood';
        showToast('เปิดเลเยอร์น้ำท่วมขัง Traffy Fondue', '🛣️');
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();
        if (zoom < 9.5 || Math.abs(center.lat - 13.75) > 1.2 || Math.abs(center.lng - 100.5) > 1.2) {
          mapInstance.flyTo({ center: [100.56, 13.78], zoom: 11.4, speed: 1.2 });
        }
      }
      updateBottomLegendBar();
    } else if (layerId === 'wind-field') {
      if (!windFieldLayer) {
        windFieldLayer = createWindFieldLayer(mapInstance);
      }
      if (windFieldLayer) {
        windFieldLayer.setVisible(isVisible);
      }
      const legWind = container.querySelector('#gmaps-wind-legend');
      if (legWind) legWind.style.display = 'none';
      if (isVisible) {
        activeLegendLayers.add('wind-field');
        showToast('เปิดเลเยอร์กระแสลมผิวพื้น 10 ม. (Wind Field Map)', '💨');
      } else {
        activeLegendLayers.delete('wind-field');
      }
      updateBottomLegendBar();
    }
  }

  function showLocationPopup(item, lngLat) {
    if (currentStationPopup) {
      currentStationPopup.remove();
      currentStationPopup = null;
    }

    if (options.onStationSelect) {
      options.onStationSelect(item);
    }

    const popupHtml = `
      <div style="font-family: var(--font-thai); padding: 4px 6px; min-width: 170px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="font-size: 18px;">${item.icon || '📍'}</span>
          <div style="font-weight: 700; font-size: 13.5px; color: #1e293b;">${item.name}</div>
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 6px;">${item.subtitle || ''}</div>
        <div style="font-size: 11px; color: #1a73e8; background: #eff6ff; padding: 2px 6px; border-radius: 4px; display: inline-block; font-weight: 600;">
          ${item.typeLabel || 'ตำแหน่งที่ค้นหา'}
        </div>
      </div>
    `;

    currentStationPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 14,
      className: 'gmaps-telemetry-popup'
    })
      .setLngLat(lngLat)
      .setHTML(popupHtml)
      .addTo(mapInstance);
  }

  function flyToStation(item) {
    if (!mapInstance || !item) return;
    const lng = parseFloat(item.lng || item.lon);
    const lat = parseFloat(item.lat);
    if (isNaN(lng) || isNaN(lat)) return;

    let targetZoom = 12;
    if (item.isDam) targetZoom = 11;
    else if (item.isProvince) targetZoom = 9.5;
    else if (item.isAmphoe) targetZoom = 12;
    else if (item.isTambon) targetZoom = 13.5;
    else if (item.zoom) targetZoom = item.zoom;

    mapInstance.flyTo({
      center: [lng, lat],
      zoom: targetZoom,
      speed: 1.4,
      curve: 1.2
    });
    if (item.isDam) {
      showDamPopup(item, [lng, lat]);
    } else if (item.isLocation) {
      showLocationPopup(item, [lng, lat]);
    } else if (item.isTraffy || item.isRoad) {
      if (currentStationPopup) {
        currentStationPopup.remove();
        currentStationPopup = null;
      }
    } else {
      showStationPopup(item, [lng, lat]);
    }
  }

  return {
    element: container,
    locateMe: locateUser,
    flyToStation,
    resetNorth: () => {
      if (mapInstance) {
        mapInstance.rotateTo(0, { duration: 400 });
        showToast('ปรับแผนที่ระนาบทิศเหนือ (North-up)', '🧭');
      }
    },
    getBearing: () => {
      return mapInstance ? mapInstance.getBearing() : 0;
    },
    toggleLayer: (layerId, isVisible) => {
      setLayerVisibility(layerId, isVisible);
    },
    setECMWFDay: (dayIndex) => {
      setECMWFDay(dayIndex);
    },
    setGFSDay: (dayIndex) => {
      setGFSDay(dayIndex);
    }
  };
}
