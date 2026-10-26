import { useEffect, useState } from 'react'
import { api, ApiError, apiEnabled } from '../lib/api'
import { getEmail, maskedEmail } from '../lib/email'
import SectionHead from './SectionHead'

type Status = 'idle' | 'sending' | 'sent' | 'error'

// Shows the address as text, but only builds it after real user input (mouse,
// touch, key or scroll), which plain HTTP fetchers and most headless crawlers
// never produce. Until then it shows an "[at]" version; the mailto link is
// only created when clicked.
function ProtectedEmail() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart']
    const reveal = () => {
      setEmail(getEmail())
      events.forEach((e) => window.removeEventListener(e, reveal))
    }
    events.forEach((e) => window.addEventListener(e, reveal, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, reveal))
  }, [])

  return (
    <a
      className="contact-email"
      href="#contact"
      onClick={(e) => {
        e.preventDefault()
        window.location.href = `mailto:${getEmail()}`
      }}
    >
      {email ?? maskedEmail()}
    </a>
  )
}

function Contact() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>

    setStatus('sending')
    setError('')
    setFields({})
    try {
      await api('/api/contact', { method: 'POST', json: values })
      form.reset()
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      if (err instanceof ApiError) {
        setError(err.message)
        setFields(err.fields ?? {})
      } else {
        setError('Could not reach the server. Please try again later.')
      }
    }
  }

  return (
    <section id="contact">
      <div className="container">
        <SectionHead title="Get in touch" />

        <div className="contact-layout">
          <div className="contact-info">
            <p>The best way to contact me is by email:</p>
            <ProtectedEmail />
            <p>Alternatively, send me a message!</p>
          </div>

          <div className="contact-main">
            {!apiEnabled ? (
              <p className="contact-note">
                The contact form is not available right now. Use the email icon at
                the top of the page instead.
              </p>
            ) : status === 'sent' ? (
              <div className="form-done" role="status">
                <p>Thanks for reaching out! I'll get back to you soon.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setStatus('idle')}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={onSubmit} noValidate>
                <label>
                  <span className="label">Name</span>
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    required
                    aria-invalid={!!fields.name}
                  />
                  {fields.name && <small>{fields.name}</small>}
                </label>

                <label>
                  <span className="label">Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={200}
                    required
                    aria-invalid={!!fields.email}
                  />
                  {fields.email && <small>{fields.email}</small>}
                </label>

                <label>
                  <span className="label">Message</span>
                  <textarea
                    name="message"
                    rows={6}
                    maxLength={5000}
                    required
                    aria-invalid={!!fields.message}
                  />
                  {fields.message && <small>{fields.message}</small>}
                </label>

                {/* Honeypot: invisible to people, bots fill it in. */}
                <input
                  name="website"
                  type="text"
                  className="hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn"
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                  </button>
                  {status === 'error' && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact
