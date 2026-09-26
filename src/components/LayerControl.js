/**
 * LayerControl Component for ThaiFlood - Skeuomorphic Rocker Switch Dock
 */
export function createLayerControl(onLayerToggle) {
  const container = document.createElement('div');
  container.className = 'rocker-switch-dock';
  container.id = 'rocker-switch-dock';

  const layers = [
    { id: 'flood-now', name: 'ดาวเทียมน้ำท่วม (Sentinel-1)', defaultChecked: true },
    { id: 'flow-direction', name: 'ทิศทางการไหล (เวกเตอร์)', defaultChecked: true },
    { id: 'forecast-7d', name: 'พยากรณ์น้ำท่วม 7 วัน', defaultChecked: true },
    { id: 'rivers', name: 'โครงข่ายแม่น้ำสายหลัก', defaultChecked: true },
    { id: 'stations', name: 'จุดสถานีโทรมาตร', defaultChecked: true }
  ];

  const itemsHtml = layers
    .map(
      (l) => `
    <div class="rocker-item">
      <span>${l.name}</span>
      <label class="rocker-switch" id="switch-wrap-${l.id}">
        <input type="checkbox" id="rocker-${l.id}" ${l.defaultChecked ? 'checked' : ''}>
        <span class="rocker-thumb"></span>
      </label>
    </div>
  `
    )
    .join('');

  container.innerHTML = `
    <div class="dock-title">
      <span>⚙️ สวิตช์เปิด-ปิดชั้นข้อมูล</span>
      <span style="font-size: 9px; color: #94a3b8;">ROCKER</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${itemsHtml}
    </div>
  `;

  layers.forEach((l) => {
    const input = container.querySelector(`#rocker-${l.id}`);
    input.addEventListener('change', (e) => {
      if (onLayerToggle) onLayerToggle(l.id, e.target.checked);
    });
  });

  return container;
}
