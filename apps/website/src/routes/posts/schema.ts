import { z } from "zod"

export const postSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  body: z.string(),
})

export type PostInput = z.input<typeof postSchema>
