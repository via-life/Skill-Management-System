import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useApi } from '../../api';

export default function ImportWizard({ open, onClose, groups, onDone }) {
  const { t } = useI18n();
  const { api } = useApi();

  const [step, setStep] = useState(1);

  // Step 1
  const [url, setUrl] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  // Step 2
  const [selected, setSelected] = useState({});
  const [dirs, setDirs] = useState([]);
  const [targetDir, setTargetDir] = useState('');
  const [conflict, setConflict] = useState('skip');
  const [targetGroup, setTargetGroup] = useState('');

  // Step 3
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setUrl('');
      setProbeResult(null);
      setSelected({});
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  const handleProbe = async () => {
    if (!url.trim()) return;
    setProbing(true);
    try {
      const data = await api('/api/import/probe', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      setProbeResult(data);

      // Auto-select all skills
      const sel = {};
      (data.skills || []).forEach(s => { sel[s.name] = true; });
      setSelected(sel);

      // Fetch dirs
      try {
        const dirsData = await api('/api/skills-dirs');
        setDirs(dirsData.paths || dirsData || []);
        if ((dirsData.paths || dirsData || []).length > 0) {
          const first = (dirsData.paths || dirsData)[0];
          setTargetDir(typeof first === 'string' ? first : first.path || '');
        }
      } catch {}

      setStep(2);
    } catch (e) {
      // show error via probe result
      setProbeResult({ error: e.message });
    } finally {
      setProbing(false);
    }
  };

  const handleToggleSkill = (name) => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleInstall = async () => {
    const skillNames = Object.keys(selected).filter(k => selected[k]);
    if (!skillNames.length) return;
    setInstalling(true);
    setStep(3);
    try {
      const data = await api('/api/import/install', {
        method: 'POST',
        body: JSON.stringify({
          skills: skillNames,
          target_dir: targetDir,
          conflict_strategy: conflict,
          group: targetGroup || undefined,
        }),
      });
      setResult(data);
      onDone?.();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setInstalling(false);
    }
  };

  const handleClose = async () => {
    // Cleanup on cancel if probe was done but not installed
    if (probeResult && !result) {
      try { await api('/api/import/cleanup', { method: 'POST' }); } catch {}
    }
    onClose();
  };

  const groupNames = groups ? Object.keys(groups) : [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={handleClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          📥 {t('importSkill')} — {t('step', step, 3)}
        </div>
        <div className="modal-body">
          {/* Step 1: Enter source */}
          {step === 1 && (
            <>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                {t('supportedSources')}
              </p>
              <div className="form-group">
                <label>{t('urlOrPath')}</label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  onKeyDown={e => e.key === 'Enter' && handleProbe()}
                  autoFocus
                />
              </div>
              {probeResult?.error && (
                <div className="warning-box">{probeResult.error}</div>
              )}
            </>
          )}

          {/* Step 2: Select skills */}
          {step === 2 && probeResult && (
            <>
              <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                {t('found', probeResult.skills?.length || 0)}
                <br />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{probeResult.source || url}</span>
              </p>

              {(!probeResult.skills || !probeResult.skills.length) ? (
                <div className="empty-state">{t('noSkillsFound')}</div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16 }}>
                  {probeResult.skills.map(sk => (
                    <label key={sk.name} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                      fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    }}>
                      <input
                        type="checkbox"
                        checked={!!selected[sk.name]}
                        onChange={() => handleToggleSkill(sk.name)}
                      />
                      <span style={{ fontWeight: 500 }}>{sk.name}</span>
                      {sk.exists && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--warning)', marginLeft: 'auto' }}>
                          {t('alreadyExists')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>{t('installTo')}</label>
                <select value={targetDir} onChange={e => setTargetDir(e.target.value)}>
                  {(Array.isArray(dirs) ? dirs : []).map((d, i) => {
                    const path = typeof d === 'string' ? d : d.path;
                    return <option key={i} value={path}>{path}</option>;
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="radio" name="conflict" value="skip" checked={conflict === 'skip'} onChange={() => setConflict('skip')} />
                  {t('skip')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="radio" name="conflict" value="overwrite" checked={conflict === 'overwrite'} onChange={() => setConflict('overwrite')} />
                  {t('overwrite')}
                </label>
              </div>

              <div className="form-group">
                <label>{t('group')}</label>
                <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)}>
                  <option value="">—</option>
                  {groupNames.map(g => (
                    <option key={g} value={g}>{groups[g]?.display_name || g}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Step 3: Result */}
          {step === 3 && (
            <>
              {installing ? (
                <div className="empty-state">{t('importInstalling')}</div>
              ) : result?.error ? (
                <div className="warning-box">{result.error}</div>
              ) : (
                <>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
                    ✅ {t('successInstalled', result?.installed?.length || 0)}
                  </p>
                  {result?.skipped?.length > 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {t('skippedCount', result.skipped.length)}
                    </p>
                  )}
                  {result?.installed?.map(s => (
                    <div key={s} style={{ fontSize: '0.85rem', padding: '2px 0' }}>✅ {s}</div>
                  ))}
                  {result?.skipped?.map(s => (
                    <div key={s} style={{ fontSize: '0.85rem', padding: '2px 0', color: 'var(--text-muted)' }}>⏭ {s}</div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {step === 1 && (
            <>
              <button className="btn" onClick={handleClose}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleProbe} disabled={probing || !url.trim()}>
                {probing ? t('probing') : t('probe')}
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button className="btn" onClick={() => setStep(1)}>{t('back')}</button>
              <button className="btn" onClick={handleClose}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleInstall} disabled={selectedCount === 0}>
                {t('installSelected')} ({selectedCount})
              </button>
            </>
          )}
          {step === 3 && (
            <button className="btn btn-primary" onClick={onClose}>{t('done')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
