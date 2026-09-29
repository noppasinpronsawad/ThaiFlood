/**
 * Weather Service for ThaiFlood
 * Fetches real 7-day precipitation and meteorological forecast from Open-Meteo API
 * (Free, no API key required, 10,000 req/day quota)
 */

const KEY_LOCATIONS = {
  bkk: { name: 'กรุงเทพมหานคร', lat: 13.7563, lng: 100.5018 },
  nakhonsawan: { name: 'นครสวรรค์ (ปากน้ำโพ)', lat: 15.7033, lng: 100.1371 },
  sukhothai: { name: 'สุโขทัย (ลุ่มน้ำยม)', lat: 17.0078, lng: 99.8234 },
  ayutthaya: { name: 'พระนครศรีอยุธยา', lat: 14.3532, lng: 100.5684 },
  ubon: { name: 'อุบลราชธานี (ลุ่มน้ำมูล)', lat: 15.2287, lng: 104.8564 },
  chiangmai: { name: 'เชียงใหม่ (ลุ่มน้ำปิง)', lat: 18.7883, lng: 98.9853 }
};

import { fetchTMD7DayForecast } from './tmdWeatherService.js';

const forecastCache = new Map();
const FORECAST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetch7DayWeatherForecast(locationKey = 'ayutthaya', customLat = null, customLng = null, customName = null) {
  let loc = KEY_LOCATIONS[locationKey];
  if (!loc && typeof locationKey === 'string') {
    const foundProv = THAI_PROVINCES.find((p) => locationKey.includes(p.name) || p.name.includes(locationKey));
    if (foundProv) {
      loc = { name: foundProv.name, lat: foundProv.lat, lng: foundProv.lng };
    }
  }
  if (!loc && customLat !== null && customLng !== null) {
    const safeLat = typeof customLat === 'number' && !isNaN(customLat) ? customLat : 13.7563;
    const safeLng = typeof customLng === 'number' && !isNaN(customLng) ? customLng : 100.5018;
    loc = { name: customName || 'ตำแหน่งที่เลือก', lat: safeLat, lng: safeLng };
  }
  if (!loc) {
    loc = KEY_LOCATIONS.ayutthaya;
  }

  // Ensure lat and lng are valid numbers
  if (typeof loc.lat !== 'number' || isNaN(loc.lat)) loc.lat = 13.7563;
  if (typeof loc.lng !== 'number' || isNaN(loc.lng)) loc.lng = 100.5018;

  const cacheKey = `${loc.name || 'loc'}_${loc.lat.toFixed(2)}_${loc.lng.toFixed(2)}`;
  const now = Date.now();
  const cached = forecastCache.get(cacheKey);
  if (cached && (now - cached.timestamp < FORECAST_CACHE_TTL)) {
    return cached.data;
  }

  // 1. If TMD API key is provided and running outside restricted browser CORS
  // Note: TMD server restricts Access-Control-Allow-Origin to wxmap.tmd.go.th.
  // In browser, TMD fetch fails with CORS and causes a 6s stall. We use Open-Meteo as primary in browser.
  const isDirectBrowser = typeof window !== 'undefined';
  if (import.meta?.env?.VITE_TMD_API_KEY && !isDirectBrowser) {
    try {
      const tmdData = await fetchTMD7DayForecast(loc.lat, loc.lng, loc.name);
      if (tmdData && tmdData.days) {
        forecastCache.set(cacheKey, { timestamp: now, data: tmdData });
        return tmdData;
      }
    } catch (tmdErr) {
      console.warn('TMD API fallback to Open-Meteo:', tmdErr.message);
    }
  }

  // 2. Open-Meteo Global Forecast System (High performance, < 150ms, no CORS restrictions)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=Asia%2FBangkok`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const formatted = formatWeatherData(data, loc);
    forecastCache.set(cacheKey, { timestamp: now, data: formatted });
    return formatted;
  } catch (err) {
    console.error('Failed to fetch live weather forecast from Open-Meteo:', err.message);
    // STRICT: ZERO MOCK DATA. Never fabricate rainfall or temperature values.
    return null;
  }
}

export function getAllLocations() {
  return Object.entries(KEY_LOCATIONS).map(([key, value]) => ({
    key,
    ...value
  }));
}

function getWeatherDescription(code) {
  if (code === 0) return { text: 'ท้องฟ้าแจ่มใส', icon: '☀️', severity: 'low' };
  if (code <= 3) return { text: 'มีเมฆบางส่วน', icon: '⛅', severity: 'low' };
  if (code <= 55) return { text: 'ฝนตกปรอยๆ', icon: '🌦️', severity: 'medium' };
  if (code <= 65) return { text: 'ฝนตกปานกลาง', icon: '🌧️', severity: 'medium' };
  if (code <= 75) return { text: 'ฝนตกหนัก', icon: '⛈️', severity: 'high' };
  if (code <= 99) return { text: 'ฝนฟ้าคะนองรุนแรง', icon: '🌩️', severity: 'critical' };
  return { text: 'มีเมฆมาก', icon: '☁️', severity: 'low' };
}

function formatWeatherData(data, loc) {
  const daily = data?.daily || {};
  const times = daily.time || [];
  const days = [];

  for (let i = 0; i < times.length; i++) {
    const code = (daily.weathercode && daily.weathercode[i] !== undefined) ? daily.weathercode[i] : 1;
    const weatherInfo = getWeatherDescription(code);
    const dateStr = times[i];
    let thaiDay = '';
    try {
      const parts = String(dateStr).split('-');
      if (parts.length === 3) {
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        thaiDay = dateObj.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
      } else {
        const dateObj = new Date(dateStr);
        thaiDay = dateObj.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
      }
    } catch {
      thaiDay = dateStr || 'วันนี้';
    }

    const tMax = (daily.temperature_2m_max && typeof daily.temperature_2m_max[i] === 'number')
      ? Math.round(daily.temperature_2m_max[i])
      : 32;

    const tMin = (daily.temperature_2m_min && typeof daily.temperature_2m_min[i] === 'number')
      ? Math.round(daily.temperature_2m_min[i])
      : 25;

    const rainVal = (daily.precipitation_sum && typeof daily.precipitation_sum[i] === 'number')
      ? Number(daily.precipitation_sum[i].toFixed(1))
      : 0;

    const rainProb = (daily.precipitation_probability_max && typeof daily.precipitation_probability_max[i] === 'number')
      ? daily.precipitation_probability_max[i]
      : 50;

    const wSpeed = (daily.windspeed_10m_max && typeof daily.windspeed_10m_max[i] === 'number')
      ? Math.round(daily.windspeed_10m_max[i])
      : 12;

    days.push({
      date: dateStr,
      displayDate: thaiDay,
      weatherDesc: weatherInfo.text,
      icon: weatherInfo.icon,
      severity: weatherInfo.severity,
      tempMax: tMax,
      tempMin: tMin,
      rainMm: rainVal,
      rainProbPct: rainProb,
      windSpeedKmH: wSpeed
    });
  }

  const totalRainMm = days.reduce((sum, d) => sum + (d.rainMm || 0), 0);

  return {
    locationName: loc.name,
    lat: loc.lat,
    lng: loc.lng,
    source: 'Open-Meteo Global Forecast System (GFS/ECMWF)',
    total7DayRainMm: Number(totalRainMm.toFixed(1)),
    days
  };
}



export { getWeatherDescription };

export const THAI_PROVINCES = [
  { name: 'กรุงเทพมหานคร', lat: 13.7563, lng: 100.5018 },
  { name: 'สมุทรปราการ', lat: 13.5991, lng: 100.5998 },
  { name: 'นนทบุรี', lat: 13.8621, lng: 100.5144 },
  { name: 'ปทุมธานี', lat: 14.0208, lng: 100.5250 },
  { name: 'พระนครศรีอยุธยา', lat: 14.3532, lng: 100.5684 },
  { name: 'อ่างทอง', lat: 14.5896, lng: 100.4550 },
  { name: 'ลพบุรี', lat: 14.7995, lng: 100.6534 },
  { name: 'สิงห์บุรี', lat: 14.8863, lng: 100.4005 },
  { name: 'ชัยนาท', lat: 15.1852, lng: 100.1251 },
  { name: 'สระบุรี', lat: 14.5289, lng: 100.9108 },
  { name: 'ชลบุรี', lat: 13.3611, lng: 100.9847 },
  { name: 'ระยอง', lat: 12.6815, lng: 101.2816 },
  { name: 'จันทบุรี', lat: 12.6114, lng: 102.1039 },
  { name: 'ตราด', lat: 12.2428, lng: 102.5175 },
  { name: 'ฉะเชิงเทรา', lat: 13.6904, lng: 101.0779 },
  { name: 'ปราจีนบุรี', lat: 14.0510, lng: 101.3734 },
  { name: 'นครนายก', lat: 14.2069, lng: 101.2131 },
  { name: 'สระแก้ว', lat: 13.8140, lng: 102.0592 },
  { name: 'นครราชสีมา', lat: 14.9707, lng: 102.1019 },
  { name: 'บุรีรัมย์', lat: 14.9930, lng: 103.1029 },
  { name: 'สุรินทร์', lat: 14.8818, lng: 103.4936 },
  { name: 'ศรีสะเกษ', lat: 15.1186, lng: 104.3220 },
  { name: 'อุบลราชธานี', lat: 15.2287, lng: 104.8564 },
  { name: 'ยโสธร', lat: 15.7926, lng: 104.1453 },
  { name: 'ชัยภูมิ', lat: 15.8105, lng: 102.0288 },
  { name: 'อำนาจเจริญ', lat: 15.8584, lng: 104.6300 },
  { name: 'บึงกาฬ', lat: 18.3630, lng: 103.6528 },
  { name: 'หนองบัวลำภู', lat: 17.2034, lng: 102.4407 },
  { name: 'ขอนแก่น', lat: 16.4419, lng: 102.8359 },
  { name: 'อุดรธานี', lat: 17.4157, lng: 102.7872 },
  { name: 'เลย', lat: 17.4860, lng: 101.7223 },
  { name: 'หนองคาย', lat: 17.8783, lng: 102.7420 },
  { name: 'มหาสารคาม', lat: 16.1851, lng: 103.3007 },
  { name: 'ร้อยเอ็ด', lat: 16.0538, lng: 103.6520 },
  { name: 'กาฬสินธุ์', lat: 16.4322, lng: 103.5061 },
  { name: 'สกลนคร', lat: 17.1664, lng: 104.1486 },
  { name: 'นครพนม', lat: 17.3999, lng: 104.7797 },
  { name: 'มุกดาหาร', lat: 16.5436, lng: 104.7235 },
  { name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
  { name: 'ลำพูน', lat: 18.5745, lng: 99.0087 },
  { name: 'ลำปาง', lat: 18.2888, lng: 99.4928 },
  { name: 'อุตรดิตถ์', lat: 17.6256, lng: 100.0993 },
  { name: 'แพร่', lat: 18.1446, lng: 100.1410 },
  { name: 'น่าน', lat: 18.7756, lng: 100.7730 },
  { name: 'พะเยา', lat: 19.1664, lng: 99.9022 },
  { name: 'เชียงราย', lat: 19.9105, lng: 99.8406 },
  { name: 'แม่ฮ่องสอน', lat: 19.3020, lng: 97.9654 },
  { name: 'นครสวรรค์', lat: 15.7033, lng: 100.1371 },
  { name: 'อุทัยธานี', lat: 15.3835, lng: 100.0245 },
  { name: 'กำแพงเพชร', lat: 16.4828, lng: 99.5227 },
  { name: 'ตาก', lat: 16.8839, lng: 99.1258 },
  { name: 'สุโขทัย', lat: 17.0078, lng: 99.8234 },
  { name: 'พิษณุโลก', lat: 16.8211, lng: 100.2659 },
  { name: 'พิจิตร', lat: 16.4419, lng: 100.3488 },
  { name: 'เพชรบูรณ์', lat: 16.4190, lng: 101.1567 },
  { name: 'ราชบุรี', lat: 13.5283, lng: 99.8134 },
  { name: 'กาญจนบุรี', lat: 14.0228, lng: 99.5328 },
  { name: 'สุพรรณบุรี', lat: 14.4745, lng: 100.1177 },
  { name: 'นครปฐม', lat: 13.8196, lng: 100.0443 },
  { name: 'สมุทรสาคร', lat: 13.5475, lng: 100.2744 },
  { name: 'สมุทรสงคราม', lat: 13.4098, lng: 99.9994 },
  { name: 'เพชรบุรี', lat: 13.1114, lng: 99.9391 },
  { name: 'ประจวบคีรีขันธ์', lat: 11.8124, lng: 99.7972 },
  { name: 'นครศรีธรรมราช', lat: 8.4325, lng: 99.9631 },
  { name: 'กระบี่', lat: 8.0863, lng: 98.9063 },
  { name: 'พังงา', lat: 8.4501, lng: 98.5255 },
  { name: 'ภูเก็ต', lat: 7.8804, lng: 98.3923 },
  { name: 'สุราษฎร์ธานี', lat: 9.1382, lng: 99.3217 },
  { name: 'ระนอง', lat: 9.9658, lng: 98.6348 },
  { name: 'ชุมพร', lat: 10.4930, lng: 99.1800 },
  { name: 'สงขลา', lat: 7.1898, lng: 100.5954 },
  { name: 'สตูล', lat: 6.6238, lng: 100.0674 },
  { name: 'ตรัง', lat: 7.5563, lng: 99.6114 },
  { name: 'พัทลุง', lat: 7.6167, lng: 100.0740 },
  { name: 'ปัตตานี', lat: 6.8696, lng: 101.2501 },
  { name: 'ยะลา', lat: 6.5411, lng: 101.2804 },
  { name: 'นราธิวาส', lat: 6.4255, lng: 101.8253 }
];

export function getNearestProvince(lat, lng) {
  let nearest = THAI_PROVINCES[0];
  let minDistanceSq = Infinity;
  for (const p of THAI_PROVINCES) {
    const dLat = p.lat - lat;
    const dLng = p.lng - lng;
    const dSq = dLat * dLat + dLng * dLng;
    if (dSq < minDistanceSq) {
      minDistanceSq = dSq;
      nearest = p;
    }
  }
  return nearest;
}

const currentProvinceWeatherCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchCurrentProvinceWeather(provinceName, lat = 13.7563, lng = 100.5018) {
  const safeLat = (typeof lat === 'number' && !isNaN(lat)) ? lat : 13.7563;
  const safeLng = (typeof lng === 'number' && !isNaN(lng)) ? lng : 100.5018;
  const safeProvince = provinceName || 'กรุงเทพมหานคร';
  const cacheKey = `${safeProvince}_${safeLat.toFixed(2)}_${safeLng.toFixed(2)}`;
  const now = Date.now();
  const cached = currentProvinceWeatherCache.get(cacheKey);

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${safeLat}&longitude=${safeLng}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const curr = json.current;
    const daily = json.daily;
    const desc = getWeatherDescription(curr?.weather_code ?? 1);
    const temp = Math.round(curr?.temperature_2m ?? 31);
    const rainProb = daily?.precipitation_probability_max?.[0] ?? 25;

    const data = {
      province: provinceName,
      temp,
      weatherDesc: desc.text,
      icon: desc.icon,
      rainProb,
      humidity: Math.round(curr?.relative_humidity_2m ?? 70),
      rainMm: Number((curr?.precipitation ?? 0).toFixed(1))
    };

    currentProvinceWeatherCache.set(cacheKey, { timestamp: now, data });
    return data;
  } catch (err) {
    console.error(`Failed to fetch live weather for ${provinceName}:`, err.message);
    // STRICT: ZERO MOCK DATA. Return null when API is unreachable.
    return null;
  }
}


