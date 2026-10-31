// ─── useRelics ────────────────────────────────────────────────────
// All relic state: CRUD, filtering, searching, sorting, section nav.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getRelics, addRelic, updateRelic, trashRelics, restoreRelics, deleteRelics, emptyTrash as emptyTrashStorage } from '../lib/relicStorage.js'

// sort helpers
function sortFn(field, dir) {
  return (a, b) => {
    let va, vb
    if (field === 'title')    { va = a.title?.toLowerCase()??'';      vb = b.title?.toLowerCase()??'' }
    else if (field === 'category') { va = a.category??'';             vb = b.category??'' }
    else if (field === 'status')   { va = a.status??'';               vb = b.status??'' }
    else /* date */            { va = a.discardedAt??a.discarded??''; vb = b.discardedAt??b.discarded??'' }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ?  1 : -1
    return 0
  }
}

export function useRelics(userId, currentProjectId) {
  const [allRelics,  setRelics]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [filter,     setFilter]     = useState('all')      // 'all'|'visuals'|'drafts'
  const [section,    setSection]    = useState('gallery')  // 'gallery'|'recent'|'revived'|'deleted'|'search'
  const [search,     setSearch]     = useState('')

  // Global search filters — only applied when section === 'search'. Kept
  // separate from `filter` above: that one is a gallery-only visuals/drafts
  // shortcut, this is a real cross-status/cross-date query.
  const [searchCategory, setSearchCategory] = useState('all')
  const [searchStatus,   setSearchStatus]   = useState('all')   // 'all'|'archived'|'revived'
  const [searchDateFrom, setSearchDateFrom] = useState('')
  const [searchDateTo,   setSearchDateTo]   = useState('')
  const [sortField,  setSortField]  = useState('date')     // 'date'|'title'|'category'|'status'
  const [sortDir,    setSortDir]    = useState('desc')     // 'asc'|'desc'
  const [loadedUserId, setLoadedUserId] = useState(null)
  const loading = Boolean(userId) && userId !== loadedUserId

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getRelics(userId)
      .catch(err => {
        console.error('[useRelics] Failed to load relics:', err)
        return []
      })
      .then(data => {
        if (cancelled) return
        setRelics(data)
        const active = data.filter(r => !r.deletedAt)
        const revived = active.find(r => r.revived)
        setSelectedId(revived?.id ?? active[0]?.id ?? null)
        setLoadedUserId(userId)
      })
    return () => { cancelled = true }
  }, [userId])

  // Trashed relics are out of everything except the trash section itself.
  const relics  = useMemo(() => allRelics.filter(r => !r.deletedAt), [allRelics])
  const trashed = useMemo(() => allRelics.filter(r => r.deletedAt), [allRelics])

  // toggle sort: same field → flip dir; new field → desc
  function cycleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  // derived list: section → filter → search → sort
  const visible = useMemo(() => {
    let list = section === 'deleted' ? trashed : relics

    // project scope — every section except the cross-project global search
    // and the trash (its relics' project may be gone) stays scoped to
    // whichever project is currently open.
    if (section !== 'search' && section !== 'deleted' && currentProjectId) {
      list = list.filter(r => r.projectId === currentProjectId)
    }

    // section filter — 'search' deliberately skips all of this and starts
    // from the full, unscoped list: the whole point is to look across every
    // status/project at once, not just the current section.
    if (section === 'recent')  list = [...list].sort(sortFn('date','desc')).slice(0, 10)
    else if (section === 'revived') list = list.filter(r => r.revived)

    // category filter (only in gallery)
    if (section === 'gallery') {
      if (filter === 'visuals') list = list.filter(r => r.filter === 'visuals')
      else if (filter === 'drafts') list = list.filter(r => r.filter === 'drafts')
    }

    // global search filters
    if (section === 'search') {
      if (searchCategory !== 'all') list = list.filter(r => r.category === searchCategory)
      if (searchStatus   !== 'all') list = list.filter(r => r.status === searchStatus)
      if (searchDateFrom) list = list.filter(r => (r.discardedAt ?? '') >= searchDateFrom)
      if (searchDateTo)   list = list.filter(r => (r.discardedAt ?? '') <= `${searchDateTo}T23:59:59.999Z`)
    }

    // search
    const q = search.toLowerCase().trim()
    if (q) list = list.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.responsible?.toLowerCase().includes(q) ||
      (r.tags ?? []).some(t => t.toLowerCase().includes(q))
    )

    // sort (recent section already sorted)
    if (section !== 'recent') list = [...list].sort(sortFn(sortField, sortDir))

    return list
  }, [relics, trashed, section, filter, search, sortField, sortDir, searchCategory, searchStatus, searchDateFrom, searchDateTo, currentProjectId])

  const projectRelics = useMemo(
    () => currentProjectId ? relics.filter(r => r.projectId === currentProjectId) : relics,
    [relics, currentProjectId]
  )

  // Derived, not mirrored into state: if the stored selectedId doesn't
  // belong to the current project (e.g. right after switching projects),
  // fall back to a sensible default within it instead of showing nothing.
  // The global search is the exception: its results cross projects, so
  // falling back there would open (and let you delete) a different relic
  // from the one that was clicked.
  const selected = useMemo(() => {
    if (section === 'deleted') return trashed.find(r => r.id === selectedId) ?? trashed[0] ?? null
    const direct = relics.find(r => r.id === selectedId)
    if (direct && (section === 'search' || !currentProjectId || direct.projectId === currentProjectId)) return direct
    return projectRelics.find(r => r.revived) ?? projectRelics[0] ?? null
  }, [relics, trashed, selectedId, section, currentProjectId, projectRelics])

  // stats — scoped to the current project, same as everything else in view
  const stats = useMemo(() => ({
    total:        projectRelics.length,
    revived:      projectRelics.filter(r => r.revived).length,
    archived:     projectRelics.filter(r => !r.revived).length,
    withCover:    projectRelics.filter(r => r.coverImage).length,
  }), [projectRelics])

  // CRUD
  const add = useCallback(async (relic) => {
    if (!userId) return
    const updated = await addRelic(userId, relic)
    setRelics(updated)
    setSelectedId(relic.id)
    return updated
  }, [userId])

  const update = useCallback(async (id, patch) => {
    if (!userId) return
    const updated = await updateRelic(userId, id, patch)
    setRelics(updated)
    return updated
  }, [userId])

  const trash = useCallback(async (ids) => {
    if (!userId) return
    setRelics(await trashRelics(userId, ids))
  }, [userId])

  const restore = useCallback(async (ids) => {
    if (!userId) return
    setRelics(await restoreRelics(userId, ids))
  }, [userId])

  const removeForever = useCallback(async (ids) => {
    if (!userId) return
    setRelics(await deleteRelics(userId, ids))
  }, [userId])

  const emptyTrash = useCallback(async () => {
    if (!userId) return
    setRelics(await emptyTrashStorage(userId))
  }, [userId])

  const revive = useCallback((id) => {
    const relic = relics.find(r => r.id === id)
    if (relic?.revived) return Promise.resolve(relic)
    return update(id, { status: 'revived', revivedAt: new Date().toISOString() })
  }, [update, relics])

  return {
    relics, trashed, projectRelics, visible, selected, selectedId, setSelectedId,
    filter, setFilter,
    section, setSection,
    search, setSearch,
    searchCategory, setSearchCategory,
    searchStatus,   setSearchStatus,
    searchDateFrom, setSearchDateFrom,
    searchDateTo,   setSearchDateTo,
    sortField, sortDir, cycleSort,
    loading, stats,
    add, update, revive, trash, restore, removeForever, emptyTrash,
  }
}
