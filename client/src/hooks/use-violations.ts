import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useViolations(testRunId: number) {
  return useQuery({
    queryKey: [api.violations.list.path, testRunId],
    queryFn: async () => {
      const url = buildUrl(api.violations.list.path, { testRunId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch violations");
      return api.violations.list.responses[200].parse(await res.json());
    },
    enabled: !!testRunId,
  });
}

export function useAllViolations() {
  return useQuery({
    queryKey: [api.violations.listAll.path],
    queryFn: async () => {
      const res = await fetch(api.violations.listAll.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch all violations");
      return api.violations.listAll.responses[200].parse(await res.json());
    },
  });
}
