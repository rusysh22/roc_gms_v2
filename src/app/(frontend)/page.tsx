const foundationItems = [
  'Next.js app shell',
  'Payload CMS admin',
  'PostgreSQL adapter',
  'Docker Compose services',
  'Admin auth and roles',
  'Event structure collections',
  'Scheduling foundations',
  'Operational workspace shells',
]

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="status-panel" aria-labelledby="page-title">
        <p className="eyebrow">ROC GMS Foundation</p>
        <h1 id="page-title">ROC Game Management System V2</h1>
        <p className="summary">
          The project foundation now has custom operational workspaces for event setup,
          scheduling, match-day officers, and content operations. Payload Admin remains available
          as the backoffice fallback.
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
          <a href="/workspaces/event-admin">Event Admin</a>
          <a href="/workspaces/scheduler">Scheduler</a>
          <a href="/workspaces/match-officer">Match Officer</a>
          <a href="/workspaces/content-admin">Content Admin</a>
          <a href="/schedule">Public Schedule</a>
          <a href="/standings">Public Standings</a>
          <a href="/admin">Backoffice</a>
          <a href="/api/health">Health Check</a>
        </div>
      </section>
    </main>
  )
}
