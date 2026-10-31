// ─── useAttachments ───────────────────────────────────────────────
// Manages the attachment list for a single relic.
// Handles loading, adding, deleting and error states.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAttachments,
  addAttachment,
  deleteAttachment,
  downloadAttachment,
  openAttachment,
  createPreviewURL,
} from '../lib/attachmentStorage.js'
import { onRelicDataChanged } from '../lib/relicDataEvents.js'
import { validateFile } from '../constants/fileTypes.js'

export function useAttachments(relicId, userId) {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState([])
  const [loadedRelicId, setLoadedRelicId] = useState(null)
  const [reloadKey,   setReloadKey]   = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const fetching = Boolean(relicId) && relicId !== loadedRelicId
  // Never the previous relic's list while this one's is on its way.
  const visibleAttachments = relicId && !fetching ? attachments : []
  const visibleError = fetching ? null : error

  // ── Load attachments when relicId changes, or anything mounted changes them ──
  useEffect(() => {
    if (!relicId) return
    let cancelled = false
    getAttachments(relicId)
      .then(data => { if (!cancelled) setAttachments(data) })
      .catch(() => {
        if (cancelled) return
        setAttachments([])
        setError(t('attachments.errors.loadFailed'))
      })
      .finally(() => { if (!cancelled) setLoadedRelicId(relicId) })
    return () => { cancelled = true }
  }, [relicId, reloadKey, t])

  useEffect(() => {
    if (!relicId) return
    return onRelicDataChanged(relicId, () => setReloadKey(key => key + 1))
  }, [relicId])

  // ── Add one or more files ─────────────────────────────────────
  const addFiles = useCallback(async (files) => {
    if (!relicId || !userId) return []
    const fileArray = Array.from(files)
    const errors    = []

    // Validate each file before storing anything
    for (const file of fileArray) {
      const err = validateFile(file, t)
      if (err) { errors.push({ file: file.name, message: err }); }
    }
    if (errors.length) {
      const msg = errors.map(e => `• ${e.file}: ${e.message}`).join('\n')
      throw new Error(msg)
    }

    // Check for duplicates by name within this relic
    const existing = attachments.map(a => a.originalName.toLowerCase())
    const dupes    = fileArray.filter(f => existing.includes(f.name.toLowerCase()))
    if (dupes.length) {
      throw new Error(t('attachments.errors.alreadyAttached', {
        count: dupes.length,
        files: dupes.map(d => d.name).join(', '),
      }))
    }

    setLoading(true)
    setError(null)
    try {
      return await Promise.all(
        fileArray.map(f => addAttachment(relicId, userId, f))
      )
    } catch (err) {
      setError(t('attachments.errors.saveFailed'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [relicId, userId, attachments, t])

  // ── Delete ────────────────────────────────────────────────────
  const remove = useCallback(async (attId) => {
    setError(null)
    try {
      await deleteAttachment(attId)
    } catch (err) {
      setError(t('attachments.errors.deleteFailed'))
      throw err
    }
  }, [t])

  // ── Download (Save As…) ───────────────────────────────────────
  const download = useCallback(async (att) => {
    try {
      await downloadAttachment(att)
    } catch {
      setError(t('attachments.errors.downloadFailed'))
    }
  }, [t])

  // ── Open with the system's default app ────────────────────────
  const open = useCallback(async (att) => {
    try {
      await openAttachment(att)
    } catch {
      setError(t('attachments.errors.openFailed'))
    }
  }, [t])

  // ── Open for in-app preview (returns an asset URL) ────────────
  const getPreviewURL = useCallback((att) => {
    try {
      return createPreviewURL(att)
    } catch {
      setError(t('attachments.errors.previewFailed'))
      return null
    }
  }, [t])

  return {
    attachments: visibleAttachments,
    loading: loading || fetching,
    error: visibleError,
    setError,
    addFiles,
    remove,
    download,
    open,
    getPreviewURL,
  }
}
