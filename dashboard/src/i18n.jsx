import React, { createContext, useContext, useState, useCallback } from 'react';

const LANG = {
  en: {
    totalSkills:'Total Skills', today:'Today', thisWeek:'This Week', mostUsed:'Most Used',
    usageOverview:'Usage Overview', skillManagement:'Skill Management',
    newSkill:'+ New Skill', newGroup:'+ New Group',
    recentActivity:'Recent Activity', trash:'Trash', clearAll:'Clear All',
    operationHistory:'Operation History',
    // Modal
    newSkillTitle:'New Skill', editSkillTitle:'Edit Skill',
    newGroupTitle:'New Group', editGroupTitle:'Edit Group',
    name:'Name', displayName:'Display Name', description:'Description',
    tagsLabel:'Tags (comma separated)', group:'Group', color:'Color',
    enabled:'Enabled', cancel:'Cancel', save:'Save',
    deleteSkill:'Delete Skill', aboutToDelete:'About to delete:',
    deleteWarning:'This will move the following directory to trash (auto-cleared after 30 days):',
    deleteWarning2:'Claude Code will NOT be able to use this Skill until restored.',
    moveToTrash:'Move to Trash',
    permDelete:'Permanently Delete', permDeleteBtn:'Permanently Delete',
    permDeleteWarn:'This action is <strong>irreversible</strong>! All files will be permanently deleted.',
    typeNameConfirm:'Type the skill name to confirm:',
    // Dynamic
    online:'Online', offline:'Offline', updated:'Updated',
    noDataYet:'No usage data yet', noSkillsYet:'No skills yet',
    noSkillsInGroup:'No skills in this group', noActivityYet:'No activity yet',
    trashEmpty:'Trash is empty', noOpsYet:'No operations yet',
    date:'Date', skill:'Skill', count:'Count',
    restore:'Restore', undo:'Undo', irreversible:'irreversible',
    page:'Page', close:'Close', back:'Back', loading:'Loading...',
    emptyDir:'Empty directory', fileStructure:'File Structure',
    // Toast messages
    movedTo:"Moved '{0}' to '{1}'", skillCreated:'Skill created',
    savedHistory:'Saved. Previous version recorded in history.',
    movedToTrash:"'{0}' moved to trash", groupUpdated:'Group updated',
    groupCreated:'Group created', groupDeleted:'Group deleted',
    restored:"'{0}' restored", permDeleted:"'{0}' permanently deleted",
    trashCleared:'Trash cleared', opUndone:'Operation undone',
    nameRequired:'Name is required',
    deleteGroupConfirm:'Delete group "{0}"? Skills will move to Ungrouped.',
    clearTrashConfirm:'Permanently delete ALL items in trash? This cannot be undone.',
    dLeft:'{0}d left',
    // Import
    importSkill:'Import Skill', enterSource:'Enter Source', urlOrPath:'URL or Path',
    probe:'Probe', probing:'Probing...', selectSkills:'Select Skills',
    found:'Found {0} skill(s) in:', installTo:'Install to:', installSelected:'Install Selected',
    complete:'Complete', successInstalled:'Successfully installed {0} skill(s)',
    skippedCount:'Skipped {0}', alreadyExists:'Already exists!',
    skip:'Skip', overwrite:'Overwrite', done:'Done',
    supportedSources:'Supported: GitHub/GitLab URL, local path, ZIP file',
    step:'Step {0}/{1}',
    noSkillsFound:'No skills found in this source',
    importInstalling:'Installing...',
    // Skill Paths
    skillPaths:'Skill Paths', addPath:'Add Path', removePath:'Remove',
    pathType:'Type', global:'Global', project:'Project',
    pathPlaceholder:'Enter path to skills directory',
    pathAdded:'Path added', pathRemoved:'Path removed',
    // Tree
    skillPack:'Pack', skills:'skills',
  },
  zh: {
    totalSkills:'技能总数', today:'今日', thisWeek:'本周', mostUsed:'最常用',
    usageOverview:'使用量概览', skillManagement:'技能管理',
    newSkill:'+ 新建技能', newGroup:'+ 新建分组',
    recentActivity:'最近活动', trash:'回收站', clearAll:'清空',
    operationHistory:'操作历史',
    newSkillTitle:'新建技能', editSkillTitle:'编辑技能',
    newGroupTitle:'新建分组', editGroupTitle:'编辑分组',
    name:'名称', displayName:'显示名称', description:'描述',
    tagsLabel:'标签（逗号分隔）', group:'分组', color:'颜色',
    enabled:'启用', cancel:'取消', save:'保存',
    deleteSkill:'删除技能', aboutToDelete:'即将删除：',
    deleteWarning:'此操作将把以下目录移入回收站（30天后自动清除）：',
    deleteWarning2:'Claude Code 将无法使用此技能，直到从回收站恢复为止。',
    moveToTrash:'移入回收站',
    permDelete:'永久删除', permDeleteBtn:'永久删除',
    permDeleteWarn:'此操作<strong>不可撤销</strong>！所有文件将被永久删除。',
    typeNameConfirm:'请输入技能名称以确认：',
    online:'在线', offline:'离线', updated:'更新于',
    noDataYet:'暂无使用数据', noSkillsYet:'暂无技能',
    noSkillsInGroup:'此分组暂无技能', noActivityYet:'暂无活动记录',
    trashEmpty:'回收站为空', noOpsYet:'暂无操作记录',
    date:'日期', skill:'技能', count:'次数',
    restore:'恢复', undo:'撤销', irreversible:'不可撤销',
    page:'页', close:'关闭', back:'返回', loading:'加载中...',
    emptyDir:'空目录', fileStructure:'文件结构',
    movedTo:"已将 '{0}' 移至 '{1}'", skillCreated:'技能已创建',
    savedHistory:'已保存，原版本已记录至操作历史。',
    movedToTrash:"'{0}' 已移入回收站", groupUpdated:'分组已更新',
    groupCreated:'分组已创建', groupDeleted:'分组已删除',
    restored:"'{0}' 已恢复", permDeleted:"'{0}' 已永久删除",
    trashCleared:'回收站已清空', opUndone:'操作已撤销',
    nameRequired:'名称为必填项',
    deleteGroupConfirm:'删除分组 "{0}"？组内技能将移至"未分组"。',
    clearTrashConfirm:'永久删除回收站中所有项目？此操作不可撤销。',
    dLeft:'剩余{0}天',
    importSkill:'导入技能', enterSource:'输入来源', urlOrPath:'URL 或路径',
    probe:'探测', probing:'探测中...', selectSkills:'选择技能',
    found:'在以下来源发现 {0} 个技能：', installTo:'安装到：', installSelected:'安装所选',
    complete:'完成', successInstalled:'成功安装 {0} 个技能',
    skippedCount:'跳过 {0} 个', alreadyExists:'已存在！',
    skip:'跳过', overwrite:'覆盖', done:'完成',
    supportedSources:'支持：GitHub/GitLab 链接、本地路径、ZIP 文件',
    step:'步骤 {0}/{1}',
    noSkillsFound:'未在此来源中找到技能',
    importInstalling:'安装中...',
    skillPaths:'技能路径', addPath:'添加路径', removePath:'移除',
    pathType:'类型', global:'全局', project:'项目',
    pathPlaceholder:'输入技能目录路径',
    pathAdded:'路径已添加', pathRemoved:'路径已移除',
    skillPack:'技能包', skills:'个技能',
  }
};

const I18nContext = createContext(null);

function I18nProvider({ children }) {
  const [currentLang, setCurrentLang] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
    return (saved && LANG[saved]) ? saved : 'en';
  });

  const t = useCallback((key, ...args) => {
    let s = (LANG[currentLang] || LANG.en)[key] || LANG.en[key] || key;
    args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
    return s;
  }, [currentLang]);

  const toggleLang = useCallback(() => {
    setCurrentLang(prev => {
      const next = prev === 'en' ? 'zh' : 'en';
      localStorage.setItem('lang', next);
      document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
      return next;
    });
  }, []);

  return (
    <I18nContext.Provider value={{ t, lang: currentLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export { LANG, I18nContext, I18nProvider, useI18n };
