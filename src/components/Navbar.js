/**
 * Navbar Component for ThaiFlood
 * - Top-Left: Clean Google Maps Search Box
 * - Top-Right: Collapsible Layer Menu Bar (Hide Menu Bar) with Dedicated Toggles
 */
import { getVisitorCount } from '../services/analyticsService.js';
import { searchLocalProvinces, searchThaiLocations } from '../services/geocodeService.js';

export function createNavbar(options) {
  const { stations = [], dams = [], bmaRoads = [], onSearchSelect, onLayerToggle, onECMWFDayChange, onGFSDayChange } = options;

  const overlay = document.createElement('div');
  overlay.className = 'gmaps-nav-overlay';
  overlay.id = 'gmaps-nav-overlay';

  overlay.innerHTML = `
    <!-- Top-Left Google Maps Search Box -->
    <div class="gmaps-top-widget" id="gmaps-top-widget">
      <div class="gmaps-search-card" id="gmaps-search-card">
        <button class="gmaps-hamburger-btn" id="gmaps-hamburger-btn" title="เมนูหลัก (แจ้งเตือน / แหล่งข้อมูล / เกี่ยวกับผู้พัฒนา)" type="button" aria-label="เมนูหลัก">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="gmaps-search-icon">
          <span style="font-size: 18px;">🌊</span>
        </div>
        <input 
          type="text" 
          class="gmaps-search-input" 
          id="gmaps-search-input" 
          placeholder="ค้นหาจังหวัด, อำเภอ, ตำบล, สถานี, เขื่อน..." 
          autocomplete="off"
        />
        <button class="gmaps-search-btn" id="gmaps-search-submit" title="ค้นหา">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="gmaps-search-dropdown" id="gmaps-search-dropdown"></div>
    </div>

    <!-- Top-Right Collapsible Layer Toggle Menu Bar & North Compass Control Stack -->
    <div class="gmaps-layer-panel-stack" id="gmaps-layer-panel-stack">
      <div class="gmaps-layer-panel" id="gmaps-layer-panel">
        <!-- Header / Hide Menu Bar Toggle -->
      <div class="gmaps-layer-header" id="gmaps-layer-header" title="คลิกเพื่อย่อ/ขยายเมนูเลเยอร์">
        <div class="layer-header-title">
          <span class="layer-header-icon" aria-hidden="true">
            <svg class="layer-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3.5L21.5 8.8L12 14.1L2.5 8.8L12 3.5Z" />
              <path d="M2.5 12.8L12 18.1L21.5 12.8L21.5 15.8L12 21.1L2.5 15.8L2.5 12.8Z" />
            </svg>
          </span>
          <span>ชั้นข้อมูลแผนที่</span>
        </div>
        <button class="gmaps-layer-toggle-btn" id="btn-toggle-layer-panel" title="ย่อ / ขยายแถบเมนู (Hide Menu Bar)" type="button">
          <span class="toggle-btn-text">ซ่อน</span>
          <span class="toggle-btn-arrow">▾</span>
        </button>
      </div>

      <!-- Layer Items List -->
      <div class="gmaps-layer-body" id="gmaps-layer-body">
        <div class="gmaps-layer-group">
          <!-- 1. Flood Now -->
          <label class="gmaps-toggle-row" for="toggle-flood-now">
            <div class="layer-info">
              <span class="layer-dot dot-red"></span>
              <div class="layer-text-wrap">
                <div class="layer-name">น้ำท่วมปัจจุบัน</div>
                <div class="layer-desc">ขอบเขตน้ำล้นตลิ่ง · ล่าสุด: 29 ก.ย. 2026 01:00 น.</div>
              </div>
            </div>
            <div class="gmaps-switch">
              <input type="checkbox" id="toggle-flood-now" data-layer="flood-now" checked />
              <span class="switch-slider slider-red"></span>
            </div>
          </label>

          <!-- 2. 7-Day Forecast -->
          <label class="gmaps-toggle-row" for="toggle-forecast-7d">
            <div class="layer-info">
              <span class="layer-dot dot-orange"></span>
              <div class="layer-text-wrap">
                <div class="layer-name">เสี่ยงภัย 7 วัน</div>
                <div class="layer-desc">คาดการณ์ล่วงหน้า 7 วัน · ล่าสุด: 29 ก.ย. 2026 01:00 น.</div>
              </div>
            </div>
            <div class="gmaps-switch">
              <input type="checkbox" id="toggle-forecast-7d" data-layer="forecast-7d" checked />
              <span class="switch-slider slider-orange"></span>
            </div>
          </label>

          <!-- 3. Dams & Reservoirs (Requirement 2) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-dams">
              <div class="layer-info">
                <span style="font-size: 15px;">🏢</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">เขื่อนและอ่างเก็บน้ำ</div>
                  <div class="layer-desc">จุดเขื่อน & ผืนน้ำจริง · ล่าสุด: 29 ก.ย. 2026 06:00 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-dams" data-layer="dams" checked />
                <span class="switch-slider slider-cyan"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-dams" style="display: block;">
              <div class="legend-row">
                <span class="legend-color" style="background:#dc2626; border-radius:50%;"></span>
                <span><b>🔴 น้ำวิกฤต:</b> &ge; 80% (น้ำมาก)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#ea580c; border-radius:50%;"></span>
                <span><b>🟠 เฝ้าระวัง:</b> 60% – 79.9% (น้ำมาก)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#0284c7; border-radius:50%;"></span>
                <span><b>🔵 เกณฑ์ปกติ:</b> 30% – 59.9%</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#d97706; border-radius:50%;"></span>
                <span><b>🟡 น้ำน้อย:</b> &lt; 30%</span>
              </div>
              <div class="legend-note">💡 สีของสัญลักษณ์เขื่อนสะท้อนตาม % ปริมาตรน้ำกักเก็บจริงแบบเรียลไทม์</div>
            </div>
          </div>

          <!-- 4. Water Flow Direction -->
          <label class="gmaps-toggle-row" for="toggle-flow-direction">
            <div class="layer-info">
              <span class="layer-dot dot-blue"></span>
              <div class="layer-text-wrap">
                <div class="layer-name">ทิศทางน้ำไหล</div>
                <div class="layer-desc">ลูกศรเวกเตอร์ทิศทางกระแสน้ำ · ล่าสุด: 29 ก.ย. 2026 01:00 น.</div>
              </div>
            </div>
            <div class="gmaps-switch">
              <input type="checkbox" id="toggle-flow-direction" data-layer="flow-direction" />
              <span class="switch-slider slider-blue"></span>
            </div>
          </label>

          <!-- 5. Water Telemetry Stations -->
          <label class="gmaps-toggle-row" for="toggle-stations">
            <div class="layer-info">
              <span style="font-size: 14px;">📍</span>
              <div class="layer-text-wrap">
                <div class="layer-name">สถานีวัดระดับน้ำ</div>
                <div class="layer-desc">1,400+ จุดวัดโทรมาตร สสน. · ล่าสุด: 29 ก.ย. 2026 01:00 น.</div>
              </div>
            </div>
            <div class="gmaps-switch">
              <input type="checkbox" id="toggle-stations" data-layer="stations" checked />
              <span class="switch-slider slider-green"></span>
            </div>
          </label>

          <!-- 6. DMR Geology 1:250,000 -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-dmr-geology">
              <div class="layer-info">
                <span style="font-size: 14px;">🪨</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">ธรณีวิทยา (DMR 1:250k)</div>
                  <div class="layer-desc">หน่วยหิน & รอยเลื่อน กรมทรัพยากรธรณี</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-dmr-geology" data-layer="dmr-geology" />
                <span class="switch-slider slider-purple"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-dmr-geology" style="display: none;">
              <div class="legend-row">
                <span class="legend-color" style="background:#eab308; border:1px solid #ca8a04;"></span>
                <span><b>สีสันบนแผนที่:</b> หมวดหมู่และหน่วยหิน (Rock Units)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#dc2626; border:1px solid #991b1b;"></span>
                <span><b>เส้นสีแดง/ดำ:</b> รอยเลื่อนและแนวโครงสร้างธรณี</span>
              </div>
              <div class="legend-note">💡 <b>คลิกบนแผนที่</b> เพื่อดูชื่อหน่วยหิน, สัญลักษณ์ (เช่น Qa, P, Trgr) และคำอธิบายหิน ณ จุดนั้น</div>
            </div>
          </div>

          <!-- 7. TMD / RainViewer Live Weather Radar -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-sat-water">
              <div class="layer-info">
                <span style="font-size: 14px;">📡</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">เรดาร์ตรวจฝนสด (TMD / RainViewer Radar)</div>
                  <div class="layer-desc" id="desc-sat-water">ตรวจจับกลุ่มฝนสด · อัปเดตล่าสุด: <span class="radar-live-ts">29 ก.ย. 2026 01:20 น.</span></div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-sat-water" data-layer="sat-water" />
                <span class="switch-slider slider-teal"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-sat-water" style="display: none;">
              <div class="legend-scale-bar">
                <span style="background: linear-gradient(to right, #00c8ff, #00e400, #ffff00, #ff7e00, #ff0000, #99004c);"></span>
              </div>
              <div class="legend-scale-labels">
                <span>ฝนเบา (15-25 dBZ)</span>
                <span>ปานกลาง (35 dBZ)</span>
                <span style="color:#dc2626; font-weight:700;">ฝนหนัก/ลูกเห็บ (>50 dBZ)</span>
              </div>
              <div class="legend-note">💡 <b>เรดาร์ Doppler:</b> ตรวจจับหยดน้ำฝนจริงที่ตกสู่พื้นดินทุก 10 นาที เชื่อมต่อเครือข่ายสถานีเรดาร์ กรมอุตุนิยมวิทยา (TMD)</div>
              <div class="legend-timestamp" id="radar-updated-time" style="font-size: 11px; color: #0284c7; font-weight: 600; margin-top: 5px; display: flex; align-items: center; gap: 4px;">🕒 ตรวจวัดเรดาร์ล่าสุด: <span class="radar-live-ts">29 ก.ย. 2026 01:20 น.</span> (TMD Radar ทุก 10 นาที)</div>
            </div>
          </div>

          <!-- 8. Satellite Cloud Clusters -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-sat-clouds">
              <div class="layer-info">
                <span style="font-size: 14px;">☁️</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">ดาวเทียมกลุ่มเมฆ (Himawari)</div>
                  <div class="layer-desc" id="desc-sat-clouds">กลุ่มเมฆฝนสด Clean IR · อัปเดตล่าสุด: <span class="clouds-live-ts">29 ก.ย. 2026 01:20 น.</span></div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-sat-clouds" data-layer="sat-clouds" />
                <span class="switch-slider slider-sky"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-sat-clouds" style="display: none;">
              <div class="legend-scale-bar">
                <span style="background: linear-gradient(to right, #2563eb, #10b981, #facc15, #ea580c, #dc2626);"></span>
              </div>
              <div class="legend-scale-labels">
                <span>ฝนเบา</span>
                <span>ปานกลาง</span>
                <span style="color:#dc2626; font-weight:700;">พายุ/ฝนหนักมาก</span>
              </div>
              <div class="legend-note">💡 เซนเซอร์ดาวเทียมสูง 35,786 กม. ความละเอียด 2 กม./px</div>
              <div class="legend-timestamp" id="clouds-updated-time" style="font-size: 11px; color: #2563eb; font-weight: 600; margin-top: 5px; display: flex; align-items: center; gap: 4px;">🕒 ภาพดาวเทียมล่าสุด: <span class="clouds-live-ts">29 ก.ย. 2026 01:20 น.</span> (Himawari-9 Clean IR ทุก 10 นาที)</div>
            </div>
          </div>

          <!-- 9. GFS Numerical Precipitation Model (NOAA NCEP - Adjustable Days) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-gfs">
              <div class="layer-info">
                <span style="font-size: 14px;">🇺🇸</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">โมเดลคาดการณ์ฝน GFS (NOAA - ปรับวันได้)</div>
                  <div class="layer-desc">แบบจำลอง NOAA GFS (13 กม.) ล่วงหน้า 7 วัน · ล่าสุด: 29 ก.ย. 2026 00:00 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-gfs" data-layer="gfs" />
                <span class="switch-slider slider-cyan"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-gfs" style="display: none;">
              <div style="font-weight: 600; font-size: 11px; color: #475569; margin-bottom: 5px;">📅 เลือกวันพยากรณ์ล่วงหน้า (0 - 6 วัน):</div>
              <div class="gfs-day-chips-panel">
                <button class="gfs-day-btn active" data-day="0">วันนี้</button>
                <button class="gfs-day-btn" data-day="1">+1 วัน</button>
                <button class="gfs-day-btn" data-day="2">+2 วัน</button>
                <button class="gfs-day-btn" data-day="3">+3 วัน</button>
                <button class="gfs-day-btn" data-day="4">+4 วัน</button>
                <button class="gfs-day-btn" data-day="5">+5 วัน</button>
                <button class="gfs-day-btn" data-day="6">+6 วัน</button>
              </div>
              <div class="legend-scale-bar" style="margin-top: 8px;">
                <span style="background: linear-gradient(to right, #60a5fa, #10b981, #f59e0b, #ef4444, #8b5cf6);"></span>
              </div>
              <div class="legend-scale-labels">
                <span>1-10 มม.</span>
                <span>25 มม.</span>
                <span>50 มม.</span>
                <span style="color:#8b5cf6; font-weight:700;">>90 มม.</span>
              </div>
              <div class="legend-note">💡 แบบจำลอง Global Forecast System (NOAA/NCEP) ความละเอียด 13 กม. ปรับดูฝนล่วงหน้า 7 วัน</div>
            </div>
          </div>

          <!-- 10. ECMWF Numerical Precipitation Model (Adjustable Days) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-ecmwf">
              <div class="layer-info">
                <span style="font-size: 14px;">🇪🇺</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">โมเดลคาดการณ์ฝน ECMWF (ยุโรป - ปรับวันได้)</div>
                  <div class="layer-desc">แบบจำลอง ECMWF IFS (9 กม.) ล่วงหน้า 7 วัน · ล่าสุด: 29 ก.ย. 2026 00:00 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-ecmwf" data-layer="ecmwf" />
                <span class="switch-slider slider-indigo"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-ecmwf" style="display: none;">
              <div style="font-weight: 600; font-size: 11px; color: #475569; margin-bottom: 5px;">📅 เลือกวันพยากรณ์ล่วงหน้า (0 - 6 วัน):</div>
              <div class="ecmwf-day-chips-panel">
                <button class="ecmwf-day-btn active" data-day="0">วันนี้</button>
                <button class="ecmwf-day-btn" data-day="1">+1 วัน</button>
                <button class="ecmwf-day-btn" data-day="2">+2 วัน</button>
                <button class="ecmwf-day-btn" data-day="3">+3 วัน</button>
                <button class="ecmwf-day-btn" data-day="4">+4 วัน</button>
                <button class="ecmwf-day-btn" data-day="5">+5 วัน</button>
                <button class="ecmwf-day-btn" data-day="6">+6 วัน</button>
              </div>
              <div class="legend-scale-bar" style="margin-top: 8px;">
                <span style="background: linear-gradient(to right, #60a5fa, #10b981, #f59e0b, #ef4444, #8b5cf6);"></span>
              </div>
              <div class="legend-scale-labels">
                <span>1-10 มม.</span>
                <span>25 มม.</span>
                <span>50 มม.</span>
                <span style="color:#8b5cf6; font-weight:700;">>90 มม.</span>
              </div>
              <div class="legend-note">💡 แบบจำลอง European Centre for Medium-Range Weather Forecasts (ECMWF IFS 9km) มาตรฐานความแม่นยำสูงสุด</div>
            </div>
          </div>

          <!-- 11. National Highway Flood Lines (DOH 1586) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-doh-roads">
              <div class="layer-info">
                <span style="font-size: 14px;">🛣️</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">น้ำท่วมทางหลวงทั่วประเทศ (DOH)</div>
                  <div class="layer-desc">จุดน้ำท่วมทางหลวง สัญลักษณ์ ทล. · ล่าสุด: 29 ก.ย. 2026 01:00 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-doh-roads" data-layer="doh-roads" checked />
                <span class="switch-slider slider-red"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-doh-roads" style="display: block;">
              <div class="legend-row">
                <span class="legend-color" style="background:#dc2626; height:4px; width:18px; border-radius:2px; display:inline-block;"></span>
                <span><b>เส้นสีแดง:</b> การจราจรผ่านไม่ได้ (น้ำท่วมสูง)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#ea580c; height:4px; width:18px; border-radius:2px; display:inline-block;"></span>
                <span><b>เส้นสีส้ม:</b> ผ่านได้ด้วยความระมัดระวัง</span>
              </div>
              <div class="legend-note">💡 ข้อมูล <b>กรมทางหลวง (DOH)</b> แสดงเฉพาะเส้นทางที่น้ำท่วม พร้อมตราสัญลักษณ์ทางหลวง สายด่วน 1586</div>
            </div>
            <!-- Keep hidden fallback for bma-roads -->
            <input type="checkbox" id="toggle-bma-roads" data-layer="bma-roads" style="display:none;" />
          </div>

          <!-- 12. Traffy Fondue Road Flood Incidents (Minimalist Road Icon) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-traffy-flood">
              <div class="layer-info">
                <span class="minimal-road-layer-icon" style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M6 20L9.5 4H14.5L18 20H6Z" fill="#334155" stroke="#94a3b8" stroke-width="1.2" stroke-linejoin="round"/>
                    <line x1="12" y1="5" x2="12" y2="8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
                    <line x1="12" y1="10.5" x2="12" y2="13.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
                    <line x1="12" y1="16" x2="12" y2="19" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </span>
                <div class="layer-text-wrap">
                  <div class="layer-name">น้ำท่วมขัง Traffy Fondue (กทม.)</div>
                  <div class="layer-desc">รายงานจุดน้ำท่วมผิวจราจรสด · ล่าสุด: 29 ก.ย. 2026 01:15 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-traffy-flood" data-layer="traffy-flood" checked />
                <span class="switch-slider slider-orange"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-traffy-flood" style="display: block;">
              <div class="legend-row">
                <span class="legend-color" style="background:#f59e0b; height:8px; width:8px; border-radius:50%; display:inline-block;"></span>
                <span><b>สีส้ม:</b> รอรับเรื่อง / กำลังดำเนินการแก้ไข</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#10b981; height:8px; width:8px; border-radius:50%; display:inline-block;"></span>
                <span><b>สีเขียว:</b> ดำเนินการเสร็จสิ้น / น้ำลดแล้ว</span>
              </div>
              <div class="legend-note">💡 ข้อมูลจากระบบ <b>Traffy Fondue (สวทช. / กทม.)</b> คลิกที่หมุดถนนเพื่อดูภาพถ่ายและรายละเอียด</div>
            </div>
          </div>

          <!-- 12. Live Traffic Flow (Google Maps Traffic Overlay) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-traffic">
              <div class="layer-info">
                <span style="font-size: 14px;">🚦</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">สภาพการจราจรสด (Traffic Flow)</div>
                  <div class="layer-desc">สภาพการจราจรสดทั่วประเทศ · ตรวจสอบล่าสุด: 29 ก.ย. 2026 01:20 น.</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-traffic" data-layer="traffic" />
                <span class="switch-slider slider-green"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-traffic" style="display: none;">
              <div class="legend-row">
                <span class="legend-color" style="background:#16a34a; height:4px; width:18px; border-radius:2px; display:inline-block;"></span>
                <span><b>สีเขียว:</b> การจราจรคล่องตัว (> 45 กม./ชม.)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#eab308; height:4px; width:18px; border-radius:2px; display:inline-block;"></span>
                <span><b>สีส้ม:</b> การจราจรชะลอตัว (20 - 45 กม./ชม.)</span>
              </div>
              <div class="legend-row">
                <span class="legend-color" style="background:#dc2626; height:4px; width:18px; border-radius:2px; display:inline-block;"></span>
                <span><b>สีแดง:</b> การจราจรติดขัดมาก (< 20 กม./ชม.)</span>
              </div>
              <div class="legend-note">💡 ข้อมูลสภาพการจราจรสดแบบ Real-time แสดงเส้นทางหลักและทางหลวงทั่วประเทศ</div>
            </div>
          </div>

          <!-- 13. Wind Field Map (Windy-style animated particle layer) -->
          <div class="layer-item-wrapper">
            <label class="gmaps-toggle-row" for="toggle-wind-field">
              <div class="layer-info">
                <span style="font-size: 14px;">💨</span>
                <div class="layer-text-wrap">
                  <div class="layer-name">แผนที่กระแสลมผิวพื้น (Wind Field Map)</div>
                  <div class="layer-desc">อนุภาคกระแสลมเคลื่อนไหว 60 FPS มาตรฐาน WMO 10m ผิวพื้น</div>
                </div>
              </div>
              <div class="gmaps-switch">
                <input type="checkbox" id="toggle-wind-field" data-layer="wind-field" />
                <span class="switch-slider slider-sky"></span>
              </div>
            </label>
            <div class="layer-legend-box" id="legend-wind-field" style="display: none;">
              <div class="legend-scale-bar" style="margin-top: 4px;">
                <span style="background: linear-gradient(to right, #38bdf8, #34d399, #a3e635, #facc15, #fb923c, #f43f5e, #c084fc);"></span>
              </div>
              <div class="legend-scale-labels">
                <span>0-2 m/s (ลมอ่อน)</span>
                <span>8 m/s (ปานกลาง)</span>
                <span style="color:#f43f5e; font-weight:700;">>24 m/s (พายุ)</span>
              </div>
              <div class="legend-note">💡 จำลองเวกเตอร์ความเร็วลม (u, v) ณ ระดับผิวพื้น 10 เมตร ตามเกณฑ์องค์การอุตุนิยมวิทยาโลก (WMO No. 306/485)</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- North Button (ขนาดเท่าปุ่มย่อ ขยาย บริเวณด้านล่างของส่วนเลือก layer ทั้ง mobile และ desktop) -->
    <div class="gmaps-north-container" id="gmaps-north-container">
      <button class="gmaps-north-btn" id="gmaps-btn-north" title="ปรับทิศเหนือ (Reset North)" aria-label="ปรับระนาบทิศเหนือ" type="button">
        <svg class="gmaps-north-compass-icon" width="22" height="22" viewBox="0 0 32 32" fill="none">
          <!-- Subtle Outer Dial Ring -->
          <circle cx="16" cy="16" r="14" fill="none" stroke="#e2e8f0" stroke-width="1.2" opacity="0.8" />
          <!-- Cardinal Direction Ticks -->
          <line x1="16" y1="2" x2="16" y2="4.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" />
          <line x1="16" y1="27.5" x2="16" y2="30" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round" />
          <line x1="2" y1="16" x2="4.5" y2="16" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round" />
          <line x1="27.5" y1="16" x2="30" y2="16" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round" />
          <!-- 3D Shaded Compass Needle -->
          <!-- North Pointer (Ruby Red) -->
          <polygon points="16,4.5 12,16 16,13.8" fill="#ef4444" />
          <polygon points="16,4.5 20,16 16,13.8" fill="#dc2626" />
          <!-- South Pointer (Slate Metallic) -->
          <polygon points="16,27.5 12,16 16,18.2" fill="#94a3b8" />
          <polygon points="16,27.5 20,16 16,18.2" fill="#64748b" />
          <!-- Center Pivot Casing & Ruby Core -->
          <circle cx="16" cy="16" r="3" fill="#ffffff" stroke="#1e293b" stroke-width="1" />
          <circle cx="16" cy="16" r="1.3" fill="#dc2626" />
          <!-- Cardinal 'N' Label on Red Pointer -->
          <text x="16" y="11" font-size="5" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">N</text>
        </svg>
      </button>
    </div>
  </div>

    <!-- Left Slide-in Drawer Menu (Requirement 5) -->
    <div class="gmaps-drawer-backdrop" id="gmaps-drawer-backdrop"></div>
    <aside class="gmaps-drawer" id="gmaps-drawer" aria-label="เมนูหลัก">
      <div class="drawer-header">
        <div class="drawer-header-brand">
          <span class="drawer-logo">🌊</span>
          <div>
            <div class="drawer-title">ThaiFlood Intelligence</div>
            <div class="drawer-subtitle">ระบบสารสนเทศและเตือนภัยน้ำท่วม</div>
          </div>
        </div>
        <button class="drawer-close-btn" id="drawer-close-btn" title="ปิดเมนู" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Drawer Tabs -->
      <div class="drawer-tabs">
        <button class="drawer-tab-btn active" data-tab="alerts">
          <span class="tab-icon">🚨</span>
          <span class="tab-label">แจ้งเตือนวิกฤต</span>
          <span class="tab-badge" id="tab-alerts-badge">0</span>
        </button>
        <button class="drawer-tab-btn" data-tab="sources">
          <span class="tab-icon">📚</span>
          <span class="tab-label">แหล่งข้อมูล</span>
        </button>
        <button class="drawer-tab-btn" data-tab="developer">
          <span class="tab-icon">👨‍💻</span>
          <span class="tab-label">ผู้พัฒนา</span>
        </button>
      </div>

      <div class="drawer-content">
        <!-- Tab 1: Alerts (Card Stack) -->
        <div class="drawer-tab-pane active" id="tab-pane-alerts">
          <div class="alerts-pane-header">
            <div class="alerts-total-badge">
              <span class="status-dot-blink"></span>
              <span>การ์ดแจ้งเตือนวิกฤตทั้งหมด <b id="alerts-count-text">0</b> รายการ</span>
            </div>
            <button class="alerts-view-toggle" id="alerts-view-toggle" title="สลับมุมมอง">ดูทั้งหมด</button>
          </div>

          <!-- Deck View (Stacked Cards) -->
          <div class="alerts-deck-view" id="alerts-deck-view">
            <div class="alerts-stack-container" id="alerts-stack-container"></div>
            <div class="alerts-deck-controls" id="alerts-deck-controls">
              <button class="deck-btn" id="deck-btn-prev" title="การ์ดก่อนหน้า">‹ ก่อนหน้า</button>
              <span class="deck-counter" id="deck-counter">1 / 1</span>
              <button class="deck-btn" id="deck-btn-next" title="การ์ดถัดไป">ถัดไป ›</button>
            </div>
          </div>

          <!-- Expanded List View (hidden by default) -->
          <div class="alerts-list-view" id="alerts-list-view" style="display: none;"></div>
        </div>

        <!-- Tab 2: Sources -->
        <div class="drawer-tab-pane" id="tab-pane-sources">
          <div class="sources-container">
            <div class="source-section">
              <div class="source-sec-title">🗺️ แผนที่ฐาน (Basemaps)</div>
              <div class="source-card">
                <div class="source-card-title">1. แผนที่ (Map - OpenStreetMap)</div>
                <div class="source-card-body"><b>OpenStreetMap Contributors (OSM)</b> ผ่าน Tile Server มาตรฐาน EPSG:3857 แสดงโครงข่ายถนน ตรอก ซอย และชุมชน พร้อมรองรับแบบจำลองอาคาร 3D</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">2. ภาพถ่ายดาวเทียม (Satellite)</div>
                <div class="source-card-body"><b>ESRI World Imagery</b> ภาพถ่ายดาวเทียมออร์โธโฟโตความละเอียดสูงจาก ArcGIS Server แสดงภูมิประเทศจริง ลำน้ำคดเคี้ยว และที่ลุ่มต่ำ</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">3. ภูมิประเทศ (OpenTopoMap & เส้นชั้นความสูง)</div>
                <div class="source-card-body"><b>OpenTopoMap Project & NASA SRTM</b> แสดงเส้นชั้นความสูง (Contour Lines) ทุกระยะความสูง พร้อม Hillshade วิเคราะห์สันปันน้ำและภูมิประเทศ</div>
              </div>
            </div>

            <div class="source-section">
              <div class="source-sec-title">🌊 ชั้นข้อมูลอุทกวิทยา & โทรมาตรสด</div>
              <div class="source-card">
                <div class="source-card-title">1. สถานีโทรมาตรวัดระดับน้ำสด (Live Stations)</div>
                <div class="source-card-body"><b>สถาบันสารสนเทศทรัพยากรน้ำ (สสน. / HII)</b> ผ่านคลังข้อมูลน้ำแห่งชาติ API v3 กว่า 1,400+ สถานีทั่วประเทศ พร้อมระบบ Multi-tier Bank Calibration</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">2. เขื่อนและอ่างเก็บน้ำหลัก (Dams & Reservoirs)</div>
                <div class="source-card-body"><b>การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ. / EGAT)</b> และ <b>กรมชลประทาน (ชป. / RID)</b> ติดตามความจุกักเก็บ อัตราน้ำไหลเข้า และการระบายน้ำรายวัน</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">3. พื้นที่น้ำท่วมปัจจุบัน (Current Flood Extents)</div>
                <div class="source-card-body"><b>Fluvial Geomorphology Buffer</b> คำนวณขอบเขตมวลน้ำล้นตลิ่งจากโทรมาตรจริง สสน. ผสานแนวร่องน้ำ OpenStreetMap 516 สาย ไร้เส้นตัดขวาง</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">4. เสี่ยงภัยล่วงหน้า 7 วัน (7-Day Risk Forecast)</div>
                <div class="source-card-body">แบบจำลองวิเคราะห์แนวโน้มระดับน้ำล้นตลิ่งล่วงหน้า 1-3 วัน ร่วมกับการพยากรณ์ปริมาณฝนสะสม</div>
              </div>
            </div>

            <div class="source-section">
              <div class="source-sec-title">📡 สภาพอากาศ เรดาร์ & ธรณีวิทยา</div>
              <div class="source-card">
                <div class="source-card-title">1. เรดาร์ตรวจฝนสด (Weather Radar)</div>
                <div class="source-card-body"><b>RainViewer API</b> ผสานโครงข่ายสถานีเรดาร์ตรวจอากาศของ <b>กรมอุตุนิยมวิทยา (TMD)</b> ความละเอียด 512px พร้อมไทม์ไลน์ย้อนหลัง 2 ชม.</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">2. โมเดลคาดการณ์ฝน GFS & ECMWF</div>
                <div class="source-card-body"><b>NOAA NCEP (สหรัฐอเมริกา)</b> และ <b>ECMWF IFS (ยุโรป)</b> แบบจำลองพยากรณ์ฝนสะสมความละเอียดสูง ปรับวันล่วงหน้าได้ 7 วัน</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">3. ธรณีวิทยาและแนวรอยเลื่อน (DMR 1:250,000)</div>
                <div class="source-card-body"><b>กรมทรัพยากรธรณี (DMR)</b> แผนที่หน่วยหินและแนวรอยเลื่อนมีพลัง มาตราส่วน 1:250,000 พร้อมระบบถอดรหัสรหัสหินภาษาไทย</div>
              </div>
              <div class="source-card">
                <div class="source-card-title">4. น้ำท่วมถนน กทม. & สภาพการจราจรสด</div>
                <div class="source-card-body"><b>สำนักการระบายน้ำ กรุงเทพมหานคร</b> (23 เส้นทางหลัก) ผสาน <b>Google Real-Time Traffic Flow Layer</b> แสดงสภาพการจราจรบนผิวถนน</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Developer -->
        <div class="drawer-tab-pane" id="tab-pane-developer">
          <div class="developer-profile-card">
            <div class="dev-badge-icon">🎓</div>
            <h3 class="dev-name">Powered by Noppasin Pronsawad</h3>
            
            <p class="dev-description">
              โครงการ <b>ThaiFlood Intelligence</b> ถูกพัฒนาขึ้นเพื่อเป็นแพลตฟอร์มภูมิสารสนเทศและเฝ้าระวังอุทกภัยแบบเรียลไทม์ 
              ผสานความรู้ด้านธรณีวิทยา ธรณีสัณฐานวิทยา แบบจำลองทางอุทกวิทยา และเทคโนโลยี Web GIS สมัยใหม่ 
              เพื่อให้ประชาชนและหน่วยงานสามารถเข้าถึงข้อมูลน้ำท่วมที่แม่นยำ รวดเร็ว และเข้าใจง่าย
            </p>

            <div class="dev-links-list">
              <!-- LinkedIn Button -->
              <a href="https://www.linkedin.com/in/noppasinp" target="_blank" rel="noopener noreferrer" class="dev-contact-btn btn-linkedin" title="เปิด LinkedIn Profile">
                <div class="btn-contact-left">
                  <svg class="contact-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z"/>
                  </svg>
                  <div class="btn-contact-texts">
                    <span class="contact-title">LinkedIn</span>
                    <span class="contact-sub">linkedIn/noppasinp</span>
                  </div>
                </div>
                <span class="contact-arrow">↗</span>
              </a>

              <!-- Website Button -->
              <a href="https://noppasinp.vercel.app" target="_blank" rel="noopener noreferrer" class="dev-contact-btn btn-website" title="เปิด Personal Website">
                <div class="btn-contact-left">
                  <svg class="contact-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <div class="btn-contact-texts">
                    <span class="contact-title">Website</span>
                    <span class="contact-sub">noppasinp.vercel.app</span>
                  </div>
                </div>
                <span class="contact-arrow">↗</span>
              </a>
            </div>

            <!-- GoatCounter Privacy-friendly Analytics Stats -->
            <div class="drawer-stats-section" style="margin-top: 24px; padding: 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 6px; color: #cbd5e1; font-size: 12.5px; font-weight: 600;">
                  <span style="font-size: 14px;">📊</span>
                  <span>สถิติผู้เข้าชมเว็บไซต์</span>
                </div>
                <span id="visitor-count-badge" style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 11px;">
                  กำลังโหลด...
                </span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.45;">
                ขับเคลื่อนโดย <b>GoatCounter</b> — ระบบตรวจวัดสถิติแบบคำนึงถึงความเป็นส่วนตัว (Privacy-friendly) ปราศจากการเก็บคุกกี้และข้อมูลส่วนบุคคลตามมาตรฐาน PDPA / GDPR
              </div>
              <div style="margin-top: 8px;">
                <a href="https://thaiflood.goatcounter.com" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #38bdf8; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <span>เปิดดูแดชบอร์ดสถิติสด (GoatCounter Dashboard)</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile Google Maps Style "รายละเอียดแผนที่" Bottom Sheet (Matching Attached Image) -->
    <div class="gmaps-mobile-layer-backdrop" id="gmaps-mobile-layer-backdrop"></div>
    <div class="gmaps-mobile-layer-sheet" id="gmaps-mobile-layer-sheet" role="dialog" aria-modal="true" aria-label="รายละเอียดแผนที่">
      <div class="mobile-layer-sheet-handle-bar">
        <div class="mobile-layer-sheet-handle"></div>
      </div>
      <div class="mobile-layer-sheet-header">
        <h3 class="mobile-layer-sheet-title">รายละเอียดแผนที่</h3>
        <button class="mobile-layer-sheet-close" id="btn-close-mobile-layers" type="button" aria-label="ปิดรายละเอียดแผนที่">✕</button>
      </div>
      <div class="mobile-layer-sheet-body">
        <div class="mobile-layer-grid" id="mobile-layer-grid"></div>
      </div>
    </div>
  `;

  // Search logic
  const searchInput = overlay.querySelector('#gmaps-search-input');
  const dropdown = overlay.querySelector('#gmaps-search-dropdown');
  let searchAbortController = null;
  let searchDebounceTimer = null;
  const recentGeoResults = new Map();

  async function handleSearch(query) {
    const val = query.trim().toLowerCase();
    if (!val) {
      dropdown.style.display = 'none';
      if (searchAbortController) searchAbortController.abort();
      return;
    }

    // 1. Instant local matching for 77 Thai provinces
    const matchedProvinces = searchLocalProvinces(val);

    // 2. Instant matching for dams
    const matchedDams = dams.filter(
      (d) =>
        (d.name && d.name.toLowerCase().includes(val)) ||
        (d.shortName && d.shortName.toLowerCase().includes(val)) ||
        (d.province && d.province.toLowerCase().includes(val)) ||
        (d.basin && d.basin.toLowerCase().includes(val))
    );

    // 3. Instant matching for stations
    const matchedStations = stations.filter(
      (s) =>
        (s.code && s.code.toLowerCase().includes(val)) ||
        (s.shortName && s.shortName.toLowerCase().includes(val)) ||
        (s.name && s.name.toLowerCase().includes(val)) ||
        (s.province && s.province.toLowerCase().includes(val)) ||
        (s.amphoe && s.amphoe.toLowerCase().includes(val)) ||
        (s.river && s.river.toLowerCase().includes(val)) ||
        (s.basin && s.basin.toLowerCase().includes(val))
    );

    renderSearchResults({
      query,
      provinces: matchedProvinces,
      dams: matchedDams,
      stations: matchedStations,
      locations: [],
      isLoadingLocations: val.length >= 2
    });

    // 4. Async Geocoding for Districts (อำเภอ/เขต) and Subdistricts (ตำบล/แขวง) via OSM Nominatim
    if (val.length >= 2) {
      if (searchAbortController) searchAbortController.abort();
      searchAbortController = new AbortController();

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(async () => {
        const locations = await searchThaiLocations(query, searchAbortController.signal);
        locations.forEach((loc) => recentGeoResults.set(loc.id, loc));

        renderSearchResults({
          query,
          provinces: matchedProvinces,
          dams: matchedDams,
          stations: matchedStations,
          locations,
          isLoadingLocations: false
        });
      }, 250);
    }
  }

  function renderSearchResults({ query, provinces, dams: matchedDams, stations: matchedStations, locations, isLoadingLocations }) {
    const totalFound = provinces.length + matchedDams.length + matchedStations.length + locations.length;

    if (totalFound === 0 && !isLoadingLocations) {
      dropdown.innerHTML = `<div style="padding: 14px; color: #5f6368; font-size: 13px; text-align: center;">ไม่พบข้อมูลของ "${query}"</div>`;
      dropdown.style.display = 'block';
      return;
    }

    let itemsHtml = '';

    // Render Provinces (จังหวัด)
    if (provinces.length > 0) {
      itemsHtml += provinces.slice(0, 4).map((p) => `
        <div class="gmaps-drop-item" data-type="province" data-id="${p.id}">
          <div style="font-size: 18px; margin-right: 10px;">🏛️</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${p.fullName}
            </div>
            <div style="font-size: 11.5px; color: #5f6368;">ประเทศไทย (พิกัด: ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)})</div>
          </div>
          <span style="font-size: 11px; font-weight: 600; color: #4338ca; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            จังหวัด
          </span>
        </div>
      `).join('');
    }

    // Render Administrative Locations (ตำบล / อำเภอ / สถานที่ จาก Geocoder)
    if (locations.length > 0) {
      itemsHtml += locations.map((loc) => `
        <div class="gmaps-drop-item" data-type="location" data-id="${loc.id}">
          <div style="font-size: 18px; margin-right: 10px;">${loc.icon}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #1e293b; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${loc.name}
            </div>
            <div style="font-size: 11.5px; color: #5f6368; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${loc.subtitle}
            </div>
          </div>
          <span style="font-size: 10.5px; font-weight: 600; color: #0369a1; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            ${loc.typeLabel}
          </span>
        </div>
      `).join('');
    }

    // Render Dams (เขื่อน)
    if (matchedDams.length > 0) {
      itemsHtml += matchedDams.slice(0, 4).map((d) => `
        <div class="gmaps-drop-item" data-type="dam" data-id="${d.id}">
          <div style="font-size: 18px; margin-right: 10px;">🏢</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #0369a1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${d.name}
            </div>
            <div style="font-size: 11.5px; color: #5f6368;">จ.${d.province} · ${d.basin} (${d.agency})</div>
          </div>
          <span style="font-size: 11px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            น้ำ ${d.percentStorage}%
          </span>
        </div>
      `).join('');
    }

    // Render Stations (สถานีตรวจวัดน้ำ)
    if (matchedStations.length > 0) {
      itemsHtml += matchedStations
        .slice(0, 8)
        .map((st) => {
          let badgeColor = '#188038';
          let badgeText = 'ปกติ';
          if (st.status === 'critical' || st.isOverflow) {
            badgeColor = '#d93025';
            badgeText = 'ล้นตลิ่ง';
          } else if (st.status === 'warning') {
            badgeColor = '#f29900';
            badgeText = 'เฝ้าระวัง';
          } else if (st.status === 'low') {
            badgeColor = '#64748b';
            badgeText = 'น้ำน้อย';
          }

          return `
            <div class="gmaps-drop-item" data-type="station" data-id="${st.id}">
              <div style="font-size: 16px; margin-right: 10px; color: ${badgeColor};">📍</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: #202124; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${st.name}
                </div>
                <div style="font-size: 11.5px; color: #5f6368; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  จ.${st.province} · ${st.river} (${st.agency || 'สสน.'})
                </div>
              </div>
              <span style="font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeColor}15; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                ${badgeText}
              </span>
            </div>
          `;
        })
        .join('');
    }

    if (isLoadingLocations) {
      itemsHtml += `
        <div style="padding: 8px 12px; font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 6px; background: #f8fafc; border-top: 1px dashed #e2e8f0;">
          <span>🔍 กำลังค้นหาตำบล / อำเภอเพิ่มเติม...</span>
        </div>
      `;
    }

    dropdown.innerHTML = itemsHtml;
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.gmaps-drop-item').forEach((item) => {
      item.addEventListener('click', () => {
        const type = item.getAttribute('data-type');
        const id = item.getAttribute('data-id');

        if (type === 'province') {
          const prov = provinces.find((p) => String(p.id) === String(id));
          if (prov && onSearchSelect) onSearchSelect(prov);
        } else if (type === 'location') {
          const loc = recentGeoResults.get(id);
          if (loc && onSearchSelect) onSearchSelect(loc);
        } else if (type === 'dam') {
          const dam = dams.find((d) => String(d.id) === String(id));
          if (dam && onSearchSelect) onSearchSelect({ ...dam, isDam: true });
        } else {
          const st = stations.find((s) => String(s.id) === String(id));
          if (st && onSearchSelect) onSearchSelect(st);
        }
        dropdown.style.display = 'none';
        searchInput.value = '';
      });
    });
  }

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  overlay.querySelector('#gmaps-search-submit').addEventListener('click', () => {
    handleSearch(searchInput.value);
  });

  document.addEventListener('click', (e) => {
    const searchWidget = overlay.querySelector('#gmaps-top-widget');
    if (searchWidget && !searchWidget.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Mobile 3-Column Grid "รายละเอียดแผนที่" Layer Definitions (Matching Attached Screenshot)
  const MOBILE_LAYER_ITEMS = [
    {
      id: 'flood-now',
      name: 'น้ำท่วมปัจจุบัน',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#e0f2fe"/>
        <path d="M8 26C12 23 16 23 20 26C24 29 28 29 32 26C36 23 40 23 44 26V38C44 41 41 44 38 44H10C7 44 4 41 4 38V30C4 28 6 27 8 26Z" fill="#0284c7" opacity="0.3"/>
        <path d="M6 31C10 28 15 28 19 31C23 34 27 34 31 31C35 28 40 28 44 31V38C44 41.3 41.3 44 38 44H10C6.7 44 4 41.3 4 38V33C4 32 5 31.3 6 31Z" fill="#0284c7"/>
        <circle cx="24" cy="18" r="7" fill="#ef4444"/>
        <circle cx="24" cy="18" r="4" fill="#ffffff"/>
        <path d="M24 14V17M24 19V20" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'traffic',
      name: 'การจราจร',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#ecfdf5"/>
        <path d="M10 24H38" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/>
        <path d="M24 10V38" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/>
        <path d="M10 24H24" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
        <path d="M24 24H38" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
        <path d="M24 10V24" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
        <path d="M24 24V38" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
        <circle cx="24" cy="24" r="3" fill="#ffffff"/>
      </svg>`
    },
    {
      id: 'doh-roads',
      name: 'น้ำท่วมทางหลวง',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#fef2f2"/>
        <path d="M16 40L21 12H27L32 40H16Z" fill="#64748b"/>
        <line x1="24" y1="14" x2="24" y2="20" stroke="#ffffff" stroke-width="2" stroke-dasharray="3 3"/>
        <line x1="24" y1="24" x2="24" y2="38" stroke="#ffffff" stroke-width="2" stroke-dasharray="3 3"/>
        <circle cx="24" cy="27" r="10" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
        <path d="M19 27H29" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'dams',
      name: 'เขื่อน & อ่างน้ำ',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#e0f2fe"/>
        <path d="M10 20C10 20 16 16 24 16C32 16 38 20 38 20V24L34 36H14L10 24V20Z" fill="#0284c7"/>
        <line x1="18" y1="20" x2="18" y2="36" stroke="#ffffff" stroke-width="2"/>
        <line x1="24" y1="18" x2="24" y2="36" stroke="#ffffff" stroke-width="2"/>
        <line x1="30" y1="20" x2="30" y2="36" stroke="#ffffff" stroke-width="2"/>
        <path d="M6 38C12 36 18 36 24 38C30 40 36 40 42 38" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'stations',
      name: 'สถานีวัดน้ำ',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#eff6ff"/>
        <circle cx="24" cy="18" r="8" fill="#1a73e8"/>
        <path d="M24 26V38" stroke="#1a73e8" stroke-width="3" stroke-linecap="round"/>
        <path d="M16 38H32" stroke="#1a73e8" stroke-width="3" stroke-linecap="round"/>
        <circle cx="24" cy="18" r="3.5" fill="#ffffff"/>
        <path d="M14 12C11 15 11 21 14 24" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        <path d="M34 12C37 15 37 21 34 24" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'forecast-7d',
      name: 'เสี่ยงภัย 7 วัน',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#fff7ed"/>
        <path d="M24 9L39 36H9L24 9Z" fill="#f97316" stroke="#ea580c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M24 19V27M24 31V32" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="29" y="8" width="14" height="12" rx="4" fill="#ea580c"/>
        <text x="36" y="17" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">7D</text>
      </svg>`
    },
    {
      id: 'sat-water',
      name: 'เรดาร์ฝนสด',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#ecfeff"/>
        <circle cx="24" cy="24" r="16" stroke="#06b6d4" stroke-width="2" fill="#0891b2" fill-opacity="0.1"/>
        <circle cx="24" cy="24" r="10" stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="2 2"/>
        <circle cx="24" cy="24" r="4" fill="#06b6d4"/>
        <path d="M24 24L36 14" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M24 8A16 16 0 0 1 36 14" fill="#06b6d4" fill-opacity="0.25"/>
      </svg>`
    },
    {
      id: 'ecmwf',
      name: 'พยากรณ์ฝน',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#eef2ff"/>
        <path d="M14 26C11.8 26 10 24.2 10 22C10 20 11.5 18.3 13.5 18.1C14.3 14.6 17.4 12 21 12C25.4 12 29 15.6 29 20C29 20.3 29 20.7 28.9 21C30.7 21.2 32 22.7 32 24.5C32 26.4 30.4 28 28.5 28H14" fill="#6366f1"/>
        <line x1="16" y1="32" x2="14" y2="38" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="22" y1="32" x2="20" y2="38" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="28" y1="32" x2="26" y2="38" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'traffy-flood',
      name: 'Traffy Fondue',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#fffbeb"/>
        <circle cx="24" cy="22" r="12" fill="#f59e0b"/>
        <path d="M24 34L20 28H28L24 34Z" fill="#f59e0b"/>
        <path d="M17 21L24 15L31 21" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="24" cy="23" r="2.5" fill="#ffffff"/>
      </svg>`
    },
    {
      id: 'wind-field',
      name: 'กระแสลม',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#f0fdf4"/>
        <path d="M8 18H28C31 18 33 16 33 14C33 12 31 10 28 10C25 10 24 12 24 13" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M12 24H34C37 24 39 26 39 28C39 30 37 32 34 32C31 32 30 30 30 29" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M8 30H22C24 30 25 31 25 32C25 33 24 34 22 34" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'flow-direction',
      name: 'ทิศทางน้ำไหล',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#f0f9ff"/>
        <path d="M12 14C18 14 20 24 26 24C32 24 34 14 40 14" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 26C18 26 20 36 26 36C32 36 34 26 40 26" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
        <path d="M36 22L41 26L36 30" fill="#0284c7"/>
      </svg>`
    },
    {
      id: 'dmr-geology',
      name: 'ธรณีวิทยา',
      iconSvg: `<svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <rect width="48" height="48" rx="12" fill="#faf5ff"/>
        <path d="M8 36L20 18L28 28L34 20L42 36H8Z" fill="#a855f7" opacity="0.3"/>
        <path d="M8 36L18 22L26 32L32 24L40 36H8Z" fill="#9333ea"/>
        <line x1="12" y1="32" x2="36" y2="32" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="2 2"/>
      </svg>`
    }
  ];

  // Collapsible Layer Menu Bar (Hide Menu Bar)
  const layerPanel = overlay.querySelector('#gmaps-layer-panel');
  const toggleBtn = overlay.querySelector('#btn-toggle-layer-panel');
  const toggleBtnText = toggleBtn.querySelector('.toggle-btn-text');
  const toggleBtnArrow = toggleBtn.querySelector('.toggle-btn-arrow');
  const layerHeader = overlay.querySelector('#gmaps-layer-header');

  const mobileSheet = overlay.querySelector('#gmaps-mobile-layer-sheet');
  const mobileBackdrop = overlay.querySelector('#gmaps-mobile-layer-backdrop');
  const mobileCloseBtn = overlay.querySelector('#btn-close-mobile-layers');
  const mobileGrid = overlay.querySelector('#mobile-layer-grid');

  function openMobileLayerSheet() {
    syncMobileCards();
    if (mobileSheet) mobileSheet.classList.add('open');
    if (mobileBackdrop) mobileBackdrop.classList.add('open');
  }

  function closeMobileLayerSheet() {
    if (mobileSheet) mobileSheet.classList.remove('open');
    if (mobileBackdrop) mobileBackdrop.classList.remove('open');
  }

  function syncMobileCards() {
    if (!mobileGrid) return;
    const cards = mobileGrid.querySelectorAll('.mobile-layer-card-btn');
    cards.forEach((btn) => {
      const lid = btn.dataset.layer;
      const chk = overlay.querySelector(`input[data-layer="${lid}"]`);
      const isActive = chk ? chk.checked : false;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderMobileLayerGrid() {
    if (!mobileGrid) return;
    mobileGrid.innerHTML = MOBILE_LAYER_ITEMS.map((item) => {
      const chk = overlay.querySelector(`input[data-layer="${item.id}"]`);
      const isActive = chk ? chk.checked : false;
      return `
        <button class="mobile-layer-card-btn ${isActive ? 'active' : ''}" data-layer="${item.id}" type="button" aria-pressed="${isActive ? 'true' : 'false'}" aria-label="${item.name}">
          <div class="mobile-layer-card-thumb">
            ${item.iconSvg}
          </div>
          <span class="mobile-layer-card-name">${item.name}</span>
        </button>
      `;
    }).join('');

    mobileGrid.querySelectorAll('.mobile-layer-card-btn').forEach((btn) => {
      let lastTrigger = 0;
      const handleToggle = (e) => {
        const now = Date.now();
        if (now - lastTrigger < 250) return;
        lastTrigger = now;
        e.stopPropagation();
        const lid = btn.dataset.layer;
        const chk = overlay.querySelector(`input[data-layer="${lid}"]`);
        if (chk) {
          chk.checked = !chk.checked;
          chk.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (onLayerToggle) {
          const nowActive = !btn.classList.contains('active');
          btn.classList.toggle('active', nowActive);
          onLayerToggle(lid, nowActive);
        }
        syncMobileCards();
      };

      btn.addEventListener('click', handleToggle);
      btn.addEventListener('touchend', handleToggle);
    });
  }

  renderMobileLayerGrid();

  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMobileLayerSheet();
    });
  }
  if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMobileLayerSheet();
    });
    mobileBackdrop.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      closeMobileLayerSheet();
    }, { passive: true });
  }

  if (mobileSheet) {
    mobileSheet.addEventListener('click', (e) => e.stopPropagation());
    mobileSheet.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    mobileSheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    mobileSheet.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    mobileSheet.addEventListener('pointerdown', (e) => e.stopPropagation());
    mobileSheet.addEventListener('pointermove', (e) => e.stopPropagation());
  }

  // Mobile Webview requirement: Start collapsed as an icon on mobile screens
  if (window.innerWidth <= 768) {
    layerPanel.classList.add('collapsed');
    toggleBtnText.textContent = 'แสดง';
    toggleBtnArrow.textContent = '▴';
  }

  function togglePanelCollapse(e) {
    if (e) e.stopPropagation();
    if (window.innerWidth <= 768) {
      if (mobileSheet && mobileSheet.classList.contains('open')) {
        closeMobileLayerSheet();
      } else {
        openMobileLayerSheet();
      }
      return;
    }
    const isCollapsed = layerPanel.classList.toggle('collapsed');
    if (isCollapsed) {
      toggleBtnText.textContent = 'แสดง';
      toggleBtnArrow.textContent = '▴';
    } else {
      toggleBtnText.textContent = 'ซ่อน';
      toggleBtnArrow.textContent = '▾';
    }
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    togglePanelCollapse(e);
  });
  layerHeader.addEventListener('click', (e) => {
    if (e.target.closest('#btn-toggle-layer-panel')) return;
    // If collapsed (or in mobile icon mode), clicking anywhere on the icon/header triggers it
    if (layerPanel.classList.contains('collapsed') || window.innerWidth <= 768) {
      e.stopPropagation();
      e.preventDefault();
      togglePanelCollapse(e);
    }
  });

  // Close layer panel on mobile when tapping outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mobileSheet && mobileSheet.classList.contains('open')) {
        if (!mobileSheet.contains(e.target) && !layerPanel.contains(e.target) && !e.target.closest('#gmaps-mobile-layer-sheet') && !e.target.closest('#gmaps-layer-panel')) {
          closeMobileLayerSheet();
        }
      }
      if (!layerPanel.classList.contains('collapsed')) {
        if (!layerPanel.contains(e.target) && !e.target.closest('#gmaps-btn-north')) {
          layerPanel.classList.add('collapsed');
          toggleBtnText.textContent = 'แสดง';
          toggleBtnArrow.textContent = '▴';
        }
      }
    }
  });

  // North Button Controller (Reset map rotation to North)
  const northBtn = overlay.querySelector('#gmaps-btn-north');
  const compassIcon = overlay.querySelector('.gmaps-north-compass-icon');

  function handleResetNorth(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (options.onResetNorth) {
      options.onResetNorth();
    } else {
      window.dispatchEvent(new CustomEvent('thaiflood:reset-north'));
    }
  }

  if (northBtn) {
    northBtn.addEventListener('click', handleResetNorth);
    northBtn.addEventListener('touchend', handleResetNorth);
  }

  window.addEventListener('thaiflood:map-rotate', (e) => {
    if (compassIcon && e.detail && typeof e.detail.bearing === 'number') {
      compassIcon.style.transform = `rotate(${-e.detail.bearing}deg)`;
    }
  });

  overlay.updateNorthBearing = (bearing) => {
    if (compassIcon && typeof bearing === 'number') {
      compassIcon.style.transform = `rotate(${-bearing}deg)`;
    }
  };

  // Layer switches change event
  const switches = overlay.querySelectorAll('.gmaps-switch input[type="checkbox"]');
  switches.forEach((sw) => {
    sw.addEventListener('change', (e) => {
      const layerId = e.target.dataset.layer;
      const isChecked = e.target.checked;
      if (onLayerToggle) onLayerToggle(layerId, isChecked);
      syncMobileCards();

      // Auto toggle legend visibility for satellite, radar, geology, GFS, and ECMWF layers
      if (layerId === 'sat-water') {
        const leg = overlay.querySelector('#legend-sat-water');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'sat-clouds') {
        const leg = overlay.querySelector('#legend-sat-clouds');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'dmr-geology') {
        const leg = overlay.querySelector('#legend-dmr-geology');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'gfs') {
        const leg = overlay.querySelector('#legend-gfs');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'ecmwf') {
        const leg = overlay.querySelector('#legend-ecmwf');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'doh-roads') {
        const leg = overlay.querySelector('#legend-doh-roads');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'bma-roads') {
        const leg = overlay.querySelector('#legend-bma-roads');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'traffy-flood') {
        const leg = overlay.querySelector('#legend-traffy-flood');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'traffic') {
        const leg = overlay.querySelector('#legend-traffic');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'dams') {
        const leg = overlay.querySelector('#legend-dams');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      } else if (layerId === 'wind-field') {
        const leg = overlay.querySelector('#legend-wind-field');
        if (leg) leg.style.display = isChecked ? 'block' : 'none';
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileLayerSheet();
    }
  });

  // Left Drawer (Hamburger Menu, Alerts Stack, Sources, Developer)
  const hamburgerBtn = overlay.querySelector('#gmaps-hamburger-btn');
  const drawer = overlay.querySelector('#gmaps-drawer');
  const drawerBackdrop = overlay.querySelector('#gmaps-drawer-backdrop');
  const drawerCloseBtn = overlay.querySelector('#drawer-close-btn');

  function updateVisitorBadge() {
    getVisitorCount().then((count) => {
      const badge = overlay.querySelector('#visitor-count-badge');
      if (badge && count) {
        badge.textContent = `${count} ครั้ง`;
      }
    }).catch(() => {});
  }
  updateVisitorBadge();

  function openDrawer(tabName = null) {
    drawer.classList.add('open');
    drawerBackdrop.classList.add('open');
    updateVisitorBadge();
    if (tabName) {
      switchDrawerTab(tabName);
    }
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
  }

  if (drawer) drawer.addEventListener('click', (e) => e.stopPropagation());
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => openDrawer());
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  // Drawer Tabs Switching
  const tabBtns = overlay.querySelectorAll('.drawer-tab-btn');
  const tabPanes = overlay.querySelectorAll('.drawer-tab-pane');

  function switchDrawerTab(tabId) {
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabId}`);
    });
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = btn.getAttribute('data-tab');
      switchDrawerTab(tabId);
    });
  });

  // Prepare Critical Alert Items (Stations, BMA Roads, High Dams)
  const alertItems = [];

  // 1. Stations with Overflow or Critical Status
  stations.forEach((st) => {
    if (st && (st.isOverflow || st.status === 'critical')) {
      const level = typeof st.currentLevel === 'number' ? st.currentLevel : (typeof st.waterLevel === 'number' ? st.waterLevel : 0);
      const bank = typeof st.bankCapacity === 'number' ? st.bankCapacity : 0;
      const diff = typeof st.diff === 'number' ? st.diff : (level - bank);
      const diffText = diff > 0 ? `+${diff.toFixed(2)} ม.` : '';
      const dtText = st.datetime ? `${st.datetime} น.` : (st.date ? `${st.date} ${st.time || ''} น.` : '2026-09-26 19:20 น.');
      alertItems.push({
        id: `st_${st.id}`,
        type: 'station',
        icon: '📍',
        title: st.name || `สถานี ${st.code || st.id}`,
        subtitle: `จ.${st.province || '-'} · ลำน้ำ ${st.river || 'ลุ่มน้ำหลัก'} (${st.agency || 'สสน.'})`,
        datetime: dtText,
        badge: '🔴 วิกฤตล้นตลิ่ง',
        badgeColor: '#dc2626',
        badgeBg: '#fef2f2',
        stat1Label: 'ระดับน้ำปัจจุบัน',
        stat1Val: `${level.toFixed(2)} ม.รทก.`,
        stat2Label: 'ระดับตลิ่งวิกฤต',
        stat2Val: bank > 0 ? `${bank.toFixed(2)} ม.รทก.` : 'ไม่มีข้อมูลตลิ่ง',
        note: `สถานะ: มวลน้ำล้นตลิ่ง ${diffText || st.diffDisplay || ''} เร่งระบายน้ำและเฝ้าระวังพื้นที่ลุ่มต่ำริมฝั่ง`,
        raw: st
      });
    }
  });

  // 2. Bangkok Road Flood Corridors (BMA Drainage)
  const bmaFeatures = (bmaRoads && bmaRoads.features) ? bmaRoads.features : [];
  bmaFeatures.forEach((f) => {
    const p = f.properties || {};
    const isCrit = p.riskLevel === 'critical';
    const coords = f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [];
    const centerCoord = coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [100.56, 13.78];
    const dtText = p.updatedAt ? `${p.updatedAt} 19:15 น.` : '2026-09-26 19:15 น.';
    alertItems.push({
      id: `road_${p.id}`,
      type: 'road',
      icon: '🚗',
      title: p.road || 'ถนน กทม.',
      subtitle: `${p.segment || ''} (เขต${p.district || '-'})`,
      datetime: dtText,
      badge: isCrit ? '🔴 น้ำท่วมผิวจราจรวิกฤต' : '🟠 เฝ้าระวังน้ำท่วมขัง',
      badgeColor: isCrit ? '#dc2626' : '#ea580c',
      badgeBg: isCrit ? '#fef2f2' : '#fffbeb',
      stat1Label: 'ระดับน้ำท่วมขัง',
      stat1Val: p.waterDepthCm || '15 - 25 ซม.',
      stat2Label: 'ช่องทางที่กระทบ',
      stat2Val: p.floodedLanes || '2 ช่องจราจร',
      note: p.trafficImpact || 'รถเล็กสัญจรลำบาก ควรหลีกเลี่ยงเส้นทาง',
      raw: {
        ...p,
        lng: centerCoord[0],
        lat: centerCoord[1],
        isRoad: true
      }
    });
  });

  // 3. High Storage Dams (>= 85%)
  dams.forEach((d) => {
    if (d && d.percentStorage >= 85) {
      const dtText = d.date ? `${d.date} 06:00 น.` : '2026-09-26 06:00 น.';
      alertItems.push({
        id: `dam_${d.id}`,
        type: 'dam',
        icon: '🏢',
        title: d.name,
        subtitle: `จ.${d.province} · ลุ่มน้ำ ${d.basin} (${d.agency})`,
        datetime: dtText,
        badge: '🏢 น้ำกักเก็บวิกฤต',
        badgeColor: '#dc2626',
        badgeBg: '#fef2f2',
        stat1Label: 'ปริมาตรน้ำกักเก็บ',
        stat1Val: `${(d.currentStorage || 0).toLocaleString()} ล้าน ลบ.ม.`,
        stat2Label: 'ความจุอ่างเก็บน้ำ',
        stat2Val: `${d.percentStorage || 0}%`,
        note: `การระบายน้ำ: ${d.released ? d.released.toLocaleString() : 0} ล้าน ลบ.ม./วัน เฝ้าระวังท้ายน้ำ`,
        raw: {
          ...d,
          isDam: true
        }
      });
    }
  });

  // Update counts
  const alertsBadge = overlay.querySelector('#tab-alerts-badge');
  const alertsCountText = overlay.querySelector('#alerts-count-text');
  if (alertsBadge) alertsBadge.textContent = alertItems.length;
  if (alertsCountText) alertsCountText.textContent = alertItems.length;

  // Render Alert Cards (Deck View & List View)
  const stackContainer = overlay.querySelector('#alerts-stack-container');
  const listViewContainer = overlay.querySelector('#alerts-list-view');
  const deckControls = overlay.querySelector('#alerts-deck-controls');
  const deckCounter = overlay.querySelector('#deck-counter');
  const btnPrev = overlay.querySelector('#deck-btn-prev');
  const btnNext = overlay.querySelector('#deck-btn-next');
  const btnToggleView = overlay.querySelector('#alerts-view-toggle');
  const deckView = overlay.querySelector('#alerts-deck-view');

  let activeCardIndex = 0;
  let isListView = false;

  function renderAlertCardHTML(item, index, total) {
    return `
      <div class="alert-card" data-index="${index}">
        <div class="alert-card-header">
          <div class="alert-card-type-icon">${item.icon}</div>
          <div class="alert-card-heading">
            <div class="alert-card-title">${item.title}</div>
            <div class="alert-card-sub">${item.subtitle}</div>
          </div>
          <span class="alert-card-badge" style="color: ${item.badgeColor}; background: ${item.badgeBg};">
            ${item.badge}
          </span>
        </div>
        <div class="alert-card-datetime">
          <span class="datetime-icon">🕒</span>
          <span class="datetime-label">ข้อมูล ณ วันที่/เวลา:</span>
          <b class="datetime-val">${item.datetime || 'ตรวจวัดล่าสุด'}</b>
        </div>
        <div class="alert-card-stats">
          <div class="alert-stat-box">
            <span class="stat-lbl">${item.stat1Label}</span>
            <b class="stat-val" style="color: ${item.badgeColor};">${item.stat1Val}</b>
          </div>
          <div class="alert-stat-box">
            <span class="stat-lbl">${item.stat2Label}</span>
            <b class="stat-val">${item.stat2Val}</b>
          </div>
        </div>
        <div class="alert-card-note">${item.note}</div>
        <button class="alert-card-fly-btn" data-index="${index}" type="button">
          <span>📍 ดูตำแหน่งบนแผนที่</span>
          <span class="fly-arrow">→</span>
        </button>
      </div>
    `;
  }

  function updateDeckCards() {
    if (!stackContainer) return;
    if (alertItems.length === 0) {
      stackContainer.innerHTML = `
        <div class="alerts-empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">✅</div>
          <div style="font-weight: 700; color: #166534; font-size: 14px;">ไม่มีจุดตรวจวัดหรือถนนที่อยู่ในเกณฑ์วิกฤต</div>
          <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">ระดับน้ำในลำน้ำและถนนสายสำคัญอยู่ในเกณฑ์ควบคุม</div>
        </div>
      `;
      if (deckControls) deckControls.style.display = 'none';
      return;
    }

    if (deckControls) deckControls.style.display = 'flex';
    if (deckCounter) deckCounter.textContent = `${activeCardIndex + 1} / ${alertItems.length}`;

    // Render cards into stack with circular indexing
    const total = alertItems.length;
    stackContainer.innerHTML = alertItems.map((item, idx) => {
      const circularOffset = (idx - activeCardIndex + total) % total;
      let posClass = 'hidden';
      let transform = 'translateY(80px) scale(0.8)';
      let zIndex = 1;
      let opacity = 0;
      let pointer = 'none';

      if (circularOffset === 0) {
        posClass = 'top';
        transform = 'translateY(0) scale(1)';
        zIndex = 10;
        opacity = 1;
        pointer = 'auto';
      } else if (circularOffset === 1 && total > 1) {
        posClass = 'behind-1';
        transform = 'translateY(14px) scale(0.95)';
        zIndex = 9;
        opacity = 0.85;
      } else if (circularOffset === 2 && total > 2) {
        posClass = 'behind-2';
        transform = 'translateY(28px) scale(0.90)';
        zIndex = 8;
        opacity = 0.65;
      }

      return `
        <div class="alert-stack-item ${posClass}" style="transform: ${transform}; z-index: ${zIndex}; opacity: ${opacity}; pointer-events: ${pointer};">
          ${renderAlertCardHTML(item, idx, alertItems.length)}
        </div>
      `;
    }).join('');

    // Wire up fly buttons inside deck
    stackContainer.querySelectorAll('.alert-card-fly-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const item = alertItems[idx];
        if (item && onSearchSelect) {
          closeDrawer();
          onSearchSelect(item.raw);
        }
      });
    });
  }

  function renderListView() {
    if (!listViewContainer) return;
    listViewContainer.innerHTML = alertItems.map((item, idx) => `
      <div class="alert-list-item">
        ${renderAlertCardHTML(item, idx, alertItems.length)}
      </div>
    `).join('');

    listViewContainer.querySelectorAll('.alert-card-fly-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const item = alertItems[idx];
        if (item && onSearchSelect) {
          closeDrawer();
          onSearchSelect(item.raw);
        }
      });
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (alertItems.length === 0) return;
      activeCardIndex = (activeCardIndex - 1 + alertItems.length) % alertItems.length;
      updateDeckCards();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (alertItems.length === 0) return;
      activeCardIndex = (activeCardIndex + 1) % alertItems.length;
      updateDeckCards();
    });
  }

  if (btnToggleView) {
    btnToggleView.addEventListener('click', (e) => {
      e.stopPropagation();
      isListView = !isListView;
      if (isListView) {
        deckView.style.display = 'none';
        listViewContainer.style.display = 'flex';
        btnToggleView.textContent = 'การ์ดซ้อน';
        renderListView();
      } else {
        listViewContainer.style.display = 'none';
        deckView.style.display = 'block';
        btnToggleView.textContent = 'ดูทั้งหมด';
        updateDeckCards();
      }
    });
  }

  // Initial render of alert deck
  updateDeckCards();

  // GFS Day Chips Click Handler
  const gfsDayBtns = overlay.querySelectorAll('.gfs-day-btn');
  gfsDayBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const day = parseInt(btn.getAttribute('data-day'), 10);
      gfsDayBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onGFSDayChange) onGFSDayChange(day);
    });
  });

  // Expose helper to sync active GFS day button from external controllers
  overlay.setGFSActiveDay = (dayIndex) => {
    gfsDayBtns.forEach((b) => {
      const d = parseInt(b.getAttribute('data-day'), 10);
      b.classList.toggle('active', d === dayIndex);
    });
  };

  // ECMWF Day Chips Click Handler
  const ecmwfDayBtns = overlay.querySelectorAll('.ecmwf-day-btn');
  ecmwfDayBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const day = parseInt(btn.getAttribute('data-day'), 10);
      ecmwfDayBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onECMWFDayChange) onECMWFDayChange(day);
    });
  });

  // Expose helper to sync active ECMWF day button from external controllers
  overlay.setECMWFActiveDay = (dayIndex) => {
    ecmwfDayBtns.forEach((b) => {
      const d = parseInt(b.getAttribute('data-day'), 10);
      b.classList.toggle('active', d === dayIndex);
    });
  };

  return overlay;
}
