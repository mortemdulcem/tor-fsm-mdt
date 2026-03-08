import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useSimulateFsm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.fsm.simulate.input>) => {
      const res = await fetch(api.fsm.simulate.path, {
        method: api.fsm.simulate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Simulation failed");
      return api.fsm.simulate.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      // Invalidate specific test run data and all violations
      queryClient.invalidateQueries({ queryKey: [api.testRuns.get.path, variables.testRunId] });
      queryClient.invalidateQueries({ queryKey: [api.transitions.list.path, variables.testRunId] });
      queryClient.invalidateQueries({ queryKey: [api.violations.list.path, variables.testRunId] });
      queryClient.invalidateQueries({ queryKey: [api.testRuns.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.violations.listAll.path] });
    },
  });
}
