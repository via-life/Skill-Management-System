import React, { useState } from 'react';
import { useApi } from '../api';

function fmtSize(b) { if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }

export default function SkillsTree({ onViewFiles, onEditSkill, onDeleteSkill, t }) {
  const { api } = useApi();
  const [tree, setTree] = useState(null);

  React.useEffect(() => {
    api('/api/skills-tree').then(d => setTree(d.paths || [])).catch(() => {});
  }, []);

  const refresh = () => api('/api/skills-tree').then(d => setTree(d.paths || [])).catch(() => {});

  if (!tree) return <div className="empty-state">{t('loading')}</div>;
  if (!tree.length || tree.every(p => !p.entries?.length)) return <div className="empty-state">{t('noSkillsYet')}</div>;

  return (
    <>
      {tree.map(pi => (
        <PathBlock key={pi.path} pathInfo={pi} countMap={{}} t={t}
          onViewFiles={onViewFiles} onEditSkill={onEditSkill} onDeleteSkill={onDeleteSkill} />
      ))}
    </>
  );
}

function PathBlock({ pathInfo, t, onViewFiles, onEditSkill, onDeleteSkill }) {
  const [open, setOpen] = useState(true);
  const badge = pathInfo.type === 'global'
    ? <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{t('global')}</span>
    : <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(63,185,80,0.15)', color: 'var(--success)' }}>{t('project')}</span>;

  return (
    <div className={`group-block ${open ? 'open' : ''}`}>
      <div className="group-header" onClick={() => setOpen(!open)}>
        <div className="group-title">
          <span className="chevron">▶</span> {badge}
          <span style={{ fontSize: '0.82rem' }}>{pathInfo.path}</span>
          <span className="group-count">({pathInfo.entries?.length || 0})</span>
        </div>
      </div>
      <div className="group-body">
        {(!pathInfo.entries || !pathInfo.entries.length)
          ? <div className="empty-state">{t('noSkillsYet')}</div>
          : pathInfo.entries.map(entry => entry.kind === 'skill'
            ? <SkillRow key={entry.name} sk={entry} t={t} onViewFiles={onViewFiles} onEditSkill={onEditSkill} onDeleteSkill={onDeleteSkill} />
            : <PackBlock key={entry.name} pack={entry} t={t} onViewFiles={onViewFiles} onEditSkill={onEditSkill} onDeleteSkill={onDeleteSkill} />
          )}
      </div>
    </div>
  );
}

function PackBlock({ pack, t, onViewFiles, onEditSkill, onDeleteSkill }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`group-block ${open ? 'open' : ''}`} style={{ margin: '4px 0 4px 12px' }}>
      <div className="group-header" onClick={() => setOpen(!open)} style={{ padding: '6px 12px' }}>
        <div className="group-title">
          <span className="chevron">▶</span> 📁 {pack.name} <span className="group-count">({pack.skills?.length || 0} {t('skills')})</span>
        </div>
      </div>
      <div className="group-body">
        {(pack.skills || []).map(sk => (
          <SkillRow key={sk.name} sk={sk} t={t} onViewFiles={onViewFiles} onEditSkill={onEditSkill} onDeleteSkill={onDeleteSkill} />
        ))}
      </div>
    </div>
  );
}

function SkillRow({ sk, t, onViewFiles, onEditSkill, onDeleteSkill }) {
  return (
    <div className="skill-row">
      <div><span className="skill-name">{sk.name}</span></div>
      <div className="skill-display">{sk.display_name || ''}</div>
      <div className="skill-count">{sk.total_count || 0}</div>
      <div className="skill-actions">
        <button className="btn-icon" title="Files" onClick={() => onViewFiles(sk.name)}>📂</button>
        <button className="btn-icon" title="Edit" onClick={() => onEditSkill(sk.name)}>✏</button>
        <button className="btn-icon" title="Delete" onClick={() => onDeleteSkill(sk.name)} style={{ color: 'var(--danger)' }}>🗑</button>
      </div>
    </div>
  );
}
