/**
 * Telemetry Switching Service for ThaiFlood
 * Manages dual-mode data ingestion:
 * - Rule 1: If bot data in /api/meta.json exists and is fresh (< 60 minutes old),
 *           load pre-computed static JSON from Edge cache (/api/*.json).
 * - Rule 2: If bot data is missing, 404, or older than 60 minutes,
 *           seamlessly fallback to calling live government APIs directly.
 */

const BOT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour max age
let cachedMeta = null;
let lastMetaCheckTime = 0;
const META_CHECK_INTERVAL_MS = 60 * 1000; // re-check meta at most once per minute

/**
 * Fetch and parse /api/meta.json
 * @returns {Promise<Object|null>}
 */
export async function getBotMetadata() {
  const now = Date.now();
  if (cachedMeta && (now - lastMetaCheckTime < META_CHECK_INTERVAL_MS)) {
    return cachedMeta;
  }

  try {
    const res = await fetch('/api/meta.json', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (!res.ok) {
      cachedMeta = null;
      return null;
    }
    const data = await res.json();
    if (data && data.timestamp) {
      cachedMeta = data;
      lastMetaCheckTime = now;
      return data;
    }
  } catch {
    cachedMeta = null;
  }
  return null;
}

/**
 * Check if bot data is available and younger than 60 minutes
 * @returns {Promise<boolean>}
 */
export async function isBotDataFresh() {
  const meta = await getBotMetadata();
  if (!meta || !meta.timestamp) return false;

  const timestampMs = new Date(meta.timestamp).getTime();
  if (isNaN(timestampMs)) return false;

  const ageMs = Date.now() - timestampMs;
  const isFresh = ageMs >= 0 && ageMs < BOT_MAX_AGE_MS;

  if (isFresh) {
    const ageMins = Math.round(ageMs / 60000);
    console.log(`[SWITCH] 🤖 Using fresh bot data (Age: ${ageMins} mins < 60 mins)`);
  } else {
    const ageMins = Math.round(ageMs / 60000);
    console.warn(`[SWITCH] ⚠️ Bot data expired (Age: ${ageMins} mins >= 60 mins). Falling back to direct API.`);
  }

  return isFresh;
}

/**
 * Load endpoint with Smart Switching:
 * 1. Checks if bot cache is fresh (< 60 mins)
 * 2. If fresh, loads /api/{endpoint}.json
 * 3. If stale or fails, calls fallbackDirectFn()
 * 
 * @param {string} endpointName - e.g. 'stations', 'dams', 'doh-roads', 'cctv'
 * @param {Function} fallbackDirectFn - async function returning direct data
 * @returns {Promise<any>}
 */
export async function fetchWithSmartSwitching(endpointName, fallbackDirectFn) {
  const fresh = await isBotDataFresh();
  if (fresh) {
    try {
      const res = await fetch(`/api/${endpointName}.json`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data) ? data.length > 0 : (data.features?.length > 0 || Object.keys(data).length > 0))) {
          return data;
        }
      }
    } catch (err) {
      console.warn(`[SWITCH] Error reading /api/${endpointName}.json: ${err.message}. Fallback to direct API.`);
    }
  }

  // Fallback to direct official government API call
  return await fallbackDirectFn();
}
