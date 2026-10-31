// ─── ProjectSwitcher ──────────────────────────────────────────────
// Replaces the old static "active project" badge: a real dropdown to
// switch between projects, rename one, delete one (orphans its relics,
// never deletes them), or create a new one inline.

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

export default function ProjectSwitcher({ projects, currentProject, onSwitchProject, onAddProject, onRenameProject, onRemoveProject, confirm, compact = false }) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const [open,     setOpen]     = useState(false)
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [draft,    setDraft]    = useState('')
  const [nameTaken, setNameTaken] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false); setRenamingId(null) } }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Two projects with one name can't be told apart in this list or in moves
  function isTaken(name, exceptId) {
    const wanted = name.trim().toLowerCase()
    return projects.some(p => p.id !== exceptId && p.name.toLowerCase() === wanted)
  }
  function editDraft(value) { setDraft(value); setNameTaken(false) }

  function startCreate() { setCreating(true); editDraft('') }
  async function submitCreate() {
    if (isTaken(draft)) { setNameTaken(true); return }
    if (draft.trim()) await onAddProject(draft)
    setCreating(false); setDraft('')
  }

  function startRename(p) { setRenamingId(p.id); editDraft(p.name) }
  async function submitRename() {
    if (isTaken(draft, renamingId)) { setNameTaken(true); return }
    if (draft.trim()) await onRenameProject(renamingId, draft)
    setRenamingId(null); setDraft('')
  }

  async function handleDelete(p) {
    const ok = await confirm({
      title: t('sidebar.projects.deleteConfirmTitle'),
      message: t('sidebar.projects.deleteConfirmMessage', { name: p.name }),
      danger: true, confirmLabel: t('common.delete'),
    })
    if (ok) await onRemoveProject(p.id)
  }

  const rowStyle = { display:'flex', alignItems:'center', gap:6, padding:'7px 10px', fontSize:12, fontFamily:font.ui }

  return (
    <div ref={ref} style={{ margin: compact ? 0 : '0 10px 10px', position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:10, padding: compact ? 6 : 12,
          borderRadius:radius.card, background:color.bgElevated, border:`1px solid ${color.bgBorder}`,
          cursor:'pointer', textAlign:'left',
        }}>
        <div style={{width:32,height:32,background:color.blue500,borderRadius:radius.control,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,fontWeight:700,color:color.onPrimary,letterSpacing:'0.02em'}}>
          {(currentProject?.name ?? '??').slice(0,2).toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:color.textTertiary,fontFamily:font.mono}}>{t('sidebar.activeProject')}</div>
          <div style={{fontSize:12,fontWeight:600,color:color.textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {currentProject?.name ?? '—'}
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.tap} style={{ display:'flex', color:color.textSecondary }}>
          <ChevronDown size={14}/>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y: compact ? -6 : 6, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y: compact ? -6 : 6, scale:0.98 }}
            transition={spring.tap}
            className="glass glass-neutral"
            style={{ position:'absolute', ...(compact ? { top:'calc(100% + 8px)' } : { bottom:'calc(100% + 8px)' }), left:0, right:0, borderRadius:radius.card, padding:'4px 0', zIndex:50, maxHeight:260, overflowY:'auto', transformOrigin: compact ? 'top center' : 'bottom center' }}>
            {projects.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center' }}>
                {renamingId === p.id ? (
                  <div style={{ ...rowStyle, flex:1 }}>
                    <input autoFocus value={draft} onChange={e=>editDraft(e.target.value)}
                      aria-label={t('sidebar.projects.rename')} aria-invalid={nameTaken}
                      onKeyDown={e=>{ if(e.key==='Enter') submitRename(); if(e.key==='Escape') setRenamingId(null) }}
                      style={{flex:1,padding:'4px 6px',borderRadius:6,border:`1px solid ${color.blue500}`,background:color.bgBase,color:color.textPrimary,fontSize:12,fontFamily:font.ui,outline:'none'}}/>
                    <button onClick={submitRename} style={{background:'none',border:'none',cursor:'pointer',color:color.sage500,padding:2}}><Check size={13}/></button>
                    <button onClick={()=>setRenamingId(null)} style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,padding:2}}><X size={13}/></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { onSwitchProject(p.id); setOpen(false) }}
                      style={{ ...rowStyle, flex:1, background:p.id===currentProject?.id?alpha(color.blue500,0.12):'none', border:'none', cursor:'pointer', color:p.id===currentProject?.id?color.blue300:color.textPrimary, fontWeight:p.id===currentProject?.id?600:400 }}
                      onMouseEnter={e=>{ if(p.id!==currentProject?.id) e.currentTarget.style.background=color.hoverOverlay }}
                      onMouseLeave={e=>{ if(p.id!==currentProject?.id) e.currentTarget.style.background='none' }}>
                      {p.name}
                    </button>
                    <button onClick={() => startRename(p)} title={t('sidebar.projects.rename')} aria-label={t('sidebar.projects.rename')} style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,padding:6}}><Pencil size={11}/></button>
                    {projects.length > 1 && (
                      <button onClick={() => handleDelete(p)} title={t('sidebar.projects.delete')} aria-label={t('sidebar.projects.delete')} style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,padding:6}}><Trash2 size={11}/></button>
                    )}
                  </>
                )}
              </div>
            ))}

            {nameTaken && (
              <div role="alert" style={{ padding:'4px 10px', fontSize:11, color:color.terracotta500, fontFamily:font.ui }}>
                {t('sidebar.projects.nameTaken')}
              </div>
            )}

            <div style={{ height:1, background:color.bgBorder, margin:'4px 0' }}/>

            {creating ? (
              <div style={{ ...rowStyle }}>
                <input autoFocus value={draft} onChange={e=>editDraft(e.target.value)}
                  aria-label={t('sidebar.projects.newPlaceholder')} aria-invalid={nameTaken}
                  placeholder={t('sidebar.projects.newPlaceholder')}
                  onKeyDown={e=>{ if(e.key==='Enter') submitCreate(); if(e.key==='Escape') setCreating(false) }}
                  style={{flex:1,padding:'4px 6px',borderRadius:6,border:`1px solid ${color.blue500}`,background:color.bgBase,color:color.textPrimary,fontSize:12,fontFamily:font.ui,outline:'none'}}/>
                <button onClick={submitCreate} style={{background:'none',border:'none',cursor:'pointer',color:color.sage500,padding:2}}><Check size={13}/></button>
              </div>
            ) : (
              <button onClick={startCreate} style={{ ...rowStyle, width:'100%', background:'none', border:'none', cursor:'pointer', color:color.blue300, fontWeight:600 }}
                onMouseEnter={e=>e.currentTarget.style.background=color.hoverOverlay}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                <Plus size={13}/>{t('sidebar.projects.new')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
