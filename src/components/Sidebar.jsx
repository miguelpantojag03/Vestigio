import { Image, Clock, Trash2, RotateCcw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import UserMenu from './UserMenu.jsx'
import ProjectSwitcher from './ProjectSwitcher.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import logo from '../assets/vestigio-logo.svg'

const NAV = [
  { id: 'gallery',  Icon: Image },
  { id: 'search',   Icon: Search },
  { id: 'recent',   Icon: Clock },
  { id: 'revived',  Icon: RotateCcw },
  { id: 'deleted',  Icon: Trash2 },
]

export default function Sidebar({
  user, activeSection, onSection, onOpenSettings,
  projects, currentProject, onSwitchProject, onAddProject, onRenameProject, onRemoveProject, confirm,
}) {
  const { t } = useTranslation()
  const { color, radius, font } = useTheme()
  return (
    <aside style={{
      width:200,flexShrink:0,display:'flex',flexDirection:'column',
      height:'100%',background:color.bgBase,borderRight:`1px solid ${color.bgBorder}`,
    }}>
      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'18px 16px 14px'}}>
        <img src={logo} alt="" width={30} height={30} style={{borderRadius:radius.control,flexShrink:0}}/>
        <span style={{fontWeight:700,fontSize:13,color:color.textPrimary,letterSpacing:'-0.02em'}}>Vestigio</span>
      </div>

      {/* Nav */}
      <nav style={{display:'flex',flexDirection:'column',gap:2,padding:'0 8px'}}>
        {NAV.map(({id,Icon})=>{
          const active = activeSection===id
          const label = t(`sidebar.nav.${id}`)
          const desc  = t(`sidebar.nav.${id}Desc`)
          return (
            <button key={id} onClick={()=>onSection(id)}
              title={desc}
              style={{
                display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderRadius:radius.control,border:'none',
                cursor:'pointer',
                background:active?alpha(color.blue500, 0.18):'transparent',
                color:active?color.blue300:color.textSecondary,
                fontSize:13,fontWeight:active?600:400,fontFamily:font.ui,textAlign:'left',width:'100%',
                transition:'background 0.12s,color 0.12s',
              }}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background=color.hoverOverlay;e.currentTarget.style.color=color.textPrimary}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color=color.textSecondary}}}>
              <Icon size={15} strokeWidth={active?2.5:1.8}/>
              {label}
            </button>
          )
        })}
      </nav>

      <div style={{flex:1}}/>

      {/* Project switcher */}
      {projects?.length > 0 && (
        <ProjectSwitcher
          projects={projects} currentProject={currentProject}
          onSwitchProject={onSwitchProject} onAddProject={onAddProject}
          onRenameProject={onRenameProject} onRemoveProject={onRemoveProject}
          confirm={confirm}
        />
      )}

      {/* User footer */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderTop:`1px solid ${color.bgBorder}`}}>
        <div style={{width:30,height:30,borderRadius:'50%',flexShrink:0,background:`linear-gradient(135deg,${color.blue500},${color.blue800})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'white'}}>
          {user?.avatarInitials||'??'}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,color:color.textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.fullName||t('sidebar.userFallback')}</div>
          <div style={{fontSize:10,color:color.textSecondary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
        </div>
        <UserMenu user={user} onOpenSettings={onOpenSettings}/>
      </div>
    </aside>
  )
}
