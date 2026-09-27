import { Link, useParams } from 'react-router-dom'
import { LifeNoteLoader } from '../components/LifeNoteLoader'
import { useTodo } from '../hooks/useTodos'

export function TodoDetailPage() {
  const { id } = useParams()
  const todoId = Number(id)
  const { data, isPending, isError, error } = useTodo(todoId)

  if (!Number.isFinite(todoId) || todoId <= 0) {
    return <p className="error">Invalid todo id.</p>
  }

  if (isPending) {
    return <LifeNoteLoader label="Loading todo…" />
  }

  if (isError) {
    return <p className="error">Error: {error.message}</p>
  }

  return (
    <section className="page">
      <p>
        <Link to="/todos">← Back to todos</Link>
      </p>
      <h2>Todo #{data.id}</h2>
      <p>{data.title}</p>
      <p>Status: {data.completed ? 'Completed' : 'Open'}</p>
    </section>
  )
}
