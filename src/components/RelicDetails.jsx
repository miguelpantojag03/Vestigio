import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RotateCcw, Trash2, Pencil, Paperclip, Expand,
  Image as ImageIcon, Sparkles, X,
  Link2, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle,
  Layers, Plus, ChevronDown, ChevronUp, ArrowUpCircle, Archive, Undo2,
} from 'lucide-react'
import { getThumbnail } from './Thumbnails.jsx'
import { useAttachments }  from '../hooks/useAttachments.js'
import { useDrafts }       from '../hooks/useDrafts.js'
import { useAuth }         from '../auth/AuthProvider.jsx'
import { useToast }        from './Toast.jsx'
import { useConfirm }      from './ConfirmModal.jsx'
import { isImage }         from '../constants/fileTypes.js'
import { useTheme }        from '../context/ThemeContext.jsx'
import { alpha }           from '../styles/tokens.js'
import { formatDate }      from '../lib/formatDate.js'
import { getLinkStatus, openLinkedFile, openCopiedFile, pickFileToLink, secureCopy, basename } from '../lib/fileLinks.js'

/* ─── full-screen image viewer ────────────────────────────────────── */
function ImageViewer({ src, title, onClose }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const [zoom, setZoom] = useState(1)
  const [rot,  setRot]  = useState(0)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const btn = (label, onClick, danger = false) => (
    <button onClick={onClick} title={label}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: danger ? color.terracotta500 : color.textPrimary, padding: 6, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.background = color.hoverOverlay}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{label === t('imageViewer.close') ? <X size={16}/> : label === t('imageViewer.rotate') ? <span style={{fontSize:13}}>↻</span> : label === '+' ? <span style={{fontSize:16}}>+</span> : <span style={{fontSize:16}}>−</span>}</button>
  )

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed',inset:0,zIndex:600,
        background:'rgba(0,0,0,0.9)',backdropFilter:'blur(8px)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,
      }}>
      {/* toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:12,width:'100%',maxWidth:800,justifyContent:'space-between'}}>
        <span style={{fontSize:13,color:color.textPrimary,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{title}</span>
        <div style={{display:'flex',gap:2,alignItems:'center'}}>
          {btn('−',()=>setZoom(z=>Math.max(0.25,+(z-0.25).toFixed(2))))}
          <span style={{fontSize:11,color:color.textSecondary,minWidth:38,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
          {btn('+',()=>setZoom(z=>Math.min(5,+(z+0.25).toFixed(2))))}
          {btn(t('imageViewer.rotate'),()=>setRot(r=>(r+90)%360))}
          <div style={{width:1,height:20,background:color.bgBorder,margin:'0 4px'}}/>
          {btn(t('imageViewer.close'),onClose,true)}
        </div>
      </div>
      {/* image */}
      <div style={{width:'100%',maxWidth:800,flex:1,maxHeight:'calc(100vh-120px)',borderRadius:12,overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',background:color.bgBase,border:`1px solid ${color.bgBorder}`}}>
        <img src={src} alt={title} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',transform:`scale(${zoom}) rotate(${rot}deg)`,transformOrigin:'center',transition:'transform 0.2s ease',userSelect:'none'}} draggable={false}/>
      </div>
    </div>
  )
}

/* ─── thumbnail of an image attachment ───────────────────────────── */
function AttachmentThumb({ att, getPreviewURL, onOpen }) {
  const { color } = useTheme()
  const [hov, setHov] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on att.id only, same as the effect this replaced
  const src = useMemo(() => getPreviewURL(att), [att.id])

  // Object URLs aren't memory-managed by the browser — revoke the previous
  // one whenever src changes or this thumbnail unmounts.
  useEffect(() => {
    return () => { if (src) URL.revokeObjectURL(src) }
  }, [src])

  if (!src) return null
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>onOpen(src, att.originalName)}
      title={att.originalName}
      style={{
        width:56,height:56,borderRadius:8,overflow:'hidden',
        cursor:'pointer',position:'relative',flexShrink:0,
        border: hov ? `2px solid ${color.blue500}` : `2px solid ${color.bgBorder}`,
        transform: hov ? 'scale(1.05)' : 'scale(1)',
        transition:'border-color 0.12s,transform 0.12s',
      }}>
      <img src={src} alt={att.originalName} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
      {hov && (
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Expand size={14} style={{color:'white'}}/>
        </div>
      )}
    </div>
  )
}

/* ─── AI analysis display ─────────────────────────────────────────── */
function AIAnalysisBlock({ analysis, loading, onRequest }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  if (loading) return (
    <div style={{padding:'10px 12px',borderRadius:8,background:alpha(color.blue500, 0.08),border:`1px solid ${alpha(color.blue500, 0.2)}`,fontSize:11,color:color.blue300,display:'flex',alignItems:'center',gap:8}}>
      <Sparkles size={12} style={{animation:'am-spin 1s linear infinite'}}/>
      {t('relicDetails.aiAnalyzing')}
    </div>
  )
  if (analysis) return (
    <div style={{padding:'10px 12px',borderRadius:8,background:alpha(color.blue500, 0.08),border:`1px solid ${alpha(color.blue500, 0.2)}`}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
        <Sparkles size={11} style={{color:color.blue300}}/>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:color.blue300}}>{t('relicDetails.aiAnalysisLabel').toUpperCase()}</span>
      </div>
      <p style={{fontSize:11,color:color.textPrimary,lineHeight:1.65,margin:0}}>{analysis}</p>
    </div>
  )
  return (
    <button onClick={onRequest}
      style={{
        width:'100%',padding:'8px 0',borderRadius:8,border:`1px dashed ${alpha(color.blue500, 0.4)}`,
        background:'transparent',color:color.blue300,fontSize:12,fontWeight:600,
        fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
        transition:'background 0.12s,border-color 0.12s',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background=alpha(color.blue500, 0.08);e.currentTarget.style.borderColor=color.blue300}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor=alpha(color.blue500, 0.4)}}>
      <Sparkles size={13}/> {t('relicDetails.aiAnalyzeButton')}
    </button>
  )
}

/* ─── linked external file ────────────────────────────────────────── */
function LinkedFileSection({ relic, onUpdateRelic, color, font, t, push }) {
  const [status, setStatus] = useState('none')
  const [busy,   setBusy]   = useState(false)
  const { linkedFilePath, linkedFileMtime } = relic

  useEffect(() => {
    if (!linkedFilePath) return
    let cancelled = false
    getLinkStatus({ linkedFilePath, linkedFileMtime })
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(err => {
        console.error('[RelicDetails] Could not check linked file:', err)
        if (!cancelled) setStatus('broken')
      })
    return () => { cancelled = true }
  }, [linkedFilePath, linkedFileMtime])

  if (!relic.linkedFilePath) return null

  async function handleOpen() {
    try { await openLinkedFile(relic) }
    catch { push(t('relicDetails.linkedFile.openError'), 'error') }
  }

  async function handleOpenCopy() {
    try { await openCopiedFile(relic) }
    catch { push(t('relicDetails.linkedFile.openError'), 'error') }
  }

  async function handleRelink() {
    setBusy(true)
    try {
      const picked = await pickFileToLink()
      if (!picked) return
      await onUpdateRelic(relic.id, { linkedFilePath: picked.path, linkedFileMtime: picked.mtime })
      push(t('relicDetails.linkedFile.relinked'), 'success')
    } catch (err) {
      // Tauri commands reject with a plain string, not an Error.
      push(err?.message ?? t('relicDetails.linkedFile.openError'), 'error')
    } finally { setBusy(false) }
  }

  async function handleSecureCopy() {
    setBusy(true)
    try {
      const path = await secureCopy(relic)
      await onUpdateRelic(relic.id, { linkedFileCopiedPath: path })
      push(t('relicDetails.linkedFile.copySecured'), 'success')
    } catch { push(t('relicDetails.linkedFile.copyError'), 'error') }
    finally { setBusy(false) }
  }

  const statusLabel = {
    ok:       t('relicDetails.linkedFile.statusOk'),
    modified: t('relicDetails.linkedFile.statusModified'),
    broken:   t('relicDetails.linkedFile.statusBroken'),
    none:     '',
  }[status]
  const statusColor = status === 'broken' ? color.terracotta500 : status === 'modified' ? color.blue300 : color.sage500

  return (
    <div style={{border:`1px solid ${color.bgBorder}`,borderRadius:10,overflow:'hidden'}}>
      <div style={{padding:'7px 12px',background:color.bgElevated,borderBottom:`1px solid ${color.bgBorder}`,display:'flex',alignItems:'center',gap:6}}>
        <Link2 size={11} style={{color:color.textSecondary}}/>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:color.textSecondary}}>{t('relicDetails.linkedFile.title').toUpperCase()}</span>
      </div>
      <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {status === 'broken' && <AlertTriangle size={12} style={{color:statusColor,flexShrink:0}}/>}
          <span style={{fontSize:11,color:color.textPrimary,fontFamily:font.mono,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={relic.linkedFilePath}>
            {basename(relic.linkedFilePath)}
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:statusColor,fontWeight:600}}>
          {statusLabel}
          {relic.linkedFileCopiedPath && (
            <span style={{display:'flex',alignItems:'center',gap:3,color:color.sage500}}>
              <ShieldCheck size={11}/>{t('relicDetails.linkedFile.hasCopy')}
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={handleOpen} disabled={status==='broken'||busy}
            style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px solid ${color.bgBorder}`,background:'transparent',color:status==='broken'?color.textTertiary:color.textPrimary,fontSize:11,fontWeight:500,fontFamily:font.ui,cursor:status==='broken'||busy?'not-allowed':'pointer'}}>
            <ExternalLink size={11}/>{t('relicDetails.linkedFile.open')}
          </button>
          {status === 'broken' && (
            <button onClick={handleRelink} disabled={busy}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px solid ${alpha(color.blue500, 0.4)}`,background:alpha(color.blue500, 0.08),color:color.blue300,fontSize:11,fontWeight:600,fontFamily:font.ui,cursor:busy?'not-allowed':'pointer'}}>
              <RefreshCw size={11}/>{t('relicDetails.linkedFile.relink')}
            </button>
          )}
          {status === 'broken' && relic.linkedFileCopiedPath && (
            <button onClick={handleOpenCopy} disabled={busy}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textPrimary,fontSize:11,fontWeight:500,fontFamily:font.ui,cursor:busy?'not-allowed':'pointer'}}>
              <ShieldCheck size={11}/>{t('relicDetails.linkedFile.openCopy')}
            </button>
          )}
          {!relic.linkedFileCopiedPath && status !== 'broken' && (
            <button onClick={handleSecureCopy} disabled={busy}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textSecondary,fontSize:11,fontWeight:500,fontFamily:font.ui,cursor:busy?'not-allowed':'pointer'}}>
              <ShieldCheck size={11}/>{t('relicDetails.linkedFile.secureCopy')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── drafts ───────────────────────────────────────────────────────── */
function DraftEditor({ draft, onChange, color, font, t }) {
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description)
  const [notes, setNotes] = useState(draft.notes)
  const pendingRef = useRef(null)

  useEffect(() => {
    const changed = title !== draft.title || description !== draft.description || notes !== draft.notes
    const patch = { title, description, notes }
    pendingRef.current = changed ? patch : null
    if (!changed) return
    const timer = setTimeout(() => {
      pendingRef.current = null
      onChange(patch)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, notes])

  // Collapsing the editor or switching relics mid-debounce must not lose
  // what was just typed — the UI promises this autosaves.
  useEffect(() => () => {
    if (pendingRef.current) onChange(pendingRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inputStyle = { width:'100%', padding:'6px 8px', borderRadius:6, background:color.bgBase, border:`1px solid ${color.bgBorder}`, color:color.textPrimary, fontSize:11, fontFamily:font.ui, outline:'none' }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px 10px 10px', background:color.bgBase, borderRadius:7 }}>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={t('relicDetails.drafts.titlePlaceholder')} style={inputStyle}/>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder={t('relicDetails.drafts.descriptionPlaceholder')} rows={2} style={{...inputStyle, resize:'vertical'}}/>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t('relicDetails.drafts.notesPlaceholder')} rows={2} style={{...inputStyle, resize:'vertical'}}/>
      <span style={{ fontSize:9, color:color.textTertiary }}>{t('relicDetails.drafts.autosaveHint')}</span>
    </div>
  )
}

function DraftsSection({ relic, onUpdateRelic, color, font, t, push }) {
  const { user } = useAuth()
  const { drafts, create, update, remove, archive } = useDrafts(relic.id, user?.id)
  const { confirm, ConfirmModalUI } = useConfirm()
  const [expandedId, setExpandedId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  const open = drafts.filter(d => d.status === 'open')
  const archived = drafts.filter(d => d.status === 'archived')

  async function handleCreate() {
    const draft = await create({
      label: t('relicDetails.drafts.defaultLabel', { n: drafts.length + 1 }),
      title: relic.title, description: relic.description, notes: relic.notes,
    })
    setExpandedId(draft.id)
  }

  async function handlePromote(draft) {
    await onUpdateRelic(relic.id, { title: draft.title, description: draft.description, notes: draft.notes })
    await archive(draft.id, t('relicDetails.drafts.promotedReason'))
    const others = open.filter(d => d.id !== draft.id)
    if (others.length > 0) {
      const ok = await confirm({
        title: t('relicDetails.drafts.archiveOthersTitle'),
        message: t('relicDetails.drafts.archiveOthersMessage', { count: others.length }),
        confirmLabel: t('relicDetails.drafts.archiveOthersConfirm'),
        cancelLabel: t('relicDetails.drafts.archiveOthersCancel'),
      })
      if (ok) await Promise.all(others.map(d => archive(d.id, t('relicDetails.drafts.archivedWithPromotion'))))
    }
    push(t('relicDetails.drafts.promoted'), 'success')
  }

  return (
    <div style={{border:`1px solid ${color.bgBorder}`,borderRadius:10,overflow:'hidden'}}>
      <ConfirmModalUI/>
      <div style={{padding:'7px 12px',background:color.bgElevated,borderBottom:`1px solid ${color.bgBorder}`,display:'flex',alignItems:'center',gap:6}}>
        <Layers size={11} style={{color:color.textSecondary}}/>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:color.textSecondary,flex:1}}>{t('relicDetails.drafts.title').toUpperCase()}</span>
        <button onClick={handleCreate} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:color.blue300,fontSize:10,fontWeight:600,fontFamily:font.ui}}>
          <Plus size={11}/>{t('relicDetails.drafts.new')}
        </button>
      </div>
      <div style={{padding:open.length||archived.length?'8px 10px':'10px 12px',display:'flex',flexDirection:'column',gap:6}}>
        {open.length === 0 && archived.length === 0 && (
          <span style={{fontSize:11,color:color.textTertiary}}>{t('relicDetails.drafts.empty')}</span>
        )}
        {open.map(d => (
          <div key={d.id} style={{display:'flex',flexDirection:'column',gap:0,border:`1px solid ${color.bgBorder}`,borderRadius:8,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',cursor:'pointer'}}
              onClick={() => setExpandedId(expandedId===d.id?null:d.id)}>
              <span style={{flex:1,fontSize:11,color:color.textPrimary,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {d.label || d.title || t('relicDetails.drafts.untitled')}
              </span>
              <button onClick={e=>{e.stopPropagation();handlePromote(d)}} title={t('relicDetails.drafts.promote')}
                style={{background:'none',border:'none',cursor:'pointer',color:color.sage500,padding:3,display:'flex'}}>
                <ArrowUpCircle size={13}/>
              </button>
              <button onClick={e=>{e.stopPropagation();archive(d.id, t('relicDetails.drafts.archivedManually'))}} title={t('relicDetails.drafts.archive')}
                style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,padding:3,display:'flex'}}>
                <Archive size={12}/>
              </button>
              <button onClick={e=>{e.stopPropagation();remove(d.id)}} title={t('common.delete')}
                style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,padding:3,display:'flex'}}>
                <Trash2 size={12}/>
              </button>
              {expandedId===d.id ? <ChevronUp size={12} style={{color:color.textSecondary}}/> : <ChevronDown size={12} style={{color:color.textSecondary}}/>}
            </div>
            {expandedId === d.id && (
              <DraftEditor draft={d} onChange={patch => update(d.id, patch)} color={color} font={font} t={t}/>
            )}
          </div>
        ))}
        {archived.length > 0 && (
          <button onClick={()=>setShowArchived(s=>!s)} style={{background:'none',border:'none',cursor:'pointer',color:color.textSecondary,fontSize:10,textAlign:'left',padding:0}}>
            {showArchived ? t('relicDetails.drafts.hideArchived') : t('relicDetails.drafts.showArchived', { count: archived.length })}
          </button>
        )}
        {showArchived && archived.map(d => (
          <div key={d.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',opacity:0.6}}>
            <span style={{flex:1,fontSize:11,color:color.textSecondary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {d.label || d.title || t('relicDetails.drafts.untitled')}
            </span>
            <span style={{fontSize:9,color:color.textTertiary}}>{d.archivedReason}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── main component ──────────────────────────────────────────────── */
export default function RelicDetails({ relic, projectName, onUpdateRelic, onRevive, onTrash, onRestore, onDeleteForever, onEdit, onAnalyze, aiAnalysis, aiLoading }) {
  const { t } = useTranslation()
  const { color, font } = useTheme()
  const { user } = useAuth()
  const { push } = useToast()
  const { attachments, getPreviewURL } = useAttachments(relic?.id ?? null, user?.id)

  const [viewer,  setViewer]  = useState(null)  // { src, title }
  const [showAll, setShowAll] = useState(false)

  // Reset viewer when relic changes — adjusted during render (React's
  // recommended pattern for this) rather than in an effect, so switching
  // relics doesn't cost an extra render pass.
  const [prevRelicId, setPrevRelicId] = useState(relic?.id)
  if (relic?.id !== prevRelicId) {
    setPrevRelicId(relic?.id)
    setViewer(null)
    setShowAll(false)
  }

  const imageAtts  = attachments.filter(a => isImage(a.extension))
  const visibleImg = showAll ? imageAtts : imageAtts.slice(0, 6)
  const totalAtts  = attachments.length
  const hasCover   = !!relic?.coverImage
  const inTrash    = !!relic?.deletedAt

  return (
    <aside style={{
      width:260,flexShrink:0,display:'flex',flexDirection:'column',
      height:'100%',background:color.bgBase,borderLeft:`1px solid ${color.bgBorder}`,
      overflowY:'auto',
    }}>
      {/* header */}
      <div style={{
        padding:'14px 16px 10px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        borderBottom: relic ? `1px solid ${color.bgBorder}` : 'none',flexShrink:0,
      }}>
        <span style={{fontSize:14,fontWeight:600,fontFamily:font.display,color:color.textPrimary}}>{t('relicDetails.title')}</span>
        {relic && !inTrash && (
          <button onClick={()=>onEdit(relic)}
            style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textSecondary,fontSize:11,fontWeight:600,fontFamily:font.ui,cursor:'pointer',transition:'border-color 0.12s,color 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=color.blue500;e.currentTarget.style.color=color.blue300}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=color.bgBorder;e.currentTarget.style.color=color.textSecondary}}>
            <Pencil size={11}/> {t('relicDetails.edit')}
          </button>
        )}
      </div>

      {!relic ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center',color:color.textTertiary,fontSize:13}}>
          {t('relicDetails.selectPrompt')}
        </div>
      ) : (
        <div style={{padding:'14px 16px 20px',display:'flex',flexDirection:'column',gap:12}}>

          {/* ── COVER IMAGE (real photo or category thumbnail) ── */}
          <div
            onClick={hasCover ? ()=>setViewer({src:relic.coverImage,title:relic.title}) : undefined}
            style={{
              width:'100%',height:160,borderRadius:10,overflow:'hidden',
              position:'relative',flexShrink:0,cursor:hasCover?'pointer':'default',
              border:`1px solid ${color.bgBorder}`,
            }}>
            {hasCover ? (
              <>
                <img src={relic.coverImage} alt={relic.title}
                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                {/* hover overlay */}
                <div className="rd-hover-overlay" style={{
                  position:'absolute',inset:0,background:'rgba(0,0,0,0)',
                  display:'flex',alignItems:'flex-end',justifyContent:'flex-end',
                  padding:8,transition:'background 0.15s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.35)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,0)'}
                >
                  <div style={{background:alpha(color.blue500, 0.85),borderRadius:6,padding:'3px 8px',display:'flex',alignItems:'center',gap:5,fontSize:10,color:'white',fontWeight:600}}>
                    <Expand size={10}/> {t('relicDetails.viewOverlay')}
                  </div>
                </div>
              </>
            ) : (
              // show the category thumbnail (same as grid card) when no cover image
              <div style={{width:'100%',height:'100%'}}>
                {getThumbnail(relic.thumbnail)}
              </div>
            )}
          </div>

          {/* title */}
          <div style={{fontSize:14,fontStyle:'italic',fontWeight:500,fontFamily:font.display,color:color.textPrimary,lineHeight:1.4}}>
            "{relic.title}"
          </div>

          {/* status */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,
              background:relic.revived?color.sage500:color.blue500,
              boxShadow:relic.revived?`0 0 6px ${color.sage500}`:`0 0 6px ${color.blue500}`}}/>
            <span style={{fontSize:11,color:color.textSecondary}}>{relic.revived?t('relicDetails.statusRevived'):t('relicDetails.statusArchived')}</span>
          </div>

          {/* tags */}
          {relic.tags?.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {relic.tags.map(tag=>(
                <span key={tag} style={{fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:color.blue300,background:alpha(color.blue500, 0.15),borderRadius:99,padding:'2px 8px'}}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* image gallery from attachments */}
          {imageAtts.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <ImageIcon size={12} style={{color:color.blue300}}/>
                <span style={{fontSize:11,fontWeight:700,color:color.textPrimary}}>{t('relicDetails.images')}</span>
                <span style={{fontSize:10,fontWeight:700,color:color.blue300,background:alpha(color.blue500, 0.15),borderRadius:99,padding:'1px 7px'}}>{imageAtts.length}</span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {visibleImg.map(att=>(
                  <AttachmentThumb key={att.id} att={att} getPreviewURL={getPreviewURL}
                    onOpen={(src,title)=>setViewer({src,title})}/>
                ))}
              </div>
              {imageAtts.length > 6 && (
                <button onClick={()=>setShowAll(s=>!s)}
                  style={{fontSize:10,color:color.blue300,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
                  {showAll ? t('relicDetails.showLess') : t('relicDetails.showMore', { count: imageAtts.length-6 })}
                </button>
              )}
            </div>
          )}

          {/* attachments badge */}
          {totalAtts > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:7,background:alpha(color.blue500, 0.1),border:`1px solid ${alpha(color.blue500, 0.2)}`}}>
              <Paperclip size={12} style={{color:color.blue300}}/>
              <span style={{fontSize:11,color:color.blue300,fontWeight:600}}>{t('relicDetails.filesAttached', { count: totalAtts })}</span>
            </div>
          )}

          {/* drafts — in-progress variants of this idea's content, usable
              from any status (archived or revived) */}
          {!inTrash && <DraftsSection relic={relic} onUpdateRelic={onUpdateRelic} color={color} font={font} t={t} push={push}/>}

          {/* linked external file */}
          <LinkedFileSection relic={relic} onUpdateRelic={onUpdateRelic} color={color} font={font} t={t} push={push}/>

          {/* metadata */}
          <div style={{border:`1px solid ${color.bgBorder}`,borderRadius:10,overflow:'hidden'}}>
            {[
              {label:t('relicDetails.project'),  value:projectName},
              {label:t('relicDetails.category'), value:t(`relicCard.category.${relic.category}`, relic.category)},
              {label:t('relicDetails.created'),  value:formatDate(relic.createdAt??relic.created)},
              {label:t('relicDetails.discarded'),value:formatDate(relic.discardedAt??relic.discarded)},
              ...(relic.responsible?[{label:t('relicDetails.responsible'),value:relic.responsible}]:[]),
            ].map(({label,value},i,arr)=>(
              <div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:color.bgElevated,borderBottom:i<arr.length-1?`1px solid ${color.bgBorder}`:'none'}}>
                <span style={{fontSize:11,color:color.textSecondary,flexShrink:0}}>{label}</span>
                <span style={{fontSize:11,color:color.textPrimary,fontWeight:500,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{value??'—'}</span>
              </div>
            ))}
          </div>

          {/* notes */}
          {relic.notes && (
            <div style={{padding:'8px 12px',borderRadius:8,background:color.bgElevated,border:`1px solid ${color.bgBorder}`}}>
              <div style={{fontSize:10,fontWeight:700,color:color.textSecondary,marginBottom:4,letterSpacing:'0.06em'}}>{t('relicDetails.notes').toUpperCase()}</div>
              <div style={{fontSize:11,color:color.textPrimary,lineHeight:1.6}}>{relic.notes}</div>
            </div>
          )}

          {/* AI analysis */}
          {!inTrash && <AIAnalysisBlock analysis={aiAnalysis} loading={aiLoading} onRequest={()=>onAnalyze?.(relic)}/>}

          {/* actions */}
          {inTrash && (
            <button onClick={()=>onRestore(relic.id)}
              style={{width:'100%',padding:'10px 0',borderRadius:8,border:'none',background:color.blue500,color:color.onPrimary,fontSize:13,fontWeight:600,fontFamily:font.ui,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background=color.blue600}
              onMouseLeave={e=>e.currentTarget.style.background=color.blue500}>
              <Undo2 size={13}/> {t('relicDetails.restore')}
            </button>
          )}
          {!inTrash && !relic.revived && (
            <button onClick={()=>onRevive(relic.id)}
              style={{width:'100%',padding:'10px 0',borderRadius:8,border:'none',background:color.blue500,color:color.onPrimary,fontSize:13,fontWeight:600,fontFamily:font.ui,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background=color.blue600}
              onMouseLeave={e=>e.currentTarget.style.background=color.blue500}>
              <RotateCcw size={13}/> {t('relicDetails.reviveNow')}
            </button>
          )}
          <button onClick={()=>inTrash ? onDeleteForever(relic.id) : onTrash(relic.id)}
            style={{width:'100%',padding:'10px 0',borderRadius:8,background:'transparent',color:color.textSecondary,fontSize:13,fontWeight:600,fontFamily:font.ui,cursor:'pointer',border:`1px solid ${color.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'border-color 0.12s,color 0.12s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=color.terracotta500;e.currentTarget.style.color=color.terracotta500}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=color.bgBorder;e.currentTarget.style.color=color.textSecondary}}>
            <Trash2 size={13}/> {inTrash ? t('relicDetails.deleteForever') : t('relicDetails.moveToTrash')}
          </button>
        </div>
      )}

      {/* fullscreen viewer */}
      {viewer && <ImageViewer src={viewer.src} title={viewer.title} onClose={()=>setViewer(null)}/>}

      <style>{`@keyframes am-spin{to{transform:rotate(360deg)}}`}</style>
    </aside>
  )
}
