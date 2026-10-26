import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SectionHead from './SectionHead'

type Project = {
  year: number
  name: string
  badge?: string
  description: string
  tags: string[]
  urls?: string[]
  images?: string[]
  details?: string
}

const projects: Project[] = [
  {
    year: 2026,
    name: 'MAGNET / ATLAS',
    badge: 'Pocket FM',
    description:
      'Multi-agent long-form story generation with character agents, critic revision, and graph-based world-state tracking, plus a knowledge-graph pipeline for hallucination and narrative consistency.',
    tags: ['LLMs', 'Multi-agent', 'Knowledge graphs'],
    urls: [
      'https://github.com/PocketFM-Research',
      'https://arxiv.org/abs/2607.00918',
    ],
  },
  {
    year: 2026,
    name: 'FastSimplex',
    badge: 'NC State',
    description:
      'Real-time safety architecture integrating RL controllers into F1TENTH autonomous racing cars with verifiable safety guarantees, cut per-cycle compute by 56%.',
    tags: ['ROS', 'RL', 'Real-time systems'],
  },
  {
    year: 2025,
    name: 'ASCIIBench',
    badge: 'Algoverse AI',
    description:
      'First-author benchmark for whether LLMs and VLMs can generate, classify, and represent ASCII art. Released a 5,315-image dataset, fine-tuned CLIP weights, and evaluation code.',
    tags: ['Benchmark', 'CLIP', 'Multimodal'],
    urls: [
      'https://github.com/ASCIIBench/ASCIIBench',
      'https://arxiv.org/abs/2512.04125',
    ],
  },
  {
    year: 2025,
    name: 'MiniFold',
    description:
      'Simplified AlphaFold-inspired model for protein backbone prediction using RCSB PDB/FASTA data, one-hot encoding, multi-head attention, RMSD evaluation, and 3D visualization of Cα traces.',
    tags: ['TensorFlow', 'Keras', 'NumPy'],
    urls: ['https://github.com/KerryLuo/protein-structure-prediction'],
  },
]

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
          {project.images?.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
          {project.details && <p>{project.details}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Projects() {
  const [selected, setSelected] = useState<Project | null>(null)
  const years = [...new Set(projects.map((p) => p.year))].sort((a, b) => b - a)

  return (
    <section id="projects">
      <div className="container">
        <SectionHead title="Projects" />

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
                    key={project.name}
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
                    {project.urls && (
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
                  </article>
                ))}
              </div>
            </div>
          )
        })}
        </div>
      </div>
      {selected && (
        <ProjectModal project={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}

export default Projects
