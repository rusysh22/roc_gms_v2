const foundationItems = [
  'Next.js app shell',
  'Payload CMS admin',
  'PostgreSQL adapter',
  'Docker Compose services',
  'Admin auth and roles',
  'Site config collection',
  'Seed command structure',
]

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="status-panel" aria-labelledby="page-title">
        <p className="eyebrow">Phase 0 Foundation</p>
        <h1 id="page-title">ROC Game Management System V2</h1>
        <p className="summary">
          The project foundation is ready for local development. Payload Admin is available
          as the backoffice base while custom operational workspaces are planned for later phases.
        </p>

        <div className="status-grid" aria-label="Foundation status">
          {foundationItems.map((item) => (
            <div className="status-item" key={item}>
              <span aria-hidden="true" />
              <p>{item}</p>
            </div>
          ))}
        </div>

        <div className="actions">
          <a href="/admin">Open Admin</a>
          <a href="/schedule">Public Schedule</a>
          <a href="/scheduler/queue">Match Queue</a>
          <a href="/api/health">Health Check</a>
        </div>
      </section>
    </main>
  )
}
