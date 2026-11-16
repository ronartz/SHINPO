export function AuthWarpBackground() {
  return (
    <div className="auth-warp" aria-hidden="true">
      <div className="auth-warp__plane auth-warp__plane--top" />
      <div className="auth-warp__plane auth-warp__plane--right" />
      <div className="auth-warp__plane auth-warp__plane--bottom" />
      <div className="auth-warp__plane auth-warp__plane--left" />
      {Array.from({ length: 8 }, (_, index) => (
        <span className={`auth-warp__beam auth-warp__beam--${index + 1}`} key={index} />
      ))}
    </div>
  )
}
