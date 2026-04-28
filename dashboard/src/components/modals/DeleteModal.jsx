import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';

export default function DeleteModal({ open, mode, skillName, skillPath, onClose, onConfirm }) {
  const { t } = useI18n();
  const [confirmInput, setConfirmInput] = useState('');

  const isPermDelete = mode === 'permDelete';

  useEffect(() => {
    if (open) setConfirmInput('');
  }, [open]);

  if (!open) return null;

  const canConfirm = isPermDelete ? confirmInput === skillName : true;

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className={`modal ${isPermDelete ? 'danger' : ''}`} onClick={e => e.stopPropagation()}
        style={!isPermDelete ? { borderColor: 'var(--danger)' } : undefined}
      >
        <div className="modal-header" style={{ color: 'var(--danger)' }}>
          ⚠️ {isPermDelete ? t('permDelete') : t('deleteSkill')}
        </div>
        <div className="modal-body">
          {isPermDelete ? (
            <>
              <div className="warning-box">
                <p dangerouslySetInnerHTML={{ __html: t('permDeleteWarn') }} />
              </div>
              <p style={{ marginTop: 12, fontSize: '0.85rem' }}>
                <strong>{skillName}</strong>
              </p>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>{t('typeNameConfirm')}</label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={skillName}
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                {t('aboutToDelete')} <strong>{skillName}</strong>
              </p>
              <div className="warning-box">
                <p>{t('deleteWarning')}</p>
                <p className="path" style={{ margin: '8px 0' }}>{skillPath}</p>
                <p>{t('deleteWarning2')}</p>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button
            className="btn btn-danger"
            onClick={() => onConfirm(skillName)}
            disabled={!canConfirm}
          >
            {isPermDelete ? t('permDeleteBtn') : t('moveToTrash')}
          </button>
        </div>
      </div>
    </div>
  );
}
