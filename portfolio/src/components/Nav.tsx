import { useEffect, useRef, useState } from 'react'
import EmailButton from './EmailButton'

const links = ['About', 'Experience', 'Projects', 'Publications']

// How long the bar stays put after a nav link click, covering the smooth scroll.
const NAV_SCROLL_MS = 1200

function Nav() {
  const [hidden, setHidden] = useState(false)
  const navigating = useRef(false)
  const unlockTimer = useRef<number>(0)
  const lastY = useRef(0)

  // Hide the bar while scrolling down, bring it back as soon as you scroll up.
  // Scrolling that comes from clicking a nav link leaves the bar visible.
  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (navigating.current) {
        lastY.current = y
        return
      }
      if (Math.abs(y - lastY.current) < 6) return
      setHidden(y > lastY.current && y > 80)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(unlockTimer.current)
    }
  }, [])

  const onNavClick = () => {
    navigating.current = true
    setHidden(false)
    window.clearTimeout(unlockTimer.current)
    unlockTimer.current = window.setTimeout(() => {
      navigating.current = false
      lastY.current = window.scrollY
    }, NAV_SCROLL_MS)
  }

  return (
    <nav className={hidden ? 'nav nav-hidden' : 'nav'}>
      <div className="container">
        <a href="#home" className="nav-name" onClick={onNavClick}>
          Kerry Luo
        </a>
        <div className="nav-right">
          <ul>
            {links.map((link) => (
              <li key={link}>
                <a href={`#${link.toLowerCase()}`} onClick={onNavClick}>
                  {link}
                </a>
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
