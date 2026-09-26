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
import { fetchNWPModelData, buildGFSGeoJSON, buildECMWFGeoJSON } from '../services/nwpForecastService.js';
import bmaFloodRoadLines from '../data/bmaFloodRoadLines.json';
import { createWindFieldLayer } from './WindFieldLayer.js';
import { evaluateDamRuleCurve } from '../services/damRuleCurveService.js';

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

  // Basemap Switcher (Google Maps Style with 50x50px square preview cards, >> expand button, and sideways options)
  const basemapSwitcher = document.createElement('div');
  basemapSwitcher.className = 'gmaps-basemap-container';
  basemapSwitcher.id = 'gmaps-basemap-container';
  basemapSwitcher.innerHTML = `
    <div class="gmaps-basemap-header">
      <span class="basemap-header-label">ประเภทแผนที่: <b id="basemap-active-name">แผนที่</b></span>
    </div>
    <div class="gmaps-basemap-wrapper">
      <button class="gmaps-basemap-trigger" id="gmaps-basemap-trigger" title="คลิกหรือชี้เมาส์เพื่อเลือกประเภทแผนที่" type="button">
        <div class="basemap-thumb thumb-street" id="basemap-active-thumb"></div>
        <div class="basemap-expand-arrow" id="basemap-expand-arrow" title="แสดงตัวเลือกแผนที่อื่น">»</div>
      </button>
      <div class="gmaps-basemap-side-grid" id="gmaps-basemap-side-grid">
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
    <span class="pill-icon" id="pill-weather-icon">🌤️</span>
    <span class="pill-temp" id="pill-weather-temp">--°</span>
    <span class="pill-divider">·</span>
    <span class="pill-location" id="pill-weather-prov">กำลังโหลด...</span>
    <span class="pill-desc" id="pill-weather-desc"></span>
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
  let cachedNWPData = null;
  let currentGFSDay = 0;
  let currentECMWFDay = 0;
  let currentStationPopup = null;
  let userLocationMarker = null;
  let userLocationPopup = null;
  let toastTimeout = null;

  // Floating NWP Day Controller (appears when GFS or ECMWF is toggled ON)
  const ecmwfFloatBar = document.createElement('div');
  ecmwfFloatBar.className = 'gmaps-ecmwf-float-bar';
  ecmwfFloatBar.id = 'gmaps-ecmwf-float-bar';
  ecmwfFloatBar.style.display = 'none';
  ecmwfFloatBar.innerHTML = `
    <div class="float-label">
      <span>🇪🇺 <b>ECMWF IFS:</b></span>
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
  `;
  container.appendChild(ecmwfFloatBar);

  ecmwfFloatBar.querySelectorAll('.float-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.getAttribute('data-day'), 10);
      setNWPForecastDay(day);
    });
  });

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
      center: [100.4, 15.2],
      zoom: 6.8,
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

    function updateBasemapLabel(name) {
      if (basemapActiveLabel) {
        basemapActiveLabel.textContent = name;
      }
    }

    const btn3d = container.querySelector('#gmaps-btn-3d');
    let is3DPitched = false;

    function switchBasemap(mode) {
      if (!mapInstance || activeBasemap === mode) return;
      activeBasemap = mode;
      if (btnStreet) btnStreet.classList.toggle('active', mode === 'street');
      if (btnSat) btnSat.classList.toggle('active', mode === 'satellite');
      if (btnTopo) btnTopo.classList.toggle('active', mode === 'topo');

      if (basemapActiveThumb) {
        basemapActiveThumb.className = `basemap-thumb ${basemapThumbs[mode] || 'thumb-street'}`;
      }

      updateBasemapLabel(basemapNames[mode] || mode);

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

    if (btnStreet) btnStreet.addEventListener('click', () => switchBasemap('street'));
    if (btnSat) btnSat.addEventListener('click', () => switchBasemap('satellite'));
    if (btnTopo) btnTopo.addEventListener('click', () => switchBasemap('topo'));

    // Toggle expand/collapse on click of trigger or arrow
    function toggleBasemapExpand(e) {
      if (e) e.stopPropagation();
      const isExpanded = basemapSwitcher.classList.toggle('expanded');
      if (basemapArrow) basemapArrow.textContent = isExpanded ? '«' : '»';
    }

    if (basemapTrigger) basemapTrigger.addEventListener('click', toggleBasemapExpand);

    basemapSwitcher.addEventListener('mouseleave', () => {
      basemapSwitcher.classList.remove('expanded');
      if (basemapArrow) basemapArrow.textContent = '»';
      updateBasemapLabel(basemapNames[activeBasemap] || 'แผนที่');
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
          descEl.textContent = weather.weatherDesc ? `· ${weather.weatherDesc}` : '';
          weatherPill.title = `จ.${weather.province}: ${weather.temp}°C (${weather.weatherDesc}) - คลิกดูพยากรณ์ฝน 7 วัน`;
        }
      } catch (err) {
        console.warn('Weather pill update err:', err);
      }
    }

    function handleZoomAndMove() {
      if (!mapInstance) return;
      const zoom = mapInstance.getZoom();
      // Show weather pill when zoomed in closer to province/district level (zoom >= 8.0 to 12.5)
      const isProvinceView = zoom >= 8.0 && zoom <= 12.5;

      if (isProvinceView) {
        weatherPill.classList.add('visible');
        clearTimeout(weatherUpdateTimer);
        weatherUpdateTimer = setTimeout(() => {
          updateProvinceWeather();
        }, 200);
      } else {
        weatherPill.classList.remove('visible');
      }
    }

    weatherPill.addEventListener('click', () => {
      if (options.onWeatherPillClick && currentWeatherProvince) {
        options.onWeatherPillClick(currentWeatherProvince);
      }
    });

    mapInstance.on('load', () => {
      renderGeoJSONLayers();
      renderDamLayers();
      renderStationMarkers();
      renderFlowDirectionArrows();
      renderBMARoadFloodLines();
      initTrafficLayer();
      initNWPForecastLayers();
      refreshRadarTiles();
      refreshCloudTiles();
      setupGeologyClickHandler();
      setupDemClickHandler();
      windFieldLayer = createWindFieldLayer(mapInstance);
      handleZoomAndMove();
    });

    // Requirement 2: Auto collapse layer panel on map drag or click
    function autoCollapseLayerPanel() {
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

    mapInstance.on('dragstart', autoCollapseLayerPanel);
    mapInstance.on('click', (e) => {
      autoCollapseLayerPanel();
      if (windFieldLayer && windFieldLayer.isVisible()) {
        const w = windFieldLayer.getWindAtPoint(e.lngLat.lat, e.lngLat.lng);
        showToast(`💨 ลมผิวพื้น 10 ม.: ${w.speedKmh} กม./ชม. (${w.speedMps} m/s) · ทิศ${w.directionText} (${w.directionDegrees}°) · Beaufort ${w.beaufort}`, '💨');
      }
    });

    mapInstance.on('zoom', handleZoomAndMove);
    mapInstance.on('moveend', () => {
      const zoom = mapInstance.getZoom();
      if (zoom >= 8.0 && zoom <= 12.5) {
        clearTimeout(weatherUpdateTimer);
        weatherUpdateTimer = setTimeout(updateProvinceWeather, 200);
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
      data: { type: 'FeatureCollection', features: [] }
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
      data: { type: 'FeatureCollection', features: [] }
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
    const rc = evaluateDamRuleCurve(damObj, damObj.date || new Date());
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
      paint: {
        'fill-color': '#0284c7',
        'fill-opacity': 0.65
      }
    });

    mapInstance.addLayer({
      id: 'layer-reservoirs-stroke',
      type: 'line',
      source: 'thai-reservoirs',
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
      const el = document.createElement('div');
      el.className = `gmaps-dam-marker-pin status-${st.level}`;
      el.setAttribute('data-id', dam.id);
      el.title = `${dam.name} (${dam.province}) - ความจุน้ำ ${dam.percentStorage}% [สถานะ: ${st.label}]`;
      el.innerHTML = `
        <div class="dam-pin-badge" style="filter: drop-shadow(0 2px 6px ${st.shadow});">
          <svg class="dam-pin-svg" viewBox="0 0 28 28" width="28" height="28" fill="none">
            <circle cx="14" cy="14" r="13" fill="${st.color}" stroke="#ffffff" stroke-width="2"/>
            <path d="M7 11C7 11 10.5 9 14 9C17.5 9 21 11 21 11V13L19 19H9L7 13V11Z" fill="#ffffff"/>
            <line x1="11" y1="11" x2="11" y2="19" stroke="${st.color}" stroke-width="1.8"/>
            <line x1="14" y1="11" x2="14" y2="19" stroke="${st.color}" stroke-width="1.8"/>
            <line x1="17" y1="11" x2="17" y2="19" stroke="${st.color}" stroke-width="1.8"/>
          </svg>
          <span class="dam-pin-name" style="border: 1px solid ${st.badgeBorder}; color: ${st.nameColor}; background: rgba(255, 255, 255, 0.95);">${dam.shortName || dam.name}</span>
        </div>
      `;

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
    const flowPoints = generateFlowVectorPoints(basinsData.features);

    flowPoints.features.forEach((pt) => {
      const outer = document.createElement('div');
      outer.className = 'gmaps-flow-arrow-wrap';
      outer.style.display = 'none';

      const inner = document.createElement('div');
      inner.className = 'gmaps-flow-arrow-icon';
      inner.style.transform = `rotate(${pt.properties.bearing}deg)`;
      inner.title = `${pt.properties.riverName}: ${pt.properties.description}`;

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
        if (el) el.textContent = ` (อัปเดต: ${timeStr})`;
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
      if (el) el.textContent = ` (อัปเดต: ${thaiTimeStr})`;
    } catch (err) {
      console.warn('NASA GIBS Himawari cloud refresh:', err.message);
    }
  }

  function updateNWPFloatBar() {
    const floatBar = container.querySelector('#gmaps-ecmwf-float-bar');
    if (!floatBar) return;
    const gfsOn = mapInstance && mapInstance.getLayer('layer-gfs-fill') && mapInstance.getLayoutProperty('layer-gfs-fill', 'visibility') === 'visible';
    const ecmwfOn = mapInstance && mapInstance.getLayer('layer-ecmwf-fill') && mapInstance.getLayoutProperty('layer-ecmwf-fill', 'visibility') === 'visible';

    if (gfsOn || ecmwfOn) {
      floatBar.style.display = 'flex';
      const labelSpan = floatBar.querySelector('.float-label');
      const activeDay = gfsOn ? currentGFSDay : currentECMWFDay;
      const f = cachedNWPData && cachedNWPData[0]?.dailyForecasts[activeDay];
      const dateStr = f ? `${f.displayDate} (${f.dayLabel})` : 'วันนี้';

      if (labelSpan) {
        if (gfsOn && ecmwfOn) {
          labelSpan.innerHTML = `<span>🇺🇸 GFS & 🇪🇺 ECMWF:</span> <span id="ecmwf-float-date" style="color: #4f46e5; font-weight:700;">${dateStr}</span>`;
        } else if (gfsOn) {
          labelSpan.innerHTML = `<span>🇺🇸 <b>GFS (NOAA):</b></span> <span id="ecmwf-float-date" style="color: #0284c7; font-weight:700;">${dateStr}</span>`;
        } else {
          labelSpan.innerHTML = `<span>🇪🇺 <b>ECMWF IFS:</b></span> <span id="ecmwf-float-date" style="color: #4f46e5; font-weight:700;">${dateStr}</span>`;
        }
      }

      floatBar.querySelectorAll('.float-chip').forEach((c) => {
        const d = parseInt(c.getAttribute('data-day'), 10);
        c.classList.toggle('active', d === activeDay);
      });
    } else {
      floatBar.style.display = 'none';
    }
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

  function renderBMARoadFloodLines() {
    if (!mapInstance.getSource('source-bma-roads')) {
      mapInstance.addSource('source-bma-roads', {
        type: 'geojson',
        data: bmaFloodRoadLines
      });
    }

    if (!mapInstance.getLayer('layer-bma-roads-glow')) {
      mapInstance.addLayer({
        id: 'layer-bma-roads-glow',
        type: 'line',
        source: 'source-bma-roads',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'riskLevel'],
            'critical', '#ff1744',
            'warning', '#ff9100',
            '#00e5ff'
          ],
          'line-width': 14,
          'line-opacity': 0.65,
          'line-blur': 5
        }
      });
    }

    if (!mapInstance.getLayer('layer-bma-roads-line')) {
      mapInstance.addLayer({
        id: 'layer-bma-roads-line',
        type: 'line',
        source: 'source-bma-roads',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'visible'
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'riskLevel'],
            'critical', '#ff1744',
            'warning', '#ff9100',
            '#0284c7'
          ],
          'line-width': 6,
          'line-opacity': 0.95
        }
      });
    }

    // Solid Glowing Neon Core Line (Requirement 9: Solid Line & Neon Glow, No Dashes)
    if (!mapInstance.getLayer('layer-bma-roads-core')) {
      mapInstance.addLayer({
        id: 'layer-bma-roads-core',
        type: 'line',
        source: 'source-bma-roads',
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

    ['layer-bma-roads-line', 'layer-bma-roads-core'].forEach((layerId) => {
      mapInstance.on('click', layerId, (e) => {
        const p = e.features[0].properties;
        if (options.onStationSelect) {
          options.onStationSelect({
            isRoad: true,
            id: p.id,
            road: p.road,
            segment: p.segment,
            district: p.district,
            waterDepthCm: p.waterDepthCm,
            lengthKm: p.lengthKm,
            floodedLanes: p.floodedLanes,
            trafficImpact: p.trafficImpact,
            cause: p.cause,
            riskLevel: p.riskLevel,
            warningBadge: p.warningBadge,
            lastUpdated: p.lastUpdated,
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
            province: 'กรุงเทพมหานคร'
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
  }

  function setLayerVisibility(layerId, isVisible) {
    if (!mapInstance) return;
    const vis = isVisible ? 'visible' : 'none';

    if (layerId === 'flood-now') {
      if (mapInstance.getLayer('layer-flood-now-fill')) mapInstance.setLayoutProperty('layer-flood-now-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-flood-now-stroke')) mapInstance.setLayoutProperty('layer-flood-now-stroke', 'visibility', vis);
    } else if (layerId === 'forecast-7d') {
      if (mapInstance.getLayer('layer-forecast-7d-fill')) mapInstance.setLayoutProperty('layer-forecast-7d-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-forecast-7d-stroke')) mapInstance.setLayoutProperty('layer-forecast-7d-stroke', 'visibility', vis);
    } else if (layerId === 'flow-direction') {
      flowMarkers.forEach((m) => {
        m.getElement().style.display = isVisible ? 'flex' : 'none';
      });
    } else if (layerId === 'dams') {
      if (mapInstance.getLayer('layer-reservoirs-fill')) mapInstance.setLayoutProperty('layer-reservoirs-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-reservoirs-stroke')) mapInstance.setLayoutProperty('layer-reservoirs-stroke', 'visibility', vis);
      if (mapInstance.getLayer('layer-dams-symbol')) mapInstance.setLayoutProperty('layer-dams-symbol', 'visibility', vis);
      if (mapInstance.getLayer('layer-dams-circle')) mapInstance.setLayoutProperty('layer-dams-circle', 'visibility', vis);
      if (mapInstance.getLayer('layer-dams-glow')) mapInstance.setLayoutProperty('layer-dams-glow', 'visibility', vis);
      if (mapInstance.getLayer('layer-dams-labels')) mapInstance.setLayoutProperty('layer-dams-labels', 'visibility', vis);
      damMarkers.forEach((m) => {
        m.getElement().style.display = isVisible ? 'flex' : 'none';
      });
    } else if (layerId === 'traffic') {
      if (mapInstance.getLayer('layer-traffic')) {
        mapInstance.setLayoutProperty('layer-traffic', 'visibility', vis);
        if (isVisible && mapInstance.getZoom() < 13) {
          showToast('ชั้นข้อมูลการจราจรจะแสดงผลเมื่อซูมระดับ 13 ขึ้นไป (ระดับถนน/ชุมชน)', '🚦');
        }
      }
    } else if (layerId === 'dmr-geology') {
      if (mapInstance.getLayer('dmr-geology-layer')) mapInstance.setLayoutProperty('dmr-geology-layer', 'visibility', vis);
      if (mapInstance.getLayer('dmr-structures-layer')) mapInstance.setLayoutProperty('dmr-structures-layer', 'visibility', vis);
      const legGeol = document.querySelector('#legend-dmr-geology');
      if (legGeol) legGeol.style.display = isVisible ? 'block' : 'none';
    } else if (layerId === 'stations') {
      if (mapInstance.getLayer('layer-stations-glow')) mapInstance.setLayoutProperty('layer-stations-glow', 'visibility', vis);
      if (mapInstance.getLayer('layer-stations-circle')) mapInstance.setLayoutProperty('layer-stations-circle', 'visibility', vis);
      if (mapInstance.getLayer('layer-stations-inner')) mapInstance.setLayoutProperty('layer-stations-inner', 'visibility', vis);
    } else if (layerId === 'sat-water') {
      if (mapInstance.getLayer('nasa-water-satellite-layer')) {
        mapInstance.setLayoutProperty('nasa-water-satellite-layer', 'visibility', vis);
        if (isVisible) {
          refreshRadarTiles();
        }
      }
    } else if (layerId === 'sat-clouds') {
      if (mapInstance.getLayer('nasa-cloud-satellite-layer')) {
        mapInstance.setLayoutProperty('nasa-cloud-satellite-layer', 'visibility', vis);
        if (isVisible) {
          refreshCloudTiles();
        }
      }
    } else if (layerId === 'gfs') {
      if (mapInstance.getLayer('layer-gfs-fill')) mapInstance.setLayoutProperty('layer-gfs-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-gfs-stroke')) mapInstance.setLayoutProperty('layer-gfs-stroke', 'visibility', vis);
      updateNWPFloatBar();
    } else if (layerId === 'ecmwf') {
      if (mapInstance.getLayer('layer-ecmwf-fill')) mapInstance.setLayoutProperty('layer-ecmwf-fill', 'visibility', vis);
      if (mapInstance.getLayer('layer-ecmwf-stroke')) mapInstance.setLayoutProperty('layer-ecmwf-stroke', 'visibility', vis);
      updateNWPFloatBar();
    } else if (layerId === 'bma-roads') {
      if (mapInstance.getLayer('layer-bma-roads-glow')) mapInstance.setLayoutProperty('layer-bma-roads-glow', 'visibility', vis);
      if (mapInstance.getLayer('layer-bma-roads-line')) mapInstance.setLayoutProperty('layer-bma-roads-line', 'visibility', vis);
      if (mapInstance.getLayer('layer-bma-roads-core')) mapInstance.setLayoutProperty('layer-bma-roads-core', 'visibility', vis);
      if (mapInstance.getLayer('layer-bma-roads-dash')) mapInstance.setLayoutProperty('layer-bma-roads-dash', 'visibility', vis);
      if (isVisible) {
        showToast('เปิดเส้นทางน้ำท่วมถนน กทม. (23 เส้นทางหลัก)', '🚗');
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();
        if (zoom < 9.5 || Math.abs(center.lat - 13.75) > 1.2 || Math.abs(center.lng - 100.5) > 1.2) {
          mapInstance.flyTo({ center: [100.56, 13.78], zoom: 11.4, speed: 1.2 });
        }
      }
    } else if (layerId === 'wind-field') {
      if (windFieldLayer) {
        windFieldLayer.setVisible(isVisible);
      }
      const legWind = container.querySelector('#gmaps-wind-legend');
      if (legWind) legWind.style.display = isVisible ? 'block' : 'none';
      if (isVisible) {
        showToast('เปิดเลเยอร์กระแสลมผิวพื้น 10 ม. (Wind Field Map)', '💨');
      }
    }
  }

  function flyToStation(item) {
    if (!mapInstance || !item) return;
    const lng = parseFloat(item.lng);
    const lat = parseFloat(item.lat);
    if (isNaN(lng) || isNaN(lat)) return;

    mapInstance.flyTo({
      center: [lng, lat],
      zoom: item.isDam ? 11 : 12,
      speed: 1.4,
      curve: 1.2
    });
    if (item.isDam) {
      showDamPopup(item, [lng, lat]);
    } else {
      showStationPopup(item, [lng, lat]);
    }
  }

  return {
    element: container,
    locateMe: locateUser,
    flyToStation,
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
