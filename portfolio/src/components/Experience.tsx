import SectionHead from './SectionHead'

const roles = [
  {
    title: 'Web Development Bootcamp Member — UMD App Dev Club',
    dates: 'Sep 2026 – Present',
  },
  {
    title: 'Research Intern — North Carolina State University',
    dates: 'June 2025 – July 2026',
  },
  {
    title: 'AI Research Intern — Pocket FM',
    dates: 'Feb 2026 – May 2026',
  },
  {
    title: 'Machine Learning Researcher — Algoverse AI',
    dates: 'Aug 2022 – Sep 2025',
  },
]

function Experience() {
  return (
    <section id="experience" className="experience">
      <div className="container">
        <SectionHead title="Experience" />
        <ol className="roles">
          {roles.map((role, i) => (
            <li key={role.title}>
              <span className="label">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="role-title">{role.title}</div>
                <div className="label">{role.dates}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default Experience
