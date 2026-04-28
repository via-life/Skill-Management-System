import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useApi } from '../../api';

function fmtSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}

function TreeNode({ node, skillName, onFileClick }) {
  const { t } = useI18n();

  if (node.type === 'directory' || node.children) {
    return (
      <li>
        <span className="ft-dir">📁 {node.name}</span>
        {node.children && node.children.length > 0 ? (
          <ul>
            {node.children.map((child, i) => (
              <TreeNode key={child.path || i} node={child} skillName={skillName} onFileClick={onFileClick} />
            ))}
          </ul>
        ) : (
          <ul><li style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('emptyDir')}</li></ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <span className="ft-file" onClick={() => onFileClick(node.path)}>
        📄 {node.name}
      </span>
      {node.size != null && <span className="ft-size">{fmtSize(node.size)}</span>}
    </li>
  );
}

export default function FileTreeModal({ open, onClose, skillName }) {
  const { t } = useI18n();
  const { api } = useApi();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    if (!open || !skillName) return;
    setLoading(true);
    setTree(null);
    setFileContent(null);
    setFilePath('');
    api(`/api/skills/${encodeURIComponent(skillName)}/files`)
      .then(data => setTree(data.tree || data.files || data))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [open, skillName]);

  const handleFileClick = async (path) => {
    setFileLoading(true);
    setFilePath(path);
    try {
      const data = await api(`/api/skills/${encodeURIComponent(skillName)}/files/${encodeURIComponent(path)}`);
      setFileContent(data.content ?? JSON.stringify(data, null, 2));
    } catch {
      setFileContent('Error loading file');
    } finally {
      setFileLoading(false);
    }
  };

  if (!open) return null;

  // File content sub-modal
  if (fileContent !== null) {
    return (
      <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
        <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            📄 {filePath}
          </div>
          <div className="modal-body">
            {fileLoading ? (
              <div className="empty-state">{t('loading')}</div>
            ) : (
              <pre className="file-content">{fileContent}</pre>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => { setFileContent(null); setFilePath(''); }}>
              {t('back')}
            </button>
            <button className="btn" onClick={onClose}>{t('close')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          📂 {t('fileStructure')} — {skillName}
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="empty-state">{t('loading')}</div>
          ) : (
            <div className="file-tree">
              <ul>
                {Array.isArray(tree) && tree.length > 0
                  ? tree.map((node, i) => (
                      <TreeNode key={node.path || i} node={node} skillName={skillName} onFileClick={handleFileClick} />
                    ))
                  : <li style={{ color: 'var(--text-muted)' }}>{t('emptyDir')}</li>
                }
              </ul>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
