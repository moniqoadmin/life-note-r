import { useQuery } from '@tanstack/react-query'
import { fetchTodoById, fetchTodos } from '../api/todos'

export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  detail: (id: number) => [...todoKeys.all, 'detail', id] as const,
}

export function useTodos() {
  return useQuery({
    queryKey: todoKeys.lists(),
    queryFn: fetchTodos,
  })
}

export function useTodo(id: number) {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => fetchTodoById(id),
    enabled: Number.isFinite(id) && id > 0,
  })
}
