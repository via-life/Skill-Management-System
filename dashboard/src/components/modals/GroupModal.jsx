import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useApi } from '../../api';

export default function GroupModal({ open, onClose, editingGroup, groups, onSaved }) {
  const { t } = useI18n();
  const { api } = useApi();

  const [form, setForm] = useState({ name: '', display_name: '', color: '#6c63ff' });
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingGroup;

  useEffect(() => {
    if (!open) return;
    if (isEdit && groups && groups[editingGroup]) {
      const g = groups[editingGroup];
      setForm({
        name: editingGroup,
        display_name: g.display_name || '',
        color: g.color || '#6c63ff',
      });
    } else {
      setForm({ name: '', display_name: '', color: '#6c63ff' });
    }
  }, [open, editingGroup, groups]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        color: form.color,
      };

      if (isEdit) {
        await api(`/api/groups/${encodeURIComponent(editingGroup)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await api('/api/groups', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      onSaved?.();
      onClose();
    } catch (e) {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {isEdit ? t('editGroupTitle') : t('newGroupTitle')}
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t('name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              readOnly={isEdit}
            />
          </div>
          <div className="form-group">
            <label>{t('displayName')}</label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => handleChange('display_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('color')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={form.color}
                onChange={e => handleChange('color', e.target.value)}
                style={{ width: 48, height: 36, padding: 2, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                {form.color}
              </span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
