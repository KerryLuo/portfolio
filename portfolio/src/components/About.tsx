import type { IconType } from 'react-icons'
import {
  SiClaude,
  SiCplusplus,
  SiDocker,
  SiFastapi,
  SiFlask,
  SiGit,
  SiHtml5,
  SiJavascript,
  SiLinux,
  SiNextdotjs,
  SiNodedotjs,
  SiNumpy,
  SiPandas,
  SiPostgresql,
  SiPython,
  SiPytorch,
  SiReact,
  SiRos,
  SiScikitlearn,
  SiTailwindcss,
  SiTypescript,
} from 'react-icons/si'
import { FaJava } from 'react-icons/fa'
import { TbBrandOpenai, TbCar, TbChartLine } from 'react-icons/tb'

type Skill = { name: string; icon: IconType }

const skills: { label: string; items: Skill[] }[] = [
  {
    label: 'Languages',
    items: [
      { name: 'Python', icon: SiPython },
      { name: 'C++', icon: SiCplusplus },
      { name: 'TypeScript', icon: SiTypescript },
      { name: 'JavaScript', icon: SiJavascript },
      { name: 'Java', icon: FaJava },
      { name: 'HTML/CSS', icon: SiHtml5 },
    ],
  },
  {
    label: 'Frameworks',
    items: [
      { name: 'React', icon: SiReact },
      { name: 'Next.js', icon: SiNextdotjs },
      { name: 'Node.js', icon: SiNodedotjs },
      { name: 'Tailwind CSS', icon: SiTailwindcss },
      { name: 'FastAPI', icon: SiFastapi },
      { name: 'Flask', icon: SiFlask },
    ],
  },
  {
    label: 'ML & Data',
    items: [
      { name: 'PyTorch', icon: SiPytorch },
      { name: 'scikit-learn', icon: SiScikitlearn },
      { name: 'NumPy', icon: SiNumpy },
      { name: 'Pandas', icon: SiPandas },
      { name: 'PostgreSQL', icon: SiPostgresql },
    ],
  },
  {
    label: 'Tools & Infra',
    items: [
      { name: 'Git', icon: SiGit },
      { name: 'Docker', icon: SiDocker },
      { name: 'Linux', icon: SiLinux },
      { name: 'ROS2', icon: SiRos },
      { name: 'MATLAB', icon: TbChartLine },
      { name: 'CARLA', icon: TbCar },
      { name: 'Claude', icon: SiClaude },
      { name: 'Codex', icon: TbBrandOpenai },
    ],
  },
]

function About() {
  return (
    <section id="about" className="about-page">
      <div className="container">
        <div className="about">
          <div className="portrait">
            <span className="label">Portrait</span>
          </div>

          <div>
            <h2>About Me</h2>
            <p className="bio">
              I am a computer science student at the University of Maryland. My
              research focuses on evaluating and making AI systems more
              reliable: multimodal benchmarks, long-form generation, and
              real-time safety for learned controllers.
            </p>
          </div>
        </div>

        <div className="skills">
          {skills.map((group) => (
            <div key={group.label} className="skill-col">
              <span className="label">{group.label}</span>
              <ul>
                {group.items.map(({ name, icon: Icon }) => (
                  <li key={name} className="skill">
                    <Icon aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default About
