import SectionHead from './SectionHead'

const publications = [
  {
    title:
      'ASCIIBench: Evaluating Language-Model-Based Understanding of Visually-Oriented Text',
    authors:
      'Kerry Luo, Michael Fu, Joshua Peguero, Husnain Malik, Anvay Patil, Joyce Lin, Megan Van Overborg, Ryan Sarmiento, Kevin Zhu',
    venue: 'NeurIPS 2025 Workshops on LLM Evaluation & Multimodal Algorithmic Reasoning',
    url: 'https://arxiv.org/abs/2512.04125',
  },
  {
    title:
      'From Personas to Plot: Character-Grounded Multi-Agent Story Generation for Long-Form Narratives',
    authors:
      'Aayush Aluru, Chloe Ho, Muhammad Hammouri, Kerry Luo, Myra Malik, Ryan Lagasse, Arjun Bahuguna, Vasu Sharma',
    venue: 'COLM 2026 WAB & LLA; ICML 2026 WiML Workshops',
    url: 'https://arxiv.org/abs/2607.00918',
  },
]

function Publications() {
  return (
    <section id="publications">
      <div className="container">
        <SectionHead label="Research · Writing" title="Publications" />
        <ol className="pubs">
          {publications.map((pub, i) => (
            <li key={pub.title}>
              <span className="label">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h4>
                  <a href={pub.url} target="_blank" rel="noopener noreferrer">
                    {pub.title}
                  </a>
                </h4>
                <p className="authors">{pub.authors}</p>
                <span className="label">{pub.venue}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default Publications
