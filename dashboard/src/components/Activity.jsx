import React from 'react';

function fmtDate(iso) { return iso || ''; }

export default function Activity({ stats, t }) {
  if (!stats || !stats.length) return <div className="empty-state">{t('noActivityYet')}</div>;
  const sorted = [...stats].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <table>
      <thead><tr><th>{t('date')}</th><th>{t('skill')}</th><th>{t('count')}</th></tr></thead>
      <tbody>
        {sorted.slice(0, 50).map((r, i) => (
          <tr key={i} className="animated-item">
            <td>{fmtDate(r.date)}</td>
            <td>{r.skill_name}</td>
            <td>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
