import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useTransitions(testRunId: number) {
  return useQuery({
    queryKey: [api.transitions.list.path, testRunId],
    queryFn: async () => {
      const url = buildUrl(api.transitions.list.path, { testRunId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transitions");
      return api.transitions.list.responses[200].parse(await res.json());
    },
    enabled: !!testRunId,
  });
}
