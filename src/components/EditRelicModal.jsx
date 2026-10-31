// ─── EditRelicModal ───────────────────────────────────────────────
// Edit relic: all fields + cover image + tags (with AI) + attachments.

import { useState, useRef, useEffect } from 'react'
import { X, ImagePlus, Sparkles } from 'lucide-react'
import { useTranslation }   from 'react-i18next'
import { useAuth }          from '../auth/AuthProvider.jsx'
import { useToast }         from './Toast.jsx'
import Modal                from './Modal.jsx'
import AttachmentList       from './AttachmentList.jsx'
import { useAttachments }   from '../hooks/useAttachments.js'
import { useConfirm }       from './ConfirmModal.jsx'
import { useAI }            from '../hooks/useAI.js'
import { getThumbnail }     from './Thumbnails.jsx'
import { TagsInput }        from './NewRelicModal.jsx'
import AITagSuggester       from './AITagSuggester.jsx'
import LinkedFilePicker     from './LinkedFilePicker.jsx'
import { pickFileToLink, secureCopy } from '../lib/fileLinks.js'
import { CATEGORIES, CATEGORY_FILTER_MAP, CATEGORY_THUMB_MAP } from '../constants/categories.js'
import { Spinner }          from './FormField.jsx'
import { useTheme }         from '../context/ThemeContext.jsx'
import { alpha }            from '../styles/tokens.js'
import { registerUnsavedChanges } from '../lib/windowCloseGuard.js'

// ── Cover image helpers (same resize logic as NewRelicModal) ──────
const COVER_MAX_B    = 5 * 1024 * 1024
const COVER_IMG_EXTS = ['jpg','jpeg','png','webp','gif']

function resizeToBase64(file, maxW=600, maxH=400) {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let {width:w,height:h} = img
      if(w>maxW||h>maxH){const r=Math.min(maxW/w,maxH/h);w=Math.round(w*r);h=Math.round(h*r)}
      const c=document.createElement('canvas');c.width=w;c.height=h
      c.getContext('2d').drawImage(img,0,0,w,h)
      resolve(c.toDataURL('image/jpeg',0.82))
    }
    img.onerror=reject;img.src=url
  })
}

function CoverImagePicker({ coverImage, onChange, fallbackThumb }) {
  const { t } = useTranslation()
  const { color, radius, font } = useTheme()
  const inputRef=useRef(null)
  const [err,setErr]=useState('')
  const [busy,setBusy]=useState(false)

  async function handleFile(file) {
    setErr('')
    const ext=file.name.split('.').pop()?.toLowerCase()
    if(!COVER_IMG_EXTS.includes(ext)){setErr(t('modals.newRelic.imageTypeError'));return}
    if(file.size>COVER_MAX_B){setErr(t('modals.newRelic.imageSizeError'));return}
    setBusy(true)
    try{onChange(await resizeToBase64(file))}catch{setErr(t('modals.newRelic.imageProcessError'))}
    finally{setBusy(false)}
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div onClick={()=>!busy&&inputRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
          style={{width:96,height:64,borderRadius:radius.control,overflow:'hidden',border:`1px solid ${color.bgBorder}`,flexShrink:0,position:'relative',cursor:'pointer',background:color.bgBase}}>
          {busy
            ?<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner/></div>
            :<>
              {getThumbnail(fallbackThumb,coverImage)}
              <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s'}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0'}>
                <ImagePlus size={18} style={{color:'white'}}/>
              </div>
            </>
          }
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <button type="button" onClick={()=>inputRef.current?.click()} disabled={busy}
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:radius.controlSm,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textPrimary,fontSize:12,fontWeight:500,fontFamily:font.ui,cursor:busy?'not-allowed':'pointer',transition:'border-color 0.12s'}}
            onMouseEnter={e=>{if(!busy)e.currentTarget.style.borderColor=color.blue500}}
            onMouseLeave={e=>e.currentTarget.style.borderColor=color.bgBorder}>
            <ImagePlus size={13}/>{coverImage?t('modals.newRelic.changeImage'):t('modals.newRelic.uploadImage')}
          </button>
          {coverImage&&<button type="button" onClick={()=>onChange(null)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:radius.controlSm,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textSecondary,fontSize:12,fontWeight:500,fontFamily:font.ui,cursor:'pointer',transition:'border-color 0.12s,color 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=color.terracotta500;e.currentTarget.style.color=color.terracotta500}} onMouseLeave={e=>{e.currentTarget.style.borderColor=color.bgBorder;e.currentTarget.style.color=color.textSecondary}}><X size={13}/>{t('modals.newRelic.remove')}</button>}
          <span style={{fontSize:10,color:color.textSecondary}}>{t('modals.newRelic.imageHint')}</span>
        </div>
      </div>
      {err&&<span style={{fontSize:11,color:color.terracotta500,padding:'4px 8px',borderRadius:5,background:alpha(color.terracotta500, 0.1)}}>{err}</span>}
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif"
        onChange={e=>{const f=e.target.files[0];if(f)handleFile(f);e.target.value=''}}
        style={{display:'none'}} aria-label={t('modals.newRelic.uploadCoverLabel')}/>
    </div>
  )
}

// ── Description enhancer button ───────────────────────────────────
function DescriptionEnhancer({ title, description, onApply }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const { loading, error, enhanceDescription } = useAI()
  const [done, setDone] = useState(false)

  async function handle() {
    const result = await enhanceDescription(title, description)
    if (result?.description) {
      onApply(result.description)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    }
  }

  return (
    <div style={{marginTop:5}}>
      <button type="button" onClick={handle} disabled={loading||!title.trim()}
        style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:7,border:`1px solid ${alpha(color.blue500, 0.35)}`,background:alpha(color.blue500, 0.06),color:done?color.sage500:color.blue300,fontSize:11,fontWeight:600,fontFamily:'inherit',cursor:loading||!title.trim()?'not-allowed':'pointer',opacity:!title.trim()?0.5:1,transition:'background 0.12s'}}
        onMouseEnter={e=>{if(!loading&&title.trim())e.currentTarget.style.background=alpha(color.blue500, 0.14)}}
        onMouseLeave={e=>e.currentTarget.style.background=alpha(color.blue500, 0.06)}>
        <Sparkles size={12} style={{animation:loading?'am-spin 0.8s linear infinite':'none'}}/>
        {loading?t('modals.editRelic.enhancing'):done?`✓ ${t('modals.editRelic.applied')}`:`✦ ${t('modals.editRelic.enhanceWithAI')}`}
      </button>
      {error&&<span style={{fontSize:10,color:color.terracotta500,marginTop:4,display:'block'}}>{error}</span>}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────
export default function EditRelicModal({ relic, onClose, onSave }) {
  const { t }      = useTranslation()
  const { color, radius, font } = useTheme()
  const { user }   = useAuth()
  const { push }   = useToast()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [title,       setTitle]       = useState(relic.title)
  const [category,    setCategory]    = useState(relic.category)
  const [description, setDesc]        = useState(relic.description)
  const [notes,       setNotes]       = useState(relic.notes??'')
  const [responsible, setResponsible] = useState(relic.responsible??'')
  const [tags,        setTags]        = useState(relic.tags??[])
  const [coverImage,  setCoverImage]  = useState(relic.coverImage??null)
  const [linkedFile, setLinkedFile] = useState(
    relic.linkedFilePath ? { path: relic.linkedFilePath, mtime: relic.linkedFileMtime } : null
  )
  const [secureCopyFlag, setSecureCopyFlag] = useState(!!relic.linkedFileCopiedPath)
  const [titleError,  setTitleError]  = useState('')
  const [saving,      setSaving]      = useState(false)

  const {
    attachments,loading:attLoading,error:attError,setError:setAttError,
    addFiles,remove:removeAttRaw,download:downloadAtt,open:openAtt,getPreviewURL,
  } = useAttachments(relic.id, user?.id)

  // Let the native window-close guard know this form has unsaved edits.
  // Attachments aren't included — useAttachments persists them immediately,
  // they're never "unsaved" the way the text fields below are.
  const isDirty = Boolean(
    title !== relic.title ||
    category !== relic.category ||
    description !== relic.description ||
    notes !== (relic.notes ?? '') ||
    responsible !== (relic.responsible ?? '') ||
    coverImage !== (relic.coverImage ?? null) ||
    tags.length !== (relic.tags ?? []).length ||
    tags.some((tag, i) => tag !== (relic.tags ?? [])[i]) ||
    (linkedFile?.path ?? null) !== (relic.linkedFilePath ?? null) ||
    secureCopyFlag !== !!relic.linkedFileCopiedPath
  )
  useEffect(() => {
    registerUnsavedChanges(isDirty)
    return () => registerUnsavedChanges(false)
  }, [isDirty])

  async function handleAddFiles(files){setAttError(null);try{await addFiles(files)}catch(err){setAttError(err.message)}}

  async function handlePickFile() {
    const picked = await pickFileToLink()
    if (picked) setLinkedFile(picked)
  }

  async function handleDeleteAtt(att) {
    const ok = await confirm({
      title: t('modals.editRelic.deleteAttachmentTitle'),
      message: t('modals.editRelic.deleteAttachmentMessage', { name: att.originalName }),
      danger: true, confirmLabel: t('modals.editRelic.deleteAttachmentConfirm'),
    })
    if(!ok)return
    try{await removeAttRaw(att.id);push(t('modals.editRelic.attachmentDeleted'),'info')}
    catch{push(t('modals.editRelic.attachmentDeleteError'),'error')}
  }

  async function handleSave() {
    if(!title.trim()){setTitleError(t('modals.newRelic.titleRequired'));return}
    setSaving(true)
    try {
      const now=new Date().toISOString()
      let linkedFileCopiedPath = relic.linkedFileCopiedPath ?? null
      if (!linkedFile) {
        linkedFileCopiedPath = null
      } else if (secureCopyFlag && (!linkedFileCopiedPath || linkedFile.path !== relic.linkedFilePath)) {
        linkedFileCopiedPath = await secureCopy({ id: relic.id, linkedFilePath: linkedFile.path })
      } else if (!secureCopyFlag) {
        linkedFileCopiedPath = null
      }
      const patch = {
        title:title.trim(),category,
        description:description.trim(),
        notes:notes.trim(),responsible:responsible.trim(),
        tags,
        filter:CATEGORY_FILTER_MAP[category],thumbnail:CATEGORY_THUMB_MAP[category],
        linkedFilePath: linkedFile?.path ?? null,
        linkedFileMtime: linkedFile?.mtime ?? null,
        linkedFileCopiedPath,
        updatedAt:now,
      }
      // Only touch the cover-image file on disk if it actually changed —
      // otherwise an unchanged `asset://` string would get mistaken for
      // "nothing to persist" and the real file would get deleted.
      if (coverImage !== (relic.coverImage ?? null)) patch.coverImage = coverImage ?? null
      await onSave(relic.id, patch)
      push(t('modals.editRelic.relicUpdated'),'success')
      onClose()
    } catch(err){
      push(err.message,'error')
    } finally{setSaving(false)}
  }

  const S = {
    input:{width:'100%',padding:'8px 10px',borderRadius:radius.controlSm,background:color.bgBase,border:`1px solid ${color.bgBorder}`,color:color.textPrimary,fontSize:13,fontFamily:font.ui,outline:'none'},
    label:{fontSize:12,fontWeight:600,color:color.textPrimary,marginBottom:5,display:'block'},
    focus:e=>{e.target.style.borderColor=color.blue500;e.target.style.boxShadow=`0 0 0 3px ${alpha(color.blue500, 0.12)}`},
    blur: e=>{e.target.style.borderColor=color.bgBorder;e.target.style.boxShadow='none'},
    sec:{fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:color.textSecondary,textTransform:'uppercase'},
  }

  return (
    <>
      <ConfirmModalUI/>
      <Modal title={t('modals.editRelic.title')} onClose={onClose}>
        <div style={{display:'flex',flexDirection:'column',gap:14,maxHeight:'72vh',overflowY:'auto',paddingRight:2}}>

          <div style={S.sec}>{t('modals.newRelic.generalInfo')}</div>

          <div>
            <label style={S.label}>{t('modals.newRelic.titleLabel')} <span style={{color:color.terracotta500}}>*</span></label>
            <input style={{...S.input,borderColor:titleError?color.terracotta500:color.bgBorder}}
              value={title} onChange={e=>{setTitle(e.target.value);setTitleError('')}} autoFocus onFocus={S.focus} onBlur={S.blur}/>
            {titleError&&<span style={{fontSize:11,color:color.terracotta500,marginTop:4,display:'block'}}>{titleError}</span>}
          </div>

          <div>
            <label style={S.label}>{t('modals.newRelic.category')}</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {CATEGORIES.map(c=>(
                <button key={c} type="button" onClick={()=>setCategory(c)}
                  style={{padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',background:category===c?color.blue500:alpha(color.blue500, 0.1),color:category===c?color.onPrimary:color.blue300,fontSize:10,fontWeight:700,letterSpacing:'0.04em',fontFamily:font.mono,textTransform:'lowercase'}}>
                  {t(`relicCard.category.${c}`, c)}
                </button>
              ))}
            </div>
          </div>

          {/* Cover Image */}
          <div style={{borderTop:`1px solid ${color.bgBorder}`,paddingTop:14}}>
            <div style={{...S.sec,marginBottom:10}}>{t('modals.newRelic.coverImage')}</div>
            <CoverImagePicker coverImage={coverImage} onChange={setCoverImage} fallbackThumb={CATEGORY_THUMB_MAP[category]}/>
          </div>

          {/* Details */}
          <div style={{borderTop:`1px solid ${color.bgBorder}`,paddingTop:14}}>
            <div style={{...S.sec,marginBottom:10}}>{t('modals.newRelic.details')}</div>
            <label style={S.label}>{t('modals.newRelic.responsible')}</label>
            <input style={S.input} value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder={t('modals.newRelic.responsiblePlaceholder')} onFocus={S.focus} onBlur={S.blur}/>
          </div>

          <div>
            <label style={S.label}>{t('modals.newRelic.description')}</label>
            <textarea style={{...S.input,resize:'vertical',minHeight:70}} value={description} onChange={e=>setDesc(e.target.value)} rows={3} onFocus={S.focus} onBlur={S.blur}/>
            <DescriptionEnhancer title={title} description={description} onApply={setDesc}/>
          </div>

          <div>
            <label style={S.label}>{t('modals.newRelic.additionalNotes')}</label>
            <textarea style={{...S.input,resize:'vertical',minHeight:50}} value={notes} onChange={e=>setNotes(e.target.value)} rows={2} onFocus={S.focus} onBlur={S.blur}/>
          </div>

          {/* Tags */}
          <div style={{borderTop:`1px solid ${color.bgBorder}`,paddingTop:14}}>
            <div style={{...S.sec,marginBottom:10}}>{t('modals.newRelic.tags')}</div>
            <TagsInput tags={tags} onChange={setTags}/>
            <AITagSuggester title={title} description={description} category={category} currentTags={tags} onAdd={suggested=>setTags(prev=>[...new Set([...prev,...suggested])])}/>
          </div>

          {/* Linked file */}
          <div style={{borderTop:`1px solid ${color.bgBorder}`,paddingTop:14}}>
            <div style={{...S.sec,marginBottom:10}}>{t('modals.newRelic.linkedFile')}</div>
            <LinkedFilePicker
              linkedFile={linkedFile} onPick={handlePickFile} onClear={()=>{setLinkedFile(null);setSecureCopyFlag(false)}}
              secureCopy={secureCopyFlag} onSecureCopyChange={setSecureCopyFlag}
            />
          </div>

          {/* Attachments */}
          <div style={{borderTop:`1px solid ${color.bgBorder}`,paddingTop:14}}>
            <AttachmentList attachments={attachments} loading={attLoading} error={attError} onAddFiles={handleAddFiles} onDelete={handleDeleteAtt} onOpen={openAtt} onDownload={downloadAtt} getPreviewURL={getPreviewURL}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button onClick={onClose} style={{flex:1,padding:'9px 0',borderRadius:8,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textSecondary,fontSize:13,fontWeight:600,fontFamily:font.ui,cursor:'pointer'}}>{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={saving}
            style={{flex:2,padding:'9px 0',borderRadius:8,border:'none',background:saving?color.blue600:color.blue500,color:color.onPrimary,fontSize:13,fontWeight:600,fontFamily:font.ui,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'background 0.12s'}}
            onMouseEnter={e=>{if(!saving)e.currentTarget.style.background=color.blue600}}
            onMouseLeave={e=>{if(!saving)e.currentTarget.style.background=color.blue500}}>
            {saving&&<Spinner/>}{saving?t('common.saving'):t('modals.editRelic.saveChanges')}
          </button>
        </div>
      </Modal>
    </>
  )
}
