import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLogout, useSession } from '../hooks/useAuth'

export function Layout() {
  const navigate = useNavigate()
  const { data: user, isPending } = useSession()
  const logout = useLogout()

  function handleSignOut() {
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login'),
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="brand">Life Note</h1>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/todos">Todos</NavLink>
          {isPending ? null : user ? (
            <>
              <span className="nav-user">{user.name ?? user.email}</span>
              <button type="button" className="nav-signout" onClick={handleSignOut} disabled={logout.isPending}>
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
