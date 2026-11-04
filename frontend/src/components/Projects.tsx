import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiError, apiEnabled } from '../lib/api'
import SectionHead from './SectionHead'

type Project = {
  id: number
  year: number
  name: string
  badge: string | null
  description: string
  tags: string[]
  urls: string[]
}

type Draft = Omit<Project, 'id'>

const emptyDraft: Draft = {
  year: new Date().getFullYear(),
  name: '',
  badge: null,
  description: '',
  tags: [],
  urls: [],
}

const splitList = (value: string, sep: RegExp) =>
  value.split(sep).map((v) => v.trim()).filter(Boolean)

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.166 6.84 9.49.5.09.68-.217.68-.482 0-.237-.01-.866-.014-1.7-2.782.604-3.37-1.34-3.37-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.07-.608.07-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.53 2.34 1.088 2.91.832.09-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.09.39-1.984 1.03-2.682-.104-.254-.448-1.27.098-2.647 0 0 .84-.27 2.75 1.026A9.56 9.56 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.91-1.296 2.75-1.026 2.75-1.026.546 1.377.202 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.842-2.338 4.687-4.566 4.936.36.31.678.92.678 1.855 0 1.338-.012 2.416-.012 2.744 0 .267.18.578.688.48A10.01 10.01 0 0 0 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  )
}

function PaperIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M6 2.5h8.5L19 7v14.5H6zM14 2.5V7.5h5M9 12h7M9 15.5h7M9 19h4"
      />
    </svg>
  )
}

const isPaper = (url: string) => new URL(url).hostname.endsWith('arxiv.org')

function ProjectModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Rendered on the page body so it covers the whole window.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal project-modal"
        role="dialog"
        aria-modal="true"
        aria-label={project.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          autoFocus
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M5 5l14 14M19 5L5 19"
            />
          </svg>
        </button>
        <div className="project-modal-body">
          {project.badge && <span className="label">{project.badge}</span>}
          <h4>{project.name}</h4>
          <p>{project.description}</p>
          <div className="tags">
            {project.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ProjectForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Project | null
  onSave: (draft: Draft) => Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setSaving(true)
    setError('')
    setFields({})
    try {
      await onSave({
        year: Number(v.year),
        name: v.name,
        badge: v.badge.trim() || null,
        description: v.description,
        tags: splitList(v.tags, /,/),
        urls: splitList(v.urls, /\s+/),
      })
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError) {
        setError(err.message)
        setFields(err.fields ?? {})
      } else {
        setError('Could not reach the server. Please try again later.')
      }
    }
  }

  const d = initial ?? emptyDraft
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal project-modal"
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Edit project' : 'Add project'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-modal-body">
          <h4>{initial ? 'Edit project' : 'Add project'}</h4>
          <form className="contact-form" onSubmit={onSubmit} noValidate>
            <label>
              <span className="label">Name</span>
              <input name="name" defaultValue={d.name} maxLength={100} autoFocus aria-invalid={!!fields.name} />
              {fields.name && <small>{fields.name}</small>}
            </label>
            <label>
              <span className="label">Year</span>
              <input name="year" type="number" defaultValue={d.year} aria-invalid={!!fields.year} />
              {fields.year && <small>{fields.year}</small>}
            </label>
            <label>
              <span className="label">Badge (optional)</span>
              <input name="badge" defaultValue={d.badge ?? ''} maxLength={100} />
            </label>
            <label>
              <span className="label">Description</span>
              <textarea name="description" rows={4} defaultValue={d.description} maxLength={1000} aria-invalid={!!fields.description} />
              {fields.description && <small>{fields.description}</small>}
            </label>
            <label>
              <span className="label">Tags (comma separated)</span>
              <input name="tags" defaultValue={d.tags.join(', ')} />
            </label>
            <label>
              <span className="label">Links (separated by spaces)</span>
              <input name="urls" defaultValue={d.urls.join(' ')} />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Editing is a dev-only admin tool for now; the deployed site is read-only.
const canEdit = import.meta.env.DEV

function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(apiEnabled)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  // `null` = closed, `'new'` = creating, a Project = editing it.
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!apiEnabled) return
    const controller = new AbortController()
    api<Project[]>('/api/projects', { signal: controller.signal })
      .then(setProjects)
      .catch((err) => {
        if (controller.signal.aborted) return
        setLoadError(err instanceof ApiError ? err.message : 'Could not reach the server.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const save = async (draft: Draft) => {
    if (editing === 'new') {
      const created = await api<Project>('/api/projects', { method: 'POST', json: draft })
      setProjects((all) => [...all, created])
    } else if (editing) {
      const updated = await api<Project>(`/api/projects/${editing.id}`, { method: 'PUT', json: draft })
      setProjects((all) => all.map((p) => (p.id === updated.id ? updated : p)))
    }
    setEditing(null)
  }

  const remove = async (project: Project) => {
    if (!window.confirm(`Delete "${project.name}"?`)) return
    setActionError('')
    try {
      await api(`/api/projects/${project.id}`, { method: 'DELETE' })
      setProjects((all) => all.filter((p) => p.id !== project.id))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reach the server.')
    }
  }

  const years = [...new Set(projects.map((p) => p.year))].sort((a, b) => b - a)

  return (
    <section id="projects">
      <div className="container">
        <SectionHead title="Projects" />

        {canEdit && !loadError && (
          <div className="project-toolbar">
            <button type="button" className="btn" onClick={() => setEditing('new')}>
              Add project
            </button>
          </div>
        )}
        {loading && <p className="contact-note">Loading projects…</p>}
        {(loadError || !apiEnabled) && (
          <p className="form-error" role="alert">
            {loadError || 'Projects are unavailable right now.'}
          </p>
        )}
        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="years">
        {years.map((year) => {
          const items = projects.filter((p) => p.year === year)
          return (
            <div key={year}>
              <div className="year">
                <h3>{year}</h3>
              </div>
              <div className="grid">
                {items.map((project) => (
                  <article
                    key={project.id}
                    className="card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(project)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        setSelected(project)
                      }
                    }}
                  >
                    {project.urls.length > 0 && (
                      <div className="card-links">
                        {project.urls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            aria-label={
                              isPaper(url)
                                ? `${project.name} paper`
                                : `${project.name} on GitHub`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isPaper(url) ? <PaperIcon /> : <GitHubIcon />}
                          </a>
                        ))}
                      </div>
                    )}
                    <span className="label">{project.badge}</span>
                    <h4>{project.name}</h4>
                    <p>{project.description}</p>
                    <div className="tags">
                      {project.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {canEdit && (
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(project)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(project)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )
        })}
        </div>
      </div>
      {canEdit && editing && (
        <ProjectForm
          initial={editing === 'new' ? null : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {selected && (
        <ProjectModal project={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}

export default Projects
