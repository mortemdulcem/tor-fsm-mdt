import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useFsmSpec() {
  return useQuery({
    queryKey: [api.fsm.spec.path],
    queryFn: async () => {
      const res = await fetch(api.fsm.spec.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch FSM spec");
      return api.fsm.spec.responses[200].parse(await res.json());
    },
  });
}

export function useRunMetrics(id: number | null) {
  return useQuery({
    queryKey: [api.fsm.metrics.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.fsm.metrics.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return api.fsm.metrics.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useRunMdt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (testRunId: number) => {
      const res = await fetch(api.fsm.mdt.path, {
        method: api.fsm.mdt.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testRunId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to run MDT");
      return api.fsm.mdt.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.testRuns.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.violations.listAll.path] });
      queryClient.invalidateQueries({ queryKey: [api.fsm.metrics.path] });
    },
  });
}
