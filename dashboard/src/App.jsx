import React, { useState, useEffect, useCallback, useRef } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { ThemeProvider, useTheme } from './theme';
import { ApiProvider, useApi } from './api';

// Effects
import MagnetLines from './effects/MagnetLines';
import TargetCursor from './effects/TargetCursor';
import Lanyard from './effects/Lanyard';

// Business components
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import Chart from './components/Chart';
import SkillsTree from './components/SkillsTree';
import Activity from './components/Activity';
import Trash from './components/Trash';
import Operations from './components/Operations';
import Toast from './components/Toast';

// Modals
import SkillModal from './components/modals/SkillModal';
import GroupModal from './components/modals/GroupModal';
import DeleteModal from './components/modals/DeleteModal';
import FileTreeModal from './components/modals/FileTreeModal';
import ImportWizard from './components/modals/ImportWizard';
import PathsModal from './components/modals/PathsModal';

/* ─── Section wrapper: collapsible ───────────────────────────────── */
function Section({ title, icon, children, actions, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`section collapsible ${open ? 'open' : ''}`}>
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <h2>{icon} {title}</h2>
        {actions && <div className="section-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

/* ─── Main App Content ───────────────────────────────────────────── */
function AppContent() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { api } = useApi();

  // ── Data state ──
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [opsData, setOpsData] = useState(null);
  const [cachedGroups, setCachedGroups] = useState({});

  // ── UI state ──
  const [chartDays, setChartDays] = useState(7);
  const [opsPage, setOpsPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState('');
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // ── Modal state ──
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState('delete');
  const [deleteSkillName, setDeleteSkillName] = useState('');
  const [deleteSkillPath, setDeleteSkillPath] = useState('');
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [fileTreeSkill, setFileTreeSkill] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [pathsOpen, setPathsOpen] = useState(false);

  // ── Toast helper ──
  const showToast = useCallback((msg, type = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Color helper ──
  const getSkillColor = useCallback((name) => {
    for (const [, g] of Object.entries(cachedGroups)) {
      if (g.skills && g.skills.includes(name)) return g.color || 'var(--accent)';
    }
    return 'var(--accent)';
  }, [cachedGroups]);

  // ── Data fetching ──
  const refreshData = useCallback(async () => {
    const daysParam = chartDays ? `?days=${chartDays}` : '';
    try {
      const [skillsRes, statsRes, summaryRes, trashRes, opsRes, groupsRes] = await Promise.all([
        api('/api/skills').catch(() => ({ skills: [] })),
        api('/api/stats').catch(() => ({})),
        api(`/api/summary${daysParam}`).catch(() => []),
        api('/api/trash').catch(() => ({ items: [] })),
        api(`/api/operations?page=${opsPage}`).catch(() => ({ operations: [], total_pages: 1 })),
        api('/api/groups').catch(() => ({ groups: {} })),
      ]);

      setSkills(skillsRes.skills || skillsRes || []);
      setStats(statsRes);
      setSummary(Array.isArray(summaryRes) ? summaryRes : summaryRes.summary || []);
      setTrashItems(trashRes.items || trashRes || []);
      setOpsData(opsRes);
      setCachedGroups(groupsRes.groups || groupsRes || {});

      const now = new Date();
      setLastRefresh(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      // partial failures handled individually
    }
  }, [api, chartDays, opsPage]);

  // Initial + periodic refresh
  useEffect(() => { refreshData(); }, [refreshData]);
  useEffect(() => {
    const timer = setInterval(refreshData, 30000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Expose toggleTheme globally for Lanyard module
  useEffect(() => {
    window.__toggleTheme = toggleTheme;
    return () => { delete window.__toggleTheme; };
  }, [toggleTheme]);

  // ── Action handlers ──
  const handleViewFiles = (name) => {
    setFileTreeSkill(name);
    setFileTreeOpen(true);
  };

  const handleEditSkill = (name) => {
    setEditingSkill(name);
    setSkillModalOpen(true);
  };

  const handleNewSkill = () => {
    setEditingSkill(null);
    setSkillModalOpen(true);
  };

  const handleDeleteSkill = (name) => {
    // Find path from skills data
    const sk = Array.isArray(skills) ? skills.find(s => s.name === name) : null;
    setDeleteSkillName(name);
    setDeleteSkillPath(sk?.path || sk?.dir || name);
    setDeleteMode('delete');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (name) => {
    try {
      if (deleteMode === 'permDelete') {
        await api(`/api/trash/${encodeURIComponent(name)}`, { method: 'DELETE' });
        showToast(t('permDeleted', name));
      } else {
        await api(`/api/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
        showToast(t('movedToTrash', name));
      }
      setDeleteModalOpen(false);
      refreshData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleNewGroup = () => {
    setEditingGroup(null);
    setGroupModalOpen(true);
  };

  const handleRestore = async (name) => {
    try {
      await api(`/api/trash/${encodeURIComponent(name)}/restore`, { method: 'POST' });
      showToast(t('restored', name));
      refreshData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handlePermDelete = (name) => {
    setDeleteSkillName(name);
    setDeleteSkillPath('');
    setDeleteMode('permDelete');
    setDeleteModalOpen(true);
  };

  const handleClearTrash = async () => {
    if (!confirm(t('clearTrashConfirm'))) return;
    try {
      await api('/api/trash', { method: 'DELETE' });
      showToast(t('trashCleared'));
      refreshData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleUndo = async (opId) => {
    try {
      await api(`/api/operations/${opId}/undo`, { method: 'POST' });
      showToast(t('opUndone'));
      refreshData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSkillSaved = () => {
    showToast(editingSkill ? t('savedHistory') : t('skillCreated'));
    refreshData();
  };

  const handleGroupSaved = () => {
    showToast(editingGroup ? t('groupUpdated') : t('groupCreated'));
    refreshData();
  };

  // ── Computed ──
  const skillCount = stats?.total_skills ?? (Array.isArray(skills) ? skills.length : 0);
  const todayCount = stats?.today_count ?? 0;
  const weekCount = stats?.week_count ?? 0;
  const topSkill = stats?.most_used || '—';
  const recentStats = stats?.recent || [];

  return (
    <>
      {/* 1. MagnetLines background */}
      <div style={{
        width: '100vw', height: '100vh', position: 'fixed',
        top: 0, left: 0, zIndex: -1, pointerEvents: 'none', opacity: 0.12,
      }}>
        <MagnetLines
          containerSize="100vw"
          lineColor="var(--accent)"
        />
      </div>

      {/* 2. Lanyard (fixed top-right, pull to toggle theme) */}
      <Lanyard
        position={[0, 0, 40]}
        gravity={[0, -40, 0]}
        fov={20}
        transparent={true}
      />

      {/* 3. Navbar */}
      <Navbar
        lastRefresh={lastRefresh ? `${t('updated')} ${lastRefresh}` : ''}
        onRefresh={refreshData}
      />

      {/* 4. Main container */}
      <div className="container">
        {/* Stats Cards */}
        <StatsCards
          skillCount={skillCount}
          todayCount={todayCount}
          weekCount={weekCount}
          topSkill={topSkill}
          t={t}
        />

        {/* Usage Chart */}
        <Chart
          summary={summary}
          chartDays={chartDays}
          setChartDays={setChartDays}
          getSkillColor={getSkillColor}
          t={t}
        />

        {/* Skill Management */}
        <Section
          title={t('skillManagement')}
          icon="🎯"
          actions={
            <>
              <button className="btn btn-sm" onClick={handleNewSkill}>{t('newSkill')}</button>
              <button className="btn btn-sm" onClick={handleNewGroup}>{t('newGroup')}</button>
              <button className="btn btn-sm" onClick={() => setImportOpen(true)}>{t('importSkill')}</button>
              <button className="btn btn-sm" onClick={() => setPathsOpen(true)}>{t('skillPaths')}</button>
            </>
          }
        >
          <SkillsTree
            onViewFiles={handleViewFiles}
            onEditSkill={handleEditSkill}
            onDeleteSkill={handleDeleteSkill}
            t={t}
          />
        </Section>

        {/* Recent Activity */}
        <Section title={t('recentActivity')} icon="📋">
          <Activity stats={recentStats} t={t} />
        </Section>

        {/* Trash */}
        <Section
          title={t('trash')}
          icon="🗑"
          defaultOpen={false}
          actions={
            trashItems.length > 0 && (
              <button className="btn btn-sm btn-danger" onClick={handleClearTrash}>{t('clearAll')}</button>
            )
          }
        >
          <Trash
            items={trashItems}
            onRestore={handleRestore}
            onPermDelete={handlePermDelete}
            onClear={handleClearTrash}
            t={t}
          />
        </Section>

        {/* Operations */}
        <Section title={t('operationHistory')} icon="📜" defaultOpen={false}>
          <Operations
            data={opsData}
            opsPage={opsPage}
            setOpsPage={setOpsPage}
            onUndo={handleUndo}
            t={t}
          />
        </Section>
      </div>

      {/* 5. All Modals */}
      <SkillModal
        open={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
        editingSkill={editingSkill}
        groups={cachedGroups}
        onSaved={handleSkillSaved}
      />
      <GroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        editingGroup={editingGroup}
        groups={cachedGroups}
        onSaved={handleGroupSaved}
      />
      <DeleteModal
        open={deleteModalOpen}
        mode={deleteMode}
        skillName={deleteSkillName}
        skillPath={deleteSkillPath}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
      <FileTreeModal
        open={fileTreeOpen}
        onClose={() => setFileTreeOpen(false)}
        skillName={fileTreeSkill}
      />
      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={cachedGroups}
        onDone={refreshData}
      />
      <PathsModal
        open={pathsOpen}
        onClose={() => setPathsOpen(false)}
      />

      {/* 6. Toast container */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* 7. TargetCursor (highest z-index) */}
      <TargetCursor
        targetSelector=".btn,.card,button,a,input"
        hideDefaultCursor={false}
        parallaxOn={false}
      />
    </>
  );
}

/* ─── Root App with Providers ────────────────────────────────────── */
export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ApiProvider>
          <AppContent />
        </ApiProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
