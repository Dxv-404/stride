/**
 * ContactFooter — Section 6: Closing footer with contact links.
 *
 * Minimal dark footer with the project title, student info,
 * and relevant links. Designed to be the final resting place
 * of the scroll journey.
 */

export default function ContactFooter() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-8"
      style={{
        minHeight: '50vh',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}
    >
      {/* Divider line */}
      <div
        style={{
          width: '60px',
          height: '1px',
          backgroundColor: 'rgba(196, 149, 106, 0.3)',
        }}
      />

      {/* Project wordmark */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
          fontWeight: 400,
          color: '#E7E7E7',
          letterSpacing: '0.2em',
        }}
      >
        STRIDE
      </h2>

      {/* Subtitle */}
      <p
        className="font-mono"
        style={{
          fontSize: '0.7rem',
          color: 'rgba(231, 231, 231, 0.4)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          maxWidth: '500px',
          lineHeight: 1.8,
        }}
      >
        Evolving 2D Walkers Using Genetic Algorithms
        <br />
        Optimisation Techniques · CIA-3 Project
      </p>

      {/* Student info */}
      <div
        className="font-mono"
        style={{
          fontSize: '0.65rem',
          color: 'rgba(231, 231, 231, 0.3)',
          letterSpacing: '0.08em',
          lineHeight: 2,
        }}
      >
        <p>Dev Krishna · 3rd Year Data Science</p>
        <p>CHRIST (Deemed to be University), Pune</p>
      </div>

      {/* Links */}
      <div className="flex gap-6 mt-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono"
          style={{
            fontSize: '0.6rem',
            color: 'rgba(231, 231, 231, 0.35)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(231, 231, 231, 0.1)',
            paddingBottom: '2px',
            transition: 'color 200ms ease, border-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#C4956A'
            e.currentTarget.style.borderColor = '#C4956A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(231, 231, 231, 0.35)'
            e.currentTarget.style.borderColor = 'rgba(231, 231, 231, 0.1)'
          }}
        >
          GitHub
        </a>
        <a
          href="/lab"
          className="font-mono"
          style={{
            fontSize: '0.6rem',
            color: 'rgba(231, 231, 231, 0.35)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(231, 231, 231, 0.1)',
            paddingBottom: '2px',
            transition: 'color 200ms ease, border-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#C4956A'
            e.currentTarget.style.borderColor = '#C4956A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(231, 231, 231, 0.35)'
            e.currentTarget.style.borderColor = 'rgba(231, 231, 231, 0.1)'
          }}
        >
          Enter Lab
        </a>
      </div>

      {/* Copyright / bottom spacer */}
      <p
        className="font-mono mt-8"
        style={{
          fontSize: '0.55rem',
          color: 'rgba(231, 231, 231, 0.15)',
          letterSpacing: '0.08em',
        }}
      >
        © 2026 STRIDE Project
      </p>
    </div>
  )
}
