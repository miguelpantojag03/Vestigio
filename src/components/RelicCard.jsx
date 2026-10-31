import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { RotateCcw, PenLine, FileText, Palette, Tag, StickyNote, Paperclip, Link2, Layers, Check } from 'lucide-react'
import { getThumbnail } from './Thumbnails.jsx'
import { countAttachments } from '../lib/attachmentStorage.js'
import { countOpenDrafts } from '../lib/draftStorage.js'
import { getLinkStatus } from '../lib/fileLinks.js'
import { onRelicDataChanged } from '../lib/relicDataEvents.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { formatDate } from '../lib/formatDate.js'

function CategoryIcon({ cat }) {
  switch (cat) {
    case 'SKETCH':      return <PenLine size={9}/>
    case 'COPYWRITING': return <FileText size={9}/>
    case 'PALETTE':     return <Palette size={9}/>
    case 'BRANDING':    return <Tag size={9}/>
    case 'NOTES':       return <StickyNote size={9}/>
    default:            return <FileText size={9}/>
  }
}

export default function RelicCard({ relic, isSelected, onSelect, onCardDrag, onCardDragEnd, animIndex = 0, selectionMode = false }) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const [attCount, setAttCount] = useState(0)
  const [draftCount, setDraftCount] = useState(0)
  const [linkBroken, setLinkBroken] = useState(false)

  // Load badge counts asynchronously (lightweight, no blob transfer)
  useEffect(() => {
    if (!relic?.id) return
    function loadCounts() {
      countAttachments(relic.id).then(setAttCount).catch(() => {})
      countOpenDrafts(relic.id).then(setDraftCount).catch(() => {})
    }
    loadCounts()
    return onRelicDataChanged(relic.id, loadCounts)
  }, [relic?.id])

  const linkedFilePath = relic?.linkedFilePath
  const linkedFileMtime = relic?.linkedFileMtime
  useEffect(() => {
    if (!linkedFilePath) return
    let cancelled = false
    getLinkStatus({ linkedFilePath, linkedFileMtime }).then(s => { if (!cancelled) setLinkBroken(s === 'broken') }).catch(() => {})
    return () => { cancelled = true }
  }, [linkedFilePath, linkedFileMtime])

  return (
    <motion.div
      drag={!relic.deletedAt && !selectionMode}
      dragSnapToOrigin
      dragElastic={0.12}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: `0 24px 56px -14px ${alpha(color.blue500, 0.45)}` }}
      onDrag={(e, info) => onCardDrag?.(relic.id, info)}
      onDragEnd={(e, info) => onCardDragEnd?.(relic.id, info)}
      onClick={() => onSelect(relic.id)}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={relic.title}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(relic.id) }
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, transition: spring.tap }}
      transition={{ ...spring.tap, delay: animIndex * 0.025 }}
      style={{
        borderRadius:radius.card, padding:10, cursor:'pointer',
        background:color.bgElevated,
        border: isSelected ? `1.5px solid ${color.blue500}` : `1px solid ${color.bgBorder}`,
        boxShadow: isSelected ? `0 0 0 3px ${alpha(color.blue500, 0.18)},0 4px 24px ${alpha(color.blue500, 0.10)}` : 'none',
        opacity: isSelected ? 1 : 0.72,
        userSelect:'none',
      }}
      onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.opacity='1' }}
      onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.opacity='0.72' }}
    >
      {/* Thumbnail */}
      <div style={{height:100,borderRadius:radius.chip+2,overflow:'hidden',position:'relative',marginBottom:9}}>
        {getThumbnail(relic.thumbnail, relic.coverImage)}

        {/* Bulk selection checkbox */}
        {selectionMode && (
          <div aria-hidden style={{
            position:'absolute',bottom:5,left:5,width:18,height:18,borderRadius:radius.chipSm,
            display:'flex',alignItems:'center',justifyContent:'center',
            background:isSelected?color.blue500:'rgba(0,0,0,0.55)',
            border:`1.5px solid ${isSelected?color.blue500:'rgba(255,255,255,0.7)'}`,
          }}>
            {isSelected && <Check size={12} strokeWidth={3} style={{color:color.onPrimary}}/>}
          </div>
        )}

        {/* Attachment count badge */}
        {attCount > 0 && (
          <div style={{
            position:'absolute',top:5,right:5,
            display:'flex',alignItems:'center',gap:3,
            background:'rgba(0,0,0,0.7)',borderRadius:radius.pill,padding:'2px 6px',
            fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',fontFamily:font.mono,
          }}>
            <Paperclip size={8}/>{attCount}
          </div>
        )}

        {/* Open draft count badge — stacks below attachments if both present */}
        {draftCount > 0 && (
          <div title={t('relicCard.draftsCount', { count: draftCount })} style={{
            position:'absolute',top:attCount>0?26:5,right:5,
            display:'flex',alignItems:'center',gap:3,
            background:'rgba(0,0,0,0.7)',borderRadius:radius.pill,padding:'2px 6px',
            fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',fontFamily:font.mono,
          }}>
            <Layers size={8}/>{draftCount}
          </div>
        )}

        {/* Linked external file badge — only when broken, it's the one state worth a glance */}
        {relic.linkedFilePath && linkBroken && (
          <div title={t('relicCard.linkBroken')} style={{
            position:'absolute',top:5,left:5,
            display:'flex',alignItems:'center',justifyContent:'center',
            background:alpha(color.terracotta500, 0.9),borderRadius:radius.pill,padding:4,
          }}>
            <Link2 size={9} style={{color:'white'}}/>
          </div>
        )}

        {/* Revived overlay */}
        {relic.revived && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:alpha(color.blue500, 0.18)}}>
            <div style={{background:color.blue500,borderRadius:radius.chip,padding:'2px 8px',fontSize:9,fontWeight:600,color:color.onPrimary,display:'flex',alignItems:'center',gap:4,fontFamily:font.mono}}>
              <RotateCcw size={8}/> {t('relicCard.revived')}
            </div>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
        <div style={{display:'flex',alignItems:'center',gap:4,background:alpha(color.blue500, 0.12),borderRadius:radius.chipSm,padding:'2px 6px',fontSize:9,fontWeight:500,color:color.blue300,fontFamily:font.mono,textTransform:'lowercase'}}>
          <CategoryIcon cat={relic.category}/>{t(`relicCard.category.${relic.category}`, relic.category)}
        </div>
        <span style={{fontSize:9,color:color.textSecondary,fontFamily:font.mono}}>{formatDate(relic.createdAt)}</span>
      </div>

      {/* Title */}
      <div style={{fontSize:12,fontStyle:'italic',fontWeight:500,fontFamily:font.display,color:color.textPrimary,marginBottom:4,lineHeight:1.4}}>
        "{relic.title}"
      </div>

      {/* Description */}
      <p style={{fontSize:10,color:color.textSecondary,fontFamily:font.ui,lineHeight:1.55,margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
        {relic.description}
      </p>

      {/* Tags */}
      {relic.tags?.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:5}}>
          {relic.tags.slice(0,3).map(tag=>(
            <span key={tag} style={{fontSize:8,fontWeight:500,color:color.blue300,background:alpha(color.blue500, 0.1),borderRadius:radius.pill,padding:'1px 6px',fontFamily:font.mono}}>{tag}</span>
          ))}
          {relic.tags.length > 3 && <span style={{fontSize:8,color:color.textSecondary,padding:'1px 0',fontFamily:font.mono}}>+{relic.tags.length-3}</span>}
        </div>
      )}
    </motion.div>
  )
}
