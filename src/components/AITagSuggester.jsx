// ─── AITagSuggester ───────────────────────────────────────────────
// Inline button that calls AI to suggest tags for a relic.
// Used inside NewRelicModal and EditRelicModal.

import { useState }  from 'react'
import { Sparkles }  from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAI }     from '../hooks/useAI.js'
import { useTheme }  from '../context/ThemeContext.jsx'
import { alpha }     from '../styles/tokens.js'

export default function AITagSuggester({ title, description, category, currentTags, onAdd }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const { loading, error, suggestTags } = useAI()
  const [suggestions, setSuggestions]   = useState([])
  const [shown, setShown]               = useState(false)

  async function handleSuggest() {
    if (!title.trim()) return
    setShown(true)
    const result = await suggestTags(title, description, category)
    if (result?.tags) {
      // Filter out tags the relic already has
      const fresh = result.tags.filter(tag => !currentTags.includes(tag))
      setSuggestions(fresh)
    }
  }

  function addTag(tag) {
    onAdd([tag])
    setSuggestions(prev => prev.filter(x => x !== tag))
  }

  return (
    <div style={{ marginTop: 6 }}>
      {/* Suggest button */}
      <button type="button" onClick={handleSuggest} disabled={loading || !title.trim()}
        style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'5px 10px', borderRadius:7, border:`1px solid ${alpha(color.blue500, 0.35)}`,
          background:alpha(color.blue500, 0.06), color:color.blue300,
          fontSize:11, fontWeight:600, fontFamily:'inherit',
          cursor: loading||!title.trim() ? 'not-allowed' : 'pointer',
          opacity: !title.trim() ? 0.5 : 1,
          transition:'background 0.12s,border-color 0.12s',
        }}
        onMouseEnter={e=>{if(!loading&&title.trim()){e.currentTarget.style.background=alpha(color.blue500, 0.14);e.currentTarget.style.borderColor=color.blue300}}}
        onMouseLeave={e=>{e.currentTarget.style.background=alpha(color.blue500, 0.06);e.currentTarget.style.borderColor=alpha(color.blue500, 0.35)}}>
        <Sparkles size={12} style={{ animation: loading ? 'am-spin 0.8s linear infinite' : 'none' }}/>
        {loading ? t('ai.suggesting') : t('ai.suggestTags')}
      </button>

      {/* Suggested tags */}
      {shown && suggestions.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:7 }}>
          {suggestions.map(tag => (
            <button key={tag} type="button" onClick={() => addTag(tag)}
              style={{
                fontSize:10, fontWeight:700, letterSpacing:'0.06em',
                color:color.blue300, background:alpha(color.blue500, 0.1),
                border:`1px dashed ${alpha(color.blue500, 0.4)}`,
                borderRadius:99, padding:'3px 9px', cursor:'pointer',
                fontFamily:'inherit', transition:'background 0.12s',
              }}
              onMouseEnter={e=>e.currentTarget.style.background=alpha(color.blue500, 0.22)}
              onMouseLeave={e=>e.currentTarget.style.background=alpha(color.blue500, 0.1)}
              title={t('ai.clickToAdd')}>
              + {tag}
            </button>
          ))}
        </div>
      )}

      {shown && suggestions.length === 0 && !loading && !error && (
        <span style={{ fontSize:10, color:color.textSecondary, marginTop:5, display:'block' }}>
          {t('ai.allAdded')}
        </span>
      )}

      {error && (
        <span style={{ fontSize:10, color:color.terracotta500, marginTop:5, display:'block' }}>{error}</span>
      )}

      <style>{`@keyframes am-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
