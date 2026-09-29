/**
 * Main Application Bootstrapper for ThaiFlood
 * 100% Real Live Government Data (ThaiWater HII & TMD NWP Supercomputer)
 * Google Maps Inspired Experience (Port 3050)
 */
import './index.css';
import basinsData from './data/thailandBasins.json';
import riverReachesData from './data/riverReaches.js';
import bmaRoadsData from './data/bmaFloodRoadLines.json';
import dohFloodData from './data/dohFloodHighways.json';
import { fetchLiveWaterStations } from './services/waterStationService.js';
import { fetchLiveDams } from './services/damService.js';
import { computeCurrentFloodPolygons, compute7DayRiskPolygons } from './services/floodRiskService.js';

import { createNavbar } from './components/Navbar.js';
import { createMapViewer } from './components/MapViewer.js';
import { createWaterStationList } from './components/WaterStationList.js';

// Prevent iOS Safari / Chrome elastic window scroll dislocation
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }, { passive: true });
}

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Render initial loading skeleton
  appContainer.innerHTML = `
    <div id="live-data-loading" style="position: fixed; inset: 0; background: #ffffff; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-thai);">
      <div style="font-size: 40px; margin-bottom: 12px; animation: gmaps-pulse 1.2s infinite ease-in-out;">🌊</div>
      <div style="font-size: 16px; font-weight: 700; color: #1a73e8; margin-bottom: 6px;">กำลังเชื่อมต่อข้อมูลสดจากคลังข้อมูลน้ำแห่งชาติ (สสน.)</div>
      <div style="font-size: 12.5px; color: #5f6368;">โหลดสถานีโทรมาตรวัดระดับน้ำ 1,400+ จุด และเขื่อนหลัก 50+ แห่งทั่วประเทศ...</div>
    </div>
  `;

  try {
    // Fetch 100% real live telemetry data in parallel
    let stationsData = [];
    let damsData = [];
    try {
      const [stations, dams] = await Promise.all([
        fetchLiveWaterStations(),
        fetchLiveDams()
      ]);
      stationsData = stations || [];
      damsData = dams || [];
    } catch (err) {
      console.error('Failed to load live data:', err);
    }

    // Combine major river basins with 500+ detailed river reaches for comprehensive snapping
    const allRiverBasins = {
      type: 'FeatureCollection',
      features: [...basinsData.features, ...riverReachesData.features]
    };

    // Compute dynamic flood polygons and 7-day risks from real data (snapping to actual river reaches)
    const floodNowData = computeCurrentFloodPolygons(stationsData, allRiverBasins);
    const forecast7dData = compute7DayRiskPolygons(stationsData, allRiverBasins);

    // Clear loading screen
    appContainer.innerHTML = '';

    let placeSheetInstance = null;

    // 1. Google Maps Fullscreen Map Viewer
    const mapViewer = createMapViewer({
      basinsData,
      floodNowData,
      forecast7dData,
      stationsData,
      damsData,
      onStationSelect: (item) => {
        if (placeSheetInstance) {
          if (item.isDam) {
            placeSheetInstance.selectDam(item);
          } else if (item.isDohRoad) {
            placeSheetInstance.selectDohRoad(item);
          } else if (item.isRoad) {
            placeSheetInstance.selectRoad(item);
          } else if (item.isTraffy) {
            placeSheetInstance.selectTraffy(item);
          } else if (item.isUserLocation) {
            placeSheetInstance.selectUserLocation(item);
          } else if (item.isDedicatedWeather) {
            placeSheetInstance.openDedicatedWeatherForecast(item.province || 'กรุงเทพมหานคร');
          } else if (item.isGeneric || item.isElevation || item.isFloodExtent || item.isNWP || item.isGeology) {
            placeSheetInstance.selectGeneric(item);
          } else {
            placeSheetInstance.selectStation(item);
          }
        }
      },
      onWeatherPillClick: (provinceName) => {
        if (placeSheetInstance && placeSheetInstance.openDedicatedWeatherForecast) {
          placeSheetInstance.openDedicatedWeatherForecast(provinceName);
        }
      }
    });
    appContainer.appendChild(mapViewer.element);

    // 2. Google Maps Left Place Sheet
    placeSheetInstance = createWaterStationList(stationsData, (item) => {
      mapViewer.flyToStation(item);
    });
    appContainer.appendChild(placeSheetInstance.element);

    window.addEventListener('thaiflood:close-place-sheet', () => {
      if (placeSheetInstance && placeSheetInstance.close) {
        placeSheetInstance.close();
      }
    });

    // 3. Google Maps Top-Left Search Bar & Filter Chips
    const topWidget = createNavbar({
      stations: stationsData,
      dams: damsData,
      bmaRoads: bmaRoadsData,
      dohRoads: dohFloodData,
      onSearchSelect: (item) => {
        mapViewer.flyToStation(item);
        if (placeSheetInstance) {
          if (item.isDam) {
            placeSheetInstance.selectDam(item);
          } else if (item.isRoad) {
            placeSheetInstance.selectRoad(item);
          } else if (item.isTraffy) {
            placeSheetInstance.selectTraffy(item);
          } else if (item.isLocation) {
            placeSheetInstance.selectGeneric({
              ...item,
              desc: item.subtitle,
              riskTag: item.typeLabel || 'ตำแหน่งที่ค้นหา'
            });
          } else {
            placeSheetInstance.selectStation(item);
          }
        }
      },
      onLayerToggle: (layerId, isVisible) => {
        mapViewer.toggleLayer(layerId, isVisible);
      },
      onECMWFDayChange: (dayIndex) => {
        mapViewer.setECMWFDay(dayIndex);
      },
      onGFSDayChange: (dayIndex) => {
        mapViewer.setGFSDay(dayIndex);
      },
      onResetNorth: () => {
        if (mapViewer && mapViewer.resetNorth) {
          mapViewer.resetNorth();
        }
      }
    });
    appContainer.appendChild(topWidget);

    console.log(`🗺️ ThaiFlood Live Portal loaded ${stationsData.length} live stations from ThaiWater (HII) & TMD.`);
  } catch (criticalErr) {
    console.error('Critical initialization error in ThaiFlood:', criticalErr);
    appContainer.innerHTML = `
      <div style="padding: 40px 20px; font-family: var(--font-thai); text-align: center; max-width: 500px; margin: 60px auto;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; font-weight: 700; color: #d93025; margin-bottom: 8px;">เกิดข้อผิดพลาดในการโหลดระบบ</div>
        <div style="font-size: 13px; color: #5f6368; margin-bottom: 20px;">${criticalErr.message || 'กรุณาลองรีเฟรชหน้าเว็บอีกครั้ง'}</div>
        <button onclick="location.reload()" style="background: #1a73e8; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
          รีเฟรชหน้าเว็บ
        </button>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
