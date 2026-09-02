/* Payload Admin login-screen + nav brand mark. Kept intentionally plain (no next/image) so it
   renders identically inside Payload's own admin bundle. Sources the shared public brand asset. */
export function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/lockup.png"
      alt="InTourney"
      style={{ height: 90, width: 'auto' }}
    />
  )
}

export default Logo
