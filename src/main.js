/**
 * Main Application Bootstrapper for ThaiFlood
 * 100% Real Live Government Data (ThaiWater HII, DOH Highway & TMD NWP Supercomputer)
 * Google Maps Inspired Experience (Port 3050)
 */
import './index.css';
import basinsData from './data/thailandBasins.json';
import riverReachesData from './data/riverReaches.js';
import { fetchLiveWaterStations, getCachedWaterStations } from './services/waterStationService.js';
import { fetchLiveDams, getCachedDams } from './services/damService.js';
import { getDohHighwayGeoJSON, getCachedDohHighwayGeoJSON } from './services/dohHighwayFloodService.js';
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

  try {
    // 1. Instant Synchronous Cache Lookup (Stale-While-Revalidate)
    // Ensures 0ms First Contentful Paint without waiting for slow government APIs
    let stationsData = getCachedWaterStations() || [];
    let damsData = getCachedDams() || [];
    let dohRoadsData = getCachedDohHighwayGeoJSON() || { type: 'FeatureCollection', features: [] };

    // Combine major river basins with 500+ detailed river reaches for comprehensive snapping
    const allRiverBasins = {
      type: 'FeatureCollection',
      features: [...basinsData.features, ...riverReachesData.features]
    };

    // Compute dynamic flood polygons and 7-day risks from initial data
    const floodNowData = computeCurrentFloodPolygons(stationsData, allRiverBasins);
    const forecast7dData = compute7DayRiskPolygons(stationsData, allRiverBasins);

    let placeSheetInstance = null;

    // 1. Google Maps Fullscreen Map Viewer
    const mapViewer = createMapViewer({
      basinsData,
      floodNowData,
      forecast7dData,
      stationsData,
      damsData,
      dohRoadsData,
      onStationSelect: (item) => {
        if (placeSheetInstance) {
          if (item.isDam) {
            placeSheetInstance.selectDam(item);
          } else if (item.isDohRoad) {
            placeSheetInstance.selectDohRoad(item);
          } else if (item.isCctv) {
            placeSheetInstance.selectCctv(item);
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

    // 2. Google Maps Left Place Sheet
    placeSheetInstance = createWaterStationList(stationsData, (item) => {
      mapViewer.flyToStation(item);
    });

    // 3. Google Maps Top-Left Search Bar & Filter Chips
    const topWidget = createNavbar({
      stations: stationsData,
      dams: damsData,
      dohRoads: dohRoadsData,
      onSearchSelect: (item) => {
        mapViewer.flyToStation(item);
        if (placeSheetInstance) {
          if (item.isDam) {
            placeSheetInstance.selectDam(item);
          } else if (item.isCctv) {
            placeSheetInstance.selectCctv(item);
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
      },
      onNavigateToStatistics: () => {
        navigateTo('/statistics');
      }
    });

    // Container for Statistics View
    const statsRoot = document.createElement('div');
    statsRoot.id = 'tf-stats-view-root';
    statsRoot.style.cssText = 'position:relative; width:100%; height:100%; display:none;';

    let statsViewInstance = null;

    async function showStatisticsView() {
      if (mapViewer && mapViewer.element) mapViewer.element.style.display = 'none';
      if (placeSheetInstance && placeSheetInstance.element) placeSheetInstance.element.style.display = 'none';
      if (topWidget) topWidget.style.display = 'none';
      statsRoot.style.display = 'block';

      if (!statsViewInstance) {
        const { createStatisticsView } = await import('./components/StatisticsView.js');
        statsViewInstance = createStatisticsView({
          onBackToMap: () => navigateTo('/')
        });
        statsRoot.appendChild(statsViewInstance);
      }
    }

    function showMapView() {
      statsRoot.style.display = 'none';
      if (mapViewer && mapViewer.element) mapViewer.element.style.display = 'block';
      if (placeSheetInstance && placeSheetInstance.element) placeSheetInstance.element.style.display = 'block';
      if (topWidget) topWidget.style.display = 'block';
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }

    function handleRoute() {
      const path = window.location.pathname;
      if (path === '/statistics' || path.startsWith('/statistics')) {
        showStatisticsView();
      } else {
        showMapView();
      }
    }

    function navigateTo(path) {
      if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
      handleRoute();
    }

    window.addEventListener('popstate', handleRoute);

    // Mount to DOM synchronously at T=0 (Instant Paint - No Blank White Screen)
    appContainer.innerHTML = '';
    appContainer.appendChild(mapViewer.element);
    appContainer.appendChild(placeSheetInstance.element);
    appContainer.appendChild(topWidget);
    appContainer.appendChild(statsRoot);
    handleRoute();

    window.addEventListener('thaiflood:close-place-sheet', () => {
      if (placeSheetInstance && placeSheetInstance.close) {
        placeSheetInstance.close();
      }
    });

    // Support direct CCTV sheet opening via custom event
    window.addEventListener('thaiflood:open-cctv-sheet', (e) => {
      if (placeSheetInstance && e.detail) {
        placeSheetInstance.selectCctv(e.detail);
      }
    });

    // Direct clean visibility of top navigation
    topWidget.style.opacity = '1';
    topWidget.style.transform = 'translateY(0)';

    // Double map resize to ensure WebGL canvas is perfectly sized on initial display
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Execute Space POV WebGL Zoom-In Descent Sequence without HUD (Smooth Camera FlyTo from Orbit to Thailand)
    if (mapViewer && mapViewer.runSpacePOVZoomAnimation) {
      mapViewer.runSpacePOVZoomAnimation({
        duration: 2000,
        onComplete: () => {
          window.dispatchEvent(new Event('resize'));
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
          });
        }
      });
    }

    // 4. Fetch 100% real live telemetry data in parallel in the background (Stale-While-Revalidate)
    Promise.all([
      fetchLiveWaterStations(),
      fetchLiveDams(),
      getDohHighwayGeoJSON()
    ]).then(([liveStations, liveDams, liveDohRoads]) => {
      const freshStations = liveStations || [];
      const freshDams = liveDams || [];
      const freshDohRoads = liveDohRoads || { type: 'FeatureCollection', features: [] };

      if (mapViewer && mapViewer.updateLiveTelemetry) {
        mapViewer.updateLiveTelemetry({
          stationsData: freshStations,
          damsData: freshDams,
          dohRoadsData: freshDohRoads,
          allRiverBasins
        });
      }
      if (placeSheetInstance && placeSheetInstance.updateStations && freshStations.length > 0) {
        placeSheetInstance.updateStations(freshStations);
      }
      if (topWidget && topWidget.updateData) {
        topWidget.updateData({
          stations: freshStations,
          dams: freshDams,
          dohRoads: freshDohRoads
        });
      }
      console.log(`🗺️ ThaiFlood Live Portal loaded ${freshStations.length} live stations from ThaiWater (HII) & TMD.`);
    }).catch((bgErr) => {
      console.warn('Background telemetry sync non-fatal:', bgErr);
    });

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
