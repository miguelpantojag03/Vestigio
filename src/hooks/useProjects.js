// ─── useProjects ──────────────────────────────────────────────────
// Project list + CRUD, and which one is currently active (persisted
// per user so it survives a reload).

import { useState, useEffect, useCallback } from 'react'
import { getProjects, createProject, renameProject, deleteProject } from '../lib/projectStorage.js'
import { CURRENT_PROJECT_KEY } from '../constants/storageKeys.js'

export function useProjects(userId) {
  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [loadedUserId, setLoadedUserId] = useState(null)
  const loading = Boolean(userId) && userId !== loadedUserId

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getProjects(userId).then(async list => {
      if (cancelled) return
      // Defensive — should never happen given onboarding + the migration's
      // backfill, but a brand-new/edge-case user still needs somewhere to go.
      if (list.length === 0) {
        const created = await createProject(userId, 'General')
        list = [created]
      }
      setProjects(list)
      const saved = localStorage.getItem(CURRENT_PROJECT_KEY(userId))
      const valid = list.find(p => p.id === saved)
      setCurrentProjectId((valid ?? list[0]).id)
      setLoadedUserId(userId)
    }).catch(err => {
      console.error('[useProjects] Failed to load projects:', err)
      if (!cancelled) setLoadedUserId(userId)
    })
    return () => { cancelled = true }
  }, [userId])

  const switchProject = useCallback((projectId) => {
    setCurrentProjectId(projectId)
    if (userId) localStorage.setItem(CURRENT_PROJECT_KEY(userId), projectId)
  }, [userId])

  const addProject = useCallback(async (name) => {
    if (!userId || !name.trim()) return
    const created = await createProject(userId, name)
    setProjects(prev => [created, ...prev])
    switchProject(created.id)
    return created
  }, [userId, switchProject])

  const rename = useCallback(async (id, name) => {
    if (!name.trim()) return
    await renameProject(id, name)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() } : p))
  }, [])

  const remove = useCallback(async (id) => {
    await deleteProject(id)
    const next = projects.filter(p => p.id !== id)
    setProjects(next)
    if (currentProjectId === id && next.length > 0) switchProject(next[0].id)
  }, [projects, currentProjectId, switchProject])

  const currentProject = projects.find(p => p.id === currentProjectId) ?? null

  return { projects, currentProject, currentProjectId, switchProject, addProject, rename, remove, loading }
}
