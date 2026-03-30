import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "./provider";
import type { MutationOptions } from "./types";

export function useMutation<TInput, TOutput>(options: MutationOptions<TInput, TOutput>) {
  const client = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fix #4: options を ref で保持し、mutate の deps を安定化
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput> => {
      const { fn, invalidate, onSuccess } = optionsRef.current;

      setIsSubmitting(true);
      setError(null);

      try {
        const data = await fn(input);

        if (onSuccess) {
          onSuccess(data);
        }

        if (invalidate) {
          for (const key of invalidate) {
            client.invalidate(Array.isArray(key) ? key : [key]);
          }
        }

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client],
  );

  return { mutate, isSubmitting, error };
}
