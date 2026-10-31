// ─── MobileNav ────────────────────────────────────────────────────
// The sidebar's contents, rearranged for a phone: project and account up top,
// sections in reach of a thumb at the bottom.

import { useTranslation } from 'react-i18next'
import UserMenu from './UserMenu.jsx'
import ProjectSwitcher from './ProjectSwitcher.jsx'
import { NAV } from './Sidebar.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export function MobileHeader({
  user, onOpenSettings, projects, currentProject,
  onSwitchProject, onAddProject, onRenameProject, onRemoveProject, confirm,
}) {
  const { color } = useTheme()
  return (
    <header style={{
      display:'flex', alignItems:'center', gap:10, flexShrink:0,
      padding:'calc(8px + env(safe-area-inset-top)) 12px 8px',
      background:color.bgBase, borderBottom:`1px solid ${color.bgBorder}`,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        {projects?.length > 0 && (
          <ProjectSwitcher
            compact
            projects={projects} currentProject={currentProject}
            onSwitchProject={onSwitchProject} onAddProject={onAddProject}
            onRenameProject={onRenameProject} onRemoveProject={onRemoveProject}
            confirm={confirm}
          />
        )}
      </div>
      <UserMenu user={user} onOpenSettings={onOpenSettings} opensDown/>
    </header>
  )
}

export function BottomNav({ activeSection, onSection }) {
  const { t } = useTranslation()
  const { color, font } = useTheme()
  return (
    <nav style={{
      display:'flex', flexShrink:0,
      padding:'4px 4px calc(4px + env(safe-area-inset-bottom))',
      background:color.bgBase, borderTop:`1px solid ${color.bgBorder}`,
    }}>
      {NAV.map(({ id, Icon }) => {
        const active = activeSection === id
        return (
          <button key={id} onClick={() => onSection(id)} aria-current={active ? 'page' : undefined}
            style={{
              flex:1, minWidth:0, minHeight:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              background:'none', border:'none', cursor:'pointer', padding:'4px 2px',
              color: active ? color.blue300 : color.textSecondary,
              fontSize:10, fontWeight: active ? 700 : 500, fontFamily:font.ui,
            }}>
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8}/>
            <span style={{ maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {t(`sidebar.mobileNav.${id}`)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
