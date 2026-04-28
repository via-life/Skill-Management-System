import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useApi } from '../../api';

export default function PathsModal({ open, onClose }) {
  const { t } = useI18n();
  const { api } = useApi();

  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchPaths = async () => {
    setLoading(true);
    try {
      const data = await api('/api/skills-dirs');
      setPaths(data.paths || data || []);
    } catch {
      setPaths([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchPaths();
  }, [open]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!newPath.trim()) return;
    setAdding(true);
    try {
      await api('/api/skills-dirs', {
        method: 'POST',
        body: JSON.stringify({ path: newPath.trim() }),
      });
      setNewPath('');
      await fetchPaths();
    } catch {}
    setAdding(false);
  };

  const handleRemove = async (path) => {
    try {
      await api(`/api/skills-dirs/${encodeURIComponent(path)}`, { method: 'DELETE' });
      await fetchPaths();
    } catch {}
  };

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          📁 {t('skillPaths')}
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="empty-state">{t('loading')}</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                {(Array.isArray(paths) ? paths : []).map((p, i) => {
                  const path = typeof p === 'string' ? p : p.path;
                  const type = typeof p === 'object' ? p.type : null;
                  const skillCount = typeof p === 'object' ? p.skill_count : null;

                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: '1px solid var(--border)',
                      gap: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.85rem', fontFamily: 'var(--mono)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {path}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          {type && (
                            <span style={{
                              display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                              fontSize: '0.7rem', fontWeight: 600,
                              background: type === 'global' ? 'var(--accent-soft)' : 'rgba(63,185,80,0.15)',
                              color: type === 'global' ? 'var(--accent)' : 'var(--success)',
                            }}>
                              {t(type)}
                            </span>
                          )}
                          {skillCount != null && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {skillCount} {t('skills')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemove(path)}
                      >
                        {t('removePath')}
                      </button>
                    </div>
                  );
                })}
                {paths.length === 0 && (
                  <div className="empty-state" style={{ padding: 16 }}>{t('noSkillsYet')}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newPath}
                  onChange={e => setNewPath(e.target.value)}
                  placeholder={t('pathPlaceholder')}
                  style={{
                    flex: 1, padding: '8px 12px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font)', fontSize: '0.85rem',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newPath.trim()}>
                  {t('addPath')}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
