import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="page">
      <h2>Vite + React + TypeScript</h2>
      <p>
        Boilerplate with TanStack Query, React Router, and Zod. Open{' '}
        <Link to="/todos">Todos</Link> to see them working together.
      </p>
    </section>
  )
}
