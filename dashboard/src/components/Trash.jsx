import React from 'react';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Trash({ items, onRestore, onPermDelete, onClear, t }) {
  if (!items || !items.length) return <div className="empty-state">{t('trashEmpty')}</div>;

  return (
    <>
      {items.map(item => {
        const rem = item.remaining_days;
        return (
          <div key={item.name} className="trash-row animated-item">
            <div><strong>{item.name}</strong></div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.group || ''}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtTime(item.deleted_at)}</div>
            <div className={`remaining ${rem <= 5 ? 'urgent' : ''}`}>{t('dLeft', rem)}</div>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => onRestore(item.name)}>↩ {t('restore')}</button>
              <button className="btn btn-sm btn-danger" onClick={() => onPermDelete(item.name)}>⛔</button>
            </div>
          </div>
        );
      })}
    </>
  );
}
