// ─── DeathCausePicker ─────────────────────────────────────────────
// Optional "why did this idea die?" field, shared by the new/edit modals.

import { useTranslation } from 'react-i18next'
import { DEATH_CAUSES } from '../constants/deathCauses.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

export default function DeathCausePicker({ cause, detail, onCauseChange, onDetailChange }) {
  const { t } = useTranslation()
  const { color, radius, font } = useTheme()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {DEATH_CAUSES.map(c => (
          // Clicking the selected chip clears it: the field is optional.
          <button key={c} type="button" aria-pressed={cause === c} onClick={() => onCauseChange(cause === c ? null : c)}
            style={{
              padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer',
              background: cause === c ? color.blue500 : alpha(color.blue500, 0.1),
              color: cause === c ? color.onPrimary : color.blue300,
              fontSize:11, fontWeight:600, fontFamily:font.ui,
            }}>
            {t(`deathCause.${c}`)}
          </button>
        ))}
      </div>
      <input
        value={detail}
        onChange={e => onDetailChange(e.target.value)}
        placeholder={t('deathCause.detailPlaceholder')}
        style={{
          width:'100%', padding:'8px 10px', borderRadius:radius.controlSm,
          background:color.bgBase, border:`1px solid ${color.bgBorder}`,
          color:color.textPrimary, fontSize:13, fontFamily:font.ui, outline:'none',
        }}
        onFocus={e => { e.target.style.borderColor = color.blue500; e.target.style.boxShadow = `0 0 0 3px ${alpha(color.blue500, 0.12)}` }}
        onBlur={e => { e.target.style.borderColor = color.bgBorder; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}
