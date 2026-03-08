import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useTestRuns() {
  return useQuery({
    queryKey: [api.testRuns.list.path],
    queryFn: async () => {
      const res = await fetch(api.testRuns.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch test runs");
      return api.testRuns.list.responses[200].parse(await res.json());
    },
  });
}

export function useTestRun(id: number) {
  return useQuery({
    queryKey: [api.testRuns.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.testRuns.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch test run");
      return api.testRuns.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.testRuns.create.input>) => {
      const res = await fetch(api.testRuns.create.path, {
        method: api.testRuns.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create test run");
      return api.testRuns.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.testRuns.list.path] });
    },
  });
}
