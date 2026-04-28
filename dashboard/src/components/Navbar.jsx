import React from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { useApi } from '../api';

export default function Navbar({ lastRefresh, onRefresh }) {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { online } = useApi();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        🎯 <span className="shiny-text">Skill Management System</span>
      </div>
      <div className="navbar-actions">
        <span className={`status-dot ${online ? 'online' : 'offline'}`} />
        <span className="status-text">{online ? t('online') : t('offline')}</span>
        <span className="last-refresh">{lastRefresh}</span>
        <button className="btn btn-sm" onClick={onRefresh} title="Refresh">⟳</button>
        <button className="btn btn-sm" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn btn-sm" onClick={toggleLang}>
          {lang === 'en' ? '中文' : 'EN'}
        </button>
      </div>
    </nav>
  );
}
