import { z } from 'zod'

export const TodoSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
})

export const TodosSchema = z.array(TodoSchema)

export type Todo = z.infer<typeof TodoSchema>
