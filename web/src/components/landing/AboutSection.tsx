/**
 * AboutSection — Section 3 HTML overlay: split layout.
 *
 * Left 50%: empty (3D wireframe human visible through canvas)
 * Right 50%: text about the STRIDE project with parallax entry.
 *
 * The human model slides to the left via sceneState.humanX,
 * driven by GSAP ScrollTrigger in useScrollTimeline.
 */

export default function AboutSection() {
  return (
    <div
      className="flex items-center"
      style={{
        minHeight: '100vh',
        padding: '4rem 2rem',
      }}
    >
      {/* Left spacer — 3D human visible through canvas */}
      <div className="hidden md:block" style={{ width: '40%', flexShrink: 0 }} />

      {/* Right text panel */}
      <div
        className="w-full md:w-[60%] max-w-2xl mx-auto md:mx-0"
        style={{ padding: '2rem' }}
      >
        {/* Section label */}
        <p
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'rgba(231, 231, 231, 0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          About the Project
        </p>

        {/* Heading */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight: 400,
            color: '#E7E7E7',
            letterSpacing: '0.05em',
            lineHeight: 1.2,
            marginBottom: '1.5rem',
          }}
        >
          Teaching Machines
          <br />
          to Walk
        </h2>

        {/* Description paragraphs */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: 'rgba(231, 231, 231, 0.65)',
            fontSize: '0.88rem',
            lineHeight: 1.7,
          }}
        >
          <p>
            STRIDE uses genetic algorithms to evolve 2D bipedal walkers from
            scratch. Starting with random joint parameters, a population of
            creatures is iteratively selected, crossed over, and mutated —
            mirroring Darwinian evolution.
          </p>
          <p>
            Each creature has 6 motorized joints and 2 passive spring elbows,
            controlled by 18 optimisable genes. Over generations, the GA
            discovers coordinated limb movement, phase offsets between legs,
            and counter-swinging arms — the fundamental mechanics of walking.
          </p>
        </div>

        {/* Stats row */}
        <div
          className="flex gap-8 mt-8 font-mono"
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <div>
            <span style={{ color: '#C4956A', fontSize: '1.2rem', fontWeight: 500 }}>
              18
            </span>
            <br />
            <span style={{ color: 'rgba(231, 231, 231, 0.4)' }}>Genes</span>
          </div>
          <div>
            <span style={{ color: '#C4956A', fontSize: '1.2rem', fontWeight: 500 }}>
              6
            </span>
            <br />
            <span style={{ color: 'rgba(231, 231, 231, 0.4)' }}>Motors</span>
          </div>
          <div>
            <span style={{ color: '#C4956A', fontSize: '1.2rem', fontWeight: 500 }}>
              30
            </span>
            <br />
            <span style={{ color: 'rgba(231, 231, 231, 0.4)' }}>Runs each</span>
          </div>
          <div>
            <span style={{ color: '#C4956A', fontSize: '1.2rem', fontWeight: 500 }}>
              17
            </span>
            <br />
            <span style={{ color: 'rgba(231, 231, 231, 0.4)' }}>Configs</span>
          </div>
        </div>
      </div>
    </div>
  )
}
