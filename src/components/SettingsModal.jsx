// ─── SettingsModal ────────────────────────────────────────────────
// User settings: language, theme, backup, export.

import { useState }     from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Archive, Upload } from 'lucide-react'
import Modal             from './Modal.jsx'
import { getRelics }     from '../lib/relicStorage.js'
import { exportBackup, importBackup } from '../lib/backup.js'
import { useToast }      from './Toast.jsx'
import { useConfirm }    from './ConfirmModal.jsx'
import { useTheme }      from '../context/ThemeContext.jsx'
import { ThemeControl, LanguageControl } from './ThemeLanguageControls.jsx'

function PreferenceRow({ label, children }) {
  const { color, font } = useTheme()
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <span style={{ fontSize:13, fontWeight:600, color:color.textPrimary, fontFamily:font.ui }}>{label}</span>
      {children}
    </div>
  )
}

function ExportSection({ userId }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const { push } = useToast()

  async function exportJSON() {
    const relics = (await getRelics(userId)).filter(r => !r.deletedAt)
    const blob = new Blob([JSON.stringify(relics, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `vestigio-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    push(t('modals.settings.exportedJSON'), 'success')
  }

  async function exportCSV() {
    const relics  = (await getRelics(userId)).filter(r => !r.deletedAt)
    const headers = ['id','title','category','description','project','status','deathCause','deathCauseDetail','createdAt','discardedAt','tags','responsible']
    const rows    = relics.map(r =>
      headers.map(h => {
        const v = h === 'tags' ? (r.tags||[]).join(';') : (r[h]??'')
        return `"${String(v).replace(/"/g,'""')}"`
      }).join(',')
    )
    // The BOM is what makes Excel read this as UTF-8 instead of garbling accents.
    const csv  = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `vestigio-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    push(t('modals.settings.exportedCSV'), 'success')
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:color.textSecondary,textTransform:'uppercase',marginBottom:4}}>
        {t('modals.settings.exportArchive')}
      </div>
      <div style={{display:'flex',gap:8}}>
        <ExportBtn label={t('modals.settings.exportJSON')} icon={<Download size={13}/>} onClick={exportJSON}/>
        <ExportBtn label={t('modals.settings.exportCSV')}  icon={<Download size={13}/>} onClick={exportCSV}/>
      </div>
    </div>
  )
}

function ExportBtn({ label, icon, onClick, disabled }) {
  const { color, radius, font } = useTheme()
  return (
    <button onClick={onClick} disabled={disabled}
      style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:radius.control,border:`1px solid ${color.bgBorder}`,background:'transparent',color:color.textPrimary,fontSize:12,fontWeight:500,fontFamily:font.ui,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.6:1,transition:'border-color 0.12s,color 0.12s'}}
      onMouseEnter={e=>{if(disabled)return;e.currentTarget.style.borderColor=color.blue500;e.currentTarget.style.color=color.blue300}}
      onMouseLeave={e=>{if(disabled)return;e.currentTarget.style.borderColor=color.bgBorder;e.currentTarget.style.color=color.textPrimary}}>
      {icon}{label}
    </button>
  )
}

function BackupSection() {
  const { t }      = useTranslation()
  const { color }  = useTheme()
  const { push }   = useToast()
  const { confirm, ConfirmModalUI } = useConfirm()
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const path = await exportBackup()
      if (path) push(t('modals.settings.backupExported'), 'success')
    } catch {
      push(t('modals.settings.backupExportError'), 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleRestore() {
    const ok = await confirm({
      title: t('modals.settings.backupRestoreConfirmTitle'),
      message: t('modals.settings.backupRestoreConfirmMessage'),
      confirmLabel: t('modals.settings.backupRestoreConfirmAction'),
      danger: true,
    })
    if (!ok) return
    setRestoring(true)
    try {
      await importBackup() // relaunches the app on success; no further UI update needed
    } catch (err) {
      // Rust commands reject with the raw String error, not an Error instance.
      push(err === 'invalid_backup' ? t('modals.settings.backupRestoreInvalid') : t('modals.settings.backupRestoreError'), 'error')
      setRestoring(false)
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:color.textSecondary,textTransform:'uppercase',marginBottom:4}}>
        {t('modals.settings.backupTitle')}
      </div>
      <p style={{fontSize:11,color:color.textSecondary,lineHeight:1.6,margin:0}}>
        {t('modals.settings.backupDescription')}
      </p>
      <div style={{display:'flex',gap:8}}>
        <ExportBtn
          label={exporting ? t('modals.settings.backupExporting') : t('modals.settings.backupExport')}
          icon={<Archive size={13}/>}
          onClick={handleExport}
          disabled={exporting || restoring}
        />
        <ExportBtn
          label={restoring ? t('modals.settings.backupRestoring') : t('modals.settings.backupRestore')}
          icon={<Upload size={13}/>}
          onClick={handleRestore}
          disabled={exporting || restoring}
        />
      </div>
      <ConfirmModalUI/>
    </div>
  )
}

export default function SettingsModal({ userId, onClose }) {
  const { t }       = useTranslation()
  const { color }   = useTheme()

  return (
    <Modal title={t('modals.settings.title')} onClose={onClose}>
      <div style={{display:'flex',flexDirection:'column',gap:20,maxHeight:'72vh',overflowY:'auto',paddingRight:2}}>

        {/* Language + Theme */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <PreferenceRow label={t('modals.settings.language')}><LanguageControl/></PreferenceRow>
          <PreferenceRow label={t('modals.settings.theme')}><ThemeControl/></PreferenceRow>
        </div>

        <div style={{height:1,background:color.bgBorder}}/>

        {/* Backup */}
        <BackupSection/>

        <div style={{height:1,background:color.bgBorder}}/>

        {/* Export */}
        <ExportSection userId={userId}/>

        <div style={{height:1,background:color.bgBorder}}/>

        {/* Privacy */}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:color.textSecondary,textTransform:'uppercase',marginBottom:4}}>
            {t('modals.settings.privacyTitle')}
          </div>
          {['privacyLocal', 'privacyAI', 'privacyGoogle'].map(key => (
            <p key={key} style={{fontSize:11,color:color.textSecondary,lineHeight:1.6,margin:0}}>{t(`modals.settings.${key}`)}</p>
          ))}
        </div>
      </div>
    </Modal>
  )
}
