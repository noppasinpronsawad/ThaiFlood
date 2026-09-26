/**
 * WaterStationList Component for ThaiFlood - Google Maps Left Place Sheet
 * Fully unified Place Sheet replacing all map popups.
 * Supports:
 * - Telemetry Water Stations
 * - Major Dams & Reservoirs
 * - BMA Flood-Prone Road Corridors
 * - User Current Location & Neighborhood Risk
 * - Multi-layer sequential cards ("แสดงข้อมูลต่อกันเมื่อเปิดหลายเลเยอร์")
 * - Live Weather & 7-Day Forecast
 * - Dedicated Weather Forecast View ("หากกด weather pill ให้แสดงเฉพาะพยากรณ์อากาศ")
 */
import { evaluateStationRisk } from '../services/hydrologyService.js';
import { fetch7DayWeatherForecast, fetchCurrentProvinceWeather } from '../services/weatherService.js';
import { identifyRockUnit } from '../services/geologyService.js';
import { evaluateDamRuleCurve } from '../services/damRuleCurveService.js';
import bmaFloodRoadLines from '../data/bmaFloodRoadLines.json';

// Helper: Haversine distance in km to nearest BMA flooded road line
function getMinDistanceToBMARoads(lat, lng) {
  const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
  const longitude = typeof lng === 'number' ? lng : parseFloat(lng);
  if (isNaN(latitude) || isNaN(longitude)) return 999999;

  // BMA rough bounding box check: Lat 13.3 - 14.2, Lng 100.1 - 101.0
  if (latitude < 13.3 || latitude > 14.2 || longitude < 100.1 || longitude > 101.0) {
    return 999999; // Far away (e.g. Srinagarind Dam in Kanchanaburi ~150km, Bhumibol ~450km)
  }

  let minDist = Infinity;
  for (const feat of bmaFloodRoadLines.features) {
    if (!feat.geometry || !feat.geometry.coordinates) continue;
    const coords = feat.geometry.coordinates;
    for (const [rLng, rLat] of coords) {
      const dLat = (rLat - latitude) * (Math.PI / 180);
      const dLng = (rLng - longitude) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(latitude * (Math.PI / 180)) * Math.cos(rLat * (Math.PI / 180)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = 6371 * c;
      if (distKm < minDist) {
        minDist = distKm;
        if (minDist <= 5.0) return minDist;
      }
    }
  }
  return minDist;
}

export function createWaterStationList(stations, onStationSelect) {
  const sheet = document.createElement('div');
  sheet.className = 'gmaps-place-sheet';
  sheet.id = 'gmaps-place-sheet';

  let currentItem = stations.find((s) => s.status === 'critical') || stations[0] || {};
  let isVisible = false;

  function getActiveLayers() {
    const isChecked = (id) => {
      const el = document.querySelector(id);
      return el ? el.checked : false;
    };
    return {
      dams: isChecked('#toggle-dams'),
      stations: isChecked('#toggle-stations'),
      bmaRoads: isChecked('#toggle-bma-roads'),
      satWater: isChecked('#toggle-sat-water'),
      satClouds: isChecked('#toggle-sat-clouds'),
      geology: isChecked('#toggle-dmr-geology'),
      gfs: isChecked('#toggle-gfs'),
      ecmwf: isChecked('#toggle-ecmwf'),
      traffic: isChecked('#toggle-traffic')
    };
  }

  function getProvinceName(item) {
    if (item.province) return item.province;
    if (item.name && typeof item.name === 'string') {
      const parts = item.name.split(' ');
      for (const p of parts) {
        if (p.startsWith('จ.') || p.includes('กรุงเทพ')) return p.replace('จ.', '');
      }
    }
    return 'กรุงเทพมหานคร';
  }

  async function render() {
    if (!currentItem) return;

    // Requirement 6: Dedicated Weather Forecast Mode
    if (currentItem.isDedicatedWeather) {
      renderDedicatedWeatherSheet();
      return;
    }

    // Determine type of primary entity
    if (currentItem.isDam || currentItem.currentStorage !== undefined) {
      renderDamSheet();
    } else if (currentItem.isRoad) {
      renderRoadSheet();
    } else if (currentItem.isUserLocation) {
      renderUserLocationSheet();
    } else if (currentItem.isElevation || currentItem.isFloodExtent || currentItem.isNWP) {
      renderGenericSheet();
    } else {
      renderStationSheet();
    }
  }

  // ==========================================
  // 1. Water Station Sheet
  // ==========================================
  function renderStationSheet() {
    const st = currentItem;
    const hasBank = st.hasBankInfo && st.bankCapacity > 0;
    const isOverflow = st.isOverflow;
    const diff = st.diff !== null && st.diff !== undefined ? st.diff : null;
    const percentFill = hasBank
      ? Math.min(100, Math.max(8, Math.round((st.currentLevel / st.bankCapacity) * 100)))
      : 50;

    let statusColor = '#188038';
    let statusText = hasBank && diff !== null
      ? `ระดับน้ำปกติ (ต่ำกว่าตลิ่ง ${diff} ม.)`
      : 'ระดับน้ำปกติ (สถานะควบคุมได้)';
    let statusBannerBg = '#e6f4ea';
    let statusBannerText = '#137333';

    if (isOverflow) {
      statusColor = '#d93025';
      statusText = diff !== null
        ? `🔴 น้ำล้นตลิ่งแล้ว (+${diff} ม.)`
        : '🔴 วิกฤต: ระดับน้ำล้นตลิ่งแล้ว';
      statusBannerBg = '#fce8e6';
      statusBannerText = '#c5221f';
    } else if (st.status === 'warning' || st.situationLevel === 4) {
      statusColor = '#f29900';
      statusText = diff !== null
        ? `🟠 เฝ้าระวังน้ำสูง (เหลือ ${diff} ม.)`
        : '🟠 เฝ้าระวัง: ระดับน้ำใกล้ตลิ่ง';
      statusBannerBg = '#fef7e0';
      statusBannerText = '#b06000';
    } else if (st.status === 'low') {
      statusColor = '#64748b';
      statusText = `🔵 ระดับน้ำน้อย`;
      statusBannerBg = '#f1f5f9';
      statusBannerText = '#334155';
    }

    const subLocation = [
      st.amphoe ? 'อ.' + st.amphoe : '',
      st.province ? 'จ.' + st.province : ''
    ].filter(Boolean).join(' ');
    const subtitle = `${subLocation ? subLocation + ' · ' : ''}${st.river || st.basin} (${st.agency || 'สสน.'})`;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📍 ${st.name}</h2>
          <div class="gmaps-place-sub">${subtitle}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${statusBannerBg}; color: ${statusBannerText}; border: 1px solid ${statusColor}35;">
        <div style="font-size: 20px;">${isOverflow ? '🌊' : (st.status === 'warning' ? '⚠️' : (st.status === 'low' ? '💧' : '🛡️'))}</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${statusText}</div>
          <div style="font-size: 11.5px; opacity: 0.9;">
            ${isOverflow ? 'มวลน้ำล้นตลิ่งเข้าท่วมพื้นที่ลุ่มต่ำริมน้ำ' : (st.status === 'warning' ? 'ระดับน้ำใกล้ตลิ่ง เข้าสู่เกณฑ์เฝ้าระวังภัย' : 'ระดับน้ำในแม่น้ำยังอยู่ภายใต้เกณฑ์ควบคุม')}
          </div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>ซูมดูพิกัด</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>พยากรณ์อากาศ</span>
        </button>
      </div>

      <div style="padding: 12px 16px; border-bottom: 1px solid #e8eaed;">
        <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; margin-bottom: 6px;">
          <span>ระดับน้ำจริง: <b style="color: ${statusColor}; font-size: 16px;">${(st.currentLevel ?? 0).toFixed(2)} ม. (รทก.)</b></span>
          <span style="color: #5f6368;">${hasBank ? `ระดับตลิ่ง: ${st.bankCapacity.toFixed(2)} ม.` : 'ไม่มีข้อมูลระดับตลิ่ง'}</span>
        </div>
        <div class="gmaps-bar-track">
          <div class="gmaps-bar-fill" style="width: ${percentFill}%; background: ${statusColor};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #70757a; margin-top: 4px;">
          <span>0%</span>
          <span>${hasBank ? `ความจุลำน้ำ: <b>${percentFill}%</b> (${st.diffDisplay || ''})` : `สถานะ: <b>${st.diffDisplay || 'ปกติ'}</b>`}</span>
          <span>100% (ตลิ่ง)</span>
        </div>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">เวลาที่ตรวจวัดสด</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">${st.datetime || 'ข้อมูลล่าสุด'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">หน่วยงานรับผิดชอบ</div>
            <div class="gmaps-row-value">${st.agency || 'สสน. (สถาบันสารสนเทศทรัพยากรน้ำ)'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">แนวโน้มระดับน้ำ</div>
            <div class="gmaps-row-value" style="color: ${st.trend === 'rising' ? '#d93025' : '#202124'}; font-weight: 600;">
              ${st.trend === 'rising' ? '⬆️ กำลังเพิ่มขึ้น' : (st.trend === 'falling' ? '⬇️ กำลังลดลง' : '➡️ ระดับน้ำทรงตัว')}
            </div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">⚡</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">อัตราการระบายน้ำ (Discharge)</div>
            <div class="gmaps-row-value">${st.flowRate ? st.flowRate.toLocaleString() + ' ลบ.ม./วินาที' : 'ไม่มีเซนเซอร์วัดอัตราไหล'}</div>
          </div>
        </div>

        ${isGeologyEnabled() ? `
          <div class="gmaps-detail-row" id="st-sheet-geol-row">
            <span class="gmaps-row-icon">🪨</span>
            <div class="gmaps-row-content">
              <div class="gmaps-row-label">หน่วยหินฐาน (DMR 1:250k)</div>
              <div class="gmaps-row-value" id="st-sheet-geol-val" style="color: #7c3aed; font-weight: 600;">กำลังตรวจสอบหินฐาน...</div>
            </div>
          </div>
        ` : ''}
      </div>

      <div style="margin: 10px 16px; padding: 10px 12px; background: #e8f0fe; border-radius: 8px; font-size: 12px; color: #174ea6; line-height: 1.45;">
        <b>💡 คำแนะนำสำหรับประชาชน:</b><br/>
        ${isOverflow
          ? 'ระดับน้ำสูงกว่าตลิ่งแล้ว ขอให้ประชาชนริมแม่น้ำยกสิ่งของขึ้นที่สูง ตัดไฟจุดน้ำท่วม และเตรียมพร้อมอพยพสัตว์เลี้ยง'
          : (st.status === 'warning'
            ? 'ระดับน้ำใกล้ตลิ่งและมีแนวโน้มสูงขึ้น ขอให้จัดเตรียมกระสอบทราย ตรวจสอบเครื่องสูบน้ำ และติดตามสถานการณ์ใกล้ชิด'
            : 'ระดับน้ำในลำน้ำยังอยู่ในเกณฑ์ควบคุม สามารถสัญจรและใช้ชีวิตได้ตามปกติ')}
      </div>

      <!-- Multi-Layer Companion Cards (แสดงข้อมูลต่อกันเมื่อเปิดหลายเลเยอร์) -->
      ${renderCompanionLayerCards(st.lat, st.lng, st.province)}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml(st.province)}
    `;

    attachEvents();
    loadSheetWeather(getProvinceName(st), st.lat, st.lng);
    loadGeologyIfEnabled(st.lat, st.lng);
  }

  // ==========================================
  // 2. Dam Sheet
  // ==========================================
  function renderDamSheet() {
    const dam = currentItem;
    const p = typeof dam.percentStorage === 'number' ? dam.percentStorage : parseFloat(dam.percentStorage) || 0;
    const rc = evaluateDamRuleCurve(dam, dam.date || new Date());
    
    // Evaluate status and banner strictly according to Rule Curve
    let statusColor = '#0284c7';
    let statusBannerBg = '#f0f9ff';
    let statusBannerText = '#0369a1';
    let statusText = `🔵 เกณฑ์ปกติ: ${p}% ของความจุ (อยู่ในเกณฑ์ควบคุม Rule Curve)`;

    if (rc && rc.zone === 'above_urc') {
      const diff = (p - rc.urcPercent).toFixed(1);
      statusColor = '#dc2626';
      statusBannerBg = '#fef2f2';
      statusBannerText = '#b91c1c';
      statusText = `🔴 วิกฤต (น้ำมาก): ${p}% ของความจุ (เกินเกณฑ์ควบคุมบน URC +${diff}%)`;
    } else if (rc && p >= rc.urcPercent - 5) {
      const margin = (rc.urcPercent - p).toFixed(1);
      statusColor = '#ea580c';
      statusBannerBg = '#fff7ed';
      statusBannerText = '#c2410c';
      statusText = `🟠 เฝ้าระวัง (น้ำมาก): ${p}% ของความจุ (ใกล้เกณฑ์ควบคุมบน URC เหลือ ${margin}%)`;
    } else if (rc && rc.zone === 'below_lrc') {
      const diff = (rc.lrcPercent - p).toFixed(1);
      statusColor = '#d97706';
      statusBannerBg = '#fffbeb';
      statusBannerText = '#b45309';
      statusText = `🟡 น้ำน้อย: ${p}% ของความจุ (ต่ำกว่าเกณฑ์ควบคุมล่าง LRC -${diff}%)`;
    }

    const subLocation = [dam.amphoe ? 'อ.' + dam.amphoe : '', dam.province ? 'จ.' + dam.province : ''].filter(Boolean).join(' ');
    const subtitle = `${subLocation ? subLocation + ' · ' : ''}${dam.basin} (${dam.agency})`;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">🏢 ${dam.name}</h2>
          <div class="gmaps-place-sub">${subtitle}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${statusBannerBg}; color: ${statusBannerText}; border: 1px solid ${statusColor}35;">
        <div style="font-size: 20px;">🏢</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${statusText}</div>
          <div style="font-size: 11.5px; opacity: 0.9;">
            ข้อมูลโทรมาตรเขื่อนสดจากคลังข้อมูลน้ำแห่งชาติ สสน. ร่วมกับ กฟผ./ชป.
          </div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>ซูมดูพิกัด</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>พยากรณ์อากาศ</span>
        </button>
      </div>

      <div style="padding: 12px 16px; border-bottom: 1px solid #e8eaed;">
        <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; margin-bottom: 6px;">
          <span>ปริมาณน้ำปัจจุบัน: <b style="color: ${statusColor}; font-size: 16px;">${(dam.currentStorage ?? 0).toLocaleString()} ล้าน ลบ.ม.</b></span>
          <span style="color: #5f6368;">ความจุปกติ: ${(dam.normalStorage ?? 0).toLocaleString()} ล้าน ลบ.ม.</span>
        </div>
        <div class="gmaps-bar-track">
          <div class="gmaps-bar-fill" style="width: ${Math.min(100, Math.max(5, dam.percentStorage ?? 50))}%; background: ${statusColor};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #70757a; margin-top: 4px;">
          <span>0%</span>
          <span>ระดับกักเก็บ: <b>${dam.percentStorage}%</b></span>
          <span>100% (ความจุปกติ)</span>
        </div>
      </div>

      <!-- Dam Rule Curve Assessment (เกณฑ์ควบคุมน้ำในเขื่อน) -->
      ${rc ? `
        <div class="gmaps-rule-curve-card" style="margin: 12px 16px; padding: 14px; background: #f8fafc; border: 1.5px solid ${rc.border}; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 16px;">📈</span>
              <span style="font-weight: 700; font-size: 13px; color: #1e293b;">เกณฑ์ควบคุมน้ำในเขื่อน (Rule Curve)</span>
            </div>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; background: ${rc.badgeBg}; color: ${rc.zoneColor}; border: 1px solid ${rc.border};">
              ${rc.zone === 'above_urc' ? 'เกินเกณฑ์บน (URC)' : (rc.zone === 'below_lrc' ? 'ต่ำกว่าเกณฑ์ล่าง (LRC)' : 'เกณฑ์ควบคุมปกติ')}
            </span>
          </div>

          <div style="font-size: 11.5px; color: #64748b; margin-bottom: 12px; line-height: 1.4;">
            ประเมินตามปฏิทินฤดูกาล กรมชลประทาน & กฟผ. (เปรียบเทียบระดับน้ำสดกับเส้นควบคุม Upper / Lower Rule Curve)
          </div>

          <!-- 3-Zone Gauge Bar -->
          <div style="position: relative; margin: 18px 4px 12px 4px;">
            <div style="height: 14px; border-radius: 7px; overflow: hidden; display: flex; box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);">
              <div style="width: ${rc.lrcPercent}%; background: linear-gradient(90deg, #fef3c7, #fde68a); border-right: 2px dashed #d97706;" title="โซนน้ำน้อย (ต่ำกว่า LRC): 0 - ${rc.lrcPercent}%"></div>
              <div style="width: ${rc.urcPercent - rc.lrcPercent}%; background: linear-gradient(90deg, #bae6fd, #7dd3fc); border-right: 2px dashed #dc2626;" title="โซนควบคุมปกติ (LRC - URC): ${rc.lrcPercent}% - ${rc.urcPercent}%"></div>
              <div style="width: ${100 - rc.urcPercent}%; background: linear-gradient(90deg, #fecaca, #f87171);" title="โซนเสี่ยงน้ำล้น (เหนือ URC): ${rc.urcPercent}% - 100%"></div>
            </div>

            <!-- Current Storage Needle Pin -->
            <div style="position: absolute; top: -7px; left: ${Math.min(97, Math.max(3, p))}%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
              <div style="background: #0f172a; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
                ${p}%
              </div>
              <div style="width: 2px; height: 19px; background: #0f172a; border-radius: 1px;"></div>
            </div>
          </div>

          <!-- Zone Indicators -->
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; color: #64748b;">
            <div style="text-align: left;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; margin-right: 3px;"></span>
              <span>เกณฑ์ล่าง (LRC): <b>${rc.lrcPercent}%</b></span>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-right: 3px;"></span>
              <span>เกณฑ์บน (URC): <b>${rc.urcPercent}%</b></span>
            </div>
          </div>

          <!-- Operational Assessment Advice Box -->
          <div style="padding: 10px; background: ${rc.badgeBg}; border-radius: 8px; border: 1px solid ${rc.border}; margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 12px; color: ${rc.zoneColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>${rc.zoneLabel}</span>
            </div>
            <div style="font-size: 11.5px; color: #334155; line-height: 1.45;">
              ${rc.advice}
            </div>
          </div>

          <!-- Threshold Metrics Breakdown -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div style="padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="color: #64748b;">เกณฑ์ควบคุมตอนบน (URC)</div>
              <div style="font-weight: 700; color: #dc2626; font-size: 12px;">${rc.urcStorage.toLocaleString()} ล้าน ลบ.ม.</div>
            </div>
            <div style="padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="color: #64748b;">เกณฑ์ควบคุมตอนล่าง (LRC)</div>
              <div style="font-weight: 700; color: #d97706; font-size: 12px;">${rc.lrcStorage.toLocaleString()} ล้าน ลบ.ม.</div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📅</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">วันที่ตรวจวัดสด</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">${dam.date || 'วันนี้'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">หน่วยงานกำกับดูแล</div>
            <div class="gmaps-row-value">${dam.agency || 'กฟผ. / กรมชลประทาน'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">💧</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">น้ำไหลเข้าเขื่อน (Inflow)</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">+${(dam.inflow ?? 0).toLocaleString()} ล้าน ลบ.ม./วัน</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🌊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">น้ำระบายออก (Released)</div>
            <div class="gmaps-row-value" style="color: #ea580c; font-weight: 600;">-${(dam.released ?? 0).toLocaleString()} ล้าน ลบ.ม./วัน</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">ความจุกักเก็บสูงสุด (Max Capacity)</div>
            <div class="gmaps-row-value">${(dam.maxStorage ?? 0).toLocaleString()} ล้าน ลบ.ม.</div>
          </div>
        </div>

        ${isGeologyEnabled() ? `
          <div class="gmaps-detail-row" id="dam-sheet-geol-row">
            <span class="gmaps-row-icon">🪨</span>
            <div class="gmaps-row-content">
              <div class="gmaps-row-label">หน่วยหินฐานสันเขื่อน (DMR 1:250k)</div>
              <div class="gmaps-row-value" id="dam-sheet-geol-val" style="color: #7c3aed; font-weight: 600;">กำลังตรวจสอบหินฐาน...</div>
            </div>
          </div>
        ` : ''}
      </div>

      ${dam.cctvUrl ? `
        <div style="margin: 10px 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #334155;">📹 ภาพสดจากกล้อง CCTV สันเขื่อน:</div>
          <img src="${dam.cctvUrl}" alt="CCTV ${dam.name}" style="width: 100%; height: auto; border-radius: 6px;" onerror="this.parentElement.style.display='none';" />
        </div>
      ` : ''}

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(dam.lat, dam.lng, dam.province)}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml(dam.province)}
    `;

    attachEvents();
    loadSheetWeather(getProvinceName(dam), dam.lat, dam.lng);
    loadGeologyIfEnabled(dam.lat, dam.lng);
  }

  // ==========================================
  // 3. BMA Road Flood Corridor Sheet
  // ==========================================
  function renderRoadSheet() {
    const road = currentItem;
    const isCrit = road.riskLevel === 'critical';
    const color = isCrit ? '#dc2626' : '#ea580c';
    const bgBadge = isCrit ? '#fef2f2' : '#fffbeb';
    const borderBadge = isCrit ? '#fecaca' : '#fed7aa';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">🚗 ${road.road}</h2>
          <div class="gmaps-place-sub">กทม. เขต ${road.district || 'กรุงเทพมหานคร'} · สำนักการระบายน้ำ</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${bgBadge}; color: ${color}; border: 1px solid ${borderBadge};">
        <div style="font-size: 22px;">🌊</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${road.warningBadge || (isCrit ? '🔴 น้ำท่วมขังวิกฤตบนผิวจราจร' : '🟠 เฝ้าระวังน้ำท่วมขัง')}</div>
          <div style="font-size: 11.5px; opacity: 0.95;">ระดับน้ำท่วมขังผิวจราจร: <b>${road.waterDepthCm}</b> (${road.floodedLanes})</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>ซูมดูถนน</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>พยากรณ์อากาศ</span>
        </button>
      </div>

      <div style="padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #e8eaed; font-size: 12px; color: #1e293b;">
        <b>📍 ช่วงเส้นทางที่เฝ้าระวัง:</b><br/>
        <div style="margin-top: 3px; color: #475569; line-height: 1.4;">${road.segment}</div>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">เวลาที่อัปเดตล่าสุด</div>
            <div class="gmaps-row-value" style="color: #dc2626; font-weight: 700;">${road.lastUpdated || '26 ก.ย. 2026 21:00 น.'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📏</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">ระยะทางแนวเฝ้าระวัง</div>
            <div class="gmaps-row-value">${road.lengthKm} กิโลเมตร</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🛣️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">ช่องจราจรที่ได้รับผลกระทบ</div>
            <div class="gmaps-row-value">${road.floodedLanes}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">⚠️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">ผลกระทบการจราจร</div>
            <div class="gmaps-row-value" style="color: #b45309; line-height: 1.35;">${road.trafficImpact}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">💡</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">สาเหตุการระบายน้ำชะลอตัว</div>
            <div class="gmaps-row-value" style="color: #64748b; line-height: 1.35;">${road.cause}</div>
          </div>
        </div>
      </div>

      <div style="margin: 10px 16px; padding: 10px 12px; background: #fef2f2; border-radius: 8px; font-size: 11.5px; border: 1px dashed #fca5a5; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #991b1b; font-weight: 600;">📞 สายด่วน กทม. 1555</span>
        <a href="https://line.me/R/ti/p/@traffyfondue" target="_blank" style="background: #16a34a; color: #fff; padding: 4px 10px; border-radius: 6px; text-decoration: none; font-weight: 700;">
          💬 แจ้งผ่าน Traffy Fondue
        </a>
      </div>

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(road.lat || 13.78, road.lng || 100.56, 'กรุงเทพมหานคร')}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml('กรุงเทพมหานคร')}
    `;

    attachEvents();
    loadSheetWeather('กรุงเทพมหานคร', road.lat || 13.78, road.lng || 100.56);
    loadGeologyIfEnabled(road.lat || 13.78, road.lng || 100.56);
  }

  // ==========================================
  // 4. User Current Location Sheet
  // ==========================================
  function renderUserLocationSheet() {
    const loc = currentItem;
    const st = loc.nearestStation;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📍 ตำแหน่งปัจจุบันของคุณ</h2>
          <div class="gmaps-place-sub">พิกัด ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy || 15)} ม.)</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">
        <div style="font-size: 22px;">🎯</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">ตรวจจับพิกัด GPS สำเร็จ</div>
          <div style="font-size: 11.5px; opacity: 0.9;">ประเมินความเสี่ยงน้ำท่วมจากสถานีโทรมาตรและข้อมูลพื้นที่รอบตัว</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>ซูมดูตำแหน่งฉัน</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>พยากรณ์อากาศ</span>
        </button>
      </div>

      ${st ? `
        <div style="margin: 12px 16px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 2px;">📡 สถานีโทรมาตรวัดน้ำใกล้คุณที่สุด (~${(loc.minKm ?? 0).toFixed(1)} กม.):</div>
          <div style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${st.name}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 12px;">
            <span>ระดับน้ำ: <b style="color: ${st.isOverflow ? '#d93025' : '#16a34a'}; font-size: 14px;">${st.currentLevel.toFixed(2)} ม. (รทก.)</b></span>
            <span style="font-size: 11px; background: ${st.isOverflow ? '#fee2e2' : '#dcfce7'}; color: ${st.isOverflow ? '#991b1b' : '#15803d'}; padding: 2px 7px; border-radius: 12px; font-weight: 700;">
              ${st.diffDisplay || 'ปกติ'}
            </span>
          </div>
        </div>
      ` : ''}

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(loc.lat, loc.lng, 'กรุงเทพมหานคร')}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml('กรุงเทพมหานคร')}
    `;

    attachEvents();
    loadSheetWeather('กรุงเทพมหานคร', loc.lat, loc.lng);
    loadGeologyIfEnabled(loc.lat, loc.lng);
  }

  // ==========================================
  // 5. Generic Feature Sheet (Elevation, NWP, Flood Extent)
  // ==========================================
  function renderGenericSheet() {
    const item = currentItem;
    const title = item.name || (item.isElevation ? `ระดับความสูง ${item.elevation} ม.` : 'ข้อมูลพื้นที่');
    const desc = item.desc || item.recommendation || item.severityLabel || 'ข้อมูลการตรวจวัด';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📌 ${title}</h2>
          <div class="gmaps-place-sub">พิกัด ${item.lat ? item.lat.toFixed(4) + ', ' + item.lng.toFixed(4) : 'จุดที่เลือก'}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1;">
        <div style="font-size: 20px;">ℹ️</div>
        <div>
          <div style="font-weight: 700; font-size: 13.5px;">${desc}</div>
          <div style="font-size: 11px; color: #64748b;">${item.riskTag || item.displayDate || 'ระบบอุทกวิทยา'}</div>
        </div>
      </div>

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(item.lat, item.lng, 'กรุงเทพมหานคร')}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml('กรุงเทพมหานคร')}
    `;

    attachEvents();
    loadSheetWeather('กรุงเทพมหานคร', item.lat, item.lng);
    loadGeologyIfEnabled(item.lat, item.lng);
  }

  // ==========================================
  // 6. Requirement 6: Dedicated Weather Forecast Sheet
  // ("หากกด weather pill ให้แสดงเฉพาะพยากรณ์อากาศ")
  // ==========================================
  function renderDedicatedWeatherSheet() {
    const prov = currentItem.province || 'กรุงเทพมหานคร';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 20px;">🌤️</span>
            <h2 class="gmaps-place-title">พยากรณ์อากาศ จ.${prov}</h2>
          </div>
          <div class="gmaps-place-sub">ศูนย์อุตุนิยมวิทยา กรมอุตุนิยมวิทยา (TMD HPC) & ECMWF</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="ปิดแผงข้อมูล">✕</button>
      </div>

      <!-- Live Condition Banner -->
      <div id="dedicated-current-weather" style="margin: 0 16px 12px 16px; padding: 14px 16px; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border-radius: 12px; border: 1px solid #7dd3fc;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div id="dedicated-weather-temp" style="font-size: 32px; font-weight: 800; color: #0369a1; line-height: 1;">--°C</div>
            <div id="dedicated-weather-desc" style="font-size: 13px; font-weight: 600; color: #0284c7; margin-top: 4px;">กำลังโหลดสภาพอากาศ...</div>
          </div>
          <div id="dedicated-weather-icon" style="font-size: 38px;">🌤️</div>
        </div>
        <div id="dedicated-weather-metrics" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(2, 132, 199, 0.2); font-size: 11.5px; color: #0c4a6e;">
          <div>🌧️ โอกาสเกิดฝน: <b id="dedicated-rain-prob">--%</b></div>
          <div>💧 ความชื้นสัมพัทธ์: <b id="dedicated-humidity">--%</b></div>
          <div>💨 ความเร็วลม: <b id="dedicated-wind">-- กม./ชม.</b></div>
          <div>☔ ปริมาณฝนสด: <b id="dedicated-rain-mm">-- มม.</b></div>
        </div>
      </div>

      <!-- 7-Day Detailed Breakdown Section -->
      <div style="padding: 12px 16px; border-top: 1px solid #e8eaed;" id="gmaps-weather-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: 700; font-size: 13.5px; color: #1e293b;">📅 พยากรณ์ฝนและสภาพอากาศ 7 วันข้างหน้า</span>
          <span style="background: #e6f4ea; color: #137333; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; border: 1px solid #b7eb8f;">
            🇹🇭 TMD Official
          </span>
        </div>
        <div id="gmaps-forecast-container" style="display: flex; flex-direction: column; gap: 6px;">
          <div style="color: #70757a; font-size: 12px;">กำลังดึงข้อมูลพยากรณ์อากาศสด...</div>
        </div>
      </div>
    `;

    attachEvents();
    loadDedicatedWeather(prov, currentItem.lat, currentItem.lng);
  }

  // ==========================================
  // Helper: Multi-Layer Companion Cards
  // ("หากเปิดหลายเลเยอร์ให้แสดงข้อมูลต่อกัน")
  // ==========================================
  function renderCompanionLayerCards(lat, lng, province) {
    const layers = getActiveLayers();
    const cards = [];

    // 1. Radar Layer
    if (layers.satWater) {
      cards.push(`
        <div class="gmaps-companion-card" style="margin: 8px 16px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 5px;">
              <span>📡</span> เรดาร์ตรวจวัดกลุ่มฝนสด (TMD / RainViewer)
            </span>
            <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 8px;">เรดาร์เปิดอยู่</span>
          </div>
          <div style="color: #166534; font-size: 11px;">
            ${window.__latestRadarTime ? `🕒 ตรวจวัดเรดาร์ล่าสุด: <b>${window.__latestRadarTime}</b>` : '🕒 รอบตรวจวัดเรดาร์: สดทุก 10 นาที (สถานีเรดาร์ทั่วไทย)'}
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            ตรวจจับละอองน้ำฝนจริงที่ตกสู่พื้นดินในรัศมี 240 กม. ความแม่นยำสูง
          </div>
        </div>
      `);
    }

    // 2. Cloud Satellite Layer
    if (layers.satClouds) {
      cards.push(`
        <div class="gmaps-companion-card" style="margin: 8px 16px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 700; color: #1d4ed8; display: flex; align-items: center; gap: 5px;">
              <span>☁️</span> ดาวเทียมกลุ่มเมฆ (Himawari-9 Clean IR)
            </span>
            <span style="font-size: 10px; background: #dbeafe; color: #1e40af; font-weight: 700; padding: 1px 6px; border-radius: 8px;">ดาวเทียมเปิดอยู่</span>
          </div>
          <div style="color: #1e40af; font-size: 11px;">
            ${window.__latestCloudTime ? `🕒 ภาพดาวเทียมล่าสุด: <b>${window.__latestCloudTime}</b>` : '🕒 รอบดาวเทียม: ทุก 10 นาที (NASA GIBS / JMA)'}
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            เซนเซอร์อินฟราเรดตรวจจับยอดเมฆความเย็นจัดและกลุ่มเมฆฝนฟ้าคะนอง
          </div>
        </div>
      `);
    }

    // 3. BMA Road Flood Layer (only if within 5 km of any flooded road corridor)
    if (layers.bmaRoads && !currentItem.isRoad) {
      const distToRoads = getMinDistanceToBMARoads(lat, lng);
      if (distToRoads <= 5.0) {
        cards.push(`
          <div class="gmaps-companion-card" style="margin: 8px 16px; padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span style="font-weight: 700; color: #b91c1c; display: flex; align-items: center; gap: 5px;">
                <span>🚗</span> เส้นทางน้ำท่วมถนน กทม. (ใกล้พิกัด ${distToRoads.toFixed(1)} กม.)
              </span>
              <span style="font-size: 10px; background: #fee2e2; color: #991b1b; font-weight: 700; padding: 1px 6px; border-radius: 8px;">ในรัศมี 5 กม.</span>
            </div>
            <div style="color: #991b1b; font-size: 11px;">
              🕒 อัปเดตล่าสุด: <b>26 ก.ย. 2026 21:00 น.</b> (สำนักการระบายน้ำ กทม.)
            </div>
            <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
              พบแนวถนนเฝ้าระวังน้ำท่วมขังบนผิวจราจรในรัศมี 5 กม. รถเล็กควรระมัดระวัง
            </div>
          </div>
        `);
      }
    }

    // 4. DMR Geology Layer
    if (layers.geology) {
      cards.push(`
        <div class="gmaps-companion-card" id="st-sheet-geol-card" style="margin: 8px 16px; padding: 10px 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 700; color: #7e22ce; display: flex; align-items: center; gap: 5px;">
              <span>🪨</span> หน่วยหินทางธรณีวิทยา (DMR 1:250k)
            </span>
            <span style="font-size: 10px; background: #f3e8ff; color: #7e22ce; font-weight: 700; padding: 1px 6px; border-radius: 8px;">ธรณีวิทยาเปิดอยู่</span>
          </div>
          <div id="st-sheet-geol-val" style="color: #6b21a8; font-size: 11.5px;">
            กำลังสืบค้นข้อมูลหน่วยหิน กรมทรัพยากรธรณี...
          </div>
        </div>
      `);
    }

    // 5. Traffic Flow Layer
    if (layers.traffic) {
      cards.push(`
        <div class="gmaps-companion-card" style="margin: 8px 16px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #166534; display: flex; align-items: center; gap: 5px;">
              <span>🚦</span> สภาพการจราจรสด (Traffic Flow)
            </span>
            <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 8px;">เปิดอยู่</span>
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            แสดงความหนาแน่นของการจราจรสดบนเส้นทางรอบจุดนี้ (ซูมระดับ 13+ ขึ้นไป)
          </div>
        </div>
      `);
    }

    if (cards.length === 0) return '';

    return `
      <div style="padding: 6px 16px 2px 16px;">
        <div style="font-size: 11.5px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 4px;">
          <span>📑</span> ข้อมูลเลเยอร์ที่เปิดใช้งานร่วมกัน (${cards.length} เลเยอร์):
        </div>
      </div>
      ${cards.join('')}
    `;
  }

  // ==========================================
  // Helper: Weather HTML Block
  // ("พร้อมสภาพอากาศและพยากรณ์อากาศ")
  // ==========================================
  function renderWeatherSectionHtml(province) {
    return `
      <div style="padding: 12px 16px; border-top: 1px solid #e8eaed;" id="gmaps-weather-section">
        <div id="gmaps-weather-title" style="font-weight: 700; font-size: 13px; color: #202124; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>🌧️ สภาพอากาศและพยากรณ์ฝน 7 วันข้างหน้า</span>
            <span style="background: #e6f4ea; color: #137333; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 12px; border: 1px solid #ceead6;">
              🇹🇭 TMD Official
            </span>
          </div>
          <div style="font-size: 11px; color: #5f6368; font-weight: normal; margin-top: 2px;">
            แหล่งข้อมูล: กรมอุตุนิยมวิทยา (High Performance Computing)
          </div>
        </div>
        <div id="gmaps-forecast-container" style="display: flex; flex-direction: column; gap: 4px;">
          <div style="color: #70757a; font-size: 12px;">กำลังดึงข้อมูลพยากรณ์อากาศสด...</div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Helper: Event Attachments
  // ==========================================
  function attachEvents() {
    const closeBtn = sheet.querySelector('#btn-gmaps-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        sheet.classList.remove('open');
        isVisible = false;
      });
    }

    const focusBtn = sheet.querySelector('#btn-focus-station');
    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        if (onStationSelect && currentItem) onStationSelect(currentItem);
      });
    }

    const weatherBtn = sheet.querySelector('#btn-view-weather');
    if (weatherBtn) {
      weatherBtn.addEventListener('click', () => {
        const weatherSection = sheet.querySelector('#gmaps-weather-section');
        if (weatherSection) weatherSection.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  // ==========================================
  // Weather Loader
  // ==========================================
  async function loadSheetWeather(province, lat, lng) {
    const container = sheet.querySelector('#gmaps-forecast-container');
    if (!container) return;

    try {
      const weather = await fetch7DayWeatherForecast(province, lat, lng, province);

      container.innerHTML = weather.days
        .slice(0, 6)
        .map((d) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #f8f9fa; border-radius: 6px; font-size: 12px;">
            <span style="font-weight: 600; width: 75px;">${d.displayDate}</span>
            <span style="font-size: 16px;">${d.icon}</span>
            <span style="color: #5f6368;">${d.tempMax}° / ${d.tempMin}°</span>
            <span style="font-weight: 600; color: ${d.rainMm > 40 ? '#d93025' : (d.rainMm > 20 ? '#ea580c' : '#188038')};">
              🌧️ ${d.rainMm} มม.
            </span>
          </div>
        `)
        .join('');
    } catch (err) {
      container.innerHTML = `<div style="font-size: 11.5px; color: #64748b;">ไม่สามารถโหลดพยากรณ์อากาศได้ในขณะนี้</div>`;
    }
  }

  async function loadDedicatedWeather(province, lat, lng) {
    const tempEl = sheet.querySelector('#dedicated-weather-temp');
    const descEl = sheet.querySelector('#dedicated-weather-desc');
    const iconEl = sheet.querySelector('#dedicated-weather-icon');
    const rainProbEl = sheet.querySelector('#dedicated-rain-prob');
    const humEl = sheet.querySelector('#dedicated-humidity');
    const windEl = sheet.querySelector('#dedicated-wind');
    const rainMmEl = sheet.querySelector('#dedicated-rain-mm');
    const container = sheet.querySelector('#gmaps-forecast-container');

    try {
      const [curr, forecast] = await Promise.all([
        fetchCurrentProvinceWeather(province, lat || 13.75, lng || 100.5),
        fetch7DayWeatherForecast(province, lat, lng, province)
      ]);

      if (tempEl) tempEl.textContent = `${curr.temp}°C`;
      if (descEl) descEl.textContent = curr.weatherDesc;
      if (iconEl) iconEl.textContent = curr.icon;
      if (rainProbEl) rainProbEl.textContent = `${curr.rainProb}%`;
      if (humEl) humEl.textContent = `${curr.humidity}%`;
      if (windEl) windEl.textContent = `14 กม./ชม.`;
      if (rainMmEl) rainMmEl.textContent = `${curr.rainMm} มม.`;

      if (container && forecast && forecast.days) {
        container.innerHTML = forecast.days
          .map((d) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; font-size: 12.5px;">
              <span style="font-weight: 600; width: 85px; color: #1e293b;">${d.displayDate}</span>
              <span style="font-size: 18px;">${d.icon}</span>
              <span style="font-size: 11.5px; color: #475569; width: 85px; text-align: center;">${d.weatherDesc}</span>
              <span style="color: #64748b; font-size: 11.5px;">${d.tempMax}° / ${d.tempMin}°</span>
              <span style="font-weight: 700; color: ${d.rainMm > 40 ? '#dc2626' : (d.rainMm > 20 ? '#ea580c' : '#16a34a')}; width: 68px; text-align: right;">
                🌧️ ${d.rainMm} มม.
              </span>
            </div>
          `)
          .join('');
      }
    } catch (err) {
      if (container) {
        container.innerHTML = `<div style="font-size: 12px; color: #64748b;">ไม่สามารถโหลดพยากรณ์อากาศได้</div>`;
      }
    }
  }

  function isGeologyEnabled() {
    const toggle = document.querySelector('#toggle-dmr-geology');
    return toggle ? toggle.checked : false;
  }

  function loadGeologyIfEnabled(lat, lng) {
    if (!isGeologyEnabled() || !lat || !lng) return;
    identifyRockUnit(lat, lng).then((rock) => {
      const valEls = sheet.querySelectorAll('#st-sheet-geol-val, #dam-sheet-geol-val');
      const cardEl = sheet.querySelector('#st-sheet-geol-card');
      if (valEls.length > 0) {
        valEls.forEach((valEl) => {
          if (rock) {
            valEl.innerHTML = `<b>${rock.symbol}</b>: ${rock.name} <div style="font-size: 11px; color: #64748b; margin-top: 2px;">(ยุค: ${rock.age})</div>`;
          } else {
            valEl.innerHTML = `<span style="color: #64748b;">ไม่พบข้อมูลหินฐานบนบกในพิกัดนี้</span>`;
          }
        });
      }
      if (!rock && cardEl) {
        cardEl.style.display = 'none';
      }
    }).catch(() => {});
  }

  render();

  return {
    element: sheet,
    selectStation: (st) => {
      currentItem = st;
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectDam: (dam) => {
      currentItem = dam;
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectRoad: (road) => {
      currentItem = { isRoad: true, ...road };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectUserLocation: (loc) => {
      currentItem = { isUserLocation: true, ...loc };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectGeneric: (item) => {
      currentItem = item;
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    // Requirement 6: Dedicated weather forecast sheet
    openDedicatedWeatherForecast: (provinceName, weatherData) => {
      currentItem = {
        isDedicatedWeather: true,
        province: provinceName,
        weatherData
      };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    openWeatherForecast: (provinceName) => {
      currentItem = {
        isDedicatedWeather: true,
        province: provinceName
      };
      render();
      sheet.classList.add('open');
      isVisible = true;
    }
  };
}
