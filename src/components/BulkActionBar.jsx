// ─── BulkActionBar ────────────────────────────────────────────────
// Shown while selecting several relics. Acts on the selection; the
// Dashboard owns what's selected and what each action does.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Undo2, X, CheckSquare } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

export default function BulkActionBar({
  count, inTrash, projects, onSelectAll, onCancel,
  onMove, onAddTag, onTrash, onRestore, onDeleteForever,
}) {
  const { t } = useTranslation()
  const { color, radius, font } = useTheme()
  const [tag, setTag] = useState('')
  const none = count === 0

  const control = {
    padding:'6px 10px', borderRadius:radius.control, border:`1px solid ${color.bgBorder}`,
    background:alpha(color.bgBase, 0.35), color:color.textPrimary,
    fontSize:12, fontFamily:font.ui, outline:'none',
    opacity:none ? 0.5 : 1,
  }
  const button = {
    ...control, display:'flex', alignItems:'center', gap:5, fontWeight:600,
    cursor:none ? 'not-allowed' : 'pointer', background:'transparent',
  }

  function submitTag() {
    if (none || !tag.trim()) return
    onAddTag(tag)
    setTag('')
  }

  return (
    <div className="glass glass-neutral"
      style={{
        position:'sticky', bottom:14, zIndex:15, marginTop:16,
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'10px 14px', borderRadius:radius.glass,
      }}>
      <span style={{ fontSize:12, fontWeight:700, color:color.textPrimary, fontFamily:font.ui, marginRight:4 }}>
        {t('dashboard.bulk.count', { count })}
      </span>
      <button onClick={onSelectAll} style={{ ...button, opacity:1, cursor:'pointer' }}>
        <CheckSquare size={12}/> {t('dashboard.bulk.selectAll')}
      </button>

      <div style={{ flex:1 }}/>

      {inTrash ? (
        <>
          <button disabled={none} onClick={onRestore} style={button}>
            <Undo2 size={12}/> {t('relicDetails.restore')}
          </button>
          <button disabled={none} onClick={onDeleteForever} style={{ ...button, color:color.terracotta500 }}>
            <Trash2 size={12}/> {t('relicDetails.deleteForever')}
          </button>
        </>
      ) : (
        <>
          <select disabled={none} value="" aria-label={t('dashboard.bulk.moveTo')}
            onChange={e => onMove(e.target.value)}
            style={{ ...control, cursor:none ? 'not-allowed' : 'pointer' }}>
            <option value="" disabled>{t('dashboard.bulk.moveTo')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input disabled={none} value={tag} onChange={e => setTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitTag() }}
            placeholder={t('dashboard.bulk.addTag')} aria-label={t('dashboard.bulk.addTag')}
            style={{ ...control, width:130 }}/>
          <button disabled={none} onClick={onTrash} style={{ ...button, color:color.terracotta500 }}>
            <Trash2 size={12}/> {t('relicDetails.moveToTrash')}
          </button>
        </>
      )}

      <button onClick={onCancel} style={{ ...button, opacity:1, cursor:'pointer', color:color.textSecondary }}>
        <X size={12}/> {t('common.cancel')}
      </button>
    </div>
  )
}
