/**
 * FloodRiskSummary Component for ThaiFlood - Clean 7-Day Early Warning Cards
 */
export function createFloodRiskSummary(forecast7dData) {
  const container = document.createElement('div');
  container.className = 'clean-card';
  container.id = 'clean-risk-summary-card';

  const features = forecast7dData.features || [];

  const itemsHtml = features
    .map((f) => {
      const p = f.properties;
      const isHigh = p.riskLevel === 'high';

      const borderLeftColor = isHigh ? '#dc2626' : '#ea580c';
      const badgeBg = isHigh ? '#fef2f2' : '#fff7ed';
      const badgeColor = isHigh ? '#dc2626' : '#ea580c';
      const badgeBorder = isHigh ? '#fecaca' : '#fed7aa';

      return `
        <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-left: 4px solid ${borderLeftColor}; border-radius: 8px; padding: 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 13.5px; color: #0f172a;">${p.name}</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 2px 7px; border-radius: 6px; font-weight: 700; font-size: 11px; font-family: var(--font-numeric);">
              โอกาสท่วม ${p.floodProbabilityPct}%
            </span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
            ⏳ ช่วงเวลาที่ต้องระวัง: <b style="color: #0284c7;">${p.predictedArrivalDay}</b>
            | คาดระดับน้ำท่วม: <b style="color: #dc2626;">+${p.projectedDepthM} เมตร</b>
          </div>
          <div style="font-size: 11.5px; color: #334155; background: #f8fafc; padding: 6px 10px; border-radius: 6px; line-height: 1.45; border: 1px solid #f1f5f9;">
            🛡️ <b>คำแนะนำ:</b> ${p.recommendation}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="card-header-clean">
      <span class="card-title-clean">
        <span>🚨</span> สรุปพื้นที่เสี่ยงภัยน้ำท่วม 7 วันข้างหน้า
      </span>
      <span style="font-size: 11px; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 8px; border-radius: 4px; border: 1px solid #fecaca;">เตือนภัยระดับสูง</span>
    </div>
    <div style="font-size: 12px; color: #64748b; margin-bottom: 10px;">
      ประเมินจากปริมาณฝนสะสมคาดการณ์ 7 วัน ร่วมกับมวลน้ำหลากจากลุ่มน้ำตอนบน
    </div>
    <div style="max-height: 360px; overflow-y: auto; padding-right: 2px;">
      ${itemsHtml}
    </div>
  `;

  return container;
}
