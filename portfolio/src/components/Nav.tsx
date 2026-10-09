import EmailButton from './EmailButton'

const links = ['Home', 'About', 'Experience', 'Projects', 'Publications']

function Nav() {
  return (
    <nav className="nav">
      <div className="container">
        <a href="#home" className="nav-name">
          Kerry Luo
        </a>
        <div className="nav-right">
          <ul>
            {links.map((link) => (
              <li key={link}>
                <a href={`#${link.toLowerCase()}`}>{link}</a>
              </li>
            ))}
          </ul>
          <EmailButton variant="pill" />
        </div>
      </div>
    </nav>
  )
}

export default Nav
