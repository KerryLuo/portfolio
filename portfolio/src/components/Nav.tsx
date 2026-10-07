const links = ['Home', 'About', 'Projects', 'Publications']

function Nav() {
  return (
    <nav className="nav">
      <div className="container">
        <a href="#home" className="label">
          Kerry Luo
        </a>
        <ul className="label">
          {links.map((link) => (
            <li key={link}>
              <a href={`#${link.toLowerCase()}`}>{link}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default Nav
