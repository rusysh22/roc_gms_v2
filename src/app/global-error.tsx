'use client'

// Last-resort boundary for errors thrown by a root layout itself (src/app/(frontend)/layout.tsx
// or src/app/(payload)/layout.tsx) - since it replaces the root layout entirely, it renders its
// own <html>/<body> and deliberately avoids depending on the app's normal Tailwind pipeline (this
// path exists precisely for when something upstream of that pipeline broke).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100svh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Something went wrong</h1>
        <p style={{ fontSize: '0.875rem', color: '#41564f', maxWidth: '28rem' }}>
          The application failed to load. Retrying usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            borderRadius: '9999px',
            border: 0,
            background: '#118653',
            color: '#fff',
            padding: '0.625rem 1.5rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
