import React from 'react';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export default function Chart({ summary, chartDays, setChartDays, getSkillColor, t }) {
  const top10 = (summary || []).slice(0, 10);
  const max = top10[0]?.total_count || 1;

  return (
    <div className="section">
      <div className="section-header">
        <h2>📊 {t('usageOverview')}</h2>
        <div className="chart-controls">
          <button className={`chart-btn ${chartDays === 7 ? 'active' : ''}`} onClick={() => setChartDays(7)}>7d</button>
          <button className={`chart-btn ${chartDays === 30 ? 'active' : ''}`} onClick={() => setChartDays(30)}>30d</button>
          <button className={`chart-btn ${chartDays === null ? 'active' : ''}`} onClick={() => setChartDays(null)}>All</button>
        </div>
      </div>
      <div className="section-body">
        {!top10.length ? (
          <div className="chart-empty">{t('noDataYet')}</div>
        ) : top10.map((item, i) => (
          <div className="bar-row" key={item.skill_name}>
            <div className="bar-label" title={item.skill_name}>{item.skill_name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{
                '--pct': `${(item.total_count / max * 100).toFixed(1)}%`,
                background: getSkillColor(item.skill_name),
                '--delay': `${i * 0.08}s`,
              }} />
            </div>
            <div className="bar-count">{item.total_count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
