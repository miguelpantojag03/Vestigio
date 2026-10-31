// ─── AttachmentItem ───────────────────────────────────────────────
// Single row in the attachment list.
// Shows icon · name · size · date · actions (preview / download / delete).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText, Image, FileSpreadsheet, FileType2,
  Archive, Download, Trash2, Eye, ExternalLink,
} from 'lucide-react'
import { formatFileSize, isImage, isPDF, isText } from '../constants/fileTypes.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { formatDate } from '../lib/formatDate.js'
import { isAndroid } from '../lib/platform.js'

// ── File type icon ─────────────────────────────────────────────────
function FileIcon({ ext, size = 18 }) {
  const { color } = useTheme()
  const e = ext?.toLowerCase()
  if (['jpg','jpeg','png','webp','gif','svg'].includes(e))
    return <Image size={size} style={{ color: color.blue300 }} />
  if (e === 'pdf')
    return <FileType2 size={size} style={{ color: color.terracotta500 }} />
  if (['xls','xlsx','csv'].includes(e))
    return <FileSpreadsheet size={size} style={{ color: color.sage500 }} />
  if (['doc','docx','txt','md'].includes(e))
    return <FileText size={size} style={{ color: color.lavender500 }} />
  if (e === 'zip')
    return <Archive size={size} style={{ color: '#FEBC2E' }} />
  return <FileText size={size} style={{ color: color.textSecondary }} />
}

export default function AttachmentItem({
  attachment,
  onPreview,
  onOpen,
  onDownload,
  onDelete,
}) {
  const { t } = useTranslation()
  const { color, radius } = useTheme()
  const [hovered, setHovered] = useState(false)
  const { originalName, extension, size, createdAt } = attachment

  // Android's WebView can't show PDFs, and app-private files can't be opened by
  // other apps there: "Save as" is the way out for everything else.
  const canPreview = isImage(extension) || (isPDF(extension) && !isAndroid) || isText(extension)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '8px 10px',
        borderRadius:   radius.controlXs,
        background:     hovered ? color.hoverOverlay : 'transparent',
        transition:     'background 0.12s',
        cursor:         'default',
      }}
    >
      {/* Icon */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   7,
        background:     color.bgElevated,
        border:         `1px solid ${color.bgBorder}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        <FileIcon ext={extension} size={15} />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:     12,
          fontWeight:   600,
          color:        color.textPrimary,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {originalName}
        </div>
        <div style={{ fontSize: 10, color: color.textSecondary, marginTop: 2 }}>
          {formatFileSize(size)} · {formatDate(createdAt)}
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div style={{
        display:    'flex',
        gap:        4,
        opacity:    hovered ? 1 : 0.6, // never fully hidden: keyboard users and first-timers need to find them
        transition: 'opacity 0.15s',
      }}>
        {/* Preview */}
        {canPreview && (
          <ActionBtn
            icon={<Eye size={13} />}
            title={t('attachments.preview')}
            onClick={() => onPreview(attachment)}
            color={color.blue300}
          />
        )}
        {/* Open externally (non-previewable) */}
        {!canPreview && !isAndroid && (
          <ActionBtn
            icon={<ExternalLink size={13} />}
            title={t('attachments.openWith')}
            onClick={() => onOpen(attachment)}
            color={color.textSecondary}
          />
        )}
        {/* Download */}
        <ActionBtn
          icon={<Download size={13} />}
          title={t('attachments.save')}
          onClick={() => onDownload(attachment)}
          color={color.textSecondary}
        />
        {/* Delete */}
        <ActionBtn
          icon={<Trash2 size={13} />}
          title={t('attachments.delete')}
          onClick={() => onDelete(attachment)}
          color={color.terracotta500}
          danger
        />
      </div>
    </div>
  )
}

function ActionBtn({ icon, title, onClick, color, danger = false }) {
  const { color: theme } = useTheme()
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:          26,
        height:         26,
        borderRadius:   6,
        border:         'none',
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     hov
          ? (danger ? alpha(theme.terracotta500, 0.15) : theme.hoverOverlay)
          : 'transparent',
        color:          hov ? color : theme.textSecondary,
        transition:     'background 0.12s, color 0.12s',
      }}
    >
      {icon}
    </button>
  )
}
