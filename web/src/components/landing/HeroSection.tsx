/**
 * HeroSection — Footer section (INK-style split layout).
 *
 * Clean white top section with oversized "STRIDE" title,
 * dark bottom section with the landing GIF.
 * No 3D content in this section — purely typographic.
 */

export default function HeroSection() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Light top section ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAFAFA',
          padding: '6rem 2rem 3rem',
          gap: '1rem',
        }}
      >
        {/* Main title — oversized, bold */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(5rem, 16vw, 13rem)',
            fontWeight: 500,
            color: '#1A1A1A',
            letterSpacing: '0.04em',
            lineHeight: 0.85,
            textAlign: 'center',
          }}
        >
          STRIDE
        </h1>

        {/* Subtitle */}
        <p
          className="font-mono"
          style={{
            fontSize: 'clamp(0.55rem, 0.9vw, 0.72rem)',
            color: 'rgba(26, 26, 26, 0.35)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
            maxWidth: '480px',
            marginTop: '0.5rem',
          }}
        >
          Evolving 2D Walkers Using Genetic Algorithms
        </p>
      </div>

      {/* ── Dark bottom section with GIF ── */}
      <div
        style={{
          backgroundColor: '#0A0A0A',
          padding: '2.5rem 2rem 3.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        {/* Landing GIF */}
        <div
          style={{
            width: 'min(560px, 85vw)',
            aspectRatio: '500 / 330',
            overflow: 'hidden',
            borderRadius: '2px',
            border: '1px solid rgba(231, 231, 231, 0.06)',
          }}
        >
          <img
            src="/landing_gif.gif"
            alt="Creature walking animation"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="eager"
          />
        </div>

        {/* Credit line */}
        <p
          className="font-mono"
          style={{
            fontSize: '0.5rem',
            color: 'rgba(231, 231, 231, 0.2)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Dev Krishna &middot; 2026
        </p>
      </div>
    </div>
  )
}
