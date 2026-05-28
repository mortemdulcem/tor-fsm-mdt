import { z } from "zod";
import {
  insertTestRunSchema,
  testRuns,
  transitions,
  violations,
} from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  testRuns: {
    list: {
      method: "GET" as const,
      path: "/api/test-runs" as const,
      responses: { 200: z.array(z.custom<typeof testRuns.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/test-runs" as const,
      input: insertTestRunSchema,
      responses: {
        201: z.custom<typeof testRuns.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/test-runs/:id" as const,
      responses: {
        200: z.custom<typeof testRuns.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  transitions: {
    list: {
      method: "GET" as const,
      path: "/api/test-runs/:testRunId/transitions" as const,
      responses: { 200: z.array(z.custom<typeof transitions.$inferSelect>()) },
    },
  },
  violations: {
    list: {
      method: "GET" as const,
      path: "/api/test-runs/:testRunId/violations" as const,
      responses: { 200: z.array(z.custom<typeof violations.$inferSelect>()) },
    },
    listAll: {
      method: "GET" as const,
      path: "/api/violations" as const,
      responses: { 200: z.array(z.custom<typeof violations.$inferSelect>()) },
    },
  },
  fsm: {
    simulate: {
      method: "POST" as const,
      path: "/api/fsm/simulate" as const,
      input: z.object({ testRunId: z.number(), count: z.number().default(10) }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
    spec: {
      method: "GET" as const,
      path: "/api/fsm/spec" as const,
      responses: {
        200: z.object({
          states: z.array(z.string()),
          events: z.array(z.string()),
          validTransitions: z.array(
            z.object({ from: z.string(), event: z.string(), to: z.string() }),
          ),
          totalDomain: z.number(),
          totalValid: z.number(),
          totalInvalid: z.number(),
        }),
      },
    },
    mdt: {
      method: "POST" as const,
      path: "/api/fsm/mdt" as const,
      input: z.object({ testRunId: z.number() }),
      responses: {
        200: z.object({
          message: z.string(),
          metrics: z.object({
            stateCoverage: z.number(),
            transitionCoverage: z.number(),
            itdr: z.number(),
            fpr: z.number(),
            visitedStates: z.number(),
            totalStates: z.number(),
            coveredValidPairs: z.number(),
            totalValidPairs: z.number(),
            detectedInvalidPairs: z.number(),
            totalInvalidPairs: z.number(),
            durationMs: z.number(),
          }),
        }),
        400: errorSchemas.validation,
      },
    },
    metrics: {
      method: "GET" as const,
      path: "/api/test-runs/:id/metrics" as const,
      responses: {
        200: z.object({
          stateCoverage: z.number(),
          transitionCoverage: z.number(),
          itdr: z.number(),
          fpr: z.number(),
          visitedStates: z.number(),
          totalStates: z.number(),
          coveredValidPairs: z.number(),
          totalValidPairs: z.number(),
          detectedInvalidPairs: z.number(),
          totalInvalidPairs: z.number(),
          durationMs: z.number(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>,
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
