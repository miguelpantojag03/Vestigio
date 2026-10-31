import { useState, useRef, useEffect } from 'react'
import { AnimatePresence }  from 'framer-motion'
import { useNavigate }     from 'react-router-dom'
import { useTranslation }  from 'react-i18next'
import { Archive, RotateCcw, Layers, Trash2, CheckSquare } from 'lucide-react'
import { useAuth }         from '../auth/AuthProvider.jsx'
import { useToast }        from '../components/Toast.jsx'
import { useRelics }       from '../hooks/useRelics.js'
import { useProjects }     from '../hooks/useProjects.js'
import { useAI }           from '../hooks/useAI.js'
import { useConfirm }      from '../components/ConfirmModal.jsx'
import Sidebar             from '../components/Sidebar.jsx'
import TopBar              from '../components/TopBar.jsx'
import RelicCard           from '../components/RelicCard.jsx'
import RelicDetails        from '../components/RelicDetails.jsx'
import RevivalZone         from '../components/RevivalZone.jsx'
import NewRelicModal       from '../components/NewRelicModal.jsx'
import EditRelicModal      from '../components/EditRelicModal.jsx'
import AIInsightsPanel     from '../components/AIInsightsPanel.jsx'
import BulkActionBar       from '../components/BulkActionBar.jsx'
import SettingsModal       from '../components/SettingsModal.jsx'
import { useTheme }        from '../context/ThemeContext.jsx'

// ── Stats bar ─────────────────────────────────────────────────────
function StatsBar({ stats }) {
  const { t } = useTranslation()
  const { color, font } = useTheme()
  const items = [
    { icon: <Layers size={13}/>,    label: t('dashboard.stats.total'),    value: stats.total },
    { icon: <RotateCcw size={13}/>, label: t('dashboard.stats.revived'),  value: stats.revived },
    { icon: <Archive size={13}/>,   label: t('dashboard.stats.archived'), value: stats.archived },
  ]
  return (
    <div style={{display:'flex',gap:20,marginTop:8,marginBottom:16,flexWrap:'wrap'}}>
      {items.map(({icon,label,value})=>(
        <div key={label} style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:color.blue500}}>{icon}</span>
          <span style={{fontSize:11,fontFamily:font.mono,color:color.textSecondary}}>{label}</span>
          <span style={{fontSize:12,fontWeight:700,fontFamily:font.mono,color:color.textPrimary}}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ onNew, hasSearch, section }) {
  const { t } = useTranslation()
  const { color, font } = useTheme()
  const msg = hasSearch
    ? t('dashboard.empty.search')
    : section === 'revived' ? t('dashboard.empty.revived')
    : section === 'recent'  ? t('dashboard.empty.recent')
    : section === 'search'  ? t('dashboard.empty.searchPrompt')
    : section === 'deleted' ? t('dashboard.empty.deleted')
    : t('dashboard.empty.archiveDark')
  return (
    <div style={{marginTop:32,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,minHeight:200,borderRadius:16,border:`1px dashed ${color.bgBorder}`,color:color.textTertiary,padding:32}}>
      <span style={{fontSize:13,fontFamily:font.display,fontStyle:'italic'}}>{msg}</span>
      {!hasSearch && section==='gallery' && (
        <button onClick={onNew} style={{padding:'8px 20px',borderRadius:10,border:'none',background:color.blue500,color:color.onPrimary,fontSize:13,fontWeight:700,fontFamily:font.ui,cursor:'pointer'}}>
          {t('dashboard.empty.addFirst')}
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t }              = useTranslation()
  const { color, font, radius } = useTheme()
  const { user }           = useAuth()
  const { push }           = useToast()
  const navigate           = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()
  const { analyzeRelic, error: aiError } = useAI()

  const {
    projects, currentProject, currentProjectId, switchProject, addProject,
    rename: renameProject, remove: removeProject,
  } = useProjects(user?.id)

  const {
    relics, trashed, projectRelics, visible, selected, setSelectedId,
    filter, setFilter, section, setSection,
    search, setSearch, sortField, sortDir, cycleSort,
    searchCategory, setSearchCategory, searchStatus, setSearchStatus,
    searchCause, setSearchCause,
    searchDateFrom, setSearchDateFrom, searchDateTo, setSearchDateTo,
    stats, add, update, revive, trash, restore, removeForever, emptyTrash, moveToProject, addTag,
  } = useRelics(user?.id, currentProjectId)

  const hasSearchActivity = section === 'search'
    ? !!search || searchCategory !== 'all' || searchStatus !== 'all' || searchCause !== 'all' || !!searchDateFrom || !!searchDateTo
    : !!search

  const [dragOver,      setDragOver]      = useState(false)
  const [justRevived,   setJustRevived]   = useState(false)
  const [showNew,       setShowNew]       = useState(false)
  const [editRelic,     setEditRelic]     = useState(null)
  const [showSettings,  setShowSettings]  = useState(false)
  const [aiAnalysis,    setAiAnalysis]    = useState({})  // { [relicId]: string }
  const [aiLoadingId,   setAiLoadingId]   = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [checkedIds,    setCheckedIds]    = useState(() => new Set())
  const revivalZoneRef                    = useRef(null)

  // Only what's on screen: a filter or section change must never let a bulk
  // action reach relics the user can no longer see are selected.
  const bulkIds = visible.filter(r => checkedIds.has(r.id)).map(r => r.id)

  function toggleChecked(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setCheckedIds(new Set())
  }

  // Session expiry — AuthProvider has already signed out by the time this
  // event fires; this handler only reacts to it (toast + redirect).
  useEffect(() => {
    function handleExpired() {
      push(t('dashboard.toast.sessionExpired'), 'error', 6000)
      navigate('/login', { replace: true })
    }
    window.addEventListener('am:session-expired', handleExpired)
    return () => window.removeEventListener('am:session-expired', handleExpired)
  }, [navigate, push, t])

  // Drag & drop — spring-driven (framer-motion), not native HTML5 DnD
  function isOverRevivalZone(point) {
    const el = revivalZoneRef.current
    if (!el || !point) return false
    const r = el.getBoundingClientRect()
    return point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom
  }
  function handleCardDrag(id, info) {
    setDragOver(isOverRevivalZone(info.point))
  }
  function handleCardDragEnd(id, info) {
    const hit = isOverRevivalZone(info.point)
    setDragOver(false)
    if (!hit) return
    revive(id).catch(err => push(err.message, 'error'))
    setSelectedId(id)
    push(t('dashboard.toast.revived'), 'success')
    setJustRevived(true)
    setTimeout(() => setJustRevived(false), 700)
  }

  // If the window loses focus mid-drag (Alt+Tab, OS stealing the pointer),
  // framer-motion's onDragEnd never fires — without this, the Revival Zone
  // can stay highlighted as "drag over" even though nothing is being dragged.
  useEffect(() => {
    function resetDragOver() { setDragOver(false) }
    window.addEventListener('blur', resetDragOver)
    return () => window.removeEventListener('blur', resetDragOver)
  }, [])

  // Relic actions
  async function handleRevive(id) {
    try { await revive(id); push(t('dashboard.toast.revived'), 'success') }
    catch (err) { push(err.message, 'error') }
  }

  // No confirmation: moving to the trash is reversible, and the toast says how.
  async function handleTrash(ids) {
    try {
      await trash(ids)
      push(t('dashboard.toast.trashed', { count: ids.length }), 'info', 8000, {
        label: t('common.undo'),
        onClick: () => handleRestore(ids),
      })
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleRestore(ids) {
    try {
      await restore(ids)
      setSelectedId(ids[0])
      push(t('dashboard.toast.restored', { count: ids.length }), 'success')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleDeleteForever(ids) {
    const relic = ids.length === 1 ? trashed.find(r => r.id === ids[0]) : null
    const ok = await confirm({
      title: t('dashboard.toast.deleteTitle', { count: ids.length }),
      message: relic
        ? t('dashboard.toast.deleteMessage', { title: relic.title })
        : t('dashboard.toast.deleteManyMessage', { count: ids.length }),
      danger: true, confirmLabel: t('dashboard.toast.deleteConfirmLabel'),
    })
    if (!ok) return
    try {
      await removeForever(ids)
      push(t('dashboard.toast.deletedForever', { count: ids.length }), 'info')
      exitSelection()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleBulkMove(projectId) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    try {
      await moveToProject(bulkIds, project)
      push(t('dashboard.toast.moved', { count: bulkIds.length, project: project.name }), 'success')
      exitSelection()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleBulkTag(tag) {
    try {
      await addTag(bulkIds, tag)
      push(t('dashboard.toast.tagged', { count: bulkIds.length }), 'success')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleEmptyTrash() {
    const ok = await confirm({
      title: t('dashboard.toast.emptyTrashTitle'),
      message: t('dashboard.toast.deleteManyMessage', { count: trashed.length }),
      danger: true, confirmLabel: t('dashboard.toast.emptyTrashConfirm'),
    })
    if (!ok) return
    try {
      await emptyTrash()
      push(t('dashboard.toast.trashEmptied'), 'info')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleAddRelic(relic) {
    await add(relic)
    push(t('dashboard.toast.relicAdded'), 'success')
  }

  async function handleSaveEdit(id, patch) {
    await update(id, patch)
  }

  // AI: analyze selected relic
  async function handleAnalyze(relic) {
    if (!relic) return
    setAiLoadingId(relic.id)
    const result = await analyzeRelic(relic)
    if (result) {
      const summary = [result.summary, result.potential, ...(result.suggestions ?? [])].filter(Boolean).join(' ')
      if (summary) setAiAnalysis(prev => ({ ...prev, [relic.id]: summary }))
    }
    // Analyzing another relic aborts this call — its spinner isn't ours to clear.
    setAiLoadingId(current => current === relic.id ? null : current)
  }

  useEffect(() => {
    if (aiError) push(aiError, 'error')
  }, [aiError, push])

  // Jump to a relic from anywhere that lists the whole archive (AI insights,
  // the déjà-vu warning): it may live in another project, or in none, and
  // would otherwise silently fail to open.
  function focusRelic(id) {
    const relic = relics.find(r => r.id === id)
    if (relic && section !== 'search') {
      if (!relic.projectId) setSection('search')
      else if (relic.projectId !== currentProjectId) switchProject(relic.projectId)
    }
    setSelectedId(id)
  }

  const headerButton = {display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:radius.control,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textSecondary,fontSize:12,fontWeight:600,fontFamily:font.ui,cursor:'pointer'}

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:color.bgBase,overflow:'hidden'}}>
      <ConfirmModalUI/>

      {/* 3-column layout */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <Sidebar
          user={user}
          activeSection={section}
          onSection={setSection}
          onOpenSettings={() => setShowSettings(true)}
          projects={projects}
          currentProject={currentProject}
          onSwitchProject={switchProject}
          onAddProject={addProject}
          onRenameProject={renameProject}
          onRemoveProject={removeProject}
          confirm={confirm}
        />

        {/* Center */}
        <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:color.bgSurface}}>
          <div style={{flex:1,overflowY:'auto',position:'relative'}}>
            <TopBar
              search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter}
              section={section}
              searchCategory={searchCategory} setSearchCategory={setSearchCategory}
              searchStatus={searchStatus} setSearchStatus={setSearchStatus}
              searchCause={searchCause} setSearchCause={setSearchCause}
              searchDateFrom={searchDateFrom} setSearchDateFrom={setSearchDateFrom}
              searchDateTo={searchDateTo} setSearchDateTo={setSearchDateTo}
              onNewRelic={()=>setShowNew(true)}
              sortField={sortField} sortDir={sortDir} cycleSort={cycleSort}
            />

            <div style={{padding:'4px 20px 120px'}}>

              {/* Header */}
              <div style={{marginBottom:2}}>
                <h1 style={{fontSize:28,fontWeight:600,fontFamily:font.display,color:color.textPrimary,letterSpacing:'-0.01em',lineHeight:1.1,margin:0}}>
                  {t(`dashboard.sectionTitle.${section}`)}
                </h1>
                <p style={{fontSize:12,color:color.textSecondary,marginTop:4,marginBottom:0}}>
                  {section==='gallery'
                    ? t('dashboard.sectionDesc.gallery', { project: currentProject?.name || t('sidebar.nav.archive') })
                    : t(`dashboard.sectionDesc.${section}`)}
                </p>
              </div>

              {section === 'deleted' ? (
                trashed.length > 0 && (
                  <div style={{display:'flex',gap:8,margin:'12px 0 16px'}}>
                    {!selectionMode && (
                      <button onClick={() => setSelectionMode(true)} style={headerButton}>
                        <CheckSquare size={13}/> {t('dashboard.bulk.select')}
                      </button>
                    )}
                    <button onClick={handleEmptyTrash} style={{...headerButton,color:color.terracotta500}}>
                      <Trash2 size={13}/> {t('dashboard.emptyTrash')}
                    </button>
                  </div>
                )
              ) : (
                <>
                  {/* Stats */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                    <StatsBar stats={stats}/>
                    {!selectionMode && visible.length > 0 && (
                      <button onClick={() => setSelectionMode(true)} style={{...headerButton,marginTop:4}}>
                        <CheckSquare size={13}/> {t('dashboard.bulk.select')}
                      </button>
                    )}
                  </div>

                  {/* AI Insights */}
                  <div style={{marginBottom:20}}>
                    {/* Keyed by project: insights about another project's relics must not linger */}
                    <AIInsightsPanel key={currentProjectId} relics={projectRelics} onHighlight={focusRelic}/>
                  </div>
                </>
              )}

              {/* Grid — responsive */}
              {visible.length === 0 ? (
                <EmptyState onNew={()=>setShowNew(true)} hasSearch={hasSearchActivity} section={section}/>
              ) : (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',
                  gap:14,
                }}>
                  <AnimatePresence>
                    {visible.map((r,i)=>(
                      <RelicCard
                        key={r.id} relic={r} animIndex={i}
                        selectionMode={selectionMode}
                        isSelected={selectionMode ? checkedIds.has(r.id) : r.id===selected?.id}
                        onSelect={selectionMode ? toggleChecked : setSelectedId}
                        onCardDrag={handleCardDrag}
                        onCardDragEnd={handleCardDragEnd}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <AnimatePresence>
              {selectionMode && (
                <BulkActionBar
                  count={bulkIds.length}
                  inTrash={section === 'deleted'}
                  projects={projects}
                  onSelectAll={() => setCheckedIds(new Set(visible.map(r => r.id)))}
                  onCancel={exitSelection}
                  onMove={handleBulkMove}
                  onAddTag={handleBulkTag}
                  onTrash={() => { handleTrash(bulkIds); exitSelection() }}
                  onRestore={() => { handleRestore(bulkIds); exitSelection() }}
                  onDeleteForever={() => handleDeleteForever(bulkIds)}
                />
              )}
              </AnimatePresence>
            </div>

            {section !== 'deleted' && !selectionMode && (
              <RevivalZone
                ref={revivalZoneRef}
                isDragOver={dragOver}
                justRevived={justRevived}
              />
            )}
          </div>
        </main>

        {/* Right panel */}
        <RelicDetails
          relic={selected}
          projectName={projects.find(p => p.id === selected?.projectId)?.name}
          onUpdateRelic={update}
          onRevive={handleRevive}
          onTrash={id => handleTrash([id])}
          onRestore={id => handleRestore([id])}
          onDeleteForever={id => handleDeleteForever([id])}
          onEdit={relic=>setEditRelic(relic)}
          onAnalyze={handleAnalyze}
          aiAnalysis={selected ? aiAnalysis[selected.id] : null}
          aiLoading={aiLoadingId === selected?.id}
        />
      </div>

      {/* Modals */}
      <AnimatePresence>
      {showNew && (
        <NewRelicModal
          key="new"
          onClose={()=>setShowNew(false)}
          onAdd={handleAddRelic}
          relics={relics}
          onViewExisting={focusRelic}
          projectId={currentProjectId}
          projectName={currentProject?.name}
        />
      )}
      {editRelic && (
        <EditRelicModal key="edit" relic={editRelic} onClose={()=>setEditRelic(null)} onSave={handleSaveEdit}/>
      )}
      {showSettings && (
        <SettingsModal key="settings" userId={user?.id} onClose={()=>setShowSettings(false)}/>
      )}
      </AnimatePresence>
    </div>
  )
}
