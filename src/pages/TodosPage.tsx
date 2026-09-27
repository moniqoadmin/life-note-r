import { Link } from 'react-router-dom'
import { LifeNoteLoader } from '../components/LifeNoteLoader'
import { useTodos } from '../hooks/useTodos'

export function TodosPage() {
  const { data, isPending, isError, error } = useTodos()

  if (isPending) {
    return <LifeNoteLoader label="Loading todos…" />
  }

  if (isError) {
    return <p className="error">Error: {error.message}</p>
  }

  return (
    <section className="page">
      <h2>Todos</h2>
      <ul className="todo-list">
        {data.map((todo) => (
          <li key={todo.id}>
            <Link to={`/todos/${todo.id}`}>
              <span className={todo.completed ? 'done' : undefined}>
                {todo.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
