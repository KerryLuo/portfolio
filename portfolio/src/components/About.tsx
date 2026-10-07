const roles = [
  {
    title: 'Research Intern — North Carolina State University',
    dates: 'June 2025 – Present',
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

function About() {
  return (
    <section id="about">
      <div className="container about">
        <div className="portrait">
          <span className="label">Portrait</span>
        </div>

        <div>
          <h2>Kerry Luo</h2>
          <div className="divider" />
          <p className="bio">
            I am a computer science student at the University of Maryland,
            expected to graduate in May 2030. I previously studied at the North
            Carolina School of Science and Mathematics. My research focuses on
            evaluating and making AI systems more reliable: multimodal
            benchmarks, long-form generation, and real-time safety for learned
            controllers.
          </p>

          <h3>Past Roles</h3>
          <ol className="roles">
            {roles.map((role, i) => (
              <li key={role.title}>
                <span className="label">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div>{role.title}</div>
                  <div className="label">{role.dates}</div>
                </div>
              </li>
            ))}
          </ol>

          <a href="#projects" className="btn">
            View Projects
          </a>
        </div>
      </div>
    </section>
  )
}

export default About
