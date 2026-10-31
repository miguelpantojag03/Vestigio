// ─── AIInsightsPanel ──────────────────────────────────────────────
// Shows AI-generated insights about the user's entire archive.
// Collapsed by default; expands on demand to avoid unnecessary API calls.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, ChevronDown, ChevronUp, Lightbulb, TrendingUp, Star } from 'lucide-react'
import { useAI }     from '../hooks/useAI.js'
import { hasAIProxy } from '../lib/aiConfig.js'
import { useTheme }  from '../context/ThemeContext.jsx'
import { alpha }     from '../styles/tokens.js'

export default function AIInsightsPanel({ relics, onHighlight }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const { loading, error, archiveInsights } = useAI()
  const [insights,  setInsights]  = useState(null)
  const [expanded,  setExpanded]  = useState(false)

  if (relics.length < 3) return null  // not enough data to be meaningful

  async function handleGenerate() {
    setExpanded(true)
    const result = await archiveInsights(relics)
    if (result) setInsights(result)
  }

  return (
    <div style={{
      borderRadius:12,border:`1px solid ${alpha(color.blue500, 0.25)}`,
      background:alpha(color.blue500, 0.05),overflow:'hidden',
      transition:'all 0.2s',
    }}>
      {/* header button */}
      <button
        onClick={insights ? ()=>setExpanded(e=>!e) : handleGenerate}
        disabled={loading}
        style={{
          width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'12px 16px',background:'none',border:'none',cursor:loading?'wait':'pointer',
          fontFamily:'inherit',
        }}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:alpha(color.blue500, 0.2),display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Sparkles size={14} className={loading?'am-spin':undefined} style={{color:color.blue300}}/>
          </div>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:13,fontWeight:700,color:color.textPrimary}}>
              {loading ? t('ai.analyzingArchive') : t('ai.archiveIntelligence')}
            </div>
            <div style={{fontSize:10,color:color.textSecondary,marginTop:1}}>
              {hasAIProxy() ? t('ai.poweredByAI') : t('ai.mockMode')} · {t('ai.relicsCount', { count: relics.length })}
            </div>
          </div>
        </div>
        {insights && (expanded ? <ChevronUp size={15} style={{color:color.textSecondary}}/> : <ChevronDown size={15} style={{color:color.textSecondary}}/>)}
        {!insights && !loading && (
          <span style={{fontSize:11,fontWeight:600,color:color.blue300,background:alpha(color.blue500, 0.15),borderRadius:99,padding:'3px 10px'}}>
            {t('ai.generate')}
          </span>
        )}
      </button>

      {/* expanded content */}
      {expanded && insights && (
        <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{height:1,background:alpha(color.blue500, 0.2),marginBottom:2}}/>

          {/* overview */}
          <p style={{fontSize:12,color:color.textPrimary,lineHeight:1.65,margin:0}}>{insights.overview}</p>

          {/* patterns */}
          {insights.patterns?.length > 0 && (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:7}}>
                <TrendingUp size={12} style={{color:color.blue300}}/>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:color.blue300}}>{t('ai.patterns').toUpperCase()}</span>
              </div>
              {insights.patterns.map((p,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:5}}>
                  <span style={{color:color.blue500,flexShrink:0,marginTop:1}}>·</span>
                  <span style={{fontSize:11,color:color.textSecondary,lineHeight:1.55}}>{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* revival candidates */}
          {insights.topRevivalCandidates?.length > 0 && (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:7}}>
                <Star size={12} style={{color:'#FEBC2E'}}/>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:'#FEBC2E'}}>{t('ai.topCandidates').toUpperCase()}</span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {insights.topRevivalCandidates.map(id=>{
                  const relic = relics.find(r=>r.id===id)
                  if(!relic) return null
                  return (
                    <button key={id} onClick={()=>onHighlight?.(id)}
                      style={{fontSize:10,fontWeight:600,color:'#E8C060',background:'rgba(254,188,46,0.1)',border:'1px solid rgba(254,188,46,0.25)',borderRadius:99,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit',transition:'background 0.12s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(254,188,46,0.2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(254,188,46,0.1)'}>
                      {relic.title.slice(0,28)}{relic.title.length>28?'…':''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* tip */}
          {insights.tip && (
            <div style={{padding:'9px 12px',borderRadius:8,background:alpha(color.blue500, 0.08),border:`1px solid ${alpha(color.blue500, 0.2)}`,display:'flex',gap:8}}>
              <Lightbulb size={13} style={{color:color.blue300,flexShrink:0,marginTop:1}}/>
              <span style={{fontSize:11,color:color.textPrimary,lineHeight:1.6}}>{insights.tip}</span>
            </div>
          )}

          {/* regenerate */}
          <button onClick={handleGenerate} disabled={loading}
            style={{fontSize:10,color:color.textSecondary,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0,fontFamily:'inherit'}}
            onMouseEnter={e=>e.currentTarget.style.color=color.blue300}
            onMouseLeave={e=>e.currentTarget.style.color=color.textSecondary}>
            {loading ? t('ai.regenerating') : `↻ ${t('ai.regenerate')}`}
          </button>
        </div>
      )}

      {error && expanded && (
        <div style={{padding:'0 16px 12px',fontSize:11,color:color.terracotta500}}>{error}</div>
      )}

    </div>
  )
}
