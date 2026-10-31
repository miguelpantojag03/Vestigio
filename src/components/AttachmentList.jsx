// ─── AttachmentList ───────────────────────────────────────────────
// Renders the full attachment section for a relic:
//   - FileDropZone for adding files
//   - List of AttachmentItem rows
//   - Error message
//   - Empty state
//
// Consumers pass down the useAttachments() hook values as props
// so this component stays purely presentational.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Loader } from 'lucide-react'
import FileDropZone    from './FileDropZone.jsx'
import AttachmentItem  from './AttachmentItem.jsx'
import ImagePreviewModal from './ImagePreviewModal.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { alpha } from '../styles/tokens.js'

export default function AttachmentList({
  attachments,
  loading,
  error,
  onAddFiles,
  onDelete,
  onOpen,
  onDownload,
  getPreviewURL,
  readOnly = false,
}) {
  const { t } = useTranslation()
  const { color, radius } = useTheme()
  const [previewAtt, setPreviewAtt] = useState(null)
  const [previewURL, setPreviewURL] = useState(null)

  function handlePreview(att) {
    const url = getPreviewURL(att)
    if (!url) return
    setPreviewAtt(att)
    setPreviewURL(url)
  }

  function handleClosePreview() {
    if (previewURL) URL.revokeObjectURL(previewURL)
    setPreviewAtt(null)
    setPreviewURL(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Paperclip size={13} style={{ color: color.blue300 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: color.textPrimary, letterSpacing: '0.03em' }}>
          {t('attachments.sectionTitle')}
        </span>
        {attachments.length > 0 && (
          <span style={{
            fontSize:       10,
            fontWeight:     700,
            color:          color.blue300,
            background:     alpha(color.blue500, 0.15),
            borderRadius:   99,
            padding:        '1px 7px',
          }}>
            {attachments.length}
          </span>
        )}
        {loading && <Loader size={12} className="am-spin" style={{ color: color.textSecondary }} />}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding:      '8px 12px',
            borderRadius: 7,
            background:   alpha(color.terracotta500, 0.1),
            border:       `1px solid ${alpha(color.terracotta500, 0.3)}`,
            fontSize:     11,
            color:        color.terracotta500,
            whiteSpace:   'pre-line',
          }}
        >
          {error}
        </div>
      )}

      {/* Attachment rows */}
      {attachments.length > 0 && (
        <div style={{
          borderRadius: radius.controlSm,
          border:       `1px solid ${color.bgBorder}`,
          overflow:     'hidden',
          background:   color.bgBase,
        }}>
          {attachments.map((att, i) => (
            <div key={att.id} style={{
              borderBottom: i < attachments.length - 1 ? `1px solid ${color.bgBorder}` : 'none',
            }}>
              <AttachmentItem
                attachment={att}
                onPreview={handlePreview}
                onOpen={onOpen}
                onDownload={onDownload}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state (only shown when there are 0 attachments and not loading) */}
      {attachments.length === 0 && !loading && (
        <div style={{
          textAlign:  'center',
          fontSize:   11,
          color:      color.textTertiary,
          padding:    '8px 0 4px',
        }}>
          {t('attachments.noFiles')}
        </div>
      )}

      {/* Drop zone */}
      {!readOnly && (
        <FileDropZone onFiles={onAddFiles} disabled={loading} />
      )}

      {/* Image / text / PDF preview modal */}
      {previewAtt && previewURL && (
        <ImagePreviewModal
          attachment={previewAtt}
          url={previewURL}
          onClose={handleClosePreview}
          onDownload={onDownload}
        />
      )}

    </div>
  )
}
