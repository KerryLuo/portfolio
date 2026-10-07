import { useLayoutEffect, useRef, type ReactNode } from 'react'

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      aria-label={label}
      className="icon-link"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function Hero() {
  const rootRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLHeadingElement>(null)
  const introRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const name = nameRef.current
    const intro = introRef.current
    if (!root || !name || !intro) return

    const place = () => {
      const nameNode = name.firstChild
      const introNode = intro.firstChild
      if (!nameNode || !introNode) return

      const yPos = name.textContent?.indexOf('y') ?? -1
      const yRange = document.createRange()
      if (yPos >= 0 && nameNode.nodeType === Node.TEXT_NODE) {
        yRange.setStart(nameNode, yPos)
        yRange.setEnd(nameNode, yPos + 1)
      } else {
        yRange.selectNodeContents(name)
      }

      const textRange = document.createRange()
      if (introNode.nodeType === Node.TEXT_NODE) {
        const value = introNode.textContent ?? ''
        const start = value.search(/\S/)
        textRange.setStart(introNode, start < 0 ? 0 : start)
        textRange.setEnd(introNode, value.length)
      } else {
        textRange.selectNodeContents(intro)
      }

      const yBottom = yRange.getBoundingClientRect().bottom
      const textTop = textRange.getBoundingClientRect().top
      const extraBelow = name.getBoundingClientRect().bottom - yBottom
      const extraAbove = textTop - intro.getBoundingClientRect().top
      const half = 32

      root.style.setProperty('--sep-top', `${Math.max(0, half - extraBelow)}px`)
      root.style.setProperty('--sep-bottom', `${Math.max(0, half - extraAbove)}px`)
    }

    place()
    void document.fonts.ready.then(place)
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])

  return (
    <section id="home" className="hero container" ref={rootRef}>
      <h1 ref={nameRef}>Kerry Luo</h1>
      <div className="divider" />
      <p className="intro" ref={introRef}>
        Computer science at the University of Maryland. I work on evaluation
        and safety for AI systems that are powerful but hard to trust.
      </p>
      <div className="actions">
        <IconLink href="https://github.com/KerryLuo" label="GitHub">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.166 6.84 9.49.5.09.68-.217.68-.482 0-.237-.01-.866-.014-1.7-2.782.604-3.37-1.34-3.37-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.07-.608.07-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.53 2.34 1.088 2.91.832.09-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.09.39-1.984 1.03-2.682-.104-.254-.448-1.27.098-2.647 0 0 .84-.27 2.75 1.026A9.56 9.56 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.91-1.296 2.75-1.026 2.75-1.026.546 1.377.202 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.842-2.338 4.687-4.566 4.936.36.31.678.92.678 1.855 0 1.338-.012 2.416-.012 2.744 0 .267.18.578.688.48A10.01 10.01 0 0 0 22 12c0-5.523-4.477-10-10-10z"
            />
          </svg>
        </IconLink>
        <IconLink href="https://www.linkedin.com/in/kerryluo/" label="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.8 0 0 .77 0 1.73v20.54C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
            />
          </svg>
        </IconLink>
        <IconLink href="mailto:kerryluo1@gmail.com" label="Email">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              d="M3.5 6.5h17v11h-17z"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m3.5 6.5 8.5 7 8.5-7"
            />
          </svg>
        </IconLink>
      </div>
    </section>
  )
}

export default Hero
