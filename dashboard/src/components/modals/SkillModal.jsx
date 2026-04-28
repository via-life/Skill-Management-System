import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useApi } from '../../api';

export default function SkillModal({ open, onClose, editingSkill, groups, onSaved }) {
  const { t } = useI18n();
  const { api } = useApi();

  const [form, setForm] = useState({ name: '', display_name: '', description: '', tags: '', group: '', enabled: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingSkill;

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setLoading(true);
      api(`/api/skills/${encodeURIComponent(editingSkill)}`)
        .then(data => {
          setForm({
            name: data.name || editingSkill,
            display_name: data.display_name || '',
            description: data.description || '',
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
            group: data.group || '',
            enabled: data.enabled !== false,
          });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setForm({ name: '', display_name: '', description: '', tags: '', group: '', enabled: true });
      setLoading(false);
    }
  }, [open, editingSkill]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const tags = form.tags.split(',').map(s => s.trim()).filter(Boolean);
      const body = {
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        description: form.description.trim(),
        tags,
        enabled: form.enabled,
      };

      if (isEdit) {
        await api(`/api/skills/${encodeURIComponent(editingSkill)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        if (form.group !== undefined) {
          await api(`/api/skills/${encodeURIComponent(editingSkill)}/group`, {
            method: 'PUT',
            body: JSON.stringify({ group: form.group }),
          });
        }
      } else {
        body.group = form.group;
        await api('/api/skills', {
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

  const groupNames = groups ? Object.keys(groups) : [];

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {isEdit ? t('editSkillTitle') : t('newSkillTitle')}
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="empty-state">{t('loading')}</div>
          ) : (
            <>
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
                <label>{t('description')}</label>
                <textarea
                  value={form.description}
                  onChange={e => handleChange('description', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t('tagsLabel')}</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => handleChange('tags', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t('group')}</label>
                <select
                  value={form.group}
                  onChange={e => handleChange('group', e.target.value)}
                >
                  <option value="">—</option>
                  {groupNames.map(g => (
                    <option key={g} value={g}>{groups[g]?.display_name || g}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => handleChange('enabled', e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  {t('enabled')}
                </label>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading || !form.name.trim()}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
