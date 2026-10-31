import { Search, Plus, ChevronDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { ThemeControl, LanguageControl } from './ThemeLanguageControls.jsx'
import { CATEGORIES } from '../constants/categories.js'
import { DEATH_CAUSES } from '../constants/deathCauses.js'

const FILTERS  = ['all', 'visuals', 'drafts']
const SORT_OPT = ['date', 'title', 'category', 'status']

function SelectControl({ value, onChange, children }) {
  const { color, radius, font } = useTheme()
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        padding:'7px 10px',borderRadius:radius.control,border:`1px solid ${color.bgBorder}`,
        background:alpha(color.bgBase, 0.35),color:color.textPrimary,
        fontSize:12,fontFamily:font.ui,cursor:'pointer',outline:'none',flexShrink:0,
      }}>
      {children}
    </select>
  )
}

function DateInput({ value, onChange, title }) {
  const { color, radius, font } = useTheme()
  return (
    <input type="date" value={value} title={title} onChange={e => onChange(e.target.value)}
      style={{
        padding:'6px 8px',borderRadius:radius.control,border:`1px solid ${color.bgBorder}`,
        background:alpha(color.bgBase, 0.35),color:color.textPrimary,
        fontSize:12,fontFamily:font.ui,outline:'none',flexShrink:0,colorScheme:'auto',
      }}/>
  )
}

// Global search filter row — category / status / cause / date range. Separate from
// the gallery-only visuals/drafts tabs: this searches across every status.
function SearchFilters({
  searchCategory, setSearchCategory, searchStatus, setSearchStatus,
  searchCause, setSearchCause,
  searchDateFrom, setSearchDateFrom, searchDateTo, setSearchDateTo,
}) {
  const { t } = useTranslation()
  const { color, font } = useTheme()
  const active = searchCategory !== 'all' || searchStatus !== 'all' || searchCause !== 'all' || searchDateFrom || searchDateTo

  function clear() {
    setSearchCategory('all'); setSearchStatus('all'); setSearchCause('all'); setSearchDateFrom(''); setSearchDateTo('')
  }

  return (
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <SelectControl value={searchCategory} onChange={setSearchCategory}>
        <option value="all">{t('topbar.searchFilters.allCategories')}</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{t(`relicCard.category.${c}`)}</option>)}
      </SelectControl>
      <SelectControl value={searchStatus} onChange={setSearchStatus}>
        <option value="all">{t('topbar.searchFilters.allStatuses')}</option>
        <option value="archived">{t('topbar.searchFilters.archived')}</option>
        <option value="revived">{t('topbar.searchFilters.revived')}</option>
      </SelectControl>
      <SelectControl value={searchCause} onChange={setSearchCause}>
        <option value="all">{t('topbar.searchFilters.allCauses')}</option>
        {DEATH_CAUSES.map(c => <option key={c} value={c}>{t(`deathCause.${c}`)}</option>)}
      </SelectControl>
      <DateInput value={searchDateFrom} onChange={setSearchDateFrom} title={t('topbar.searchFilters.dateFrom')}/>
      <span style={{color:color.textTertiary,fontSize:12,fontFamily:font.ui}}>–</span>
      <DateInput value={searchDateTo} onChange={setSearchDateTo} title={t('topbar.searchFilters.dateTo')}/>
      {active && (
        <button onClick={clear} title={t('topbar.searchFilters.clear')}
          style={{display:'flex',alignItems:'center',gap:4,padding:'6px 10px',borderRadius:8,border:'none',background:'none',cursor:'pointer',color:color.textSecondary,fontSize:12,fontFamily:font.ui}}>
          <X size={12}/>{t('topbar.searchFilters.clear')}
        </button>
      )}
    </div>
  )
}

export default function TopBar({
  search, setSearch, filter, setFilter, onNewRelic, sortField, sortDir, cycleSort, section,
  searchCategory, setSearchCategory, searchStatus, setSearchStatus,
  searchCause, setSearchCause,
  searchDateFrom, setSearchDateFrom, searchDateTo, setSearchDateTo,
}) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const [sortOpen, setSortOpen] = useState(false)
  const [focused,  setFocused]  = useState(false)
  const sortRef                 = useRef(null)
  const isSearch = section === 'search'

  useEffect(() => {
    function h(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const currentLabel = t(`topbar.sort.${sortField}`) || t('topbar.sort.date')

  return (
    <div
      className="glass glass-blue"
      style={{
        display:'flex',alignItems:'center',gap:10,padding:'10px 18px',
        borderRadius:radius.glass,
        position:'sticky',top:14,zIndex:20,
        margin:'0 20px 18px',flexWrap:'wrap',
      }}>
      {/* Search */}
      <div style={{flex:1,minWidth:180,position:'relative'}}>
        <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:color.textSecondary,pointerEvents:'none'}}/>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={isSearch ? t('topbar.globalSearchPlaceholder') : t('topbar.searchPlaceholder')}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          style={{
            width:'100%',padding:'8px 12px 8px 32px',borderRadius:radius.control,
            background:alpha(color.bgBase, 0.4),border:`1px solid ${focused?color.blue500:color.bgBorder}`,
            boxShadow:focused?`0 0 0 3px ${alpha(color.blue500, 0.18)}`:'none',
            color:color.textPrimary,fontSize:13,fontFamily:font.ui,outline:'none',
            transition:'border-color 0.2s,box-shadow 0.2s',
          }}/>
      </div>

      {/* Filter tabs (gallery) or global search filters */}
      {isSearch ? (
        <SearchFilters
          searchCategory={searchCategory} setSearchCategory={setSearchCategory}
          searchStatus={searchStatus} setSearchStatus={setSearchStatus}
          searchCause={searchCause} setSearchCause={setSearchCause}
          searchDateFrom={searchDateFrom} setSearchDateFrom={setSearchDateFrom}
          searchDateTo={searchDateTo} setSearchDateTo={setSearchDateTo}
        />
      ) : (
        <div style={{display:'flex',borderRadius:radius.control,padding:3,background:alpha(color.bgBase, 0.35),flexShrink:0}}>
          {FILTERS.map(f=>{
            const active = filter===f
            return (
              <motion.button key={f} whileTap={{scale:0.97}} onClick={()=>setFilter(f)}
                style={{
                  padding:'5px 12px',borderRadius:radius.chip,border:'none',cursor:'pointer',
                  background:active?color.blue500:'transparent',
                  color:active?color.onPrimary:color.textSecondary,
                  fontSize:12,fontWeight:600,fontFamily:font.ui,transition:'background 0.15s,color 0.15s',
                }}>
                {t(`topbar.filters.${f}`)}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Sort dropdown */}
      <div ref={sortRef} style={{position:'relative',flexShrink:0}}>
        <motion.button whileTap={{scale:0.97}} onClick={()=>setSortOpen(o=>!o)}
          style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:radius.control,
            border:`1px solid ${sortOpen?color.blue500:color.bgBorder}`,
            background:alpha(color.bgBase, 0.35),color:color.textPrimary,
            fontSize:12,fontWeight:500,fontFamily:font.ui,cursor:'pointer',transition:'border-color 0.15s',
          }}>
          {sortDir==='asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>}
          {currentLabel}
          <motion.span animate={{rotate:sortOpen?180:0}} transition={spring.tap} style={{display:'flex'}}>
            <ChevronDown size={11}/>
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {sortOpen && (
            <motion.div
              initial={{opacity:0,y:-6,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6,scale:0.98}}
              transition={spring.tap}
              className="glass glass-neutral"
              style={{position:'absolute',top:'calc(100% + 8px)',right:0,borderRadius:radius.card,padding:'4px 0',minWidth:168,zIndex:50,transformOrigin:'top right'}}>
              {SORT_OPT.map(field=>{
                const current = sortField===field
                return (
                  <button key={field}
                    onClick={()=>{cycleSort(field);setSortOpen(false)}}
                    style={{
                      display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',
                      padding:'8px 14px',background:'none',border:'none',cursor:'pointer',
                      color:current?color.blue500:color.textPrimary,fontSize:12,fontFamily:font.ui,
                      transition:'background 0.1s',
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background=color.hoverOverlay}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    {t(`topbar.sort.${field}`)}
                    {current && (sortDir==='asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Theme + language quick access */}
      <ThemeControl/>
      <LanguageControl/>

      {/* New Relic */}
      <motion.button whileTap={{scale:0.97}} onClick={onNewRelic}
        style={{
          display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:radius.control,
          border:'none',cursor:'pointer',background:color.blue500,color:color.onPrimary,
          fontSize:13,fontWeight:700,fontFamily:font.ui,flexShrink:0,
        }}>
        <Plus size={14} strokeWidth={2.5}/> {t('topbar.newRelic')}
      </motion.button>
    </div>
  )
}
