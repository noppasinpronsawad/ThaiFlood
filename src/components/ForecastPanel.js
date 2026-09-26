/**
 * ForecastPanel Component for ThaiFlood - Clean 7-Day Weather & Rain Calendar
 */
import { fetch7DayWeatherForecast, getAllLocations } from '../services/weatherService.js';

export function createForecastPanel(onLocationChange) {
  const container = document.createElement('div');
  container.className = 'clean-card';
  container.id = 'forecast-calendar-card';

  const locations = getAllLocations();
  const selectOptions = locations
    .map((loc) => `<option value="${loc.key}">${loc.name}</option>`)
    .join('');

  container.innerHTML = `
    <div class="card-header-clean">
      <span class="card-title-clean">
        <span>🌧️</span> พยากรณ์ฝน 7 วันข้างหน้า
      </span>
      <select class="search-input-box" id="forecast-loc-select" style="padding: 4px 10px; font-size: 12px; width: auto;">
        ${selectOptions}
      </select>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;">
      <span style="font-size: 12.5px; color: #0369a1; font-weight: 500;">คาดการณ์ปริมาณฝนสะสมรวม 7 วัน:</span>
      <span id="forecast-rain-total" style="font-family: var(--font-numeric); font-size: 16px; font-weight: 700; color: #0284c7;">...</span>
    </div>

    <div id="forecast-days-clean-list" style="display: flex; flex-direction: column; gap: 6px;">
      <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 15px;">กำลังโหลดพยากรณ์อากาศ...</div>
    </div>
  `;

  const select = container.querySelector('#forecast-loc-select');
  select.addEventListener('change', (e) => {
    loadWeatherData(e.target.value);
    if (onLocationChange) onLocationChange(e.target.value);
  });

  async function loadWeatherData(locKey) {
    const listElem = container.querySelector('#forecast-days-clean-list');
    const totalElem = container.querySelector('#forecast-rain-total');

    const data = await fetch7DayWeatherForecast(locKey);

    totalElem.textContent = `${data.total7DayRainMm} มม.`;
    if (data.total7DayRainMm > 150) {
      totalElem.style.color = '#dc2626';
    } else if (data.total7DayRainMm > 80) {
      totalElem.style.color = '#ea580c';
    } else {
      totalElem.style.color = '#16a34a';
    }

    listElem.innerHTML = data.days
      .map((day) => {
        let rainPillBg = '#f0fdf4';
        let rainPillColor = '#16a34a';
        let rainPillBorder = '#bbf7d0';

        if (day.rainMm >= 45) {
          rainPillBg = '#fef2f2';
          rainPillColor = '#dc2626';
          rainPillBorder = '#fecaca';
        } else if (day.rainMm >= 25) {
          rainPillBg = '#fff7ed';
          rainPillColor = '#ea580c';
          rainPillBorder = '#fed7aa';
        }

        return `
          <div class="forecast-clean-row">
            <div class="forecast-clean-date">
              <div>${day.displayDate}</div>
              <div style="font-size: 10.5px; color: #64748b; font-weight: normal;">${day.weatherDesc}</div>
            </div>
            <div style="font-size: 20px;">${day.icon}</div>
            <div style="font-size: 12px; color: #475569; font-family: var(--font-numeric);">
              <span style="color: #0f172a; font-weight: 600;">${day.tempMax}°</span> / ${day.tempMin}°
            </div>
            <div style="background: ${rainPillBg}; color: ${rainPillColor}; border: 1px solid ${rainPillBorder}; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 11.5px; font-family: var(--font-numeric);">
              🌧️ ${day.rainMm} มม.
            </div>
          </div>
        `;
      })
      .join('');
  }

  loadWeatherData('ayutthaya');

  return container;
}
