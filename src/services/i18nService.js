/**
 * Internationalization (i18n) Service for ThaiFlood
 * Supports Thai (TH) and English (EN) localization with reactive updates,
 * dynamic API response fallback, and localStorage persistence.
 */

const STORAGE_KEY = 'thaiflood_lang';

export const TRANSLATIONS = {
  th: {
    // App & Header
    app_title: 'ThaiFlood Monitor',
    app_subtitle: 'แผนที่ติดตามสถานการณ์น้ำท่วมและพยากรณ์ฝนประเทศไทย แบบเรียลไทม์',
    drawer_subtitle: 'ระบบสารสนเทศและเตือนภัยน้ำท่วม',
    search_placeholder: 'ค้นหาจังหวัด, อำเภอ, ตำบล, สถานี, เขื่อน...',
    search_submit: 'ค้นหา',
    menu_main: 'เมนูหลัก (แจ้งเตือน / แหล่งข้อมูล)',
    close_menu: 'ปิดเมนู',

    // Drawer Tabs
    tab_alerts: 'แจ้งเตือน',
    tab_sources: 'แหล่งข้อมูล',
    tab_developer: 'ระบบ & สถิติ',

    // Drawer Alerts
    alerts_total_prefix: 'การ์ดแจ้งเตือนวิกฤตทั้งหมด',
    alerts_total_suffix: 'รายการ',
    alerts_view_all: 'ดูทั้งหมด',
    alerts_view_deck: 'มุมมองสำรับการ์ด',
    alerts_prev: '‹ ก่อนหน้า',
    alerts_next: 'ถัดไป ›',
    alerts_empty: 'ไม่มีการแจ้งเตือนวิกฤตในขณะนี้',
    alerts_critical: 'สถานการณ์วิกฤต',
    alerts_warning: 'เฝ้าระวังน้ำล้นตลิ่ง',
    alerts_normal: 'ระดับน้ำปกติ',

    // Drawer Stats
    stats_header: 'ข้อมูลระบบและสถิติผู้เข้าชม',
    stats_visitors: 'จำนวนผู้เข้าชมรวม',
    stats_api_status: 'สถานะการเชื่อมต่อ API',
    stats_status_online: 'พร้อมใช้งานปกติ',
    stats_last_sync: 'ซิงค์ข้อมูลล่าสุด',
    stats_privacy_badge: 'นโยบายความเป็นส่วนตัว: ไม่เก็บข้อมูลระบุตัวตน (Privacy-Friendly via GoatCounter)',

    // Layer Menu Header
    layer_menu_title: 'ชั้นข้อมูลแผนที่',
    layer_menu_hide: 'ซ่อน',
    layer_menu_show: 'แสดง',

    // Layers (Names & Descriptions)
    layer_flood_now: 'น้ำท่วมปัจจุบัน',
    layer_flood_now_desc: 'ขอบเขตน้ำล้นตลิ่ง · ดาวเทียม GISTDA & เซนเซอร์',
    layer_forecast_7d: 'เสี่ยงภัย 7 วัน',
    layer_forecast_7d_desc: 'คาดการณ์ล่วงหน้า 7 วัน · ดัชนีอุทกวิทยา',
    layer_dams: 'เขื่อนและอ่างเก็บน้ำ',
    layer_dams_desc: 'จุดเขื่อน & ผืนน้ำจริง · กฟผ. และ ชลประทาน',
    layer_flow_direction: 'ทิศทางน้ำไหล',
    layer_flow_direction_desc: 'ลูกศรเวกเตอร์ทิศทางกระแสน้ำ',
    layer_stations: 'สถานีวัดระดับน้ำ',
    layer_stations_desc: '1,400+ จุดวัดโทรมาตร สสน. ทั่วประเทศ',
    layer_geology: 'ธรณีวิทยา (DMR 1:250k)',
    layer_geology_desc: 'หน่วยหิน & รอยเลื่อน กรมทรัพยากรธรณี',
    layer_radar: 'เรดาร์ตรวจฝนสด (TMD Radar)',
    layer_radar_desc: 'ตรวจจับกลุ่มฝนสด · RainViewer API & กรมอุตุฯ',
    layer_himawari: 'เมฆดาวเทียม Himawari',
    layer_himawari_desc: 'ภาพถ่ายอินฟราเรดความถี่สูง · JMA Himawari-9',
    layer_wind: 'ลมผิวพื้น 10ม.',
    layer_wind_desc: 'เวกเตอร์ทิศทางและความเร็วลม · ECMWF WMO',
    layer_gfs: 'คาดการณ์ฝน GFS (สหรัฐฯ)',
    layer_gfs_desc: 'แบบจำลองฝนสะสม 24 ชม. NOAA NCEP 13 กม.',
    layer_ecmwf: 'คาดการณ์ฝน ECMWF (ยุโรป)',
    layer_ecmwf_desc: 'แบบจำลองฝนสะสม 24 ชม. ECMWF IFS 9 กม.',
    layer_traffic: 'จราจรสดบนทางหลวง',
    layer_traffic_desc: 'สภาพจราจรบนทางหลวง · กรมทางหลวง',
    layer_doh_roads: 'น้ำท่วมทางหลวง (DOH)',
    layer_doh_roads_desc: 'จุดน้ำท่วมผิวจราจร · กรมทางหลวง สายด่วน 1586',
    layer_cctv: 'กล้อง CCTV เรียลไทม์',
    layer_cctv_desc: 'กล้องตรวจการณ์ริมคลอง ทางหลวง และสันเขื่อน',
    layer_traffy: 'แจ้งเหตุ Traffy Fondue',
    layer_traffy_desc: 'เรื่องร้องเรียนน้ำท่วมจากประชาชน (NECTEC)',

    // Legends
    legend_dam_critical: '🔴 น้ำวิกฤต: ≥ 80% (น้ำมาก)',
    legend_dam_watch: '🟠 เฝ้าระวัง: 60% – 79.9% (น้ำมาก)',
    legend_dam_normal: '🔵 เกณฑ์ปกติ: 30% – 59.9%',
    legend_dam_low: '🟡 น้ำน้อย: < 30%',
    legend_dam_note: '💡 สีของสัญลักษณ์เขื่อนสะท้อนตาม % ปริมาตรน้ำกักเก็บจริงแบบเรียลไทม์',
    legend_doh_passable: '🟢 ผ่านได้ด้วยความระมัดระวัง',
    legend_doh_impassable: '🔴 ผ่านไม่ได้ (ทางขาด/น้ำท่วมสูง)',
    legend_doh_note: '💡 ข้อมูลสดจากศูนย์บริหารงานอุบัติภัย กรมทางหลวง (สายด่วน 1586)',
    legend_geol_colors: 'หมวดหมู่และหน่วยหิน (Rock Units)',
    legend_geol_faults: 'รอยเลื่อนและแนวโครงสร้างธรณี',
    legend_geol_note: '💡 คลิกบนแผนที่เพื่อดูชื่อหน่วยหินและคำอธิบาย',
    legend_radar_note: '💡 กลุ่มฝนสดความละเอียดสูง 512px จากสถานีเรดาร์ทั่วประเทศ',
    legend_cctv_note: '💡 คลิกที่กล้องเพื่อเปิดภาพสด CCTV ตรวจการณ์ริมน้ำและสันเขื่อน',
    legend_traffy_note: '💡 ข้อมูลแจ้งเหตุน้ำท่วมจากประชาชนผ่าน Traffy Fondue สวทช.',

    // Basemaps
    basemap_label: 'ประเภทแผนที่',
    basemap_trigger_title: 'คลิกหรือวางเมาส์เพื่อเลือกประเภทแผนที่',
    basemap_expand_arrow_title: 'แสดงตัวเลือกแผนที่อื่น',
    basemap_street: 'แผนที่',
    basemap_street_title: 'แผนที่มาตรฐาน (OpenStreetMap)',
    basemap_satellite: 'ดาวเทียม',
    basemap_satellite_title: 'ภาพถ่ายดาวเทียม (ESRI World Imagery)',
    basemap_topo: 'ภูมิประเทศ',
    basemap_topo_title: 'ภูมิประเทศ เส้นชั้นความสูง (OpenTopoMap)',
    basemap_3d: '3D',

    // Floating Map HUD & Controls
    dem_title: 'DEM & คอนทัวร์ L7018:',
    dem_hover: 'เลื่อนเมาส์บนแผนที่',
    dem_unit: 'เพื่อวัดระดับความสูงดิน',
    weather_pill_loading: 'กำลังโหลด...',
    weather_pill_title: 'สภาพอากาศและอุณหภูมิตามขอบเขตจังหวัด (คลิกดูพยากรณ์ 7 วัน)',
    disclaimer_title: 'แบบจำลองขอบเขตน้ำท่วมสร้างขึ้นจากการประมาณการณ์เชิงอุทกวิทยา โปรดตรวจสอบระดับน้ำจริงจากสถานีตรวจวัด',
    disclaimer_text: 'ภาพจำลองเชิงอุทกวิทยา: ข้อมูลประมาณการทางคณิตศาสตร์ · ตรวจสอบระดับน้ำจริงที่หมุดสถานี',
    ctrl_north: 'ปรับแผนที่ระนาบทิศเหนือ (North-up)',
    ctrl_locate: 'ตำแหน่งของฉัน',
    ctrl_locate_title: 'ตำแหน่งของฉัน (Locate Me)',
    ctrl_locate_found: 'ตำแหน่งของฉัน (ตรวจพบพิกัดแล้ว)',
    ctrl_zoom_in: 'ซูมเข้า',
    toast_north_reset: 'ปรับแผนที่ระนาบทิศเหนือ (North-up)',
    toast_layer_flow: 'เปิดเลเยอร์เวกเตอร์ทิศทางการไหลของน้ำ (Flow Vectors)',
    toast_layer_stations: 'เปิดเลเยอร์สถานีวัดระดับน้ำโทรมาตร (สสน.)',
    toast_layer_cctv: 'เปิดเลเยอร์กล้อง CCTV ทางหลวงและจุดตรวจน้ำ (ภาพสด)',
    toast_layer_doh: 'เปิดเลเยอร์น้ำท่วมทางหลวงทั่วประเทศ (กรมทางหลวง DOH สายด่วน 1586)',
    toast_layer_traffy: 'เปิดเลเยอร์น้ำท่วมขัง Traffy Fondue',
    toast_layer_traffic: 'เปิดชั้นข้อมูลสภาพการจราจรสด (Highway Traffic)',
    toast_layer_wind: 'เปิดเลเยอร์กระแสลมผิวพื้น 10 ม. (Wind Field Map)',
    toast_3d_on: 'เปิดมุมมอง 3D พร้อมแบบจำลองอาคาร (3D Buildings)',
    toast_3d_off: 'กลับสู่มุมมอง 2D ระนาบมาตรฐาน',
    toast_sat_2d: 'โหมดภาพถ่ายดาวเทียมแสดงผลแบบ 2D ระนาบแท้ (ปิด 3D)',
    toast_locate_unsupported: 'เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด Geolocation',
    toast_locate_searching: 'กำลังค้นหาตำแหน่งปัจจุบันของคุณจาก GPS...',
    toast_locate_found_prefix: 'พบพิกัดของคุณแล้ว (ความแม่นยำ ±',
    toast_locate_found_suffix: ' ม.)',
    toast_locate_permission_denied: 'ไม่ได้รับอนุญาตให้เข้าถึงพิกัด (กรุณากด Allow หรือ อนุญาต บนเบราว์เซอร์)',
    toast_locate_unavailable: 'ไม่พบสัญญาณตำแหน่งหรือ GPS (Position Unavailable)',
    toast_locate_timeout: 'หมดเวลาค้นหาพิกัด (Geolocation Timeout)',
    toast_locate_error: 'ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่อีกครั้ง',
    toast_wind_point_prefix: '💨 ลมผิวพื้น 10 ม.:',

    // Wind Legend Floating Box
    wind_legend_title: 'กระแสลมผิวพื้น 10 เมตร (WMO Scale)',
    wind_legend_units: 'm/s & กม./ชม.',
    wind_legend_calm: '0 (ลมอ่อน)',
    wind_legend_mod: '5 m/s (18 กม./ชม.)',
    wind_legend_strong: '12 m/s (43 กม./ชม.)',
    wind_legend_gale: '24+ m/s (พายุ)',
    wind_legend_tip: '💡 คลิกบนแผนที่ ณ พิกัดใดก็ได้เพื่ออ่านค่าความเร็วและทิศทางลมสด',

    // DEM Landform Descriptions
    dem_desc_sea: 'พื้นที่ปากน้ำ / ระดับต่ำมาก (น้ำทะเลหนุน)',
    dem_desc_basin: 'แอ่งที่ราบลุ่มต่ำ / ทุ่งรับน้ำ (เสี่ยงน้ำท่วมสูง)',
    dem_desc_floodplain: 'ที่ราบลุ่มน้ำท่วมถึง (Floodplain)',
    dem_desc_terrace: 'ตะพักลำน้ำ / คันดินดอน (Terrace / Levee)',
    dem_desc_high: 'ที่ดอน / เนินสูง ปลอดภัยจากน้ำท่วมขังทั่วไป',

    // Rule Curve 3-Zone Tooltips
    rc_gauge_low: 'โซนน้ำน้อย (ต่ำกว่า LRC): 0 - {lrc}%',
    rc_gauge_normal: 'โซนควบคุมปกติ (LRC - URC): {lrc}% - {urc}%',
    rc_gauge_high: 'โซนเสี่ยงน้ำล้น (เหนือ URC): {urc}% - 100%',

    // Alert Deck Extra Labels
    alerts_overbank_badge: '🔴 วิกฤตล้นตลิ่ง',
    alerts_dam_critical_badge: '🏢 น้ำกักเก็บวิกฤต',
    alerts_overbank_note: 'สถานะ: มวลน้ำล้นตลิ่ง เร่งระบายน้ำและเฝ้าระวังพื้นที่ลุ่มต่ำริมฝั่ง',
    alerts_dam_note: 'การระบายน้ำ: เฝ้าระวังผลกระทบพื้นที่ท้ายน้ำ',
    alerts_prov_prefix: 'จ.',
    alerts_river_prefix: 'ลำน้ำ',
    alerts_basin_prefix: 'ลุ่มน้ำ',
    alerts_issues_unit: 'เรื่อง',

    // Place Sheet & Popups
    sheet_close: 'ปิดแผงข้อมูล',
    sheet_station_title: 'สถานีวัดระดับน้ำโทรมาตร',
    sheet_dam_title: 'เขื่อนและอ่างเก็บน้ำ',
    sheet_cctv_title: 'กล้อง CCTV ตรวจการณ์ทางการ',
    sheet_doh_title: 'รายงานสถานการณ์น้ำท่วมทางหลวง',
    sheet_traffy_title: 'รายงานน้ำท่วม Traffy Fondue',
    sheet_water_level: 'ระดับน้ำปัจจุบัน',
    sheet_water_level_msl: 'ระดับน้ำจริง (ม. รทก.)',
    sheet_bank_level: 'ระดับตลิ่ง',
    sheet_bank_empty: 'ไม่มีข้อมูลระดับตลิ่ง',
    sheet_capacity: 'ความจุลำน้ำ',
    sheet_rule_curve: 'เกณฑ์ควบคุมน้ำในอ่าง (Rule Curve)',
    sheet_cctv_connecting: 'กำลังเชื่อมต่อสัญญาณภาพสด...',
    sheet_cctv_offline: 'สัญญาณกล้องชั่วคราวไม่พร้อมใช้งาน (โปรดดูผ่านพอร์ทัลทางการ)',
    sheet_cctv_official_portal: 'เปิดชมสตรีมสดผ่านพอร์ทัลทางการ',
    sheet_cctv_refresh: 'รีเฟรชภาพสด',
    sheet_passable: 'ยานพาหนะผ่านได้',
    sheet_impassable: 'ยานพาหนะผ่านไม่ได้ (ทางขาด/น้ำท่วมสูง)',
    sheet_source: 'ที่มาของข้อมูล',
    sheet_flow_rate: 'อัตราการไหล',
    sheet_storage: 'ปริมาตรน้ำกักเก็บ',
    sheet_inflow: 'น้ำไหลลงอ่าง',
    sheet_released: 'การระบายน้ำ',
    sheet_trend: 'แนวโน้มระดับน้ำ',
    sheet_trend_rising: 'เพิ่มขึ้น',
    sheet_trend_falling: 'ลดลง',
    sheet_trend_stable: 'ทรงตัว',
    sheet_overflow_warning: 'มวลน้ำล้นตลิ่งเข้าท่วมพื้นที่ลุ่มต่ำริมน้ำ',
    sheet_near_bank_warning: 'ระดับน้ำใกล้ตลิ่ง เข้าสู่เกณฑ์เฝ้าระวังภัย',
    sheet_normal_info: 'ระดับน้ำในแม่น้ำยังอยู่ภายใต้เกณฑ์ควบคุม',
    sheet_zoom_point: 'ซูมดูพิกัด',
    sheet_weather_forecast: 'พยากรณ์อากาศ',
    sheet_hotline_1586: 'สายด่วน 1586',
    // Alert Card Labels
    alerts_datetime_label: 'ข้อมูล ณ วันที่/เวลา:',
    alerts_fly_btn: '📍 ดูตำแหน่งบนแผนที่',
    alerts_empty_title: 'ไม่มีจุดตรวจวัดหรือถนนที่อยู่ในเกณฑ์วิกฤต',
    alerts_empty_desc: 'ระดับน้ำในลำน้ำและถนนสายสำคัญอยู่ในเกณฑ์ควบคุม',

    // Layer Legends Detailed
    legend_sat_water_light: 'ฝนเบา (15-25 dBZ)',
    legend_sat_water_medium: 'ปานกลาง (35 dBZ)',
    legend_sat_water_heavy: 'ฝนหนัก/ลูกเห็บ (>50 dBZ)',
    legend_sat_clouds_light: 'ฝนเบา',
    legend_sat_clouds_medium: 'ปานกลาง',
    legend_sat_clouds_heavy: 'พายุ/ฝนหนักมาก',
    legend_forecast_day_select: '📅 เลือกวันพยากรณ์ล่วงหน้า (0 - 6 วัน):',
    legend_today: 'วันนี้',
    legend_day_plus: '+{day} วัน',
    legend_scale_low: '1-10 มม.',
    legend_scale_med: '25 มม.',
    legend_scale_high: '50 มม.',
    legend_scale_extreme: '>90 มม.',
    legend_gfs_note: '💡 แบบจำลอง Global Forecast System (NOAA/NCEP) ความละเอียด 13 กม. ปรับดูฝนล่วงหน้า 7 วัน',
    legend_ecmwf_note: '💡 แบบจำลอง European Centre for Medium-Range Weather Forecasts (ECMWF IFS 9km) มาตรฐานความแม่นยำสูงสุด',
    legend_traffy_pending: '🟠 รอรับเรื่อง / กำลังดำเนินการแก้ไข',
    legend_traffy_resolved: '🟢 ดำเนินการเสร็จสิ้น / น้ำลดแล้ว',
    legend_traffic_green: '🟢 การจราจรคล่องตัว (> 45 กม./ชม.)',
    legend_traffic_orange: '🟠 การจราจรชะลอตัว (20 - 45 กม./ชม.)',
    legend_traffic_red: '🔴 การจราจรติดขัดมาก (< 20 กม./ชม.)',
    legend_traffic_note: '💡 ข้อมูลสภาพการจราจรสดแบบ Real-time แสดงเส้นทางหลักและทางหลวงทั่วประเทศ',
    legend_wind_light: '0-2 m/s (ลมอ่อน)',
    legend_wind_med: '8 m/s (ปานกลาง)',
    legend_wind_storm: '>24 m/s (พายุ)',
    legend_wind_note: '💡 จำลองเวกเตอร์ความเร็วลม (u, v) ณ ระดับผิวพื้น 10 เมตร ตามเกณฑ์องค์การอุตุนิยมวิทยาโลก (WMO)',
    legend_cctv_live_label: 'กล้อง CCTV สด: กรมทางหลวง, สำนักการระบายน้ำ กทม., กรมชลประทาน',
    legend_ts_radar_prefix: '🕒 ตรวจวัดเรดาร์ล่าสุด:',
    legend_ts_clouds_prefix: '🕒 ภาพดาวเทียมล่าสุด:',

    // Units
    unit_m: 'ม.',
    unit_m_msl: 'ม. (รทก.)',
    unit_cm: 'ซม.',
    unit_km: 'กม.',
    unit_mm: 'มม.',
    unit_celsius: '°C',
    unit_kmh: 'กม./ชม.',
    unit_m3_s: 'ลบ.ม./วินาที',
    unit_million_m3: 'ล้าน ลบ.ม.',
    unit_million_m3_day: 'ล้าน ลบ.ม./วัน',

    // Static Labels & Advisories in Place Sheet
    sheet_last_telemetry: 'วันและเวลาตรวจวัดล่าสุด',
    sheet_operating_agency: 'หน่วยงานรับผิดชอบ',
    sheet_water_trend: 'แนวโน้มระดับน้ำ',
    sheet_trend_rising: '⬆️ กำลังเพิ่มขึ้น',
    sheet_trend_falling: '⬇️ กำลังลดลง',
    sheet_trend_stable: '➡️ ระดับน้ำทรงตัว',
    sheet_discharge_rate: 'อัตราการระบายน้ำ (Discharge)',
    sheet_no_flow_sensor: 'ไม่มีเซนเซอร์วัดอัตราไหล',
    sheet_bedrock_unit: 'หน่วยหินฐาน (DMR 1:250k)',
    sheet_bedrock_inspecting: 'กำลังตรวจสอบหินฐาน...',
    sheet_public_advisory: '💡 คำแนะนำสำหรับประชาชน:',
    sheet_advisory_overflow: 'ระดับน้ำสูงกว่าตลิ่งแล้ว ขอให้ประชาชนริมแม่น้ำยกสิ่งของขึ้นที่สูง ตัดไฟจุดน้ำท่วม และเตรียมพร้อมอพยพสัตว์เลี้ยง',
    sheet_advisory_warning: 'ระดับน้ำใกล้ตลิ่งและมีแนวโน้มสูงขึ้น ขอให้จัดเตรียมกระสอบทราย ตรวจสอบเครื่องสูบน้ำ และติดตามสถานการณ์ใกล้ชิด',
    sheet_advisory_normal: 'ระดับน้ำในลำน้ำยังอยู่ในเกณฑ์ควบคุม สามารถสัญจรและใช้ชีวิตได้ตามปกติ',
    sheet_inflow_today: '💧 น้ำไหลเข้าวันนี้',
    sheet_outflow_today: '🌊 น้ำระบายออกวันนี้',
    sheet_current_storage: 'ระดับกักเก็บจริง',
    sheet_max_capacity: 'ความจุกักเก็บสูงสุด (Max Capacity)',
    sheet_medium_res_status: 'สถานะกักเก็บน้ำอ่างขนาดกลาง',
    sheet_medium_res_desc: 'อ่างเก็บน้ำขนาดกลางชลประทาน ติดตามปริมาตรน้ำกักเก็บและสมดุลการไหลเข้า-ออกเพื่อสนับสนุนการบริหารจัดการน้ำระดับลุ่มน้ำ',
    sheet_dry: 'แห้ง',
    sheet_normal: 'ปกติ',
    sheet_full: 'เต็มความจุ',
    sheet_rule_curve_seasonal: '📈 เกณฑ์ควบคุมน้ำตามฤดูกาล (Rule Curve ลุ่มน้ำ)',
    sheet_rule_curve_dam: '📈 เกณฑ์ควบคุมน้ำในเขื่อน (Rule Curve)',
    sheet_rule_curve_eval_desc: 'ประเมินตามปฏิทินฤดูกาล กรมชลประทาน & กฟผ. (เปรียบเทียบระดับน้ำสดกับเส้นควบคุม Upper / Lower Rule Curve)',
    sheet_lrc_label: 'เกณฑ์ล่าง (LRC)',
    sheet_urc_label: 'เกณฑ์บน (URC)',
    sheet_urc_threshold: 'เกณฑ์ควบคุมตอนบน (URC)',
    sheet_lrc_threshold: 'เกณฑ์ควบคุมตอนล่าง (LRC)',
    sheet_above_urc: 'เกินเกณฑ์บน (URC)',
    sheet_below_lrc: 'ต่ำกว่าเกณฑ์ล่าง (LRC)',
    sheet_normal_control: 'เกณฑ์ควบคุมปกติ',
    sheet_doh_km_label: 'สายทางและช่วงหลักกิโลเมตร',
    sheet_doh_depth_label: 'ระดับน้ำท่วมขังผิวทาง',
    sheet_doh_detour_label: 'เส้นทางเลี่ยงแนะนำ (Detour)',
    sheet_doh_agency_label: 'หน่วยงานรับผิดชอบและดูแลพื้นที่',
    sheet_cctv_route_label: 'สายทาง / คลองเฝ้าระวัง',
    sheet_cctv_owner_label: 'หน่วยงานเจ้าของกล้อง',
    sheet_cctv_gps_label: 'พิกัดภูมิศาสตร์ (GPS)',
    sheet_cctv_live_snapshot: 'LIVE SNAPSHOT',
    sheet_cctv_official_portal_btn: 'เว็บทางการ',
    sheet_traffy_section_label: '📍 ช่วงเส้นทางที่เฝ้าระวัง:',
    sheet_traffy_distance_label: 'ระยะทางแนวเฝ้าระวัง',
    sheet_traffy_lanes_label: 'ช่องจราจรที่ได้รับผลกระทบ',
    sheet_traffy_impact_label: 'ผลกระทบการจราจร',
    sheet_traffy_cause_label: 'สาเหตุการระบายน้ำชะลอตัว',
    sheet_traffy_bma_hotline: '📞 สายด่วน กทม. 1555',
    sheet_traffy_report_btn: '💬 แจ้งผ่าน Traffy Fondue',
    sheet_status_prefix: 'สถานะ:',
    sheet_traffy_ack: 'รับเรื่องแล้ว',
    sheet_traffy_org: 'รายงานปัญหาผ่าน Traffy Fondue สวทช. / กทม.',
    sheet_zoom_incident: 'ซูมดูจุดเกิดเหตุ',
    sheet_zoom_road: 'ซูมดูถนน',
    sheet_doh_passable_text: 'ผ่านได้ (รถเล็กโปรดระมัดระวัง)',
    sheet_doh_impassable_text: 'ปิดการจราจร / รถเล็กผ่านไม่ได้',
    sheet_doh_emergency_center: 'ศูนย์บริหารงานอุบัติภัย กรมทางหลวง',
    sheet_doh_tollfree: 'โทร 1586 (โทรฟรีตลอด 24 ชม.)',
    weather_pill_title: 'คลิกเพื่อดูพยากรณ์อากาศ 7 วัน',
    weather_pill_loading: 'กำลังโหลดสภาพอากาศ...',
    layer_header_title: 'เลเยอร์แผนที่',
    layer_collapse_title: 'ย่อ/ขยายพาเนลเลเยอร์',
    layer_cctv: 'กล้อง CCTV สด (ทั่วประเทศ)',
    layer_cctv_desc: 'สตรีมสด 400+ ตัว กรมทางหลวง & กทม.',
    layer_sat_water: 'เรดาร์น้ำฝน (Doppler Radar)',
    layer_sat_water_desc: 'เรดาร์ตรวจวัดกลุ่มฝนสด ทุก 10 นาที (TMD)',
    layer_sat_clouds: 'ดาวเทียมเมฆ (Himawari-9)',
    layer_sat_clouds_desc: 'ภาพดาวเทียม Clean IR ตรวจกลุ่มเมฆฝน',
    layer_gfs: 'แบบจำลอง GFS (NOAA)',
    layer_gfs_desc: 'พยากรณ์ฝนล่วงหน้า 7 วัน ความละเอียด 13 กม.',
    layer_ecmwf: 'แบบจำลอง ECMWF IFS',
    layer_ecmwf_desc: 'แบบจำลองพยากรณ์ฝนยุโรป แม่นยำสูงสุด (9 กม.)',
    layer_doh_roads: 'น้ำท่วมทางหลวง (กรมทางหลวง)',
    layer_doh_roads_desc: 'รายงานสดผิวทางท่วมขัง สายด่วน 1586',
    layer_traffy: 'จุดน้ำท่วม Traffy Fondue',
    layer_traffy_desc: 'รายงานปัญหาน้ำท่วมจากประชาชน (กทม./สวทช.)',
    layer_traffic: 'สภาพการจราจรสด',
    layer_traffic_desc: 'ความหนาแน่นและอัตราความเร็วบนเส้นทางหลัก',
    layer_wind_field: 'กระแสลมผิวพื้น 10 ม.',
    layer_wind_field_desc: 'ทิศทางและความเร็วลมผิวพื้น (WMO Beaufort Scale)',
    legend_dam_critical: '🔴 วิกฤต: > 85% ของความจุ',
    legend_dam_watch: '🟠 เฝ้าระวัง: 70 - 85% ของความจุ',
    legend_dam_normal: '🔵 เกณฑ์ปกติ: 30 - 70% ของความจุ',
    legend_dam_low: '🟡 น้ำน้อย: < 30% ของความจุ',
    legend_dam_note: '💡 เกณฑ์ประเมินอ่างเก็บน้ำขนาดใหญ่และขนาดกลาง กรมชลประทาน & กฟผ.',
    legend_geol_colors: 'สีเฉด: อายุและชนิดหินฐาน (หินตะกอน/อัคนี/แปร)',
    legend_geol_faults: 'เส้นประแดง: รอยเลื่อนมีพลัง (Active Faults)',
    legend_geol_note: '💡 ข้อมูลแผนที่ธรณีวิทยาประเทศไทย มาตราส่วน 1:250,000 กรมทรัพยากรธรณี (DMR)',
    legend_radar_note: '💡 เรดาร์ตรวจวัดหยดน้ำฝนจริงที่ตกสู่พื้นดินทุก 10 นาที กรมอุตุนิยมวิทยา',
    legend_clouds_note: '💡 ภาพดาวเทียมอุตุนิยมวิทยา Himawari-9 Clean IR ตรวจจับอุณหภูมิยอดเมฆฝนฟ้าคะนอง NASA GIBS',
    legend_cctv_note: '💡 สตรีมภาพสดจากเครือข่ายกล้องตรวจการณ์ กรมทางหลวง และสำนักการระบายน้ำ กทม.',
    sheet_medium_res_status: 'สถานะกักเก็บน้ำอ่างขนาดกลาง',
    sheet_medium_res_desc: 'อ่างเก็บน้ำขนาดกลางชลประทาน ติดตามปริมาตรน้ำกักเก็บและสมดุลการไหลเข้า-ออกเพื่อสนับสนุนการบริหารจัดการน้ำระดับลุ่มน้ำ',
    sheet_rule_curve_dam: 'เกณฑ์ควบคุมน้ำในเขื่อน (Rule Curve)',
    sheet_cctv_dam_crest: '📹 ภาพสดจากกล้อง CCTV สันเขื่อน:',
    sheet_bma_district: 'กทม. เขต',
    sheet_bma_drainage_agency: 'สำนักการระบายน้ำ',
    sheet_bma_hotline_1555: '📞 สายด่วน กทม. 1555',
    sheet_traffy_reported_time: 'เวลาที่แจ้งเหตุ',
    sheet_user_coords: 'พิกัด',
    sheet_nearest_station: '📡 สถานีโทรมาตรวัดน้ำใกล้คุณที่สุด',
    sheet_water_level_label: 'ระดับน้ำ:',
    sheet_elevation_label: 'ระดับความสูง',
    sheet_area_info: 'ข้อมูลพื้นที่',
    sheet_weather_wind_speed: '💨 ความเร็วลม:',
    sheet_weather_live_rain: '☔ ปริมาณฝนสด:',
    sheet_radar_desc: 'ตรวจจับละอองน้ำฝนจริงที่ตกสู่พื้นดินในรัศมี 240 กม. ความแม่นยำสูง',
    unit_cm: 'ซม.'
  },
  en: {
    // App & Header
    app_title: 'ThaiFlood Monitor',
    app_subtitle: 'Real-Time Flood Monitoring & Rainfall Forecast Platform for Thailand',
    drawer_subtitle: 'Flood Telemetry & Early Warning System',
    search_placeholder: 'Search province, district, station, dam...',
    search_submit: 'Search',
    menu_main: 'Main Menu (Alerts / Sources)',
    close_menu: 'Close Menu',

    // Drawer Tabs
    tab_alerts: 'Alerts',
    tab_sources: 'Data Sources',
    tab_developer: 'System & Stats',

    // Drawer Alerts
    alerts_total_prefix: 'Total critical alert cards:',
    alerts_total_suffix: 'items',
    alerts_view_all: 'View All',
    alerts_view_deck: 'Deck View',
    alerts_prev: '‹ Prev',
    alerts_next: 'Next ›',
    alerts_empty: 'No critical alerts at this time',
    alerts_critical: 'Critical Flooding',
    alerts_warning: 'Overbank Flood Watch',
    alerts_normal: 'Normal Water Level',

    // Drawer Stats
    stats_header: 'System Telemetry & Visitor Analytics',
    stats_visitors: 'Total Visitors',
    stats_api_status: 'Government API Link Status',
    stats_status_online: 'Operational',
    stats_last_sync: 'Last Data Sync',
    stats_privacy_badge: 'Privacy Policy: 100% Non-tracking & Privacy-Friendly via GoatCounter',

    // Layer Menu Header
    layer_menu_title: 'Map Layers',
    layer_menu_hide: 'Hide',
    layer_menu_show: 'Show',

    // Layers (Names & Descriptions)
    layer_flood_now: 'Current Flood',
    layer_flood_now_desc: 'Overbank flood extent · GISTDA satellite & sensors',
    layer_forecast_7d: '7-Day Flood Risk',
    layer_forecast_7d_desc: '7-day forward outlook · Hydrological index',
    layer_dams: 'Dams & Reservoirs',
    layer_dams_desc: 'Major dam locations & water bodies · EGAT & RID',
    layer_flow_direction: 'Water Flow Direction',
    layer_flow_direction_desc: 'River current flow vector arrows',
    layer_stations: 'Water Telemetry Stations',
    layer_stations_desc: '1,400+ official telemetry stations nationwide (HII)',
    layer_geology: 'DMR Geology (1:250k)',
    layer_geology_desc: 'Rock units & active fault lines · Mineral Resources',
    layer_radar: 'TMD Weather Radar',
    layer_radar_desc: 'Live composite precipitation radar · TMD / RainViewer',
    layer_himawari: 'Himawari Satellite Cloud',
    layer_himawari_desc: 'High-frequency Infrared Cloud Imagery · JMA Himawari-9',
    layer_wind: 'Surface Wind 10m',
    layer_wind_desc: 'Vector wind speed and direction · ECMWF WMO',
    layer_gfs: 'GFS Rain Forecast (NOAA)',
    layer_gfs_desc: '24-hour accumulated rainfall · NOAA NCEP 13km',
    layer_ecmwf: 'ECMWF Rain Forecast (Europe)',
    layer_ecmwf_desc: '24-hour accumulated rainfall · ECMWF IFS 9km',
    layer_traffic: 'Highway Live Traffic',
    layer_traffic_desc: 'Real-time highway congestion · Dept. of Highways',
    layer_doh_roads: 'Highway Flood (DOH)',
    layer_doh_roads_desc: 'Submerged road corridors · Dept. of Highways Hotline 1586',
    layer_cctv: 'Live CCTV Cameras',
    layer_cctv_desc: 'Official surveillance cameras at canals, highways & dams',
    layer_traffy: 'Traffy Fondue Reports',
    layer_traffy_desc: 'Citizen-reported urban flooding incidents (NECTEC)',

    // Legends
    legend_dam_critical: '🔴 Critical: ≥ 80% (High Storage)',
    legend_dam_watch: '🟠 Watch: 60% – 79.9% (High Storage)',
    legend_dam_normal: '🔵 Normal: 30% – 59.9%',
    legend_dam_low: '🟡 Low Storage: < 30%',
    legend_dam_note: '💡 Pin colors dynamically reflect real-time % reservoir storage volume',
    legend_doh_passable: '🟢 Passable with Caution',
    legend_doh_impassable: '🔴 Impassable (Road Submerged / Blocked)',
    legend_doh_note: '💡 Live telemetry from Department of Highways Emergency Operations Center (Hotline 1586)',
    legend_geol_colors: 'Geological Groups & Rock Units',
    legend_geol_faults: 'Fault Lines & Structural Trends',
    legend_geol_note: '💡 Click anywhere on map to inspect rock unit code and lithological descriptions',
    legend_radar_note: '💡 High-resolution 512px precipitation radar from national radar network',
    legend_cctv_note: '💡 Click any camera pin to view live official surveillance video/snapshot',
    legend_traffy_note: '💡 Citizen incident reports crowd-sourced via NECTEC Traffy Fondue',

    // Basemaps
    basemap_label: 'Basemap Style',
    basemap_trigger_title: 'Click or hover to choose basemap style',
    basemap_expand_arrow_title: 'Show more map styles',
    basemap_street: 'Map',
    basemap_street_title: 'Standard street map (OpenStreetMap)',
    basemap_satellite: 'Satellite',
    basemap_satellite_title: 'Satellite imagery (ESRI World Imagery)',
    basemap_topo: 'Terrain',
    basemap_topo_title: 'Topographic elevation contours (OpenTopoMap)',
    basemap_3d: '3D',

    // Floating Map HUD & Controls
    dem_title: 'DEM 30m & Contours:',
    dem_hover: 'Hover over map',
    dem_unit: 'to measure ground elevation',
    weather_pill_loading: 'Loading...',
    weather_pill_title: 'Live weather & temperature by province (click for 7-day forecast)',
    disclaimer_title: 'Hydrological flood model is based on hydraulic approximations. Verify live levels at telemetry stations.',
    disclaimer_text: 'Hydrological Model: Mathematical approximation · Verify live water level at station pins',
    ctrl_north: 'Orient north-up (0° bearing)',
    ctrl_locate: 'My Location',
    ctrl_locate_title: 'My Location (Locate Me)',
    ctrl_locate_found: 'My Location (GPS Located)',
    ctrl_zoom_in: 'Zoom In',
    ctrl_zoom_out: 'Zoom Out',
    toast_north_reset: 'Map reoriented north-up (0° bearing)',
    toast_layer_flow: 'Enabled Water Flow Direction Vectors',
    toast_layer_stations: 'Enabled Telemetry Water Stations (HII)',
    toast_layer_cctv: 'Enabled Highway & Water CCTV Surveillance Cameras (Live)',
    toast_layer_doh: 'Enabled Highway Flood Situation Reports (DOH Hotline 1586)',
    toast_layer_traffy: 'Enabled Traffy Fondue Flood Reports',
    toast_layer_traffic: 'Enabled Real-Time Live Traffic Overlay',
    toast_layer_wind: 'Enabled Surface Wind Field 10m (Wind Field Map)',
    toast_3d_on: 'Enabled 3D View with 3D Buildings',
    toast_3d_off: 'Returned to standard 2D view',
    toast_sat_2d: 'Satellite mode rendered in planar 2D view (3D disabled)',
    toast_locate_unsupported: 'Your browser does not support Geolocation',
    toast_locate_searching: 'Locating your current GPS position...',
    toast_locate_found_prefix: 'Located your coordinates (accuracy ±',
    toast_locate_found_suffix: ' m)',
    toast_locate_permission_denied: 'Location permission denied (Please allow location access in your browser)',
    toast_locate_unavailable: 'Location signal or GPS unavailable',
    toast_locate_timeout: 'Geolocation request timed out',
    toast_locate_error: 'Unable to determine location. Please try again.',
    toast_wind_point_prefix: '💨 Surface Wind 10m:',

    // Wind Legend Floating Box
    wind_legend_title: '10m Surface Wind Vectors (WMO Scale)',
    wind_legend_units: 'm/s & km/h',
    wind_legend_calm: '0 (Calm)',
    wind_legend_mod: '5 m/s (18 km/h)',
    wind_legend_strong: '12 m/s (43 km/h)',
    wind_legend_gale: '24+ m/s (Gale)',
    wind_legend_tip: '💡 Click anywhere on map to inspect live wind speed and direction',

    // DEM Landform Descriptions
    dem_desc_sea: 'Estuary / Low-lying Zone (Coastal tidal surge impact)',
    dem_desc_basin: 'Low-lying Basin / Flood Retarding Basin (High flood vulnerability)',
    dem_desc_floodplain: 'Natural Floodplain',
    dem_desc_terrace: 'River Terrace / Natural Levee',
    dem_desc_high: 'Highland / Rolling Hills (Safe from typical ponding)',

    // Rule Curve 3-Zone Tooltips
    rc_gauge_low: 'Low Water Zone (Below LRC): 0 - {lrc}%',
    rc_gauge_normal: 'Normal Control Zone (LRC - URC): {lrc}% - {urc}%',
    rc_gauge_high: 'Spill Risk Zone (Above URC): {urc}% - 100%',

    // Alert Deck Extra Labels
    alerts_overbank_badge: '🔴 Overbank Flooding',
    alerts_dam_critical_badge: '🏢 Critical Reservoir Storage',
    alerts_overbank_note: 'Status: Overbank surge. Expedite drainage and monitor low-lying corridors.',
    alerts_dam_note: 'Discharge: Monitor downstream river corridor impacts.',
    alerts_prov_prefix: 'Prov.',
    alerts_river_prefix: 'River',
    alerts_basin_prefix: 'Basin',
    alerts_issues_unit: 'issues',

    // Place Sheet & Popups
    sheet_close: 'Close Sheet',
    sheet_station_title: 'Telemetry Water Station',
    sheet_dam_title: 'Major Dam & Reservoir',
    sheet_cctv_title: 'Official Surveillance CCTV',
    sheet_doh_title: 'Highway Flood Situation Report',
    sheet_traffy_title: 'Traffy Fondue Flood Incident',
    sheet_water_level: 'Current Water Level',
    sheet_water_level_msl: 'Actual Water Level (m MSL)',
    sheet_bank_level: 'Bank Elevation',
    sheet_bank_empty: 'No bank elevation data',
    sheet_capacity: 'Channel Capacity',
    sheet_rule_curve: 'Reservoir Rule Curve',
    sheet_cctv_connecting: 'Connecting live feed stream...',
    sheet_cctv_offline: 'Camera stream temporarily unavailable (Please check official portal)',
    sheet_cctv_official_portal: 'Open Official Streaming Portal',
    sheet_cctv_refresh: 'Refresh Live Feed',
    sheet_passable: 'Passable for Vehicles',
    sheet_impassable: 'Impassable (Road Submerged / Blocked)',
    sheet_source: 'Data Source',
    sheet_flow_rate: 'Discharge Flow Rate',
    sheet_storage: 'Storage Volume',
    sheet_inflow: 'Inflow Volume',
    sheet_released: 'Outflow / Release',
    sheet_trend: 'Water Trend',
    sheet_trend_rising: 'Rising',
    sheet_trend_falling: 'Falling',
    sheet_trend_stable: 'Stable',
    sheet_overflow_warning: 'Overbank flooding in low-lying riverside corridors',
    sheet_near_bank_warning: 'Water level near bank, entering flood watch threshold',
    sheet_normal_info: 'Water level in river channel is within normal control range',
    sheet_zoom_point: 'Zoom to Point',
    sheet_weather_forecast: 'Weather Forecast',
    sheet_hotline_1586: 'Hotline 1586',
    // Alert Card Labels
    alerts_datetime_label: 'As of:',
    alerts_fly_btn: '📍 View on Map',
    alerts_empty_title: 'No stations or roads currently in critical condition',
    alerts_empty_desc: 'Water levels in rivers and major highway corridors remain within safe control limits',

    // Layer Legends Detailed
    legend_sat_water_light: 'Light Rain (15-25 dBZ)',
    legend_sat_water_medium: 'Moderate (35 dBZ)',
    legend_sat_water_heavy: 'Heavy Rain / Hail (>50 dBZ)',
    legend_sat_clouds_light: 'Light Rain',
    legend_sat_clouds_medium: 'Moderate',
    legend_sat_clouds_heavy: 'Storm / Heavy Rain',
    legend_forecast_day_select: '📅 Select Forecast Day (0 - 6 Days):',
    legend_today: 'Today',
    legend_day_plus: '+{day}d',
    legend_scale_low: '1-10 mm',
    legend_scale_med: '25 mm',
    legend_scale_high: '50 mm',
    legend_scale_extreme: '>90 mm',
    legend_gfs_note: '💡 Global Forecast System (NOAA/NCEP) 13km resolution, 7-day forward precipitation model',
    legend_ecmwf_note: '💡 European Centre for Medium-Range Weather Forecasts (ECMWF IFS 9km), gold-standard accuracy',
    legend_traffy_pending: '🟠 Pending / In Progress',
    legend_traffy_resolved: '🟢 Resolved / Flood Subsided',
    legend_traffic_green: '🟢 Flowing (> 45 km/h)',
    legend_traffic_orange: '🟠 Slow Traffic (20 - 45 km/h)',
    legend_traffic_red: '🔴 Heavy Congestion (< 20 km/h)',
    legend_traffic_note: '💡 Real-time live traffic overlay covering major expressways and national highways',
    legend_wind_light: '0-2 m/s (Light)',
    legend_wind_med: '8 m/s (Moderate)',
    legend_wind_storm: '>24 m/s (Gale)',
    legend_wind_note: '💡 Simulated 10m surface wind vectors (u, v) following World Meteorological Organization (WMO) standards',
    legend_cctv_live_label: 'Live CCTV: Dept. of Highways, BMA Drainage Dept., Royal Irrigation Dept.',
    legend_ts_radar_prefix: '🕒 Latest Radar Scan:',
    legend_ts_clouds_prefix: '🕒 Latest Satellite Image:',

    // Units
    unit_m: 'm',
    unit_m_msl: 'm MSL',
    unit_cm: 'cm',
    unit_km: 'km',
    unit_mm: 'mm',
    unit_celsius: '°C',
    unit_kmh: 'km/h',
    unit_m3_s: 'm³/s',
    unit_million_m3: 'Million m³',
    unit_million_m3_day: 'Million m³/day',

    // Static Labels & Advisories in Place Sheet
    sheet_last_telemetry: 'Last Telemetry Time',
    sheet_operating_agency: 'Operating Agency',
    sheet_water_trend: 'Water Level Trend',
    sheet_trend_rising: '⬆️ Rising',
    sheet_trend_falling: '⬇️ Falling',
    sheet_trend_stable: '➡️ Stable',
    sheet_discharge_rate: 'River Discharge Rate',
    sheet_no_flow_sensor: 'No Flow Sensor Available',
    sheet_bedrock_unit: 'Bedrock Unit (DMR 1:250k)',
    sheet_bedrock_inspecting: 'Inspecting Bedrock...',
    sheet_public_advisory: '💡 Public Advisory:',
    sheet_advisory_overflow: 'Water level has exceeded bank crest. Residents in low-lying riverside corridors should move belongings to high ground and prepare for evacuation.',
    sheet_advisory_warning: 'Water level is near bank crest and rising. Please prepare sandbags, verify drainage pumps, and monitor situational updates closely.',
    sheet_advisory_normal: 'Water level in river channel is within controlled envelope. Normal activities and transit can proceed safely.',
    sheet_inflow_today: '💧 Today\'s Inflow',
    sheet_outflow_today: '🌊 Today\'s Outflow',
    sheet_current_storage: 'Current Storage',
    sheet_max_capacity: 'Maximum Capacity',
    sheet_medium_res_status: 'Medium Reservoir Storage Status',
    sheet_medium_res_desc: 'Irrigation medium reservoir tracking inflow/outflow balance to support river basin management.',
    sheet_dry: 'Dry',
    sheet_normal: 'Normal',
    sheet_full: 'Full Capacity',
    sheet_rule_curve_seasonal: '📈 Seasonal Rule Curve (Basin Guide)',
    sheet_rule_curve_dam: '📈 Reservoir Rule Curve Assessment',
    sheet_rule_curve_eval_desc: 'Evaluated against seasonal envelope by RID & EGAT (comparing live telemetry with Upper / Lower Rule Curves).',
    sheet_lrc_label: 'Lower Rule Curve (LRC)',
    sheet_urc_label: 'Upper Rule Curve (URC)',
    sheet_urc_threshold: 'Upper Control Threshold (URC)',
    sheet_lrc_threshold: 'Lower Control Threshold (LRC)',
    sheet_above_urc: 'Above Upper Rule Curve (URC)',
    sheet_below_lrc: 'Below Lower Rule Curve (LRC)',
    sheet_normal_control: 'Normal Control Envelope',
    sheet_doh_km_label: 'Highway Route & KM Marker',
    sheet_doh_depth_label: 'Surface Water Depth',
    sheet_doh_detour_label: 'Recommended Detour',
    sheet_doh_agency_label: 'Responsible District / Agency',
    sheet_cctv_route_label: 'Monitored Route / Canal',
    sheet_cctv_owner_label: 'Camera Provider / Agency',
    sheet_cctv_gps_label: 'GPS Coordinates',
    sheet_cctv_live_snapshot: 'LIVE SNAPSHOT',
    sheet_cctv_official_portal_btn: 'Official Portal',
    sheet_traffy_section_label: '📍 Monitored Road Corridor:',
    sheet_traffy_distance_label: 'Monitored Corridor Length',
    sheet_traffy_lanes_label: 'Affected Traffic Lanes',
    sheet_traffy_impact_label: 'Traffic Flow Impact',
    sheet_traffy_cause_label: 'Drainage Delay Factor',
    sheet_traffy_bma_hotline: '📞 BMA Hotline 1555',
    sheet_traffy_report_btn: '💬 Report via Traffy Fondue',
    sheet_status_prefix: 'Status:',
    sheet_traffy_ack: 'Acknowledged',
    sheet_traffy_org: 'Incident reported via Traffy Fondue NECTEC / BMA',
    sheet_zoom_incident: 'Zoom to Incident',
    sheet_zoom_road: 'Zoom to Road',
    sheet_doh_passable_text: 'Passable (Small vehicles exercise caution)',
    sheet_doh_impassable_text: 'Closed / Impassable for small vehicles',
    sheet_doh_emergency_center: 'DOH Emergency Incident Management Center',
    sheet_doh_tollfree: 'Call 1586 (Toll-free 24/7 Hotline)',
    weather_pill_title: 'Click to view 7-day weather forecast',
    weather_pill_loading: 'Loading weather forecast...',
    layer_header_title: 'Map Layers',
    layer_collapse_title: 'Collapse/Expand Layers',
    layer_cctv: 'Live CCTV (Nationwide)',
    layer_cctv_desc: 'Live feeds from 400+ cameras (DOH & BMA)',
    layer_sat_water: 'Precipitation Radar (Doppler)',
    layer_sat_water_desc: 'Live rain radar every 10 min (TMD)',
    layer_sat_clouds: 'Satellite Clouds (Himawari-9)',
    layer_sat_clouds_desc: 'Clean IR satellite imagery of cloud cover',
    layer_gfs: 'GFS Model (NOAA)',
    layer_gfs_desc: '7-day forward precipitation forecast (13km)',
    layer_ecmwf: 'ECMWF IFS Model',
    layer_ecmwf_desc: 'Gold-standard European rain forecast (9km)',
    layer_doh_roads: 'Highway Flooding (DOH)',
    layer_doh_roads_desc: 'Live submerged highway reports (Hotline 1586)',
    layer_traffy: 'Traffy Fondue Flood Reports',
    layer_traffy_desc: 'Citizen-reported flood incidents (BMA/NECTEC)',
    layer_traffic: 'Live Traffic Flow',
    layer_traffic_desc: 'Real-time congestion and speed on major roads',
    layer_wind_field: 'Surface Wind Field (10m)',
    layer_wind_field_desc: 'Surface wind direction & speed (WMO Beaufort Scale)',
    legend_dam_critical: '🔴 Critical: > 85% Capacity',
    legend_dam_watch: '🟠 Watch: 70 - 85% Capacity',
    legend_dam_normal: '🔵 Normal Envelope: 30 - 70% Capacity',
    legend_dam_low: '🟡 Low Water: < 30% Capacity',
    legend_dam_note: '💡 Large & Medium Reservoir criteria by Royal Irrigation Dept. & EGAT',
    legend_geol_colors: 'Colors: Bedrock age & lithology (Sedimentary/Igneous/Metamorphic)',
    legend_geol_faults: 'Red dashed: Active Geological Faults',
    legend_geol_note: '💡 Geological Map of Thailand (1:250,000 scale) Dept. of Mineral Resources (DMR)',
    legend_radar_note: '💡 Live ground-level radar scans every 10 min by Thai Meteorological Department',
    legend_clouds_note: '💡 Himawari-9 Clean IR satellite imagery tracking cloud top temperatures by NASA GIBS',
    legend_cctv_note: '💡 Real-time camera feeds from Dept. of Highways and BMA Drainage Dept.',
    sheet_medium_res_status: 'Medium Reservoir Storage Status',
    sheet_medium_res_desc: 'Irrigation medium reservoir tracking inflow/outflow balance to support river basin management.',
    sheet_rule_curve_dam: 'Reservoir Rule Curve Assessment',
    sheet_cctv_dam_crest: '📹 Live CCTV Snapshot at Dam Crest:',
    sheet_bma_district: 'Bangkok District',
    sheet_bma_drainage_agency: 'BMA Drainage Department',
    sheet_bma_hotline_1555: '📞 BMA Hotline 1555',
    sheet_traffy_reported_time: 'Reported Time',
    sheet_user_coords: 'Coordinates',
    sheet_nearest_station: '📡 Nearest Water Telemetry Station',
    sheet_water_level_label: 'Water Level:',
    sheet_elevation_label: 'Ground Elevation',
    sheet_area_info: 'Area Information',
    sheet_weather_wind_speed: '💨 Wind Speed:',
    sheet_weather_live_rain: '☔ Live Rain:',
    sheet_radar_desc: 'Detects actual ground precipitation within 240km radius with high accuracy',
    unit_cm: 'cm'
  }
};

let currentLanguage = (() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'th') return saved;
    } catch {
      // Ignore security errors
    }
  }
  return 'th';
})();

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (lang !== 'th' && lang !== 'en') return currentLanguage;
  currentLanguage = lang;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('localStorage access error:', e);
    }
  }

  // Update HTML document lang attribute and title
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === 'en'
      ? 'ThaiFlood Monitor | Real-Time Flood & Rainfall Forecast Platform for Thailand'
      : 'ThaiFlood Monitor | แผนที่ติดตามสถานการณ์น้ำท่วมและพยากรณ์ฝนประเทศไทย แบบเรียลไทม์';
  }

  // Dispatch custom event across application
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('thaiflood:language-changed', {
      detail: { lang: currentLanguage }
    }));
  }
  return currentLanguage;
}

export function t(key, fallback = '') {
  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.th;
  if (dict && dict[key] !== undefined) {
    return dict[key];
  }
  const thDict = TRANSLATIONS.th;
  if (thDict && thDict[key] !== undefined) {
    return thDict[key];
  }
  return fallback || key;
}

/**
 * Generate full HTML for Drawer Data Sources tab in current language
 */
export function getDrawerSourcesHTML(lang = currentLanguage) {
  if (lang === 'en') {
    return `
      <div class="sources-container">
        <div class="source-section">
          <div class="source-sec-title">🗺️ Base Map Providers</div>
          <div class="source-card">
            <div class="source-card-title">1. Standard Street Map (OpenStreetMap)</div>
            <div class="source-card-body"><b>OpenStreetMap Contributors (OSM)</b> via standard EPSG:3857 tile servers, showing full road, lane, and community networks with 3D buildings support.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">2. Satellite Imagery (ESRI World Imagery)</div>
            <div class="source-card-body"><b>ESRI World Imagery</b> high-resolution satellite orthophotos via ArcGIS Server, capturing authentic geomorphology, meanders, and low-lying basins.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">3. Topographic Contours (OpenTopoMap & NASA SRTM)</div>
            <div class="source-card-body"><b>OpenTopoMap Project & NASA SRTM</b> showing standard elevation contour lines and hillshades for watershed ridgeline analysis.</div>
          </div>
        </div>

        <div class="source-section">
          <div class="source-sec-title">🌊 Hydrology & Live Telemetry</div>
          <div class="source-card">
            <div class="source-card-title">1. Live Water Telemetry Stations</div>
            <div class="source-card-body"><b>Hydro-Informatics Institute (HII / ThaiWater)</b> via National Hydroinformatics Data Center API v3, covering 1,400+ stations with Multi-tier Bank Calibration.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">2. Major Dams & Reservoirs</div>
            <div class="source-card-body"><b>Electricity Generating Authority of Thailand (EGAT)</b> & <b>Royal Irrigation Department (RID)</b> tracking storage volume, daily inflow, and outflow releases.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">3. Real-Time Flood Extent Buffers</div>
            <div class="source-card-body"><b>Fluvial Geomorphology Buffer Model</b> calculating overbank flood extents from verified sensor data aligned across 516 OpenStreetMap river reaches.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">4. 7-Day Flood Risk Forecast</div>
            <div class="source-card-body">Multi-parameter hydrology forecast model synthesizing river stage trends, rainfall accumulation, and basin runoff capacity.</div>
          </div>
        </div>

        <div class="source-section">
          <div class="source-sec-title">📡 Weather, Radar, Highways & Geology</div>
          <div class="source-card">
            <div class="source-card-title">1. Live Weather Radar (TMD / RainViewer)</div>
            <div class="source-card-body"><b>RainViewer API</b> integrating the national radar network of the <b>Thai Meteorological Department (TMD)</b> at 512px resolution with 2-hour timeline history.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">2. GFS & ECMWF Precipitation Models</div>
            <div class="source-card-body"><b>NOAA NCEP (USA)</b> & <b>ECMWF IFS (Europe)</b> high-resolution numerical weather prediction models with 7-day forward day adjustment.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">3. DMR Geology & Active Faults (1:250k)</div>
            <div class="source-card-body"><b>Department of Mineral Resources (DMR)</b> nationwide rock unit polygons and active fault lines with interactive geological symbol decoding.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">4. Highway Floods & Live Traffic Flow</div>
            <div class="source-card-body"><b>Department of Highways (DOH HDMS)</b> real-time submerged roadway reports (Hotline 1586) paired with <b>Google Real-Time Traffic Flow</b>.</div>
          </div>
          <div class="source-card">
            <div class="source-card-title">5. Official Surveillance CCTV Cameras</div>
            <div class="source-card-body">Real-time surveillance cameras across EGAT dam crests, BMA sluice gates, and DOH highway corridors.</div>
          </div>
        </div>

        <!-- Action Card: System Statistics & Historical Logs (Specification 3) -->
        <div class="source-statistics-card">
          <button id="btn-open-statistics" class="btn-statistics-link" type="button">
            <span class="stat-icon">📊</span>
            <div class="stat-text">
              <div class="stat-title">System Statistics & Historical Logs</div>
              <div class="stat-desc">Inspect live API availability and download historical telemetry (.zip)</div>
            </div>
            <span class="stat-arrow">→</span>
          </button>
        </div>
      </div>
    `;
  }

  // Thai Default
  return `
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
        <div class="source-sec-title">📡 สภาพอากาศ เรดาร์ ทางหลวง & ธรณีวิทยา</div>
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
          <div class="source-card-title">4. น้ำท่วมทางหลวง & สภาพการจราจรสด</div>
          <div class="source-card-body"><b>กรมทางหลวง (DOH HDMS)</b> รายงานจุดน้ำท่วมผิวจราจร (สายด่วน 1586) ผสาน <b>Google Real-Time Traffic Flow Layer</b> แสดงสภาพการจราจรบนผิวถนน</div>
        </div>
        <div class="source-card">
          <div class="source-card-title">5. กล้อง CCTV เรียลไทม์</div>
          <div class="source-card-body">กล้องตรวจการณ์สันเขื่อน กฟผ., ปตร. สำนักการระบายน้ำ กทม., และทางหลวง เพื่อตรวจเช็คสถานการณ์จริงด้วยภาพ</div>
        </div>
      </div>

      <!-- Action Card: สถิติระบบ & ดาวน์โหลดข้อมูลย้อนหลัง (Specification 3) -->
      <div class="source-statistics-card">
        <button id="btn-open-statistics" class="btn-statistics-link" type="button">
          <span class="stat-icon">📊</span>
          <div class="stat-text">
            <div class="stat-title">สถิติระบบ & ดาวน์โหลดข้อมูลย้อนหลัง</div>
            <div class="stat-desc">ตรวจสอบความพร้อมของ API และดาวน์โหลดประวัติข้อมูลน้ำท่วม (.zip)</div>
          </div>
          <span class="stat-arrow">→</span>
        </button>
      </div>
    </div>
  `;
}

export const THAI_PROVINCE_EN_MAP = {
  'กรุงเทพมหานคร': 'Bangkok',
  'สมุทรปราการ': 'Samut Prakan',
  'นนทบุรี': 'Nonthaburi',
  'ปทุมธานี': 'Pathum Thani',
  'พระนครศรีอยุธยา': 'Phra Nakhon Si Ayutthaya',
  'อ่างทอง': 'Ang Thong',
  'ลพบุรี': 'Lopburi',
  'สิงห์บุรี': 'Sing Buri',
  'ชัยนาท': 'Chai Nat',
  'สระบุรี': 'Saraburi',
  'ชลบุรี': 'Chonburi',
  'ระยอง': 'Rayong',
  'จันทบุรี': 'Chanthaburi',
  'ตราด': 'Trat',
  'ฉะเชิงเทรา': 'Chachoengsao',
  'ปราจีนบุรี': 'Prachinburi',
  'นครนายก': 'Nakhon Nayok',
  'สระแก้ว': 'Sa Kaeo',
  'นครราชสีมา': 'Nakhon Ratchasima',
  'บุรีรัมย์': 'Buriram',
  'สุรินทร์': 'Surin',
  'ศรีสะเกษ': 'Sisaket',
  'อุบลราชธานี': 'Ubon Ratchathani',
  'ยโสธร': 'Yasothon',
  'ชัยภูมิ': 'Chaiyaphum',
  'อำนาจเจริญ': 'Amnat Charoen',
  'บึงกาฬ': 'Bueng Kan',
  'หนองบัวลำภู': 'Nong Bua Lamphu',
  'ขอนแก่น': 'Khon Kaen',
  'อุดรธานี': 'Udon Thani',
  'เลย': 'Loei',
  'หนองคาย': 'Nong Khai',
  'มหาสารคาม': 'Maha Sarakham',
  'ร้อยเอ็ด': 'Roi Et',
  'กาฬสินธุ์': 'Kalasin',
  'สกลนคร': 'Sakon Nakhon',
  'นครพนม': 'Nakhon Phanom',
  'มุกดาหาร': 'Mukdahan',
  'เชียงใหม่': 'Chiang Mai',
  'ลำพูน': 'Lamphun',
  'ลำปาง': 'Lampang',
  'อุตรดิตถ์': 'Uttaradit',
  'แพร่': 'Phrae',
  'น่าน': 'Nan',
  'พะเยา': 'Phayao',
  'เชียงราย': 'Chiang Rai',
  'แม่ฮ่องสอน': 'Mae Hong Son',
  'นครสวรรค์': 'Nakhon Sawan',
  'อุทัยธานี': 'Uthai Thani',
  'กำแพงเพชร': 'Kamphaeng Phet',
  'ตาก': 'Tak',
  'สุโขทัย': 'Sukhothai',
  'พิษณุโลก': 'Phitsanulok',
  'พิจิตร': 'Phichit',
  'เพชรบูรณ์': 'Phetchabun',
  'ราชบุรี': 'Ratchaburi',
  'กาญจนบุรี': 'Kanchanaburi',
  'สุพรรณบุรี': 'Suphan Buri',
  'นครปฐม': 'Nakhon Pathom',
  'สมุทรสาคร': 'Samut Sakhon',
  'สมุทรสงคราม': 'Samut Songkhram',
  'เพชรบุรี': 'Phetchaburi',
  'ประจวบคีรีขันธ์': 'Prachuap Khiri Khan',
  'นครศรีธรรมราช': 'Nakhon Si Thammarat',
  'กระบี่': 'Krabi',
  'พังงา': 'Phang Nga',
  'ภูเก็ต': 'Phuket',
  'สุราษฎร์ธานี': 'Surat Thani',
  'ระนอง': 'Ranong',
  'ชุมพร': 'Chumphon',
  'สงขลา': 'Songkhla',
  'สตูล': 'Satun',
  'ตรัง': 'Trang',
  'พัทลุง': 'Phatthalung',
  'ปัตตานี': 'Pattani',
  'ยะลา': 'Yala',
  'นราธิวาส': 'Narathiwat'
};

export const BASIN_EN_MAP = {
  'เจ้าพระยา': 'Chao Phraya',
  'ป่าสัก': 'Pa Sak',
  'ท่าจีน': 'Tha Chin',
  'แม่กลอง': 'Mae Klong',
  'บางปะกง': 'Bang Pakong',
  'ปราจีนบุรี': 'Prachin Buri',
  'เพชรบุรี': 'Phetchaburi',
  'มูล': 'Mun',
  'ชี': 'Chi',
  'โขง': 'Mekong',
  'โขง (ภาคตะวันออกเฉียงเหนือ)': 'Mekong (Northeast)',
  'โขง (ภาคเหนือ)': 'Mekong (North)',
  'ปิง': 'Ping',
  'วัง': 'Wang',
  'ยม': 'Yom',
  'น่าน': 'Nan',
  'สะแกกรัง': 'Sakae Krang',
  'สาละวิน': 'Salween',
  'ตาปี': 'Tapi',
  'ทะเลสาบสงขลา': 'Songkhla Lake',
  'ปัตตานี': 'Pattani',
  'สายบุรี': 'Saiburi',
  'ชายฝั่งทะเลตะวันออก': 'Eastern Coast',
  'ภาคใต้ฝั่งตะวันออก': 'Southern East Coast',
  'ภาคใต้ฝั่งตะวันตก': 'Southern West Coast',
  'ลุ่มน้ำหลัก': 'Main River Basin'
};

export const AGENCY_EN_MAP = {
  'สสน.': 'HII',
  'สถาบันสารสนเทศทรัพยากรน้ำ': 'HII (Hydro-Informatics Institute)',
  'กรมชลประทาน': 'RID (Royal Irrigation Department)',
  'ชป.': 'RID',
  'กฟผ.': 'EGAT',
  'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย': 'EGAT (Electricity Generating Authority of Thailand)',
  'การไฟฟ้าฝ่ายผลิตฯ (EGAT)': 'EGAT',
  'กรมทางหลวง': 'DOH (Department of Highways)',
  'กรมทางหลวง (DOH)': 'DOH (Department of Highways)',
  'สำนักการระบายน้ำ กทม.': 'BMA DDS (Bangkok Drainage Department)',
  'กรมอุตุนิยมวิทยา': 'TMD (Thai Meteorological Department)',
  'กรมทรัพยากรธรณี': 'DMR (Department of Mineral Resources)',
  'สวทช.': 'NSTDA (Traffy Fondue)'
};

/**
 * Dynamic Entity Localization with Seamless Fallback
 * Returns English name if mode is 'en' and entity has English data,
 * otherwise falls back to Thai name.
 */
export function localizeName(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (currentLanguage === 'en') {
    if (item.name_en && item.name_en !== item.name && typeof item.name_en === 'string' && item.name_en.trim()) {
      return item.name_en;
    }
    if (item.shortName_en && item.shortName_en !== item.shortName && typeof item.shortName_en === 'string' && item.shortName_en.trim()) {
      return item.shortName_en;
    }
    // Dam & reservoir prefix translation
    if (item.name && typeof item.name === 'string') {
      if (item.name.startsWith('เขื่อน')) {
        const core = item.name.replace(/^เขื่อน/, '').trim();
        return `${core} Dam`;
      }
      if (item.name.startsWith('อ่างเก็บน้ำ')) {
        const core = item.name.replace(/^อ่างเก็บน้ำ/, '').trim();
        return `${core} Reservoir`;
      }
    }
  }
  return item.name || item.shortName || '';
}

export function localizeProvince(item) {
  if (!item) return '';
  let provTh = typeof item === 'string' ? item : (item.province || item.province_th || '');
  provTh = provTh.replace(/^จ\.\s*/, '').trim();
  if (currentLanguage === 'en') {
    if (typeof item === 'object' && item.province_en && item.province_en !== provTh && typeof item.province_en === 'string' && item.province_en.trim()) {
      return item.province_en;
    }
    if (THAI_PROVINCE_EN_MAP[provTh]) {
      return THAI_PROVINCE_EN_MAP[provTh];
    }
  }
  return provTh;
}

export function formatDateTimeCE(dateInput, lang = currentLanguage) {
  if (!dateInput) return '';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return localizeDateTime(String(dateInput));
  }
  const day = d.getDate();
  const year = d.getFullYear(); // Strictly Common Era (ค.ศ.)
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');

  if (lang === 'en') {
    const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${EN_MONTHS[d.getMonth()]} ${year} ${hours}:${mins}`;
  } else {
    const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${day} ${TH_MONTHS[d.getMonth()]} ${year} ${hours}:${mins} น.`;
  }
}

export function formatUnit(value, unitType, lang = currentLanguage) {
  const isEn = lang === 'en';
  const valStr = (value !== null && value !== undefined && value !== '') ? String(value) : '';
  const prefix = valStr ? `${valStr} ` : '';
  switch (unitType) {
    case 'm_msl':
      return isEn ? `${prefix}m MSL` : `${prefix}ม. (รทก.)`;
    case 'm':
      return isEn ? `${prefix}m` : `${prefix}ม.`;
    case 'cm':
      return isEn ? `${prefix}cm` : `${prefix}ซม.`;
    case 'km':
      return isEn ? `${prefix}km` : `${prefix}กม.`;
    case 'mm':
      return isEn ? `${prefix}mm` : `${prefix}มม.`;
    case 'm3_s':
      return isEn ? `${prefix}m³/s` : `${prefix}ลบ.ม./วินาที`;
    case 'million_m3':
      return isEn ? `${prefix}Million m³` : `${prefix}ล้าน ลบ.ม.`;
    case 'million_m3_day':
      return isEn ? `${prefix}Million m³/day` : `${prefix}ล้าน ลบ.ม./วัน`;
    case 'kmh':
      return isEn ? `${prefix}km/h` : `${prefix}กม./ชม.`;
    case 'celsius':
      return `${valStr}°C`;
    default:
      return valStr;
  }
}

export function localizeDateTime(dtStr) {
  if (!dtStr) return '';
  let str = String(dtStr).trim();
  // Ensure year is strictly CE (convert any 4-digit Buddhist year 25xx to CE by subtracting 543)
  str = str.replace(/\b(25[0-9]{2})\b/g, (match) => String(parseInt(match, 10) - 543));

  if (currentLanguage !== 'en') {
    return str;
  }
  let clean = str.replace(/\s*น\.?$/, '').trim();
  const TH_TO_EN_MONTHS = {
    'ม.ค.': 'Jan', 'ก.พ.': 'Feb', 'มี.ค.': 'Mar', 'เม.ย.': 'Apr',
    'พ.ค.': 'May', 'มิ.ย.': 'Jun', 'ก.ค.': 'Jul', 'ส.ค.': 'Aug',
    'ก.ย.': 'Sep', 'ต.ค.': 'Oct', 'พ.ย.': 'Nov', 'ธ.ค.': 'Dec'
  };
  for (const [thM, enM] of Object.entries(TH_TO_EN_MONTHS)) {
    if (clean.includes(thM)) {
      clean = clean.replace(thM, enM);
      break;
    }
  }
  return clean;
}

export function localizeBasin(item) {
  if (!item) return '';
  const basinTh = typeof item === 'string' ? item : (item.basin || item.basin_th || '');
  if (currentLanguage === 'en') {
    if (typeof item === 'object' && item.basin_en && item.basin_en !== basinTh && typeof item.basin_en === 'string' && item.basin_en.trim()) {
      return item.basin_en;
    }
    if (BASIN_EN_MAP[basinTh]) {
      return BASIN_EN_MAP[basinTh];
    }
  }
  return basinTh;
}

export function localizeAgency(item) {
  if (!item) return '';
  const agencyTh = typeof item === 'string' ? item : (item.agency || item.agencyShort || item.agency_th || '');
  if (currentLanguage === 'en') {
    if (typeof item === 'object' && item.agency_en && item.agency_en !== agencyTh && typeof item.agency_en === 'string' && item.agency_en.trim()) {
      return item.agency_en;
    }
    if (AGENCY_EN_MAP[agencyTh]) {
      return AGENCY_EN_MAP[agencyTh];
    }
  }
  return agencyTh;
}

export const THAI_REGION_EN_MAP = {
  'ภาคเหนือ': 'Northern Region',
  'ภาคกลาง': 'Central Region',
  'ภาคตะวันออกเฉียงเหนือ': 'Northeastern Region',
  'ภาคอีสาน': 'Northeastern Region',
  'ภาคตะวันออก': 'Eastern Region',
  'ภาคตะวันตก': 'Western Region',
  'ภาคใต้': 'Southern Region'
};

export function localizeRegion(region) {
  if (!region) return '';
  const regStr = typeof region === 'string' ? region : (region.region || region.name || '');
  if (currentLanguage === 'en') {
    if (typeof region === 'object' && region.region_en && typeof region.region_en === 'string' && region.region_en.trim()) {
      return region.region_en;
    }
    if (THAI_REGION_EN_MAP[regStr]) {
      return THAI_REGION_EN_MAP[regStr];
    }
  }
  return regStr;
}


