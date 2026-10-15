import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The address is stored reversed and only assembled after a click, so it never
// appears in the page source, the built bundle, or the DOM until requested.
const USER = '1oulyrrek'
const DOMAIN = 'moc.liamg'

const reverse = (s: string) => [...s].reverse().join('')

type Props = {
  variant?: 'icon' | 'pill'
}

function EmailButton({ variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          className="btn nav-cta"
          onClick={() => setOpen(true)}
        >
          Contact Me
        </button>
      ) : (
        <button
          type="button"
          className="icon-link"
          aria-label="Email"
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              d="M2.5 5h19v14h-19z"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.5 5 9.5 8 9.5-8"
            />
          </svg>
        </button>
      )}

      {/* Rendered on the page body so it covers the whole window; the navbar's
          blur would otherwise trap a fixed popup inside the navbar. */}
      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Email address"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                autoFocus
                onClick={() => setOpen(false)}
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
              <p className="label">Email</p>
              <p className="modal-email">
                {reverse(USER)} [at] {reverse(DOMAIN)}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export default EmailButton
