import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../hooks/useAuth'
import { postLoginPath } from '../../lib/authRedirect'
import { LifeNoteLoader } from '../LifeNoteLoader'
import './auth.css'

function SessionCheckFailed({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="session-error">
      <h1>Can't reach Life Note</h1>
      <p>{error.message} Your session wasn't touched — this is usually the server restarting.</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  )
}

/**
 * Renders its routes only for a signed-in user. Signed-out visitors go to /login
 * (remembering where they were headed); a failed session check shows a retry screen
 * instead of logging anyone out.
 */
export function RequireAuth() {
  const location = useLocation()
  const { data: user, isPending, error, refetch, isFetching } = useSession()

  if (isPending || (isFetching && !user)) return <LifeNoteLoader size="lg" fullscreen />
  if (error && user === undefined) return <SessionCheckFailed error={error} retry={() => refetch()} />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Login / sign-up pages: a signed-in user is sent on to the app instead. */
export function PublicOnly() {
  const location = useLocation()
  const { data: user, isPending } = useSession()

  if (isPending) return <LifeNoteLoader size="lg" fullscreen />
  if (user) return <Navigate to={postLoginPath(location.state)} replace />
  return <Outlet />
}
