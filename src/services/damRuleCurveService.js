/**
 * Dam Rule Curve Service for ThaiFlood
 * Provides Upper Rule Curve (URC) and Lower Rule Curve (LRC) thresholds,
 * annual seasonal curves, and operational zone classifications for major Thai reservoirs.
 * Standards derived from Royal Irrigation Department (RID) & EGAT dam operating guidelines.
 */

// 24 Semi-Monthly control points throughout the year (Jan 1 to Dec 16)
// Defines typical baseline operational curves by dam basin/typology (% of normal storage)
const TYPICAL_RULE_CURVES = {
  // 1. Northern Massive Carryover Reservoirs (Bhumibol, Sirikit)
  northern_major: {
    urc: [78, 75, 70, 65, 58, 52, 48, 52, 58, 65, 72, 78, 84, 88, 92, 95, 96, 95, 92, 88, 85, 82, 80, 78],
    lrc: [48, 45, 42, 38, 35, 32, 30, 31, 33, 36, 40, 44, 48, 52, 55, 58, 60, 58, 56, 54, 52, 50, 49, 48]
  },
  // 2. Central / Flood Retention Reservoirs (Pasak Jolasid, Khwae Noi, Khun Dan)
  flood_retention: {
    urc: [70, 60, 50, 40, 32, 28, 25, 30, 38, 48, 60, 72, 82, 90, 96, 100, 100, 98, 92, 85, 78, 74, 72, 70],
    lrc: [35, 28, 22, 18, 15, 14, 15, 18, 22, 28, 35, 42, 50, 58, 65, 70, 70, 65, 55, 48, 42, 38, 36, 35]
  },
  // 3. Northeastern Multi-purpose Reservoirs (Ubol Ratana, Lam Pao, Lam Takhong, Sirindhorn)
  northeastern: {
    urc: [76, 72, 66, 60, 54, 48, 44, 48, 54, 62, 70, 78, 85, 90, 94, 96, 95, 92, 88, 84, 80, 78, 77, 76],
    lrc: [44, 40, 36, 32, 28, 25, 24, 26, 30, 35, 42, 48, 54, 60, 64, 66, 65, 62, 58, 54, 50, 47, 45, 44]
  },
  // 4. Western Hydroelectric Reservoirs (Srinagarind, Vajiralongkorn)
  western: {
    urc: [82, 80, 76, 72, 68, 64, 62, 65, 70, 76, 82, 86, 90, 93, 95, 96, 95, 93, 90, 87, 85, 84, 83, 82],
    lrc: [55, 52, 48, 44, 40, 38, 36, 38, 42, 46, 52, 58, 62, 66, 70, 72, 72, 70, 66, 62, 59, 57, 56, 55]
  },
  // 5. Southern Monsoon Reservoirs (Rajjaprabha, Bang Lang - peak monsoon in Nov-Jan)
  southern: {
    urc: [90, 92, 88, 82, 76, 70, 65, 62, 60, 62, 66, 72, 76, 80, 84, 88, 92, 95, 96, 95, 94, 92, 91, 90],
    lrc: [60, 62, 58, 52, 46, 42, 38, 36, 35, 36, 40, 45, 50, 54, 60, 65, 70, 74, 75, 74, 70, 66, 62, 60]
  }
};

// Specific mapping of key major dams to their respective operational profile
const DAM_PROFILE_MAP = {
  // Northern
  'ภูมิพล': 'northern_major',
  'สิริกิติ์': 'northern_major',
  'กิ่วลม': 'northern_major',
  'กิ่วคอหมา': 'northern_major',
  'แม่กวงอุดมธารา': 'northern_major',
  'แม่มอก': 'northern_major',
  // Central / Flood retention
  'ป่าสักชลสิทธิ์': 'flood_retention',
  'แควน้อยบำรุงแดน': 'flood_retention',
  'ขุนด่านปราการชล': 'flood_retention',
  'ทับเสลา': 'flood_retention',
  'กระเสียว': 'flood_retention',
  'นฤบดินทรจินดา': 'flood_retention',
  // Northeastern
  'อุบลรัตน์': 'northeastern',
  'สิรินธร': 'northeastern',
  'จุฬาภรณ์': 'northeastern',
  'ลำปาว': 'northeastern',
  'ลำตะคอง': 'northeastern',
  'ลำพระเพลิง': 'northeastern',
  'มูลบน': 'northeastern',
  'ลำแซะ': 'northeastern',
  'ลำนางรอง': 'northeastern',
  'ห้วยหลวง': 'northeastern',
  'น้ำอูน': 'northeastern',
  'น้ำพุง': 'northeastern',
  // Western
  'ศรีนครินทร์': 'western',
  'วชิราลงกรณ': 'western',
  'แก่งกระจาน': 'western',
  'ปราณบุรี': 'western',
  // Eastern
  'บางพระ': 'flood_retention',
  'หนองปลาไหล': 'flood_retention',
  'ประแสร์': 'flood_retention',
  'คลองสียัด': 'flood_retention',
  // Southern
  'รัชชประภา': 'southern',
  'บางลาง': 'southern'
};

/**
 * Calculates current semi-monthly interpolation index (0 to 23) from a date
 */
function getSemiMonthIndex(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth(); // 0 to 11
  const day = d.getDate(); // 1 to 31
  const half = day <= 15 ? 0 : 1;
  const index = month * 2 + half;
  const progressInHalf = day <= 15 ? (day - 1) / 14 : (day - 16) / 15;
  return { index, nextIndex: (index + 1) % 24, progress: Math.max(0, Math.min(1, progressInHalf)) };
}

/**
 * Calculates Rule Curve metrics for a given dam
 * @param {Object} dam - Dam object with name, percentStorage, normalStorage
 * @param {Date|string} date - Evaluation date
 * @returns {Object} Rule Curve assessment with URC/LRC thresholds, status zone, and recommendations
 */
export function evaluateDamRuleCurve(dam, date = new Date()) {
  if (!dam) return null;

  // Determine profile
  let profileKey = 'northeastern';
  const damName = dam.shortName || dam.name || '';
  for (const [key, val] of Object.entries(DAM_PROFILE_MAP)) {
    if (damName.includes(key)) {
      profileKey = val;
      break;
    }
  }

  const profile = TYPICAL_RULE_CURVES[profileKey] || TYPICAL_RULE_CURVES.flood_retention;
  const { index, nextIndex, progress } = getSemiMonthIndex(date);

  // Linear interpolation between semi-monthly control points
  const urcBase = profile.urc[index];
  const urcNext = profile.urc[nextIndex];
  const urcPercent = Number((urcBase + (urcNext - urcBase) * progress).toFixed(1));

  const lrcBase = profile.lrc[index];
  const lrcNext = profile.lrc[nextIndex];
  const lrcPercent = Number((lrcBase + (lrcNext - lrcBase) * progress).toFixed(1));

  const percentStorage = typeof dam.percentStorage === 'number'
    ? dam.percentStorage
    : parseFloat(dam.percentStorage) || 0;

  const normalStorage = dam.normalStorage || (dam.maxStorage ? dam.maxStorage * 0.9 : 100);
  const urcStorage = Number(((urcPercent / 100) * normalStorage).toFixed(2));
  const lrcStorage = Number(((lrcPercent / 100) * normalStorage).toFixed(2));

  // Operational Zone Evaluation
  let zone = 'normal';
  let zoneLabel = 'อยู่ในเกณฑ์ควบคุมปกติ (Normal Zone)';
  let zoneColor = '#0284c7';
  let badgeBg = '#f0f9ff';
  let border = '#38bdf8';
  let advice = 'ปริมาณน้ำอยู่ในเกณฑ์ควบคุมมาตรฐานระหว่าง URC และ LRC บริหารจัดการระบายน้ำตามแผนปกติ';

  if (percentStorage > urcPercent) {
    const diff = Number((percentStorage - urcPercent).toFixed(1));
    zone = 'above_urc';
    zoneLabel = `🔴 เหนือเกณฑ์ควบคุมตอนบน (+${diff}% จาก URC)`;
    zoneColor = '#dc2626';
    badgeBg = '#fef2f2';
    border = '#ef4444';
    advice = 'ปริมาณน้ำเกินเส้นเกณฑ์ควบคุมตอนบน (URC) เสี่ยงน้ำล้นอาคารระบายน้ำล้น เขื่อนจำเป็นต้องปรับเพิ่มการระบายน้ำเพื่อควบคุมระดับน้ำให้อยู่ในเกณฑ์ปลอดภัย';
  } else if (percentStorage < lrcPercent) {
    const diff = Number((lrcPercent - percentStorage).toFixed(1));
    zone = 'below_lrc';
    zoneLabel = `🟡 ต่ำกว่าเกณฑ์ควบคุมตอนล่าง (-${diff}% จาก LRC)`;
    zoneColor = '#d97706';
    badgeBg = '#fffbeb';
    border = '#f59e0b';
    advice = 'ปริมาณน้ำต่ำกว่าเส้นเกณฑ์ควบคุมตอนล่าง (LRC) เสี่ยงต่อปัญหาภัยแล้งและขาดแคลนน้ำเพื่อการเกษตรและอุปโภค ควรจำกัดการระบายน้ำเฉพาะเพื่อการรักษาระบบนิเวศ';
  }

  // Generate 12-month summary for UI charts
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const annualPoints = months.map((m, mIdx) => ({
    month: m,
    urc: profile.urc[mIdx * 2],
    lrc: profile.lrc[mIdx * 2]
  }));

  return {
    profileKey,
    urcPercent,
    lrcPercent,
    urcStorage,
    lrcStorage,
    percentStorage,
    zone,
    zoneLabel,
    zoneColor,
    badgeBg,
    border,
    advice,
    annualPoints
  };
}
