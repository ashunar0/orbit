import { useCallback, useState } from "react"
import { useQueryClient } from "./provider"
import type { MutationOptions } from "./types"

export function useMutation<TInput, TOutput>(options: MutationOptions<TInput, TOutput>) {
  const client = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setIsSubmitting(true)
      setError(null)

      try {
        const data = await options.fn(input)

        if (options.onSuccess) {
          options.onSuccess(data)
        }

        if (options.invalidate) {
          client.invalidate(options.invalidate)
        }

        return data
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setIsSubmitting(false)
      }
    },
    [client, options.fn, options.invalidate, options.onSuccess],
  )

  return { mutate, isSubmitting, error }
}
