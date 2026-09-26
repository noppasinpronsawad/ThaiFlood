/**
 * GoatCounter Privacy-Friendly Analytics Service for ThaiFlood
 * No cookies, GDPR/PDPA compliant, lightweight privacy-first tracking.
 */

const GOATCOUNTER_ENDPOINT = 'https://thaiflood.goatcounter.com';

/**
 * Safely track pageview or custom event with GoatCounter
 * @param {string} path - URL path or event name
 * @param {string} title - Page or event title
 */
export function trackEvent(path = location.pathname, title = document.title) {
  try {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({
        path: path,
        title: title,
        event: path.startsWith('event:')
      });
    }
  } catch (err) {
    console.debug('[GoatCounter] Tracking ignored:', err.message);
  }
}

/**
 * Fetch total visitor count for ThaiFlood from GoatCounter
 * Returns formatted count string (e.g. "1,420") or null if unreachable
 */
export async function getVisitorCount() {
  try {
    // GoatCounter JSON counter endpoint
    const res = await fetch(`${GOATCOUNTER_ENDPOINT}/counter//.json`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.count || 'Active';
  } catch {
    // Graceful fallback for privacy extensions / ad-blockers
    return 'Active';
  }
}
