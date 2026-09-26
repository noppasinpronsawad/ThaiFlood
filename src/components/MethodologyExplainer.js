/**
 * MethodologyExplainer Component
 * Explains how ThaiFlood works with Low-AI, Physics-First algorithms & Open Data
 */
import { getMethodologyExplanation } from '../services/hydrologyService.js';

export function createMethodologyExplainer() {
  const container = document.createElement('div');
  container.className = 'glass-card';
  container.id = 'methodology-card';

  const methods = getMethodologyExplanation();
  const listHtml = methods
    .map(
      (m) => `
    <div class="method-card">
      <div class="method-title">${m.title}</div>
      <div style="font-size: 10px; color: var(--primary); margin-bottom: 4px; font-weight: 500;">
        ⚙️ เทคนิค: ${m.tech}
      </div>
      <div>${m.description}</div>
    </div>
  `
    )
    .join('');

  container.innerHTML = `
    <div class="card-header">
      <span class="card-title">
        <span>🔬</span> สถาปัตยกรรมระบบ (Low-AI)
      </span>
      <span style="font-size: 10px; color: #10b981;">100% Open Data</span>
    </div>
    <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px;">
      ระบบใช้หลักการอุทกวิทยาทางฟิสิกส์และสมการทางคณิตศาสตร์สเปกตรัม แทนการใช้ AI Black-Box จึงไม่ต้องเทรนโมเดลหนัก ประมวลผลได้รวดเร็ว และตรวจสอบย้อนกลับได้
    </p>
    ${listHtml}
  `;

  return container;
}
