import { useEffect, useRef, useState } from 'react'
import { Settings, LogOut, Sliders } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }      from '../auth/AuthProvider.jsx'
import { useToast }     from './Toast.jsx'
import { useNavigate }  from 'react-router-dom'
import { useTheme }     from '../context/ThemeContext.jsx'

export default function UserMenu({ onOpenSettings, opensDown = false }) {
  const { t } = useTranslation()
  const { color, radius, font, spring } = useTheme()
  const [open, setOpen] = useState(false)
  const { signOut }     = useAuth()
  const { push }        = useToast()
  const navigate        = useNavigate()
  const ref             = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    push(t('userMenu.signedOutToast'), 'info')
    navigate('/login', { replace: true })
  }

  function handleSettings() {
    setOpen(false)
    onOpenSettings?.()
  }

  const ITEMS = [
    { icon: <Sliders size={13}/>, label: t('userMenu.settings'), action: handleSettings,     color: color.textPrimary },
    { divider: true },
    { icon: <LogOut size={13}/>,  label: t('userMenu.signOut'),  action: handleSignOut,      color: color.terracotta500 },
  ]

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{background:'none',border:'none',cursor:'pointer',color:open?color.textPrimary:color.textSecondary,padding:opensDown?10:2,display:'flex',alignItems:'center',transition:'color 0.15s'}}
        onMouseEnter={e=>e.currentTarget.style.color=color.textPrimary}
        onMouseLeave={e=>{if(!open)e.currentTarget.style.color=color.textSecondary}}
        aria-label={t('userMenu.menuLabel')}>
        <Settings size={14}/>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{opacity:0,y:opensDown?-4:4,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:opensDown?-4:4,scale:0.98}}
            transition={spring.tap}
            className="glass glass-neutral"
            style={{
              position:'absolute',right:0,
              ...(opensDown ? {top:'130%',transformOrigin:'top right'} : {bottom:'130%',transformOrigin:'bottom right'}),
              borderRadius:radius.card,
              padding:'4px 0',minWidth:160,zIndex:100,
            }}>
            {ITEMS.map((item,i) =>
              item.divider
                ? <div key={i} style={{height:1,background:color.bgBorder,margin:'4px 0'}}/>
                : (
                  <button key={i} onClick={item.action}
                    style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'8px 14px',background:'none',border:'none',cursor:'pointer',color:item.color,fontSize:13,fontFamily:font.ui,transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=color.hoverOverlay}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    {item.icon}{item.label}
                  </button>
                )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
