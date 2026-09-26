/**
 * Geology Service - DMR 1:250,000 Rock Unit Integration
 * Queries Department of Mineral Resources (กรมทรัพยากรธรณี) ArcGIS REST API
 * Provides symbol decoding, Thai descriptions, and coordinate identification
 */

// Comprehensive dictionary of Thai DMR 1:250k Geological Symbols
const DMR_ROCK_DICTIONARY = {
  // Quaternary
  'Qa': {
    name: 'ตะกอนน้ำพา ปัจจุบัน (Alluvium)',
    age: 'ควอเทอร์นารี (Quaternary - ปัจจุบัน)',
    rockType: 'ตะกอนน้ำพาริมแม่น้ำ/ที่ราบน้ำท่วมถึง',
    desc: 'กรวด ทราย ทรายแป้ง ดินเหนียว สะสมตัวตามลำน้ำและที่ราบลุ่มน้ำท่วมถึง มีความพรุนและการซึมน้ำสูง'
  },
  'Qc': {
    name: 'ตะกอนเศษหินเชิงเขา (Colluvium)',
    age: 'ควอเทอร์นารี (Quaternary)',
    rockType: 'ตะกอนลาดเขาและเศษหินเชิงเขา',
    desc: 'เศษหิน ดิน ทราย ที่หลุดร่วงจากหน้าผาหรือไหลเลื่อนสะสมตัวบริเวณตีนเขา'
  },
  'Qt': {
    name: 'ตะกอนตะพักลำน้ำ (Terrace Deposits)',
    age: 'ควอเทอร์นารี (Pleistocene - Holocene)',
    rockType: 'ตะกอนขั้นบันไดลำน้ำ',
    desc: 'กรวดมน ทราย และดินเหนียว สะสมตัวตามแนวตะพักลำน้ำระดับต่ำถึงระดับสูง'
  },
  'Qmc': {
    name: 'ตะกอนชายหาดและทะเล (Marine & Coastal)',
    age: 'ควอเทอร์นารี (Holocene)',
    rockType: 'ตะกอนชายฝั่งทะเลและสันทราย',
    desc: 'ทรายชายหาด สันทราย ชายฝั่ง ตะกอนโคลนป่าชายเลน และตะกอนน้ำกร่อย'
  },
  'Q': {
    name: 'ตะกอนยุคควอเทอร์นารี (Quaternary Deposits)',
    age: 'ควอเทอร์นารี (Quaternary)',
    rockType: 'ตะกอนร่วนผิวดิน',
    desc: 'ตะกอนร่วน กรวด ทราย ดินเหนียวที่ยังไม่จับตัวเป็นหินแข็ง'
  },

  // Tertiary
  'Tbs': {
    name: 'หินบะซอลต์ ยุคเทอร์เชียรี (Tertiary Basalt)',
    age: 'เทอร์เชียรี (Tertiary)',
    rockType: 'หินอัคนีภูเขาไฟ (หินบะซอลต์)',
    desc: 'หินภูเขาไฟสีดำ เนื้อละเอียด มีรูพรุนฟองก๊าซ มักพบบริเวณที่ราบสูงและภูเขาไฟเก่า'
  },
  'Tv': {
    name: 'หินภูเขาไฟ ยุคเทอร์เชียรี (Tertiary Volcanics)',
    age: 'เทอร์เชียรี (Tertiary)',
    rockType: 'หินภูเขาไฟและเถ้าภูเขาไฟ',
    desc: 'หินไรโอไลต์ แอนดีไซต์ และหินกรวดภูเขาไฟ'
  },
  'T': {
    name: 'หินตะกอน ยุคเทอร์เชียรี (Tertiary Sediments)',
    age: 'เทอร์เชียรี (Tertiary - แอ่งสะสมตัวบก/น้ำจืด)',
    rockType: 'หินตะกอนแอ่งน้ำจืด',
    desc: 'หินดินดาน หินโคลน หินทราย และลิกไนต์ แหล่งสะสมเชื้อเพลิงธรรมชาติ'
  },

  // Mesozoic (Cretaceous, Jurassic, Triassic) - Khorat Group
  'JKpw': {
    name: 'หมวดหินภูพานและพระวิหาร (Phu Phan & Phra Wihan)',
    age: 'จูแรสซิก - ครีเทเชียส (Jurassic - Cretaceous)',
    rockType: 'หินทรายต้านทานการผุพัง (กลุ่มหินโคราช)',
    desc: 'หินทรายเนื้อควอตซ์สีขาว หินกรวดมน ทนทาน มักเกิดเป็นหน้าผาชันและสันเขาของที่ราบสูงโคราช'
  },
  'K': {
    name: 'หินตะกอน ยุคครีเทเชียส (Cretaceous)',
    age: 'ครีเทเชียส (Cretaceous)',
    rockType: 'หินทราย หินทรายแป้ง และหินโคลน',
    desc: 'หินตะกอนสีแดงและน้ำตาลแดงของกลุ่มหินโคราช (หมวดหินโคกกรวด ภูพาน เสาขัว)'
  },
  'J': {
    name: 'หินตะกอน ยุคจูแรสซิก (Jurassic)',
    age: 'จูแรสซิก (Jurassic)',
    rockType: 'หินทรายและหินโคลนบนบก',
    desc: 'หินทรายสีน้ำตาลแดง สลับหินดินดานและหินโคลนของกลุ่มหินโคราช'
  },
  'Tr': {
    name: 'หินตะกอน ยุคไทรแอสซิก (Triassic)',
    age: 'ไทรแอสซิก (Triassic)',
    rockType: 'หินทราย หินดินดาน และหินกรวดมน',
    desc: 'หินตะกอนน้ำตื้นสลับบก เช่น กลุ่มหินลำปาง'
  },
  'Trgr': {
    name: 'หินแกรนิต ยุคไทรแอสซิก (Triassic Granite)',
    age: 'ไทรแอสซิก (Triassic - หินอัคนีแทรกซอน)',
    rockType: 'หินอัคนีแทรกซอน (หินแกรนิต)',
    desc: 'หินแกรนิตเนื้อผลึกหยาบถึงปานกลาง แข็งแกร่ง มักเป็นแนวเทือกเขาแกนหลักของประเทศ'
  },
  'PTrv': {
    name: 'หินภูเขาไฟ ยุคเพอร์เมียน-ไทรแอสซิก (Permo-Triassic Volcanics)',
    age: 'เพอร์เมียน - ไทรแอสซิก (Permian - Triassic)',
    rockType: 'หินภูเขาไฟโบราณ',
    desc: 'หินแอนดีไซต์ ไรโอไลต์ และทัฟฟ์ แนวภูเขาไฟแนวรอยต่อแผ่นเปลือกโลก'
  },

  // Paleozoic (Permian, Carboniferous, Devonian, Silurian, Ordovician, Cambrian)
  'P': {
    name: 'หินปูนและหินตะกอน ยุคเพอร์เมียน (Permian Limestone)',
    age: 'เพอร์เมียน (Permian - หินยุคคาร์บอนเนต)',
    rockType: 'หินปูน ภูมิประเทศแบบคาสต์ (Karst)',
    desc: 'หินปูนเนื้อหนาสีเทาเข้ม มักเกิดเป็นเขาลูกโดด ถ้ำ และโพรงหินปูน (กลุ่มหินสระบุรี/ราชบุรี)'
  },
  'Ps': {
    name: 'หินตะกอน ยุคเพอร์เมียน (Permian Sediments)',
    age: 'เพอร์เมียน (Permian)',
    rockType: 'หินดินดาน หินทรายแป้ง และหินทรายปนคาร์บอนเนต',
    desc: 'หินตะกอนทะเลตื้นสลับหินปูนยุคเพอร์เมียน'
  },
  'C': {
    name: 'หินตะกอน ยุคคาร์บอนิเฟอรัส (Carboniferous)',
    age: 'คาร์บอนิเฟอรัส (Carboniferous)',
    rockType: 'หินทราย หินดินดาน และหินเชิร์ต',
    desc: 'หินตะกอนทะเลลึกปานกลาง หินดินดานสีเทาดำสลับหินทราย'
  },
  'D': {
    name: 'หินตะกอน ยุคดีโวเนียน (Devonian)',
    age: 'ดีโวเนียน (Devonian)',
    rockType: 'หินทรายแป้ง หินดินดาน และหินปูนเนื้อดิน',
    desc: 'หินตะกอนทะเลโบราณ'
  },
  'S': {
    name: 'หินตะกอน ยุคไซลูเรียน (Silurian)',
    age: 'ไซลูเรียน (Silurian)',
    rockType: 'หินดินดาน หินชนวน และหินควอร์ตไซต์',
    desc: 'หินตะกอนที่เริ่มมีสภาพแปรเล็กน้อย'
  },
  'SD': {
    name: 'หินยุคไซลูเรียน-ดีโวเนียน (Silurian-Devonian)',
    age: 'ไซลูเรียน - ดีโวเนียน (Silurian - Devonian)',
    rockType: 'หินตะกอนแปรสภาพต่ำ',
    desc: 'หินดินดาน หินชนวน หินฟิลไลต์ และหินควอร์ตไซต์'
  },
  'O': {
    name: 'หินปูน ยุคออร์โดวิเชียน (Ordovician Limestone)',
    age: 'ออร์โดวิเชียน (Ordovician)',
    rockType: 'หินปูนลายเสือ (กลุ่มหินทุ่งสง)',
    desc: 'หินปูนเนื้อละเอียดมีแถบดินเหนียวสีน้ำตาลแดงแทรกสลับ'
  },
  'ϵ': {
    name: 'หินทราย ยุคแคมเบรียน (Cambrian Sandstone)',
    age: 'แคมเบรียน (Cambrian - หินยุคเก่าแก่)',
    rockType: 'หินทรายควอร์ตไซต์',
    desc: 'หินทรายเนื้อควอตซ์สีแดงปนน้ำตาล หินที่เก่าแก่ที่สุดในมหาลักษณวิทยายุคพาลีโอโซอิก'
  },

  // Intrusive & Metamorphic
  'gr': {
    name: 'หินอัคนีแทรกซอน แกรนิต (Granitic Rocks)',
    age: 'ยุคต่าง ๆ (Mesozoic - Tertiary)',
    rockType: 'หินอัคนีแทรกซอนลึก',
    desc: 'หินแกรนิต หินแกรโนไดโอไรต์ เนื้อแน่นแกร่ง'
  },
  'm': {
    name: 'หินแปรสภาพ (Metamorphic Complex)',
    age: 'พรีแคมเบรียน - พาลีโอโซอิก (Precambrian - Paleozoic)',
    rockType: 'หินแปรระดับสูง',
    desc: 'หินไนส์ หินชีสต์ หินอ่อน เกิดจากความร้อนและความกดดันสูงใต้เปลือกโลก'
  }
};

/**
 * Decode rock symbol to human-friendly Thai description
 */
export function decodeRockSymbol(symbol) {
  if (!symbol) return null;
  const cleanSym = symbol.trim();
  if (DMR_ROCK_DICTIONARY[cleanSym]) {
    return { symbol: cleanSym, ...DMR_ROCK_DICTIONARY[cleanSym] };
  }

  // Prefix fallback matching
  for (const [key, val] of Object.entries(DMR_ROCK_DICTIONARY)) {
    if (cleanSym.startsWith(key)) {
      return {
        symbol: cleanSym,
        name: `${val.name} (${cleanSym})`,
        age: val.age,
        rockType: val.rockType,
        desc: val.desc
      };
    }
  }

  return {
    symbol: cleanSym,
    name: `หน่วยหินรหัส ${cleanSym}`,
    age: 'ข้อมูลธรณีวิทยา (DMR 1:250k)',
    rockType: 'หินตะกอน/หินอัคนี/หินแปร',
    desc: 'หน่วยหินตามแผนที่ธรณีวิทยามาตราส่วน 1:250,000 กรมทรัพยากรธรณี'
  };
}

// Memory cache to avoid repeated requests to DMR
const geologyCache = new Map();

/**
 * Query DMR ArcGIS REST identify API for rock unit at coordinates
 */
export async function identifyRockUnit(lat, lng, bounds = null, size = { width: 800, height: 600 }) {
  if (!lat || !lng) return null;

  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geologyCache.has(key)) {
    return geologyCache.get(key);
  }

  // Calculate extent
  const delta = 0.05;
  const minLng = bounds ? bounds.getWest() : lng - delta;
  const minLat = bounds ? bounds.getSouth() : lat - delta;
  const maxLng = bounds ? bounds.getEast() : lng + delta;
  const maxLat = bounds ? bounds.getNorth() : lat + delta;
  const w = size.width || 800;
  const h = size.height || 600;

  const url = `https://gisportal.dmr.go.th/arcgis/rest/services/GEOL/ROCK_UNIT_250K/MapServer/identify?` +
    `geometry=${lng},${lat}&` +
    `geometryType=esriGeometryPoint&` +
    `sr=4326&` +
    `layers=visible:0&` +
    `tolerance=2&` +
    `mapExtent=${minLng},${minLat},${maxLng},${maxLat}&` +
    `imageDisplay=${w},${h},96&` +
    `returnGeometry=false&` +
    `f=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const feat = data.results[0];
      const attrs = feat.attributes || {};
      const sym = attrs['อักษรสัญลักษณ์ของหน่วยหินที่ปรากฏบนแผนที่'] || attrs['TEXT_SYM'] || attrs['RU_ID'];
      if (!sym) return null;

      const decoded = decodeRockSymbol(sym);
      const result = {
        symbol: sym,
        name: decoded.name,
        age: decoded.age,
        rockType: decoded.rockType,
        desc: decoded.desc,
        year: attrs['ปี ค.ศ. ที่ประมวลผล'] || '2003',
        areaKm2: attrs['dmrdb2.DMRAPP.ROCK_UNIT_250K.AREA'] ? (attrs['dmrdb2.DMRAPP.ROCK_UNIT_250K.AREA'] / 1e6).toFixed(1) : null
      };

      geologyCache.set(key, result);
      return result;
    }
  } catch (err) {
    // Network or timeout failure, silently fallback
    console.debug('DMR identify failed:', err.message);
  }

  return null;
}
