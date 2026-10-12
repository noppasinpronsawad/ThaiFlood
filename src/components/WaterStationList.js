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
import { fetch7DayWeatherForecast, fetchCurrentProvinceWeather, THAI_PROVINCES } from '../services/weatherService.js';
import { identifyRockUnit } from '../services/geologyService.js';
import { evaluateDamRuleCurve } from '../services/damRuleCurveService.js';
import { t, getLanguage, localizeName, localizeProvince, localizeBasin, localizeAgency, localizeDateTime, formatUnit, formatDateTimeCE, THAI_PROVINCE_EN_MAP } from '../services/i18nService.js';
// BMA road layer removed (getMinDistanceToBMARoads retained for backward compatibility: distToRoads <= 5.0 retired)
function getMinDistanceToBMARoads(lat, lng) {
  return 999999;
}

export function createWaterStationList(stations, onStationSelect) {
  const sheet = document.createElement('div');
  sheet.className = 'gmaps-place-sheet';
  sheet.id = 'gmaps-place-sheet';

  let currentItem = stations.find((s) => s.status === 'critical') || stations[0] || {};
  let isVisible = false;

  window.addEventListener('thaiflood:language-changed', () => {
    if (isVisible && currentItem) {
      render();
    }
  });

  function getActiveLayers() {
    const isChecked = (id) => {
      const el = document.querySelector(id);
      return el ? el.checked : false;
    };
    return {
      dams: isChecked('#toggle-dams'),
      stations: isChecked('#toggle-stations'),
      satWater: isChecked('#toggle-sat-water'),
      satClouds: isChecked('#toggle-sat-clouds'),
      geology: isChecked('#toggle-dmr-geology'),
      gfs: isChecked('#toggle-gfs'),
      ecmwf: isChecked('#toggle-ecmwf'),
      traffic: isChecked('#toggle-traffic'),
      cctv: isChecked('#toggle-cctv')
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
    } else if (currentItem.isCctv) {
      renderCctvSheet();
    } else if (currentItem.isDohRoad) {
      renderDohRoadSheet();
    } else if (currentItem.isRoad) {
      renderRoadSheet();
    } else if (currentItem.isTraffy) {
      renderTraffySheet();
    } else if (currentItem.isUserLocation) {
      renderUserLocationSheet();
    } else if (currentItem.isGeology) {
      renderGeologySheet();
    } else if (currentItem.isElevation || currentItem.isFloodExtent || currentItem.isNWP || currentItem.isGeneric) {
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

    const isEn = getLanguage() === 'en';
    let statusColor = '#188038';
    let statusText = hasBank && diff !== null
      ? (isEn ? `Normal Level (${diff} m below bank)` : `ระดับน้ำปกติ (ต่ำกว่าตลิ่ง ${diff} ม.)`)
      : (isEn ? 'Normal Level (Under Control)' : 'ระดับน้ำปกติ (สถานะควบคุมได้)');
    let statusBannerBg = '#e6f4ea';
    let statusBannerText = '#137333';

    if (isOverflow) {
      statusColor = '#d93025';
      statusText = diff !== null
        ? (isEn ? `🔴 Overbank Flood (+${diff} m)` : `🔴 น้ำล้นตลิ่งแล้ว (+${diff} ม.)`)
        : (isEn ? '🔴 Critical: Overbank Cresting' : '🔴 วิกฤต: ระดับน้ำล้นตลิ่งแล้ว');
      statusBannerBg = '#fce8e6';
      statusBannerText = '#c5221f';
    } else if (st.status === 'warning' || st.situationLevel === 4) {
      statusColor = '#f29900';
      statusText = diff !== null
        ? (isEn ? `🟠 High Water Watch (${diff} m left)` : `🟠 เฝ้าระวังน้ำสูง (เหลือ ${diff} ม.)`)
        : (isEn ? '🟠 Warning: Approaching Riverbank' : '🟠 เฝ้าระวัง: ระดับน้ำใกล้ตลิ่ง');
      statusBannerBg = '#fef7e0';
      statusBannerText = '#b06000';
    } else if (st.status === 'low') {
      statusColor = '#64748b';
      statusText = isEn ? '🔵 Low Water Level' : '🔵 ระดับน้ำน้อย';
      statusBannerBg = '#f1f5f9';
      statusBannerText = '#334155';
    }

    const subLocation = [
      st.amphoe ? (isEn ? (st.amphoe_en || st.amphoe) : ('อ.' + st.amphoe)) : '',
      localizeProvince(st)
    ].filter(Boolean).join(' ');
    const subtitle = `${subLocation ? subLocation + ' · ' : ''}${localizeBasin(st)} (${localizeAgency(st)})`;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📍 ${localizeName(st)}</h2>
          <div class="gmaps-place-sub">${subtitle}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${statusBannerBg}; color: ${statusBannerText}; border: 1px solid ${statusColor}35;">
        <div style="font-size: 20px;">${isOverflow ? '🌊' : (st.status === 'warning' ? '⚠️' : (st.status === 'low' ? '💧' : '🛡️'))}</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${statusText}</div>
          <div style="font-size: 11.5px; opacity: 0.9;">
            ${isOverflow ? t('sheet_overflow_warning') : (st.status === 'warning' ? t('sheet_near_bank_warning') : t('sheet_normal_info'))}
          </div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_point')}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>${t('sheet_weather_forecast')}</span>
        </button>
      </div>

      <div style="padding: 12px 16px; border-bottom: 1px solid #e8eaed;">
        <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; margin-bottom: 6px;">
          <span>${t('sheet_water_level_msl')}: <b style="color: ${statusColor}; font-size: 16px;">${formatUnit((st.currentLevel ?? 0).toFixed(2), 'm_msl')}</b></span>
          <span style="color: #5f6368;">${hasBank ? `${t('sheet_bank_level')}: ${formatUnit(st.bankCapacity.toFixed(2), 'm_msl')}` : t('sheet_bank_empty')}</span>
        </div>
        <div class="gmaps-bar-track">
          <div class="gmaps-bar-fill" style="width: ${percentFill}%; background: ${statusColor};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #70757a; margin-top: 4px;">
          <span>0%</span>
          <span>${hasBank ? `${t('sheet_capacity')}: <b>${percentFill}%</b> (${st.diffDisplay || ''})` : `Status: <b>${st.diffDisplay || 'Normal'}</b>`}</span>
          <span>100% (${isEn ? 'Bank' : 'ตลิ่ง'})</span>
        </div>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_last_telemetry')}</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">${localizeDateTime(st.datetime) || (isEn ? '29 Sep 2026 01:00' : '29 ก.ย. 2026 01:00 น.')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_operating_agency')}</div>
            <div class="gmaps-row-value">${localizeAgency(st) || (isEn ? 'HII (Hydro-Informatics Institute)' : 'สสน. (สถาบันสารสนเทศทรัพยากรน้ำ)')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_water_trend')}</div>
            <div class="gmaps-row-value" style="color: ${st.trend === 'rising' ? '#d93025' : '#202124'}; font-weight: 600;">
              ${st.trend === 'rising' ? t('sheet_trend_rising') : (st.trend === 'falling' ? t('sheet_trend_falling') : t('sheet_trend_stable'))}
            </div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">⚡</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_discharge_rate')}</div>
            <div class="gmaps-row-value">${st.flowRate ? formatUnit(st.flowRate.toLocaleString(), 'm3_s') : t('sheet_no_flow_sensor')}</div>
          </div>
        </div>

        ${isGeologyEnabled() ? `
          <div class="gmaps-detail-row" id="st-sheet-geol-row">
            <span class="gmaps-row-icon">🪨</span>
            <div class="gmaps-row-content">
              <div class="gmaps-row-label">${t('sheet_bedrock_unit')}</div>
              <div class="gmaps-row-value" id="st-sheet-geol-val" style="color: #7c3aed; font-weight: 600;">${t('sheet_bedrock_inspecting')}</div>
            </div>
          </div>
        ` : ''}
      </div>

      <div style="margin: 10px 16px; padding: 10px 12px; background: #e8f0fe; border-radius: 8px; font-size: 12px; color: #174ea6; line-height: 1.45;">
        <b>💡 ${t('sheet_public_advisory')}:</b><br/>
        ${isOverflow
          ? (isEn ? 'Water levels have crested overbank. Riverside residents should elevate belongings, disconnect flood-exposed power lines, and prepare pets.' : 'ระดับน้ำสูงกว่าตลิ่งแล้ว ขอให้ประชาชนริมแม่น้ำยกสิ่งของขึ้นที่สูง ตัดไฟจุดน้ำท่วม และเตรียมพร้อมอพยพสัตว์เลี้ยง')
          : (st.status === 'warning'
            ? (isEn ? 'Water level is near riverbank and rising. Prepare sandbags, test drainage sump pumps, and stay tuned to live reports.' : 'ระดับน้ำใกล้ตลิ่งและมีแนวโน้มสูงขึ้น ขอให้จัดเตรียมกระสอบทราย ตรวจสอบเครื่องสูบน้ำ และติดตามสถานการณ์ใกล้ชิด')
            : (isEn ? 'River stage is within standard safe operational capacity. Normal travel and activities may continue.' : 'ระดับน้ำในลำน้ำยังอยู่ในเกณฑ์ควบคุม สามารถสัญจรและใช้ชีวิตได้ตามปกติ'))}
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
    const rc = evaluateDamRuleCurve(dam, dam.rawDate || dam.date || new Date());
    
    const isEn = getLanguage() === 'en';
    // Evaluate status and banner strictly according to Rule Curve
    let statusColor = '#0284c7';
    let statusBannerBg = '#f0f9ff';
    let statusBannerText = '#0369a1';
    let statusText = isEn
      ? `🔵 Normal: ${p}% Capacity (Within Rule Curve)`
      : `🔵 เกณฑ์ปกติ: ${p}% ของความจุ (อยู่ในเกณฑ์ควบคุม Rule Curve)`;

    if (rc && rc.zone === 'above_urc') {
      const diff = (p - rc.urcPercent).toFixed(1);
      statusColor = '#dc2626';
      statusBannerBg = '#fef2f2';
      statusBannerText = '#b91c1c';
      statusText = isEn
        ? `🔴 Critical: ${p}% Capacity (Above URC +${diff}%)`
        : `🔴 วิกฤต (น้ำมาก): ${p}% ของความจุ (เกินเกณฑ์ควบคุมบน URC +${diff}%)`;
    } else if (rc && p >= rc.urcPercent - 5) {
      const margin = (rc.urcPercent - p).toFixed(1);
      statusColor = '#ea580c';
      statusBannerBg = '#fff7ed';
      statusBannerText = '#c2410c';
      statusText = isEn
        ? `🟠 Watch: ${p}% Capacity (Near URC, ${margin}% left)`
        : `🟠 เฝ้าระวัง (น้ำมาก): ${p}% ของความจุ (ใกล้เกณฑ์ควบคุมบน URC เหลือ ${margin}%)`;
    } else if (rc && rc.zone === 'below_lrc') {
      const diff = (rc.lrcPercent - p).toFixed(1);
      statusColor = '#d97706';
      statusBannerBg = '#fffbeb';
      statusBannerText = '#b45309';
      statusText = isEn
        ? `🟡 Low Storage: ${p}% Capacity (Below LRC -${diff}%)`
        : `🟡 น้ำน้อย: ${p}% ของความจุ (ต่ำกว่าเกณฑ์ควบคุมล่าง LRC -${diff}%)`;
    }
    const subLocation = [
      dam.amphoe ? (isEn ? (dam.amphoe_en || dam.amphoe) : ('อ.' + dam.amphoe)) : '',
      localizeProvince(dam)
    ].filter(Boolean).join(' ');
    const subtitle = `${subLocation ? subLocation + ' · ' : ''}${localizeBasin(dam)} (${localizeAgency(dam)})`;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">${dam.isMediumReservoir ? '💧' : '🏢'} ${localizeName(dam)}</h2>
          <div class="gmaps-place-sub">${subtitle}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${statusBannerBg}; color: ${statusBannerText}; border: 1px solid ${statusColor}35;">
        <div style="font-size: 20px;">${dam.isMediumReservoir ? '💧' : '🏢'}</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${statusText}</div>
          <div style="font-size: 11.5px; opacity: 0.9;">
            ${dam.isMediumReservoir ? t('dam_desc_medium') : t('dam_desc_major')}
          </div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_point')}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>${t('sheet_weather_forecast')}</span>
        </button>
      </div>

      <div style="padding: 12px 16px; border-bottom: 1px solid #e8eaed;">
        <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; margin-bottom: 6px;">
          <span>${t('sheet_storage')}: <b style="color: ${statusColor}; font-size: 16px;">${(dam.currentStorage ?? 0).toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</b></span>
          <span style="color: #5f6368;">${t('sheet_capacity')}: ${(dam.normalStorage ?? 0).toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</span>
        </div>
        <div class="gmaps-bar-track">
          <div class="gmaps-bar-fill" style="width: ${Math.min(100, Math.max(5, dam.percentStorage ?? 50))}%; background: ${statusColor};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #70757a; margin-top: 4px;">
          <span>0%</span>
          <span>${isEn ? 'Storage Ratio' : 'ระดับกักเก็บ'}: <b>${dam.percentStorage}%</b></span>
          <span>100% (${isEn ? 'Normal Capacity' : 'ความจุปกติ'})</span>
        </div>
      </div>

      <!-- Dam Rule Curve Assessment (เกณฑ์ควบคุมน้ำในเขื่อน) vs Adaptive Medium Reservoir Storage Balance -->
      ${dam.isMediumReservoir ? `
        <div class="gmaps-rule-curve-card" style="margin: 12px 16px; padding: 14px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 16px;">💧</span>
              <span style="font-weight: 700; font-size: 13px; color: #166534;">${t('sheet_medium_res_status')}</span>
            </div>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 700; background: ${statusBannerBg}; color: ${statusColor}; border: 1px solid ${statusColor}40;">
              ${p}% ${isEn ? 'Capacity' : 'ของความจุ'}
            </span>
          </div>

          <div style="font-size: 11.5px; color: #475569; margin-bottom: 12px; line-height: 1.4;">
            ${t('sheet_medium_res_desc') || 'อ่างเก็บน้ำขนาดกลางชลประทาน ติดตามปริมาตรน้ำกักเก็บและสมดุลการไหลเข้า-ออกเพื่อสนับสนุนการบริหารจัดการน้ำระดับลุ่มน้ำ'}
          </div>

          <!-- Adaptive Storage Gauge Progress Bar (0 - 100%) -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 5px;">
              <span style="color: #64748b;">${t('sheet_current_storage')}</span>
              <span style="font-weight: 700; color: ${statusColor};">${(dam.currentStorage ?? 0).toLocaleString()} / ${((dam.maxStorage || dam.normalStorage) ?? 0).toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.max(4, p))}%; height: 100%; background: ${statusColor}; border-radius: 5px; transition: width 0.4s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8; margin-top: 3px;">
              <span>0% (${t('sheet_dry')})</span>
              <span>50% (${t('sheet_normal')})</span>
              <span>100% (${t('sheet_full')})</span>
            </div>
          </div>

          <!-- Water Balance Card -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div style="padding: 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
              <div style="color: #64748b; font-size: 10.5px;">${t('sheet_inflow_today') || '💧 น้ำไหลเข้าวันนี้'}</div>
              <div style="font-weight: 700; color: #0284c7; font-size: 13px;">+${(dam.inflow ?? 0).toLocaleString()} <span style="font-size: 10px; font-weight: normal;">${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</span></div>
            </div>
            <div style="padding: 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
              <div style="color: #64748b; font-size: 10.5px;">${t('sheet_outflow_today')}</div>
              <div style="font-weight: 700; color: #ea580c; font-size: 13px;">-${(dam.released ?? 0).toLocaleString()} <span style="font-size: 10px; font-weight: normal;">${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</span></div>
            </div>
          </div>

          <!-- Seasonal Rule Curve Thresholds for Medium Reservoir -->
          ${rc ? `
          <div style="margin-top: 10px; padding: 10px; background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <span style="font-weight: 700; font-size: 11px; color: #166534;">${t('sheet_rule_curve_seasonal')}</span>
              <span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: ${rc.badgeBg}; color: ${rc.zoneColor}; font-weight: 700;">
                ${rc.zone === 'above_urc' ? t('sheet_above_urc') : (rc.zone === 'below_lrc' ? t('sheet_below_lrc') : t('sheet_normal_control'))}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b;">
              <span>${t('sheet_lrc_label')}: <b style="color: #d97706;">${rc.lrcPercent}%</b></span>
              <span>${isEn ? 'Current:' : 'ระดับปัจจุบัน:'} <b style="color: ${statusColor};">${p}%</b></span>
              <span>${t('sheet_urc_label')}: <b style="color: #dc2626;">${rc.urcPercent}%</b></span>
            </div>
          </div>
          ` : ''}
        </div>
      ` : (rc ? `
        <div class="gmaps-rule-curve-card" style="margin: 12px 16px; padding: 14px; background: #f8fafc; border: 1.5px solid ${rc.border}; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 16px;">📈</span>
              <span style="font-weight: 700; font-size: 13px; color: #1e293b;">${t('sheet_rule_curve_dam') || 'เกณฑ์ควบคุมน้ำในเขื่อน (Rule Curve)'}</span>
            </div>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; background: ${rc.badgeBg}; color: ${rc.zoneColor}; border: 1px solid ${rc.border};">
              ${rc.zone === 'above_urc' ? t('sheet_above_urc') : (rc.zone === 'below_lrc' ? t('sheet_below_lrc') : t('sheet_normal_control'))}
            </span>
          </div>

          <div style="font-size: 11.5px; color: #64748b; margin-bottom: 12px; line-height: 1.4;">
            ${t('sheet_rule_curve_eval_desc')}
          </div>

          <!-- 3-Zone Gauge Bar -->
          <div style="position: relative; margin: 18px 4px 12px 4px;">
            <div style="height: 14px; border-radius: 7px; overflow: hidden; display: flex; box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);">
              <div style="width: ${rc.lrcPercent}%; background: linear-gradient(90deg, #fef3c7, #fde68a); border-right: 2px dashed #d97706;" title="${t('rc_gauge_low').replace('{lrc}', rc.lrcPercent)}"></div>
              <div style="width: ${rc.urcPercent - rc.lrcPercent}%; background: linear-gradient(90deg, #bae6fd, #7dd3fc); border-right: 2px dashed #dc2626;" title="${t('rc_gauge_normal').replace('{lrc}', rc.lrcPercent).replace('{urc}', rc.urcPercent)}"></div>
              <div style="width: ${100 - rc.urcPercent}%; background: linear-gradient(90deg, #fecaca, #f87171);" title="${t('rc_gauge_high').replace('{urc}', rc.urcPercent)}"></div>
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
              <span>${t('sheet_lrc_label')}: <b>${rc.lrcPercent}%</b></span>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-right: 3px;"></span>
              <span>${t('sheet_urc_label')}: <b>${rc.urcPercent}%</b></span>
            </div>
          </div>

          <!-- Operational Assessment Advice Box -->
          <div style="padding: 10px; background: ${rc.badgeBg}; border-radius: 8px; border: 1px solid ${rc.border}; margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 12px; color: ${rc.zoneColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>${isEn ? (rc.zoneLabelEn || rc.zoneLabel) : rc.zoneLabel}</span>
            </div>
            <div style="font-size: 11.5px; color: #334155; line-height: 1.45;">
              ${isEn ? (rc.adviceEn || rc.advice) : rc.advice}
            </div>
          </div>

          <!-- Threshold Metrics Breakdown -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div style="padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="color: #64748b;">${t('sheet_urc_threshold')}</div>
              <div style="font-weight: 700; color: #dc2626; font-size: 12px;">${rc.urcStorage.toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</div>
            </div>
            <div style="padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="color: #64748b;">${t('sheet_lrc_threshold')}</div>
              <div style="font-weight: 700; color: #d97706; font-size: 12px;">${rc.lrcStorage.toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</div>
            </div>
          </div>
        </div>
      ` : '')}

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📅</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_last_telemetry')}</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">${localizeDateTime(dam.datetime || dam.date) || (isEn ? '29 Sep 2026 06:00' : '29 ก.ย. 2026 06:00 น.')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_operating_agency')}</div>
            <div class="gmaps-row-value">${localizeAgency(dam) || (isEn ? 'EGAT / Royal Irrigation Dept.' : 'กฟผ. / กรมชลประทาน')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">💧</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_inflow_today')}</div>
            <div class="gmaps-row-value" style="color: #1a73e8; font-weight: 600;">+${(dam.inflow ?? 0).toLocaleString()} ${isEn ? 'Million m³/day' : 'ล้าน ลบ.ม./วัน'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🌊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_outflow_today')}</div>
            <div class="gmaps-row-value" style="color: #ea580c; font-weight: 600;">-${(dam.released ?? 0).toLocaleString()} ${isEn ? 'Million m³/day' : 'ล้าน ลบ.ม./วัน'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_max_capacity')}</div>
            <div class="gmaps-row-value">${(dam.maxStorage ?? 0).toLocaleString()} ${isEn ? 'Million m³' : 'ล้าน ลบ.ม.'}</div>
          </div>
        </div>

        ${isGeologyEnabled() ? `
          <div class="gmaps-detail-row" id="dam-sheet-geol-row">
            <span class="gmaps-row-icon">🪨</span>
            <div class="gmaps-row-content">
              <div class="gmaps-row-label">${t('sheet_dam_geology_label')}</div>
              <div class="gmaps-row-value" id="dam-sheet-geol-val" style="color: #7c3aed; font-weight: 600;">${t('sheet_bedrock_inspecting')}</div>
            </div>
          </div>
        ` : ''}
      </div>

      ${dam.cctvUrl ? `
        <div style="margin: 10px 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #334155;">${t('sheet_cctv_dam_crest')}</div>
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
  // 2.2 Live Official CCTV Surveillance Sheet
  // ==========================================
  function renderCctvSheet() {
    const cam = currentItem;
    const isEn = getLanguage() === 'en';
    const isDoh = cam.agencyCode === 'DOH';
    const isBma = cam.agencyCode === 'BMA';

    const agencyBadgeColor = isDoh ? '#1e40af' : (isBma ? '#15803d' : '#0369a1');
    const agencyBadgeBg = isDoh ? '#dbeafe' : (isBma ? '#dcfce7' : '#e0f2fe');
    const agencyTitle = localizeAgency(cam) || (isEn ? 'Official Surveillance Camera' : 'กล้องตรวจการณ์ภาครัฐ');

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: ${agencyBadgeColor}; background: ${agencyBadgeBg}; padding: 2px 8px; border-radius: 999px;">
              ${agencyTitle}
            </span>
            <span style="font-size: 11px; color: #64748b;">${isEn ? 'ID:' : 'รหัส:'} ${cam.id || 'CCTV'}</span>
          </div>
          <h2 class="gmaps-place-title">📹 ${localizeName(cam) || (isEn ? 'CCTV Surveillance Camera' : 'กล้อง CCTV ตรวจการณ์')}</h2>
          <div class="gmaps-place-sub">${localizeProvince(cam) || (isEn ? 'Thailand' : 'ประเทศไทย')} · ${cam.route || ''} ${cam.km ? `(${cam.km})` : ''}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <!-- Live Snapshot Container (16:9 On-Demand Fetch) -->
      <div class="gmaps-cctv-viewer" style="margin: 12px 16px; background: #0f172a; border-radius: 12px; overflow: hidden; position: relative; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <img 
          id="cctv-live-img"
          src="${cam.snapshotUrl}"
          alt="${cam.name}"
          loading="lazy"
          referrerpolicy="no-referrer"
          style="width: 100%; height: 100%; object-fit: cover; display: block;"
          onload="const l = this.parentElement.querySelector('.cctv-img-loader'); if (l) l.style.display='none';"
          onerror="
            this.style.display = 'none';
            const fallback = this.parentElement.querySelector('.cctv-img-offline');
            if (fallback) fallback.style.display = 'flex';
          "
        />
        <div class="cctv-img-loader" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1e293b; color: #94a3b8; font-size: 12px; gap: 8px;">
          <div style="font-size: 24px; animation: gmaps-pulse 1.2s infinite ease-in-out;">📹</div>
          <span>${t('sheet_cctv_connecting')}</span>
        </div>
        <div class="cctv-img-offline" style="display: none; position: absolute; inset: 0; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; text-align: center; padding: 20px 16px; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e;"></span>
            <span style="font-size: 11.5px; font-weight: 700; color: #38bdf8;">${isEn ? 'Official Surveillance Stream Connected' : 'สัญญาณกล้องสดเชื่อมต่อผ่านระบบทางการ'}</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${localizeName(cam) || t('sheet_cctv_title')}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 14px; line-height: 1.4; max-width: 280px;">${isEn ? `Streaming feed provided via ${localizeAgency(cam) || 'Official Network'}` : `ระบบถ่ายทอดสดแบบสตรีมมิ่งเปิดให้รับชมผ่านเครือข่ายของ ${cam.agency || 'หน่วยงาน'}`}</div>
          ${cam.portalUrl ? `
            <a href="${cam.portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 16px; border-radius: 8px; box-shadow: 0 4px 10px rgba(2,132,199,0.35);">
              <span>🌐 ${t('sheet_cctv_official_portal')}</span>
              <span>↗</span>
            </a>
          ` : ''}
        </div>
        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); color: #f8fafc; font-size: 10.5px; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
          <span>LIVE SNAPSHOT · ${isEn ? 'Updated:' : 'อัปเดตล่าสุด:'} ${localizeDateTime(cam.lastUpdate) || ''}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="gmaps-action-row" style="margin: 0 16px 12px 16px;">
        <button class="gmaps-action-btn" id="btn-refresh-cctv" title="${t('sheet_cctv_refresh')}">
          <span style="font-size: 15px; color: #1a73e8;">🔄</span>
          <span>${t('sheet_cctv_refresh')}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-focus-station" title="${t('sheet_zoom_point')}">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_point')}</span>
        </button>
        ${cam.portalUrl ? `
          <a class="gmaps-action-btn" href="${cam.portalUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;" title="${t('sheet_cctv_official_portal')}">
            <span style="font-size: 15px; color: #1a73e8;">🌐</span>
            <span>${isEn ? 'Official Portal' : 'เว็บทางการ'}</span>
          </a>
        ` : ''}
      </div>

      <!-- Details List -->
      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📍</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_cctv_route_label')}</div>
            <div class="gmaps-row-value" style="color: #1e293b; font-weight: 600;">${cam.route || '-'} ${cam.km ? `(${cam.km})` : ''}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_cctv_owner_label')}</div>
            <div class="gmaps-row-value" style="color: #334155; font-weight: 600;">${agencyTitle}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🌐</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_cctv_gps_label')}</div>
            <div class="gmaps-row-value" style="color: #64748b; font-family: monospace;">${(cam.lat || 0).toFixed(4)}°N, ${(cam.lng || 0).toFixed(4)}°E</div>
          </div>
        </div>
      </div>

      <!-- Weather Section -->
      ${renderWeatherSectionHtml(getProvinceName(cam))}
    `;

    attachEvents();

    const refreshBtn = sheet.querySelector('#btn-refresh-cctv');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const img = sheet.querySelector('#cctv-live-img');
        const loader = sheet.querySelector('.cctv-img-loader');
        const fallback = sheet.querySelector('.cctv-img-offline');
        if (img && cam.snapshotUrl) {
          if (loader) loader.style.display = 'flex';
          if (fallback) fallback.style.display = 'none';
          img.style.display = 'block';
          const base = cam.snapshotUrl.split('&_t=')[0].split('?_t=')[0];
          const sep = base.includes('?') ? '&' : '?';
          img.src = `${base}${sep}_t=${Date.now()}`;
        }
      });
    }

    loadSheetWeather(getProvinceName(cam), cam.lat, cam.lng);
  }

  // ==========================================
  // 2.5 DOH National Highway Flood Sheet (สายด่วน 1586)
  // ==========================================
  function renderDohRoadSheet() {
    const road = currentItem;
    const isEn = getLanguage() === 'en';
    const isPassable = road.passable !== false;
    const color = isPassable ? '#ea580c' : '#dc2626';
    const bgBadge = isPassable ? '#fff7ed' : '#fef2f2';
    const borderBadge = isPassable ? '#ffedd5' : '#fee2e2';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">🛣️ ${road.highwayNo} (${road.routeName})</h2>
          <div class="gmaps-place-sub">${road.section || road.kmRange} · ${road.amphoe ? (isEn ? (road.amphoe_en || road.amphoe) : ('อ.' + road.amphoe)) : ''} ${localizeProvince(road)} · ${localizeAgency(road) || (isEn ? 'Department of Highways (DOH)' : 'กรมทางหลวง')}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${bgBadge}; color: ${color}; border: 1px solid ${borderBadge};">
        <div style="font-size: 22px;">${isPassable ? '⚠️' : '⛔'}</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${road.statusLabel || (isPassable ? (isEn ? 'Passable (Proceed with Caution)' : t('sheet_passable')) : (isEn ? 'Impassable (Closed to Traffic)' : t('sheet_impassable')))}</div>
          <div style="font-size: 11.5px; opacity: 0.95;">${t('sheet_doh_depth_label')}: <b>${road.waterDepthCm} ${isEn ? 'cm' : 'ซม.'}</b> · ${road.cause || (isEn ? 'Surface flooding' : 'น้ำหลากท่วมผิวทาง')}</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_point')}</span>
        </button>
        <a class="gmaps-action-btn" href="tel:1586" style="text-decoration: none;">
          <span style="font-size: 15px; color: #16a34a;">📞</span>
          <span style="color: #16a34a; font-weight: 700;">${t('sheet_hotline_1586')}</span>
        </a>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🛣️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_doh_km_label')}</div>
            <div class="gmaps-row-value" style="color: #1e293b; font-weight: 600;">${road.highwayNo} ${road.routeName} (${road.kmRange})</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🌊</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_doh_depth_label')}</div>
            <div class="gmaps-row-value" style="color: ${color}; font-weight: 700; font-size: 14px;">${road.waterDepthCm} ${isEn ? 'cm' : 'ซม.'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🔄</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_doh_detour_label')}</div>
            <div class="gmaps-row-value" style="color: #0284c7; font-weight: 600; line-height: 1.4;">${road.detour || (isEn ? 'Slow down and follow Highway District warning signs' : 'ชะลอความเร็วและปฏิบัติตามป้ายเตือนของเจ้าหน้าที่แขวงทางหลวง')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_doh_agency_label')}</div>
            <div class="gmaps-row-value">${localizeAgency(road) || (isEn ? 'Department of Highways (DOH)' : 'กรมทางหลวง (Department of Highways - DOH)')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_last_telemetry')}</div>
            <div class="gmaps-row-value" style="color: #64748b;">${localizeDateTime(road.reportedTime) || (isEn ? '29 Sep 2026 01:00' : '29 ก.ย. 2026 01:00 น.')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📞</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_doh_emergency_center')}</div>
            <div class="gmaps-row-value"><a href="tel:1586" style="color: #1a73e8; font-weight: 700; text-decoration: none;">${t('sheet_doh_tollfree')}</a></div>
          </div>
        </div>
      </div>

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(road.lat, road.lng, road.province)}

      <!-- Weather Section -->
      ${renderWeatherSectionHtml(road.province)}
    `;

    attachEvents();
    loadSheetWeather(getProvinceName(road), road.lat, road.lng);
  }

  // ==========================================
  // 3. BMA Road Flood Corridor Sheet
  // ==========================================
  function renderRoadSheet() {
    const road = currentItem;
    const isEn = getLanguage() === 'en';
    const isCrit = road.riskLevel === 'critical';
    const color = isCrit ? '#dc2626' : '#ea580c';
    const bgBadge = isCrit ? '#fef2f2' : '#fffbeb';
    const borderBadge = isCrit ? '#fecaca' : '#fed7aa';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">🚗 ${road.road}</h2>
          <div class="gmaps-place-sub">${isEn ? `BMA District: ${road.district || 'Bangkok'} · Dept. of Drainage and Sewerage` : `กทม. เขต ${road.district || 'กรุงเทพมหานคร'} · สำนักการระบายน้ำ`}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${bgBadge}; color: ${color}; border: 1px solid ${borderBadge};">
        <div style="font-size: 22px;">🌊</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${road.warningBadge || (isCrit ? (isEn ? '🔴 Critical Waterlogging on Roadway' : '🔴 น้ำท่วมขังวิกฤตบนผิวจราจร') : (isEn ? '🟠 Waterlogging Watch' : '🟠 เฝ้าระวังน้ำท่วมขัง'))}</div>
          <div style="font-size: 11.5px; opacity: 0.95;">${isEn ? 'Flood Depth on Roadway:' : 'ระดับน้ำท่วมขังผิวจราจร:'} <b>${road.waterDepthCm}</b> (${road.floodedLanes})</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_road')}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>${t('sheet_weather_forecast')}</span>
        </button>
      </div>

      <div style="padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #e8eaed; font-size: 12px; color: #1e293b;">
        <b>${t('sheet_traffy_section_label')}</b><br/>
        <div style="margin-top: 3px; color: #475569; line-height: 1.4;">${road.segment}</div>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_last_telemetry')}</div>
            <div class="gmaps-row-value" style="color: #dc2626; font-weight: 700;">${localizeDateTime(road.lastUpdated) || (isEn ? '29 Sep 2026 01:00' : '29 ก.ย. 2026 01:00 น.')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📏</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_traffy_distance_label')}</div>
            <div class="gmaps-row-value">${road.lengthKm} ${isEn ? 'km' : 'กิโลเมตร'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🛣️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_traffy_lanes_label')}</div>
            <div class="gmaps-row-value">${road.floodedLanes}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">⚠️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_traffy_impact_label')}</div>
            <div class="gmaps-row-value" style="color: #b45309; line-height: 1.35;">${road.trafficImpact}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">💡</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_traffy_cause_label')}</div>
            <div class="gmaps-row-value" style="color: #64748b; line-height: 1.35;">${road.cause}</div>
          </div>
        </div>
      </div>

      <div style="margin: 10px 16px; padding: 10px 12px; background: #fef2f2; border-radius: 8px; font-size: 11.5px; border: 1px dashed #fca5a5; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #991b1b; font-weight: 600;">${t('sheet_traffy_bma_hotline')}</span>
        <a href="https://line.me/R/ti/p/@traffyfondue" target="_blank" style="background: #16a34a; color: #fff; padding: 4px 10px; border-radius: 6px; text-decoration: none; font-weight: 700;">
          ${t('sheet_traffy_report_btn')}
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
  // 3b. Traffy Fondue Flood Incident Sheet
  // ==========================================
  function renderTraffySheet() {
    const item = currentItem;
    const isEn = getLanguage() === 'en';
    const isDone = item.stateClass === 'finished' || (item.state && (item.state.includes('เสร็จ') || item.state.includes('แก้ไขแล้ว')));
    const badgeBg = isDone ? '#ecfdf5' : '#fffbeb';
    const badgeColor = isDone ? '#059669' : '#d97706';
    const badgeBorder = isDone ? '#a7f3d0' : '#fde68a';
    const badgeIcon = isDone ? '✅' : '⏳';

    const defaultTitle = isEn ? 'Traffy Fondue Incident' : 'จุดแจ้งเหตุ Traffy Fondue';
    const typePrefix = item.type ? `[${item.type}] ` : '';

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📋 ${typePrefix}${item.address || defaultTitle}</h2>
          <div class="gmaps-place-sub">${isEn ? `Ticket #${item.ticket_id} · District: ${item.district || 'Bangkok'}` : `รหัสแจ้งเหตุ #${item.ticket_id} · เขต ${item.district || 'กรุงเทพมหานคร'}`}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
        <div style="font-size: 22px;">${badgeIcon}</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${t('sheet_status_prefix')} ${item.state || t('sheet_traffy_ack')}</div>
          <div style="font-size: 11.5px; opacity: 0.95;">${t('sheet_traffy_org')}</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${t('sheet_zoom_incident')}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>${t('sheet_weather_forecast')}</span>
        </button>
      </div>

      ${item.photo_url ? `
        <div style="padding: 12px 16px 4px 16px;">
          <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-bottom: 6px;">📷 ${isEn ? 'Incident Photo' : 'ภาพถ่ายจุดเกิดเหตุ'}</div>
          <div style="border-radius: 10px; overflow: hidden; max-height: 220px; border: 1px solid #e2e8f0; background: #0f172a; text-align: center;">
            <img src="${item.photo_url}" alt="Incident photo" style="width: 100%; height: auto; max-height: 220px; object-fit: cover; display: block;" loading="lazy" />
          </div>
        </div>
      ` : ''}

      <div style="padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #e8eaed; font-size: 12px; color: #1e293b;">
        <b>📝 ${isEn ? 'Incident Details:' : 'รายละเอียดเหตุการณ์:'}</b><br/>
        <div style="margin-top: 4px; color: #334155; line-height: 1.45; font-size: 12.5px;">${item.description || (isEn ? 'No additional details provided' : 'ไม่มีรายละเอียดเพิ่มเติม')}</div>
      </div>

      <div class="gmaps-details-list">
        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">📍</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${isEn ? 'Location / Landmark' : 'สถานที่ / จุดสังเกต'}</div>
            <div class="gmaps-row-value">${item.address || '-'}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🏛️</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${isEn ? 'Responsible District' : 'เขตพื้นที่รับผิดชอบ'}</div>
            <div class="gmaps-row-value">${item.district || (isEn ? 'Bangkok' : 'กรุงเทพมหานคร')}</div>
          </div>
        </div>

        <div class="gmaps-detail-row">
          <span class="gmaps-row-icon">🕒</span>
          <div class="gmaps-row-content">
            <div class="gmaps-row-label">${t('sheet_traffy_reported_time')}</div>
            <div class="gmaps-row-value" style="color: #64748b;">${localizeDateTime(item.formattedTime || item.timestamp) || '-'}</div>
          </div>
        </div>
      </div>

      <div style="margin: 12px 16px; display: flex; gap: 8px;">
        <a href="${item.traffy_url || `https://share.traffy.in.th/teamchadchart/share?ticket_id=${item.ticket_id}`}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #0284c7; color: #fff; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600;">
          ${isEn ? 'View on Traffy Fondue ↗' : 'ดูบน Traffy Fondue ↗'}
        </a>
        <a href="${item.line_url || 'https://line.me/R/ti/p/@traffyfondue'}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #16a34a; color: #fff; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600;">
          ${isEn ? 'Report More Incidents 💬' : 'แจ้งเหตุเพิ่มเติม 💬'}
        </a>
      </div>

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(item.lat || 13.75, item.lng || 100.5, 'กรุงเทพมหานคร')}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml('กรุงเทพมหานคร')}
    `;

    attachEvents();
    loadSheetWeather('กรุงเทพมหานคร', item.lat || 13.75, item.lng || 100.5);
    loadGeologyIfEnabled(item.lat || 13.75, item.lng || 100.5);
  }

  // ==========================================
  // 4. User Current Location Sheet
  // ==========================================
  function renderUserLocationSheet() {
    const loc = currentItem;
    const isEn = getLanguage() === 'en';
    const st = loc.nearestStation;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">📍 ${isEn ? 'Your Current Location' : 'ตำแหน่งปัจจุบันของคุณ'}</h2>
          <div class="gmaps-place-sub">${isEn ? `GPS Coords ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy || 15)} m)` : `พิกัด ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy || 15)} ม.)`}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">
        <div style="font-size: 22px;">🎯</div>
        <div>
          <div style="font-weight: 700; font-size: 14px;">${isEn ? 'GPS Location Acquired' : 'ตรวจจับพิกัด GPS สำเร็จ'}</div>
          <div style="font-size: 11.5px; opacity: 0.9;">${isEn ? 'Flood risk evaluated from nearby telemetry stations and local terrain' : 'ประเมินความเสี่ยงน้ำท่วมจากสถานีโทรมาตรและข้อมูลพื้นที่รอบตัว'}</div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #1a73e8;">📍</span>
          <span>${isEn ? 'Focus My Location' : 'ซูมดูตำแหน่งฉัน'}</span>
        </button>
        <button class="gmaps-action-btn" id="btn-view-weather">
          <span style="font-size: 15px; color: #1a73e8;">🌧️</span>
          <span>${t('sheet_weather_forecast')}</span>
        </button>
      </div>

      ${st ? `
        <div style="margin: 12px 16px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 2px;">${isEn ? `📡 Nearest Water Telemetry Station (~${(loc.minKm ?? 0).toFixed(1)} km):` : `📡 สถานีโทรมาตรวัดน้ำใกล้คุณที่สุด (~${(loc.minKm ?? 0).toFixed(1)} กม.):`}</div>
          <div style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${localizeName(st)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 12px;">
            <span>${isEn ? 'Water Level:' : 'ระดับน้ำ:'} <b style="color: ${st.isOverflow ? '#d93025' : '#16a34a'}; font-size: 14px;">${st.currentLevel.toFixed(2)} ${isEn ? 'm MSL' : 'ม. (รทก.)'}</b></span>
            <span style="font-size: 11px; background: ${st.isOverflow ? '#fee2e2' : '#dcfce7'}; color: ${st.isOverflow ? '#991b1b' : '#15803d'}; padding: 2px 7px; border-radius: 12px; font-weight: 700;">
              ${st.diffDisplay || (isEn ? 'Normal' : 'ปกติ')}
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
  // 5.1 DMR Geology 1:250,000 Sheet
  // ==========================================
  function renderGeologySheet() {
    const item = currentItem;
    const isEn = getLanguage() === 'en';
    const title = item.title || (isEn ? 'DMR Geology (1:250k)' : 'ข้อมูลธรณีวิทยา (DMR 1:250k)');
    const category = isEn ? 'Bedrock & Geology (DMR 1:250k)' : (item.category || 'ธรณีวิทยาและหินฐาน (DMR 1:250k)');
    const coordsStr = item.lat && item.lng 
      ? (isEn ? `Coords ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : `พิกัด ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`)
      : (isEn ? 'Selected Coordinate' : 'พิกัดที่เลือก');
    const sourceStr = isEn ? 'Department of Mineral Resources (DMR)' : 'กรมทรัพยากรธรณี กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม';

    const details = Array.isArray(item.details) ? item.details : [];

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">🪨 ${title}</h2>
          <div class="gmaps-place-sub">${sourceStr} · ${coordsStr}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff;">
        <div style="font-size: 20px;">🪨</div>
        <div>
          <div style="font-weight: 700; font-size: 13.5px;">${category}</div>
          <div style="font-size: 11px; color: #7e22ce;">
            ${isEn ? 'Geological map scale 1:250,000 (Department of Mineral Resources, Thailand)' : 'แผนที่ธรณีวิทยามาตราส่วน 1:250,000 แสดงหน่วยหินและโครงสร้างหินฐาน'}
          </div>
        </div>
      </div>

      <div class="gmaps-action-row">
        <button class="gmaps-action-btn" id="btn-focus-station">
          <span style="font-size: 15px; color: #7e22ce;">📍</span>
          <span>${t('sheet_zoom_point')}</span>
        </button>
      </div>

      <div style="padding: 12px 16px;">
        <div style="font-weight: 700; font-size: 12.5px; color: #1e293b; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
          <span>📋</span>
          <span>${isEn ? 'Rock Unit Attributes:' : 'ข้อมูลจำเพาะของหน่วยหิน:'}</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          ${details.map((d, idx) => `
            <div style="display: flex; padding: 10px 12px; font-size: 12px; border-bottom: ${idx === details.length - 1 ? 'none' : '1px solid #f1f5f9'}; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <span style="width: 140px; color: #64748b; font-weight: 600; flex-shrink: 0;">${isEn ? (d.labelEn || d.label) : d.label}</span>
              <span style="color: #1e293b; font-weight: 600; word-break: break-word;">${d.value || '-'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${item.province ? renderWeatherSectionHtml(item.province) : ''}
    `;

    attachEvents();
    if (item.province) {
      loadSheetWeather(item.province, item.lat, item.lng);
    }
  }

  // ==========================================
  // 5.2 Generic Feature Sheet (Elevation, NWP, Flood Extent)
  // ==========================================
  function renderGenericSheet() {
    const item = currentItem;
    const isEn = getLanguage() === 'en';
    const title = item.name || item.title || (item.isElevation ? (isEn ? `Elevation ${item.elevation} m` : `ระดับความสูง ${item.elevation} ม.`) : (isEn ? 'Area Details' : 'ข้อมูลพื้นที่'));
    const desc = item.desc || item.category || item.recommendation || item.severityLabel || (isEn ? 'Measurement Telemetry' : 'ข้อมูลการตรวจวัด');

    const prov = item.province || 'กรุงเทพมหานคร';
    const details = Array.isArray(item.details) ? item.details : [];

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <h2 class="gmaps-place-title">${item.icon || '📌'} ${title}</h2>
          <div class="gmaps-place-sub">${isEn ? `Coords ${item.lat ? item.lat.toFixed(4) + ', ' + item.lng.toFixed(4) : 'Selected Point'}` : `พิกัด ${item.lat ? item.lat.toFixed(4) + ', ' + item.lng.toFixed(4) : 'จุดที่เลือก'}`}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <div class="gmaps-status-banner" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1;">
        <div style="font-size: 20px;">ℹ️</div>
        <div>
          <div style="font-weight: 700; font-size: 13.5px;">${desc}</div>
          <div style="font-size: 11px; color: #64748b;">${item.riskTag || item.displayDate || (isEn ? 'Geographic Information' : 'ระบบภูมิสารสนเทศ')}</div>
        </div>
      </div>

      ${details.length > 0 ? `
        <div style="padding: 12px 16px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
            ${details.map((d, idx) => `
              <div style="display: flex; padding: 10px 12px; font-size: 12px; border-bottom: ${idx === details.length - 1 ? 'none' : '1px solid #f1f5f9'}; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <span style="width: 140px; color: #64748b; font-weight: 600; flex-shrink: 0;">${isEn ? (d.labelEn || d.label) : d.label}</span>
                <span style="color: #1e293b; font-weight: 600; word-break: break-word;">${d.value || '-'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Multi-Layer Companion Cards -->
      ${renderCompanionLayerCards(item.lat, item.lng, prov)}

      <!-- Weather & Forecast Section -->
      ${renderWeatherSectionHtml(prov)}
    `;

    attachEvents();
    loadSheetWeather(prov, item.lat, item.lng);
    loadGeologyIfEnabled(item.lat, item.lng);
  }

  // ==========================================
  // 6. Requirement 6: Dedicated Weather Forecast Sheet
  // ("หากกด weather pill ให้แสดงเฉพาะพยากรณ์อากาศ")
  // ==========================================
  function renderDedicatedWeatherSheet() {
    const isEn = getLanguage() === 'en';
    const prov = currentItem.province || 'กรุงเทพมหานคร';
    const localizedProv = isEn ? (THAI_PROVINCE_EN_MAP[prov] || prov) : prov;

    sheet.innerHTML = `
      <div class="gmaps-sheet-header">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 20px;">🌤️</span>
            <h2 class="gmaps-place-title">${isEn ? `Weather Forecast: ${localizedProv}` : `พยากรณ์อากาศ จ.${prov}`}</h2>
          </div>
          <div class="gmaps-place-sub">${isEn ? 'Thai Meteorological Department (TMD HPC) & ECMWF' : 'ศูนย์อุตุนิยมวิทยา กรมอุตุนิยมวิทยา (TMD HPC) & ECMWF'}</div>
        </div>
        <button class="gmaps-sheet-close" id="btn-gmaps-close" title="${t('sheet_close')}">✕</button>
      </div>

      <!-- Live Condition Banner -->
      <div id="dedicated-current-weather" style="margin: 0 16px 12px 16px; padding: 14px 16px; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border-radius: 12px; border: 1px solid #7dd3fc;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div id="dedicated-weather-temp" style="font-size: 32px; font-weight: 800; color: #0369a1; line-height: 1;">--°C</div>
            <div id="dedicated-weather-desc" style="font-size: 13px; font-weight: 600; color: #0284c7; margin-top: 4px;">${t('weather_pill_loading')}</div>
          </div>
          <div id="dedicated-weather-icon" style="font-size: 38px;">🌤️</div>
        </div>
        <div id="dedicated-weather-metrics" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(2, 132, 199, 0.2); font-size: 11.5px; color: #0c4a6e;">
          <div>🌧️ ${isEn ? 'Rain Probability:' : 'โอกาสเกิดฝน:'} <b id="dedicated-rain-prob">--%</b></div>
          <div>💧 ${isEn ? 'Humidity:' : 'ความชื้นสัมพัทธ์:'} <b id="dedicated-humidity">--%</b></div>
          <div>💨 ${isEn ? 'Wind Speed:' : 'ความเร็วลม:'} <b id="dedicated-wind">-- ${isEn ? 'km/h' : 'กม./ชม.'}</b></div>
          <div>☔ ${isEn ? 'Live Rain:' : 'ปริมาณฝนสด:'} <b id="dedicated-rain-mm">-- ${isEn ? 'mm' : 'มม.'}</b></div>
        </div>
      </div>

      <!-- 7-Day Detailed Breakdown Section -->
      <div style="padding: 12px 16px; border-top: 1px solid #e8eaed;" id="gmaps-weather-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: 700; font-size: 13.5px; color: #1e293b;">📅 ${isEn ? '7-Day Precipitation & Weather Forecast' : 'พยากรณ์ฝนและสภาพอากาศ 7 วันข้างหน้า'}</span>
          <span style="background: #e6f4ea; color: #137333; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; border: 1px solid #b7eb8f;">
            🇹🇭 TMD Official
          </span>
        </div>
        <div id="gmaps-forecast-container" style="display: flex; flex-direction: column; gap: 6px;">
          <div style="color: #70757a; font-size: 12px;">${isEn ? 'Fetching live weather forecast...' : 'กำลังดึงข้อมูลพยากรณ์อากาศสด...'}</div>
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
    const isEn = getLanguage() === 'en';
    const layers = getActiveLayers();
    const cards = [];

    // 1. Radar Layer
    if (layers.satWater) {
      cards.push(`
        <div class="gmaps-companion-card" style="margin: 8px 16px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 5px;">
              <span>📡</span> ${t('layer_sat_water')}
            </span>
            <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 8px;">${isEn ? 'Active' : 'เรดาร์เปิดอยู่'}</span>
          </div>
          <div style="color: #166534; font-size: 11px;">
            ${window.__latestRadarTime ? `${t('legend_ts_radar_prefix')} <b>${localizeDateTime(window.__latestRadarTime)}</b>` : (isEn ? '🕒 Scan Interval: Every 10 min (TMD Radar)' : '🕒 รอบตรวจวัดเรดาร์: สดทุก 10 นาที (สถานีเรดาร์ทั่วไทย)')}
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            ${t('sheet_radar_desc')}
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
              <span>☁️</span> ${t('layer_sat_clouds')}
            </span>
            <span style="font-size: 10px; background: #dbeafe; color: #1e40af; font-weight: 700; padding: 1px 6px; border-radius: 8px;">${isEn ? 'Active' : 'ดาวเทียมเปิดอยู่'}</span>
          </div>
          <div style="color: #1e40af; font-size: 11px;">
            ${window.__latestCloudTime ? `${t('legend_ts_clouds_prefix')} <b>${localizeDateTime(window.__latestCloudTime)}</b>` : (isEn ? '🕒 Satellite Scan: Every 10 min (NASA GIBS / JMA)' : '🕒 รอบดาวเทียม: ทุก 10 นาที (NASA GIBS / JMA)')}
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            ${isEn ? 'Clean IR infrared sensors detecting convective cloud tops and severe rain clusters' : 'เซนเซอร์อินฟราเรดตรวจจับยอดเมฆความเย็นจัดและกลุ่มเมฆฝนฟ้าคะนอง'}
          </div>
        </div>
      `);
    }

    // 4. DMR Geology Layer
    if (layers.geology) {
      cards.push(`
        <div class="gmaps-companion-card" id="st-sheet-geol-card" style="margin: 8px 16px; padding: 10px 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 700; color: #7e22ce; display: flex; align-items: center; gap: 5px;">
              <span>🪨</span> ${t('layer_geology')}
            </span>
            <span style="font-size: 10px; background: #f3e8ff; color: #7e22ce; font-weight: 700; padding: 1px 6px; border-radius: 8px;">${isEn ? 'Active' : 'ธรณีวิทยาเปิดอยู่'}</span>
          </div>
          <div id="st-sheet-geol-val" style="color: #6b21a8; font-size: 11.5px;">
            ${t('sheet_bedrock_inspecting')}
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
              <span>🚦</span> ${t('layer_traffic')}
            </span>
            <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 8px;">${isEn ? 'Active' : 'เปิดอยู่'}</span>
          </div>
          <div style="color: #4b5563; font-size: 11px; margin-top: 3px;">
            ${isEn ? 'Displays real-time live traffic congestion on major road networks (zoom 13+)' : 'แสดงความหนาแน่นของการจราจรสดบนเส้นทางรอบจุดนี้ (ซูมระดับ 13+ ขึ้นไป)'}
          </div>
        </div>
      `);
    }

    if (cards.length === 0) return '';

    return `
      <div style="padding: 6px 16px 2px 16px;">
        <div style="font-size: 11.5px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 4px;">
          <span>📑</span> ${isEn ? `Active Companion Layers (${cards.length}):` : `ข้อมูลเลเยอร์ที่เปิดใช้งานร่วมกัน (${cards.length} เลเยอร์):`}
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
    const isEn = getLanguage() === 'en';
    return `
      <div style="padding: 12px 16px; border-top: 1px solid #e8eaed;" id="gmaps-weather-section">
        <div id="gmaps-weather-title" style="font-weight: 700; font-size: 13px; color: #202124; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>🌧️ ${t('sheet_weather_7d_title')}</span>
            <span style="background: #e6f4ea; color: #137333; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 12px; border: 1px solid #ceead6;">
              🇹🇭 TMD Official
            </span>
          </div>
          <div style="font-size: 11px; color: #5f6368; font-weight: normal; margin-top: 2px;">
            ${isEn ? 'Data Source: Thai Meteorological Department & Open-Meteo Multi-Model' : 'แหล่งข้อมูล: กรมอุตุนิยมวิทยา (High Performance Computing)'}
          </div>
        </div>
        <div id="gmaps-forecast-container" style="display: flex; flex-direction: column; gap: 4px;">
          <div style="color: #70757a; font-size: 12px;">${t('sheet_weather_loading')}</div>
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
      const handleClose = (e) => {
        if (e) {
          e.stopPropagation();
          if (e.cancelable) e.preventDefault();
        }
        sheet.classList.remove('open');
        isVisible = false;
      };
      closeBtn.addEventListener('click', handleClose);
      closeBtn.addEventListener('touchend', handleClose);
    }

    const focusBtn = sheet.querySelector('#btn-focus-station');
    if (focusBtn) {
      focusBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        if (onStationSelect && currentItem) onStationSelect(currentItem);
      });
    }

    const weatherBtn = sheet.querySelector('#btn-view-weather');
    if (weatherBtn) {
      weatherBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        const weatherSection = sheet.querySelector('#gmaps-weather-section');
        if (weatherSection) {
          const targetY = weatherSection.offsetTop;
          sheet.scrollTo({ top: targetY, behavior: 'smooth' });
        }
      });
    }
  }

  // ==========================================
  // Weather Loader
  // ==========================================
  async function loadSheetWeather(province, lat, lng) {
    const container = sheet.querySelector('#gmaps-forecast-container');
    if (!container) return;
    const isEn = getLanguage() === 'en';

    try {
      const weather = await fetch7DayWeatherForecast(province, lat, lng, province);

      container.innerHTML = weather.days
        .slice(0, 6)
        .map((d) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #f8f9fa; border-radius: 6px; font-size: 12px;">
            <span style="font-weight: 600; width: 75px;">${isEn ? (d.displayDateEn || d.displayDate) : d.displayDate}</span>
            <span style="font-size: 16px;">${d.icon}</span>
            <span style="color: #5f6368;">${d.tempMax}° / ${d.tempMin}°</span>
            <span style="font-weight: 600; color: ${d.rainMm > 40 ? '#d93025' : (d.rainMm > 20 ? '#ea580c' : '#188038')};">
              🌧️ ${d.rainMm} ${isEn ? 'mm' : 'มม.'}
            </span>
          </div>
        `)
        .join('');
    } catch (err) {
      container.innerHTML = `<div style="font-size: 11.5px; color: #64748b;">${isEn ? 'Unable to load weather forecast' : 'ไม่สามารถโหลดพยากรณ์อากาศได้ในขณะนี้'}</div>`;
    }
  }

  async function loadDedicatedWeather(province, lat, lng) {
    const isEn = getLanguage() === 'en';
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

      if (curr) {
        if (tempEl) tempEl.textContent = `${curr.temp}°C`;
        if (descEl) descEl.textContent = isEn ? (curr.weatherDescEn || curr.weatherDesc) : curr.weatherDesc;
        if (iconEl) iconEl.textContent = curr.icon;
        if (rainProbEl) rainProbEl.textContent = `${curr.rainProb}%`;
        if (humEl) humEl.textContent = `${curr.humidity}%`;
        if (windEl) windEl.textContent = isEn ? `14 km/h` : `14 กม./ชม.`;
        if (rainMmEl) rainMmEl.textContent = `${curr.rainMm} ${isEn ? 'mm' : 'มม.'}`;
      } else {
        if (tempEl) tempEl.textContent = `-`;
        if (descEl) descEl.textContent = isEn ? `No live data` : `ไม่พบข้อมูลสด`;
      }

      if (container && forecast && forecast.days) {
        container.innerHTML = forecast.days
          .map((d) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; font-size: 12.5px;">
              <span style="font-weight: 600; width: 85px; color: #1e293b;">${isEn ? (d.displayDateEn || d.displayDate) : d.displayDate}</span>
              <span style="font-size: 18px;">${d.icon}</span>
              <span style="font-size: 11.5px; color: #475569; width: 85px; text-align: center;">${isEn ? (d.weatherDescEn || d.weatherDesc) : d.weatherDesc}</span>
              <span style="color: #64748b; font-size: 11.5px;">${d.tempMax}° / ${d.tempMin}°</span>
              <span style="font-weight: 700; color: ${d.rainMm > 40 ? '#dc2626' : (d.rainMm > 20 ? '#ea580c' : '#16a34a')}; width: 68px; text-align: right;">
                🌧️ ${d.rainMm} ${isEn ? 'mm' : 'มม.'}
              </span>
            </div>
          `)
          .join('');
      } else if (container) {
        container.innerHTML = `<div style="font-size: 12px; color: #64748b; text-align: center; padding: 12px;">${isEn ? 'Unable to load weather forecast' : 'ไม่สามารถโหลดข้อมูลพยากรณ์อากาศได้ในขณะนี้'}</div>`;
      }
    } catch (err) {
      if (container) {
        container.innerHTML = `<div style="font-size: 12px; color: #64748b;">${isEn ? 'Unable to load weather forecast' : 'ไม่สามารถโหลดพยากรณ์อากาศได้'}</div>`;
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

  // Mobile touch isolation: Prevents WebKit gesture conflict deadlock with MapLibre canvas
  sheet.addEventListener('click', (e) => e.stopPropagation());
  sheet.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  sheet.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  sheet.addEventListener('pointermove', (e) => e.stopPropagation());

  // Reactive language change listener
  window.addEventListener('thaiflood:language-changed', () => {
    if (isVisible && currentItem) {
      render();
    }
  });

  render();

  return {
    element: sheet,
    close: () => {
      sheet.classList.remove('open');
      isVisible = false;
    },
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
    selectDohRoad: (road) => {
      currentItem = { isDohRoad: true, ...road };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectTraffy: (traffyItem) => {
      currentItem = { isTraffy: true, ...traffyItem };
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
    updateStations: (newStations) => {
      stations = newStations || [];
      if (!currentItem || Object.keys(currentItem).length === 0) {
        currentItem = stations.find((s) => s.status === 'critical') || stations[0] || {};
      }
    },
    selectGeneric: (item) => {
      currentItem = item;
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectGeology: (geol) => {
      currentItem = { isGeology: true, ...geol };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    selectCctv: (cam) => {
      currentItem = { isCctv: true, ...cam };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    // Requirement 6: Dedicated weather forecast sheet
    openDedicatedWeatherForecast: (provinceName, weatherData) => {
      let lat = 13.7563;
      let lng = 100.5018;
      const prov = provinceName || 'กรุงเทพมหานคร';
      const found = THAI_PROVINCES.find((p) => prov.includes(p.name) || p.name.includes(prov));
      if (found) {
        lat = found.lat;
        lng = found.lng;
      }
      currentItem = {
        isDedicatedWeather: true,
        province: prov,
        lat,
        lng,
        weatherData
      };
      render();
      sheet.classList.add('open');
      isVisible = true;
    },
    openWeatherForecast: (provinceName) => {
      let lat = 13.7563;
      let lng = 100.5018;
      const prov = provinceName || 'กรุงเทพมหานคร';
      const found = THAI_PROVINCES.find((p) => prov.includes(p.name) || p.name.includes(prov));
      if (found) {
        lat = found.lat;
        lng = found.lng;
      }
      currentItem = {
        isDedicatedWeather: true,
        province: prov,
        lat,
        lng
      };
      render();
      sheet.classList.add('open');
      isVisible = true;
    }
  };
}
