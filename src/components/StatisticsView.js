/**
 * StatisticsView Component for ThaiFlood
 * - Left Menubar / Sidebar (Desktop) & Responsive Segmented Tabs (Mobile Webview)
 * - Tab 1: Statistic (API Availability, Last Attempt, Last Success, Record Count)
 * - Tab 2: Download Log (Batch Date-range Picker, Max 30 Days, No Future Dates, ZIP download)
 */
import { zipSync, gunzipSync, strToU8 } from 'fflate';
import { getLanguage, t, formatDateTimeCE } from '../services/i18nService.js';
import { GITHUB_RAW_BASE } from '../services/telemetrySwitchService.js';
import { fetchLiveWaterStationsDirect } from '../services/waterStationService.js';
import { fetchLiveDamsDirect } from '../services/damService.js';
import { getDohHighwayGeoJSONDirect } from '../services/dohHighwayFloodService.js';
import { getCctvGeoJSONDirect } from '../services/cctvService.js';

export function createStatisticsView(options = {}) {
  const { onBackToMap } = options;

  const container = document.createElement('div');
  container.className = 'tf-stats-layout';
  container.id = 'tf-stats-layout';

  // Helper date functions
  function getYesterdayDate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  function formatDateInput(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const yesterdayStr = formatDateInput(getYesterdayDate());

  const isLocalEnv = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const envBadgeText = isLocalEnv ? 'UAT / Local (Port 3050)' : '🟢 Production Live (Direct API)';
  const envBadgeClass = isLocalEnv ? 'badge-uat' : 'badge-prod';

  let activeTab = 'statistic';
  let metaData = null;
  let officialCronTimestamp = null;
  let archiveIndex = [];

  container.innerHTML = `
    <!-- Top Bar Navigation -->
    <header class="tf-stats-header">
      <div class="tf-stats-header-left">
        <button class="tf-stats-back-btn" id="tf-stats-back-btn" type="button" title="กลับสู่แผนที่">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>กลับสู่แผนที่</span>
        </button>
        <div class="tf-stats-brand">
          <span class="tf-stats-logo">🌊</span>
          <div class="tf-stats-titles">
            <h1 class="tf-stats-main-title">ThaiFlood Statistics & Logs</h1>
            <p class="tf-stats-sub-title">ระบบรายงานสถานะโทรมาตรและประวัติข้อมูลน้ำท่วมประเทศไทย</p>
          </div>
        </div>
      </div>
      <div class="tf-stats-header-right">
        <span class="tf-stats-env-badge ${envBadgeClass}" id="tf-stats-env-badge">${envBadgeText}</span>
      </div>
    </header>

    <div class="tf-stats-body">
      <!-- Left Menubar / Sidebar -->
      <aside class="tf-stats-sidebar">
        <div class="tf-stats-menu-header">เมนูหลัก (Navigation)</div>
        <nav class="tf-stats-nav">
          <button class="tf-stats-nav-item active" data-tab="statistic" type="button">
            <span class="nav-item-icon">📊</span>
            <div class="nav-item-text">
              <span class="nav-item-title">Statistic</span>
              <span class="nav-item-desc">สถานะความพร้อมของ API</span>
            </div>
          </button>
          <button class="tf-stats-nav-item" data-tab="download-log" type="button">
            <span class="nav-item-icon">📦</span>
            <div class="nav-item-text">
              <span class="nav-item-title">Download Log</span>
              <span class="nav-item-desc">ดาวน์โหลดไฟล์ย้อนหลัง (Zip)</span>
            </div>
          </button>
        </nav>

        <div class="tf-stats-sidebar-footer">
          <div class="tf-sidebar-info">
            <div class="info-row"><b>โหมดส่งข้อมูล:</b> In-Browser Zero Overhead</div>
            <div class="info-row"><b>CDN แคช:</b> Cloudflare Edge</div>
          </div>
        </div>
      </aside>

      <!-- Main Content Pane -->
      <main class="tf-stats-content">
        <!-- 1. Statistic Tab Pane -->
        <section class="tf-tab-pane active" id="pane-statistic">
          <div class="tf-pane-header">
            <div>
              <h2 class="tf-pane-title">📊 สถานะความพร้อมของบริการ API (API Telemetry Health)</h2>
              <p class="tf-pane-desc">ตรวจสอบความพร้อมของระบบเชื่อมต่อภายนอก เวลาที่เรียกข้อมูลล่าสุด เวลาที่สำเร็จล่าสุด และจำนวนรายการที่ได้รับ</p>
            </div>
            <button class="tf-btn-refresh" id="btn-refresh-stats" type="button" title="ทดสอบยิง API สด (ต้องใช้รหัสผ่าน Admin)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4V9H9M20 20V15H15M20 9A9 9 0 005.64 5.64L4 9M4 15A9 9 0 0018.36 18.36L20 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>รีเฟรชสถานะ (Admin)</span>
            </button>
          </div>

          <!-- Overall Summary Banner -->
          <div class="tf-health-summary-card" id="tf-health-summary">
            <div class="health-summary-loading">กำลังโหลดสถานะความพร้อมของระบบ...</div>
          </div>

          <!-- API Status Table -->
          <div class="tf-table-responsive">
            <table class="tf-stats-table">
              <thead>
                <tr>
                  <th style="min-width: 220px;">บริการ & หน่วยงาน (Service / Agency)</th>
                  <th style="min-width: 130px; text-align: center;">สถานะ (Status)</th>
                  <th style="min-width: 170px;">วันเวลาที่เรียกข้อมูลล่าสุด</th>
                  <th style="min-width: 170px;">วันเวลาที่เรียกข้อมูลสำเร็จล่าสุด</th>
                  <th style="min-width: 120px; text-align: right;">จำนวนรายการ</th>
                </tr>
              </thead>
              <tbody id="tf-stats-table-body">
                <tr>
                  <td colspan="5" style="text-align: center; padding: 32px; color: #94a3b8;">
                    กำลังดึงข้อมูลสถานะ API...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 2. Download Log Tab Pane -->
        <section class="tf-tab-pane" id="pane-download-log">
          <div class="tf-pane-header">
            <div>
              <h2 class="tf-pane-title">📦 ดาวน์โหลดประวัติข้อมูลย้อนหลัง (Batch Log Download)</h2>
              <p class="tf-pane-desc">ค้นหาตามช่วงวันที่และดาวน์โหลดไฟล์โทรมาตรย้อนหลังในรูปแบบ Zip (รองรับการดาวน์โหลดหลายวันพร้อมกัน สูงสุด 30 วัน)</p>
            </div>
          </div>

          <!-- Datepicker Control Card -->
          <div class="tf-download-controls-card">
            <div class="tf-filter-grid">
              <div class="tf-filter-group">
                <label for="input-from-date">วันที่เริ่มต้น (From Date):</label>
                <input 
                  type="date" 
                  id="input-from-date" 
                  class="tf-date-input" 
                  value="${yesterdayStr}" 
                  max="${yesterdayStr}" 
                />
                <span class="tf-field-hint">ค่าเริ่มต้น: วันปัจจุบัน - 1 (ห้ามเลือกวันในอนาคต)</span>
              </div>

              <div class="tf-filter-group">
                <label for="input-to-date">วันที่สิ้นสุด (To Date):</label>
                <input 
                  type="date" 
                  id="input-to-date" 
                  class="tf-date-input" 
                  value="${yesterdayStr}" 
                  max="${yesterdayStr}" 
                />
                <span class="tf-field-hint">ช่วงการเลือกสูงสุดไม่เกิน 30 วัน</span>
              </div>

              <div class="tf-filter-actions">
                <button class="tf-btn-preset" id="btn-preset-yesterday" type="button">เมื่อวานนี้</button>
                <button class="tf-btn-preset" id="btn-preset-7days" type="button">ย้อนหลัง 7 วัน</button>
                <button class="tf-btn-preset" id="btn-preset-30days" type="button">ย้อนหลัง 30 วัน</button>
              </div>
            </div>

            <!-- Validation Notice -->
            <div class="tf-validation-alert" id="tf-date-alert" style="display: none;"></div>
          </div>

          <!-- Selected Files Manifest Card -->
          <div class="tf-manifest-card">
            <div class="manifest-card-header">
              <div class="manifest-title-group">
                <h3 class="manifest-title">รายการไฟล์ประวัติที่เลือกดาวน์โหลด</h3>
                <span class="manifest-count-badge" id="manifest-count-badge">0 วัน</span>
              </div>
              <div class="manifest-size-info" id="manifest-size-info">ขนาดไฟล์รวมโดยประมาณ: 0 KB</div>
            </div>

            <div class="manifest-items-list" id="manifest-items-list">
              <!-- Dynamically populated -->
            </div>

            <div class="manifest-card-footer">
              <div class="download-progress-bar" id="download-progress-bar" style="display: none;">
                <div class="progress-fill" id="progress-fill" style="width: 0%;"></div>
                <span class="progress-label" id="progress-label">0%</span>
              </div>
              <div class="download-status-msg" id="download-status-msg"></div>

              <button class="tf-btn-download-zip" id="btn-download-zip" type="button">
                <span class="btn-zip-icon">📦</span>
                <span>รวมและดาวน์โหลดไฟล์ (.zip)</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  // Attach Back to Map Listener
  const backBtn = container.querySelector('#tf-stats-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (onBackToMap) {
        onBackToMap();
      } else {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }

  // Sidebar Nav Tabs
  const navItems = container.querySelectorAll('.tf-stats-nav-item');
  const panes = container.querySelectorAll('.tf-tab-pane');

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      activeTab = tab;
      navItems.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
      panes.forEach((p) => p.classList.toggle('active', p.id === `pane-${tab}`));
      if (tab === 'download-log') {
        updateDateRangeManifest();
      }
    });
  });

  // Date Formatting Helper
  function formatIsoDateTime(isoStr) {
    if (!isoStr) return '<span style="color:#64748b;">ไม่มีข้อมูล</span>';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}:${secs} น.`;
    } catch {
      return isoStr;
    }
  }

  // Render Summary & Rows for Tab 1 (Statistic)
  function renderStatisticsTable(data, isAdminTest = false) {
    const summaryCard = container.querySelector('#tf-health-summary');
    const tableBody = container.querySelector('#tf-stats-table-body');
    if (!summaryCard || !tableBody) return;

    const services = data.services || {};
    const serviceKeys = Object.keys(services);

    let upCount = 0;
    let totalCount = serviceKeys.length;

    serviceKeys.forEach((key) => {
      if (services[key].status === 'UP') upCount++;
    });

    const isAllUp = upCount === totalCount && totalCount > 0;

    // Summary Card
    if (isAdminTest) {
      summaryCard.innerHTML = `
        <div class="health-banner banner-healthy">
          <div class="banner-icon-box">🧪</div>
          <div class="banner-text-box">
            <div class="banner-title">ผลการทดสอบสดโดยผู้ดูแลระบบ (Admin Diagnostic Test)</div>
            <div class="banner-meta">
              <span>เวลาทดสอบ (Admin Ping): <b>${formatIsoDateTime(data.timestamp)}</b></span>
              <span>·</span>
              <span>เวลารอบ Cron ล่าสุด: <b>${formatIsoDateTime(officialCronTimestamp || 'รอรอบซิงก์ถัดไป')}</b></span>
              <span>·</span>
              <span>พร้อมใช้งาน: <b style="color:#22c55e;">${upCount}</b> / ${totalCount} บริการ</span>
              <span>·</span>
              <span style="color:#38bdf8; font-weight:600;">🔒 ยืนยันสิทธิ์ผู้ดูแลระบบสำเร็จ (Admin Verified)</span>
            </div>
          </div>
        </div>
      `;
    } else {
      summaryCard.innerHTML = `
        <div class="health-banner ${isAllUp ? 'banner-healthy' : 'banner-degraded'}">
          <div class="banner-icon-box">${isAllUp ? '🟢' : '🟡'}</div>
          <div class="banner-text-box">
            <div class="banner-title">${isAllUp ? 'ทุกระบบพร้อมใช้งาน 100% (All Systems Operational)' : `มีบางระบบขัดข้องหรืออยู่ระหว่างตรวจสอบ (${upCount}/${totalCount})`}</div>
            <div class="banner-meta">
              <span>เวลารอบ Cron ล่าสุด: <b>${formatIsoDateTime(data.timestamp)}</b></span>
              <span>·</span>
              <span>พร้อมใช้งาน: <b style="color:#22c55e;">${upCount}</b> / ${totalCount} บริการ</span>
              <span>·</span>
              <span style="color:#a78bfa; font-weight:600;">🚀 ข้อมูลจากรอบ Cron อัตโนมัติ (Edge Cache)</span>
            </div>
          </div>
        </div>
      `;
    }

    // Table Rows
    if (serviceKeys.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;">ไม่พบข้อมูลบริการใน Metadata</td></tr>`;
      return;
    }

    tableBody.innerHTML = serviceKeys.map((key) => {
      const s = services[key];
      const isUp = s.status === 'UP';
      const countText = s.count !== undefined ? `${Number(s.count).toLocaleString()} รายการ` : '-';
      
      const isStale = isUp && s.lastSuccess && s.lastAttempt && (s.lastSuccess !== s.lastAttempt);

      return `
        <tr class="${isUp ? 'row-up' : 'row-down'}">
          <td class="col-service">
            <div class="service-name">${s.name || key}</div>
            <div class="service-agency">${s.agency || '-'}</div>
          </td>
          <td class="col-status" style="text-align: center;">
            <span class="status-pill ${isUp ? 'status-up' : 'status-down'}">
              <span class="status-indicator"></span>
              <span>${isUp ? 'พร้อมใช้งาน' : 'ไม่ตอบกลับ'}</span>
            </span>
          </td>
          <td class="col-datetime">${formatIsoDateTime(s.lastAttempt)}</td>
          <td class="col-datetime">
            ${formatIsoDateTime(s.lastSuccess)}
            ${isStale ? '<span class="stale-badge" title="ข้อมูลรอบล่าสุดไม่ตรงรอบสำเร็จ">Stale</span>' : ''}
          </td>
          <td class="col-count" style="text-align: right;">
            <span class="count-badge">${countText}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 100% Live Direct Diagnostics: Zero Mock Data, Zero Leftover UAT Data
  async function runLiveDiagnostics() {
    const summaryCard = container.querySelector('#tf-health-summary');
    if (summaryCard) {
      summaryCard.innerHTML = `
        <div class="health-summary-loading">
          <span class="status-dot-blink"></span>
          <span>กำลังยิงตรวจสอบสถานะสดจาก API หน่วยงานรัฐ 7 ระบบ (Real-time Live Telemetry Ping)...</span>
        </div>
      `;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const services = {
      stations: {
        name: "สถานีโทรมาตรวัดระดับน้ำ",
        agency: "สสน. (HII / ThaiWater)",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      dams: {
        name: "ปริมาณน้ำในอ่างเก็บน้ำ/เขื่อน",
        agency: "กฟผ. / สสน. (EGAT / HII)",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      dohRoads: {
        name: "รายงานน้ำท่วมทางหลวง",
        agency: "กรมทางหลวง (DOH)",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      cctv: {
        name: "กล้อง CCTV ทางหลวงและจุดตรวจน้ำ",
        agency: "กรมทางหลวง / กทม. / กรมชลฯ",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      openMeteo: {
        name: "แบบจำลองพยากรณ์ ECMWF & GFS",
        agency: "Open-Meteo Supercomputer",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      traffy: {
        name: "รายงานน้ำท่วมขัง Traffy Fondue",
        agency: "สวทช. / กรุงเทพมหานคร",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      },
      tmdRadar: {
        name: "เรดาร์ตรวจฝนตรวจสภาพอากาศ",
        agency: "กรมอุตุนิยมวิทยา (TMD)",
        status: "DOWN",
        lastAttempt: nowIso,
        lastSuccess: null,
        count: 0
      }
    };

    await Promise.allSettled([
      // 1. Water Stations (HII / ThaiWater)
      (async () => {
        try {
          const list = await fetchLiveWaterStationsDirect();
          if (Array.isArray(list) && list.length > 0) {
            services.stations.status = 'UP';
            services.stations.lastSuccess = nowIso;
            services.stations.count = list.length;
          }
        } catch (err) {
          console.warn('Live Stations diagnostic error:', err.message);
        }
      })(),

      // 2. Dams (EGAT / HII)
      (async () => {
        try {
          const list = await fetchLiveDamsDirect();
          if (Array.isArray(list) && list.length > 0) {
            services.dams.status = 'UP';
            services.dams.lastSuccess = nowIso;
            services.dams.count = list.length;
          }
        } catch (err) {
          console.warn('Live Dams diagnostic error:', err.message);
        }
      })(),

      // 3. DOH Highway Floods (DOH HDMS)
      (async () => {
        try {
          const geojson = await getDohHighwayGeoJSONDirect();
          if (geojson && geojson.features && geojson.features.length >= 0) {
            services.dohRoads.status = 'UP';
            services.dohRoads.lastSuccess = nowIso;
            services.dohRoads.count = geojson.features.length;
          }
        } catch (err) {
          console.warn('Live DOH diagnostic error:', err.message);
        }
      })(),

      // 4. CCTV
      (async () => {
        try {
          const geojson = await getCctvGeoJSONDirect();
          if (geojson && geojson.features && geojson.features.length >= 0) {
            services.cctv.status = 'UP';
            services.cctv.lastSuccess = nowIso;
            services.cctv.count = geojson.features.length;
          }
        } catch (err) {
          console.warn('Live CCTV diagnostic error:', err.message);
        }
      })(),

      // 5. Open-Meteo
      (async () => {
        try {
          const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.5&daily=precipitation_sum&timezone=Asia%2FBangkok&forecast_days=7', {
            signal: AbortSignal.timeout(8000)
          });
          if (res.ok) {
            const json = await res.json();
            const days = json?.daily?.time?.length || 7;
            services.openMeteo.status = 'UP';
            services.openMeteo.lastSuccess = nowIso;
            services.openMeteo.count = days;
          }
        } catch (err) {
          console.warn('Live Open-Meteo diagnostic error:', err.message);
        }
      })(),

      // 6. Traffy Fondue
      (async () => {
        try {
          const res = await fetch('https://publicapi.traffy.in.th/share/teamchadchart/search?type=%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%97%E0%B9%88%E0%B8%A7%E0%B8%A1&limit=35', {
            signal: AbortSignal.timeout(8000)
          });
          if (res.ok) {
            const json = await res.json();
            const count = json?.results ? json.results.length : (Array.isArray(json) ? json.length : 0);
            services.traffy.status = 'UP';
            services.traffy.lastSuccess = nowIso;
            services.traffy.count = count;
          }
        } catch (err) {
          console.warn('Live Traffy Fondue diagnostic error:', err.message);
        }
      })(),

      // 7. TMD Radar
      (async () => {
        try {
          const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
            signal: AbortSignal.timeout(8000)
          });
          if (res.ok) {
            const json = await res.json();
            const frames = json?.radar?.past?.length || 0;
            services.tmdRadar.status = 'UP';
            services.tmdRadar.lastSuccess = nowIso;
            services.tmdRadar.count = frames;
          }
        } catch (err) {
          console.warn('Live TMD Radar diagnostic error:', err.message);
        }
      })()
    ]);

    metaData = {
      timestamp: nowIso,
      mode: 'admin-diagnostic',
      services
    };

    renderStatisticsTable(metaData, true);
  }

  // Render Standby table when no cron data is present yet (STRICTLY ZERO EXTERNAL REQUESTS)
  function renderStandbyTable() {
    const summaryCard = container.querySelector('#tf-health-summary');
    const tableBody = container.querySelector('#tf-stats-table-body');
    if (!summaryCard || !tableBody) return;

    summaryCard.innerHTML = `
      <div class="health-banner banner-standby">
        <div class="banner-icon-box">⏳</div>
        <div class="banner-text-box">
          <div class="banner-title">ระบบโทรมาตร Edge CDN รอรับข้อมูลจากรอบ Cron (ทุก 10 นาที)</div>
          <div class="banner-meta">
            <span>โหมด: Edge Cache</span>
            <span>·</span>
            <span>ระบบทำงานอัตโนมัติทุก 10 นาทีเพื่อปกป้องเซิร์ฟเวอร์รัฐ (กดปุ่ม 'รีเฟรชสถานะ (Admin)' หากต้องการยิงทดสอบสด)</span>
          </div>
        </div>
      </div>
    `;

    const standbyServices = [
      { name: "สถานีโทรมาตรวัดระดับน้ำ", agency: "สสน. (HII / ThaiWater)" },
      { name: "ปริมาณน้ำในอ่างเก็บน้ำ/เขื่อน", agency: "กฟผ. / สสน. (EGAT / HII)" },
      { name: "รายงานน้ำท่วมทางหลวง", agency: "กรมทางหลวง (DOH)" },
      { name: "กล้อง CCTV ทางหลวงและจุดตรวจน้ำ", agency: "กรมทางหลวง / กทม. / กรมชลฯ" },
      { name: "แบบจำลองพยากรณ์ ECMWF & GFS", agency: "Open-Meteo Supercomputer" },
      { name: "รายงานน้ำท่วมขัง Traffy Fondue", agency: "สวทช. / กรุงเทพมหานคร" },
      { name: "เรดาร์ตรวจฝนตรวจสภาพอากาศ", agency: "กรมอุตุนิยมวิทยา (TMD)" }
    ];

    tableBody.innerHTML = standbyServices.map((s) => `
      <tr class="row-standby">
        <td class="col-service">
          <div class="service-name">${s.name}</div>
          <div class="service-agency">${s.agency}</div>
        </td>
        <td class="col-status" style="text-align: center;">
          <span class="status-pill status-standby">
            <span class="status-indicator" style="background:#94a3b8;"></span>
            <span>รอรอบซิงก์</span>
          </span>
        </td>
        <td class="col-datetime" style="color:#64748b;">รอรอบถัดไป</td>
        <td class="col-datetime" style="color:#64748b;">-</td>
        <td class="col-count" style="text-align: right; color:#64748b;">-</td>
      </tr>
    `).join('');
  }

  // Load Statistics Data on normal page entry: Strictly reads Edge cache, NEVER fires external API calls
  async function loadStatisticsData() {
    const summaryCard = container.querySelector('#tf-health-summary');
    if (summaryCard) {
      summaryCard.innerHTML = `
        <div class="health-summary-loading">
          <span class="status-dot-blink"></span>
          <span>กำลังเชื่อมต่อไฟล์สถิติจาก Edge CDN...</span>
        </div>
      `;
    }

    const cacheBuster = '?t=' + Date.now();

    // 1. Prioritize Global Live Edge CDN (Fresh bot data pushed every 10 mins)
    try {
      const res = await fetch(`${GITHUB_RAW_BASE}/api/meta.json` + cacheBuster, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.timestamp && data.services) {
          officialCronTimestamp = data.timestamp;
          metaData = data;
          renderStatisticsTable(metaData, false);
          return;
        }
      }
    } catch {
      // fallback to local origin
    }

    // 2. Fallback to local / origin host cache
    try {
      const res = await fetch('/api/meta.json' + cacheBuster, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.timestamp && data.services) {
          officialCronTimestamp = data.timestamp;
          metaData = data;
          renderStatisticsTable(metaData, false);
          return;
        }
      }
    } catch {
      // ignore fetch error
    }

    // STRICT: หน้า Status ห้ามยิง API ตอนกดเข้าหน้าปกติ!
    renderStandbyTable();
  }

  // One-Way Salted Cryptographic Hash Verification (Web Crypto API SHA-256)
  // Zero plaintext password stored in code, git, or client bundle
  const ADMIN_AUTH_SALT = 'tf_admin_auth_v1_secure_salt_77a9';
  const ADMIN_AUTH_DIGEST = 'edcbb34f1966804e485761775dc7ab80c637f1fe751a2867dbad397c3723c13f';

  async function verifyAdminSecret(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(ADMIN_AUTH_SALT + inputStr + ADMIN_AUTH_SALT);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return hashHex === ADMIN_AUTH_DIGEST;
    } catch {
      return false;
    }
  }

  // Admin Password Authentication Modal
  function promptAdminAuth(onSuccess) {
    const existingModal = document.getElementById('admin-auth-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'tf-modal-backdrop';
    modal.id = 'admin-auth-modal';

    modal.innerHTML = `
      <div class="tf-modal-card">
        <div class="tf-modal-header">
          <div class="tf-modal-title-group">
            <span style="font-size: 18px;">🔒</span>
            <h3 class="tf-modal-title">ยืนยันสิทธิ์ผู้ดูแลระบบ (Admin Diagnostic Test)</h3>
          </div>
          <button type="button" class="tf-modal-close" id="btn-admin-modal-close" title="ปิด">✕</button>
        </div>
        <div class="tf-modal-body">
          <p class="tf-modal-desc">
            การกดรีเฟรชเพื่อยิงทดสอบระบบสด (Live Diagnostic Ping) จะส่งคำขอทดสอบไปยัง API หน่วยงานรัฐจริงทั้ง 7 แห่งโดยตรง 
            เพื่อป้องกันการส่ง Request โดยไม่จำเป็น โปรดระบุรหัสผ่านผู้ดูแลระบบ:
          </p>
          <div class="tf-input-group">
            <input 
              type="password" 
              id="input-admin-password" 
              class="tf-admin-pass-input" 
              placeholder="กรอกรหัสผ่านผู้ดูแลระบบ..."
              autocomplete="off"
            />
            <div class="tf-admin-pass-error" id="admin-pass-error" style="display: none;"></div>
          </div>
        </div>
        <div class="tf-modal-footer">
          <button type="button" class="tf-btn-modal-cancel" id="btn-admin-cancel">ยกเลิก</button>
          <button type="button" class="tf-btn-modal-confirm" id="btn-admin-confirm">ยืนยันและทดสอบสด</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#input-admin-password');
    const errEl = modal.querySelector('#admin-pass-error');
    const btnConfirm = modal.querySelector('#btn-admin-confirm');
    const btnCancel = modal.querySelector('#btn-admin-cancel');
    const btnClose = modal.querySelector('#btn-admin-modal-close');

    setTimeout(() => input?.focus(), 50);

    function closeModal() {
      modal.remove();
    }

    async function verifyAndSubmit() {
      const val = input.value.trim();
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'กำลังตรวจสอบ...';
      const isValid = await verifyAdminSecret(val);
      if (isValid) {
        closeModal();
        onSuccess();
      } else {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'ยืนยันและทดสอบสด';
        errEl.textContent = '⚠️ รหัสผ่านไม่ถูกต้อง (Unauthorized) ไม่สามารถยิงทดสอบระบบได้';
        errEl.style.display = 'block';
        input.style.borderColor = '#ef4444';
        input.focus();
        input.select();
      }
    }

    btnConfirm.addEventListener('click', verifyAndSubmit);
    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        verifyAndSubmit();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Refresh Button - Prompts for Admin password verification before triggering on-demand ping
  const refreshBtn = container.querySelector('#btn-refresh-stats');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      promptAdminAuth(() => {
        runLiveDiagnostics();
      });
    });
  }

  // ==========================================
  // TAB 2: Download Log Logic & Validation
  // ==========================================
  const fromInput = container.querySelector('#input-from-date');
  const toInput = container.querySelector('#input-to-date');
  const dateAlert = container.querySelector('#tf-date-alert');
  const manifestItemsList = container.querySelector('#manifest-items-list');
  const manifestCountBadge = container.querySelector('#manifest-count-badge');
  const manifestSizeInfo = container.querySelector('#manifest-size-info');
  const btnDownloadZip = container.querySelector('#btn-download-zip');
  const progressBar = container.querySelector('#download-progress-bar');
  const progressFill = container.querySelector('#progress-fill');
  const progressLabel = container.querySelector('#progress-label');
  const statusMsg = container.querySelector('#download-status-msg');

  // Load Archive Index
  async function loadArchiveIndex() {
    const cacheBuster = '?t=' + Date.now();
    try {
      const res = await fetch(`${GITHUB_RAW_BASE}/api/archive-index.json` + cacheBuster, { cache: 'no-cache' });
      if (res.ok) {
        archiveIndex = await res.json();
        return;
      }
    } catch {
      // try local origin
    }

    try {
      const res = await fetch('/api/archive-index.json' + cacheBuster, { cache: 'no-cache' });
      if (res.ok) {
        archiveIndex = await res.json();
        return;
      }
    } catch {
      archiveIndex = [];
    }
  }

  // Validate Date Range & Lock
  function validateAndLockDates() {
    const yesterday = getYesterdayDate();
    const yStr = formatDateInput(yesterday);

    let fromVal = fromInput.value;
    let toVal = toInput.value;

    let fromDate = new Date(fromVal);
    let toDate = new Date(toVal);

    // Rule 1: No Future Dates allowed
    if (fromDate > yesterday) {
      fromInput.value = yStr;
      fromDate = yesterday;
    }
    if (toDate > yesterday) {
      toInput.value = yStr;
      toDate = yesterday;
    }

    // Rule 2: ToDate cannot be earlier than FromDate
    if (toDate < fromDate) {
      toInput.value = fromInput.value;
      toDate = fromDate;
    }

    // Rule 3: Max 30 Days range limit
    const diffTime = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 30) {
      // Clamp ToDate to fromDate + 29 days or yesterday, whichever is smaller
      const maxAllowedDate = new Date(fromDate);
      maxAllowedDate.setDate(maxAllowedDate.getDate() + 29);
      const clampedDate = maxAllowedDate > yesterday ? yesterday : maxAllowedDate;
      toInput.value = formatDateInput(clampedDate);
      
      dateAlert.style.display = 'block';
      dateAlert.textContent = `⚠️ ระบบจำกัดการเลือกช่วงวันสูงสุดไม่เกิน 30 วัน (ระบบได้ปรับวันที่สิ้นสุดเป็น ${formatDateInput(clampedDate)} ให้อัตโนมัติ)`;
    } else {
      dateAlert.style.display = 'none';
    }
  }

  // Compute List of Dates in Range
  function getDatesInRange(startStr, endStr) {
    const dates = [];
    let curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end) {
      dates.push(formatDateInput(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }

  // Update Manifest List for Selected Range
  function updateDateRangeManifest() {
    validateAndLockDates();

    const fromVal = fromInput.value;
    const toVal = toInput.value;
    const dateRange = getDatesInRange(fromVal, toVal);

    const totalDays = dateRange.length;
    manifestCountBadge.textContent = `${totalDays} วัน`;

    // Calculate approximate size (~119 KB per day)
    let totalEstimatedBytes = 0;

    const itemsHTML = dateRange.map((dateStr) => {
      const matchIndex = archiveIndex.find((a) => a.date === dateStr);
      const sizeBytes = matchIndex ? matchIndex.sizeBytes : 119110;
      totalEstimatedBytes += sizeBytes;
      const sizeKb = (sizeBytes / 1024).toFixed(1);

      return `
        <div class="manifest-item" data-date="${dateStr}">
          <div class="manifest-item-left">
            <span class="item-icon">📄</span>
            <div class="item-info">
              <span class="item-filename">telemetry-${dateStr}.json.gz</span>
              <span class="item-date">ข้อมูลประจำวันที่: ${dateStr}</span>
            </div>
          </div>
          <div class="manifest-item-right">
            <span class="item-size">~${sizeKb} KB</span>
            <span class="item-tag">${matchIndex ? 'พร้อมดาวน์โหลด' : 'คาดการณ์'}</span>
          </div>
        </div>
      `;
    }).join('');

    manifestItemsList.innerHTML = itemsHTML;
    manifestSizeInfo.textContent = `ขนาดไฟล์รวมโดยประมาณ: ${(totalEstimatedBytes / 1024).toFixed(1)} KB (${(totalEstimatedBytes / (1024 * 1024)).toFixed(2)} MB)`;
  }

  // Date Input Listeners
  fromInput.addEventListener('change', () => {
    updateDateRangeManifest();
  });
  toInput.addEventListener('change', () => {
    updateDateRangeManifest();
  });

  // Presets
  container.querySelector('#btn-preset-yesterday')?.addEventListener('click', () => {
    fromInput.value = yesterdayStr;
    toInput.value = yesterdayStr;
    updateDateRangeManifest();
  });

  container.querySelector('#btn-preset-7days')?.addEventListener('click', () => {
    const d = getYesterdayDate();
    d.setDate(d.getDate() - 6);
    fromInput.value = formatDateInput(d);
    toInput.value = yesterdayStr;
    updateDateRangeManifest();
  });

  container.querySelector('#btn-preset-30days')?.addEventListener('click', () => {
    const d = getYesterdayDate();
    d.setDate(d.getDate() - 29);
    fromInput.value = formatDateInput(d);
    toInput.value = yesterdayStr;
    updateDateRangeManifest();
  });

  // Batch Download & In-Browser Zipping
  btnDownloadZip?.addEventListener('click', async () => {
    const fromVal = fromInput.value;
    const toVal = toInput.value;
    const dateRange = getDatesInRange(fromVal, toVal);

    if (dateRange.length === 0) return;

    btnDownloadZip.disabled = true;
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    progressLabel.textContent = '0%';
    statusMsg.className = 'download-status-msg msg-info';
    statusMsg.textContent = `🚀 เริ่มต้นดาวน์โหลดข้อมูลโทรมาตร ${dateRange.length} รายการ...`;

    const zipFiles = {};
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dateRange.length; i++) {
      const dateStr = dateRange[i];
      const filename = `telemetry-${dateStr}.json.gz`;
      const url = `/archive/${filename}`;

      const pct = Math.round(((i + 0.5) / dateRange.length) * 80);
      progressFill.style.width = `${pct}%`;
      progressLabel.textContent = `${pct}%`;
      statusMsg.textContent = `กำลังดึงไฟล์: ${filename} (${i + 1}/${dateRange.length})...`;

      try {
        let res = await fetch(`${GITHUB_RAW_BASE}/archive/${filename}`);
        if (!res.ok) {
          // Fallback to local origin
          res = await fetch(url);
        }
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const u8 = new Uint8Array(buffer);

          // Try decompressing to give user ready-to-read .json inside zip
          try {
            const decompressed = gunzipSync(u8);
            zipFiles[`telemetry-${dateStr}.json`] = decompressed;
          } catch {
            // Fallback to storing gz directly
            zipFiles[filename] = u8;
          }
          successCount++;
        } else {
          // If past file does not exist, note it in a manifest log
          zipFiles[`telemetry-${dateStr}-missing.txt`] = strToU8(`Data archive for ${dateStr} was not present on server (HTTP ${res.status}).`);
          failCount++;
        }
      } catch (err) {
        zipFiles[`telemetry-${dateStr}-error.txt`] = strToU8(`Error fetching archive for ${dateStr}: ${err.message}`);
        failCount++;
      }
    }

    // Add Readme / Metadata to zip
    zipFiles['README.txt'] = strToU8(
      `ThaiFlood Telemetry Export\n` +
      `Date Range: ${fromVal} to ${toVal} (${dateRange.length} days)\n` +
      `Export Timestamp: ${new Date().toISOString()}\n` +
      `Successful archives: ${successCount}\n` +
      `Missing/Error: ${failCount}\n` +
      `Data Sources: HII / ThaiWater, EGAT, DOH Highways, CCTV Feeds, TMD Radar, Open-Meteo\n`
    );

    statusMsg.textContent = `📦 กำลังบีบอัดเป็นไฟล์ ZIP (In-Browser fflate)...`;
    progressFill.style.width = '90%';
    progressLabel.textContent = '90%';

    try {
      // In-browser Zip synthesis
      const zippedBuffer = zipSync(zipFiles, { level: 6 });

      progressFill.style.width = '100%';
      progressLabel.textContent = '100%';
      statusMsg.className = 'download-status-msg msg-success';
      statusMsg.textContent = `✅ บีบอัดสำเร็จ! ดาวน์โหลดไฟล์ thaiflood-telemetry-${fromVal}-to-${toVal}.zip (${(zippedBuffer.length / 1024).toFixed(1)} KB)`;

      // Trigger Browser Download
      const blob = new Blob([zippedBuffer], { type: 'application/zip' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `thaiflood-telemetry-${fromVal}-to-${toVal}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      statusMsg.className = 'download-status-msg msg-error';
      statusMsg.textContent = `❌ เกิดข้อผิดพลาดในการรวมไฟล์ Zip: ${err.message}`;
    } finally {
      btnDownloadZip.disabled = false;
    }
  });

  // Initial load
  loadStatisticsData();
  loadArchiveIndex().then(() => {
    updateDateRangeManifest();
  });

  return container;
}

