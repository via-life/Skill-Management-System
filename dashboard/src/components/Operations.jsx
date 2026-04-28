import React from 'react';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Operations({ data, opsPage, setOpsPage, onUndo, t }) {
  const ops = data?.operations || [];
  const totalPages = data?.total_pages || 1;

  if (!ops.length) return <div className="empty-state">{t('noOpsYet')}</div>;

  return (
    <>
      {ops.map(op => {
        const undone = op.undone;
        const canUndo = !undone && op.action !== 'permanent_delete' && op.action !== 'undo';
        let diff = '';
        if (op.before && op.after && typeof op.before === 'object' && typeof op.after === 'object') {
          const changes = [];
          for (const k of Object.keys(op.after)) {
            if (JSON.stringify(op.before[k]) !== JSON.stringify(op.after[k])) {
              changes.push(`${k}: ${JSON.stringify(op.before[k])} → ${JSON.stringify(op.after[k])}`);
            }
          }
          if (changes.length) diff = changes.slice(0, 3).join('; ');
        }
        return (
          <div key={op.id} className={`op-row animated-item ${undone ? 'undone' : ''}`}>
            <div className="op-time">{fmtTime(op.timestamp)}</div>
            <div><span className={`op-badge ${op.action}`}>{op.action}</span></div>
            <div className="op-summary">
              <span className="op-target">{op.target_name || ''}</span>
              {diff && <div className="op-diff">{diff}</div>}
            </div>
            <div className="op-actions">
              {canUndo && <button className="btn btn-sm" onClick={() => onUndo(op.id)}>↩ {t('undo')}</button>}
              {op.action === 'permanent_delete' && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('irreversible')}</span>}
            </div>
          </div>
        );
      })}
      <div className="pagination">
        <button className="btn btn-sm" disabled={opsPage <= 1} onClick={() => setOpsPage(opsPage - 1)}>←</button>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('page')} {opsPage} / {totalPages}</span>
        <button className="btn btn-sm" disabled={opsPage >= totalPages} onClick={() => setOpsPage(opsPage + 1)}>→</button>
      </div>
    </>
  );
}
