import { TodoSchema, TodosSchema, type Todo } from '../schemas/todo'

const BASE_URL = 'https://jsonplaceholder.typicode.com'

export async function fetchTodos(): Promise<Todo[]> {
  const response = await fetch(`${BASE_URL}/todos?_limit=10`)

  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.status}`)
  }

  const data: unknown = await response.json()
  return TodosSchema.parse(data)
}

export async function fetchTodoById(id: number): Promise<Todo> {
  const response = await fetch(`${BASE_URL}/todos/${id}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch todo ${id}: ${response.status}`)
  }

  const data: unknown = await response.json()
  return TodoSchema.parse(data)
}
