// ─── ImagePreviewModal ────────────────────────────────────────────
// In-app preview for images, plain text and PDFs.
// • Images  → <img> centered, zoom + rotate controls
// • PDFs    → <iframe> full panel
// • Text    → <pre> scrollable
// • Others  → should not reach here (AttachmentItem guards)

import { useEffect, useRef, useState } from 'react'
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isImage, isPDF, isText } from '../constants/fileTypes.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

export default function ImagePreviewModal({ attachment, url, onClose, onDownload }) {
  const { t } = useTranslation()
  const { color } = useTheme()
  const { originalName, extension } = attachment
  const [textContent, setTextContent] = useState(null)
  const [zoom,        setZoom]        = useState(1)
  const [rotation,    setRotation]    = useState(0)
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef)

  // Load text content for txt/md/csv
  useEffect(() => {
    if (!isText(extension)) return
    fetch(url)
      .then(r => r.text())
      .then(setTextContent)
      .catch(() => setTextContent(t('modals.imagePreview.couldNotRead')))
  }, [url, extension, t])

  // Close on Escape
  useEffect(() => {
    // Capture phase: Escape answers the preview, not a modal it opened from
    const handler = e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const img = isImage(extension)
  const pdf = isPDF(extension)
  const txt = isText(extension)

  const TB_BTN = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: color.textPrimary, padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.12s, color 0.12s',
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={originalName}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'am-fade 0.15s ease',
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        width: '100%', maxWidth: 920,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: color.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '60%' }}>
          {originalName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Zoom controls — images only */}
          {img && (<>
            <button style={TB_BTN} title={t('modals.imagePreview.zoomOut')}
              onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}>
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: 11, color: color.textSecondary, minWidth: 38, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button style={TB_BTN} title={t('modals.imagePreview.zoomIn')}
              onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>
              <ZoomIn size={16} />
            </button>
            <button style={TB_BTN} title={t('modals.imagePreview.rotate')}
              onClick={() => setRotation(r => (r + 90) % 360)}>
              <RotateCw size={16} />
            </button>
            <div style={{ width: 1, height: 20, background: color.bgBorder, margin: '0 4px' }} />
          </>)}

          {/* Download */}
          <button style={TB_BTN} title={t('modals.imagePreview.save')}
            onClick={() => onDownload(attachment)}
            onMouseEnter={e => { e.currentTarget.style.background = color.hoverOverlay; e.currentTarget.style.color = color.textPrimary }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = color.textPrimary }}>
            <Download size={16} />
          </button>

          {/* Close */}
          <button style={{ ...TB_BTN, marginLeft: 4 }} title={t('modals.imagePreview.close')}
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.background = alpha(color.terracotta500, 0.15); e.currentTarget.style.color = color.terracotta500 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = color.textPrimary }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div style={{
        width: '100%', maxWidth: 920,
        flex: 1, maxHeight: 'calc(100vh - 140px)',
        borderRadius: 12, overflow: 'hidden',
        background: color.bgBase, border: `1px solid ${color.bgBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>

        {/* IMAGE */}
        {img && (
          <div style={{
            overflow: 'auto', width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={url}
              alt={originalName}
              style={{
                maxWidth: '100%', maxHeight: '100%',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease',
                borderRadius: 4,
              }}
            />
          </div>
        )}

        {/* PDF */}
        {pdf && (
          <iframe
            src={url}
            title={originalName}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}

        {/* TEXT */}
        {txt && (
          <pre style={{
            width: '100%', height: '100%', overflow: 'auto',
            padding: '16px 20px', margin: 0,
            fontSize: 13, lineHeight: 1.65,
            color: color.textPrimary, background: 'transparent',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {textContent ?? t('modals.imagePreview.loading')}
          </pre>
        )}
      </div>

      <style>{`
        @keyframes am-fade { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  )
}
