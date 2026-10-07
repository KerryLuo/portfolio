import SectionHead from './SectionHead'

type Project = {
  year: number
  name: string
  badge: string
  description: string
  tags: string[]
  url?: string
}

const projects: Project[] = [
  {
    year: 2026,
    name: 'MAGNET / ATLAS',
    badge: 'Pocket FM',
    description:
      'Multi-agent long-form story generation with character agents, critic revision, and graph-based world-state tracking, plus a knowledge-graph pipeline for hallucination and narrative consistency.',
    tags: ['LLMs', 'Multi-agent', 'Knowledge graphs'],
    url: 'https://arxiv.org/abs/2607.00918',
  },
  {
    year: 2026,
    name: 'FastSimplex',
    badge: 'NC State',
    description:
      'Real-time safety stack around black-box RL controllers for F1TENTH. Early-termination cut per-cycle compute by 56% and eliminated crashes on an undertrained policy while keeping 99.8% of baseline lap speed.',
    tags: ['ROS', 'RL', 'Real-time systems'],
  },
  {
    year: 2025,
    name: 'ASCIIBench',
    badge: 'NeurIPS 2025 Workshops',
    description:
      'First-author benchmark for whether LLMs and VLMs can generate, classify, and represent ASCII art. Released a 5,315-image dataset, fine-tuned CLIP weights, and evaluation code.',
    tags: ['Benchmark', 'CLIP', 'Multimodal'],
    url: 'https://github.com/ASCIIBench/ASCIIBench',
  },
  {
    year: 2025,
    name: 'MiniFold',
    badge: 'Personal',
    description:
      'Simplified AlphaFold-inspired model for protein backbone prediction using RCSB PDB/FASTA data, one-hot encoding, multi-head attention, RMSD evaluation, and 3D visualization of Cα traces.',
    tags: ['TensorFlow', 'Keras', 'NumPy'],
  },
]

function Projects() {
  const years = [...new Set(projects.map((p) => p.year))].sort((a, b) => b - a)

  return (
    <section id="projects">
      <div className="container">
        <SectionHead label="Selected Work" title="Projects" />

        {years.map((year) => {
          const items = projects.filter((p) => p.year === year)
          return (
            <div key={year}>
              <div className="year">
                <h3>{year}</h3>
                <span className="label">
                  {items.length} {items.length === 1 ? 'Project' : 'Projects'}
                </span>
              </div>
              <div className="grid">
                {items.map((project) => (
                  <article key={project.name} className="card">
                    <span className="label">{project.badge}</span>
                    <h4>
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {project.name}
                        </a>
                      ) : (
                        project.name
                      )}
                    </h4>
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
    </section>
  )
}

export default Projects
