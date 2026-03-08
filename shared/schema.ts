import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const testRuns = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(), // 'running', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transitions = pgTable("transitions", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull(),
  fromState: text("from_state").notNull(),
  event: text("event").notNull(),
  toState: text("to_state").notNull(),
  isValid: boolean("is_valid").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const violations = pgTable("violations", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull(),
  circuitId: text("circuit_id").notNull(),
  fromState: text("from_state").notNull(),
  event: text("event").notNull(),
  attemptedState: text("attempted_state"),
  severity: text("severity").notNull(),
  attackType: text("attack_type").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertTestRunSchema = createInsertSchema(testRuns).omit({ id: true, createdAt: true });
export const insertTransitionSchema = createInsertSchema(transitions).omit({ id: true, timestamp: true });
export const insertViolationSchema = createInsertSchema(violations).omit({ id: true, timestamp: true });

export type TestRun = typeof testRuns.$inferSelect;
export type InsertTestRun = z.infer<typeof insertTestRunSchema>;

export type Transition = typeof transitions.$inferSelect;
export type InsertTransition = z.infer<typeof insertTransitionSchema>;

export type Violation = typeof violations.$inferSelect;
export type InsertViolation = z.infer<typeof insertViolationSchema>;
