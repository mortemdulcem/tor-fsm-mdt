import { db } from "./db";
import {
  testRuns,
  transitions,
  violations,
  type TestRun,
  type InsertTestRun,
  type Transition,
  type InsertTransition,
  type Violation,
  type InsertViolation,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getTestRuns(): Promise<TestRun[]>;
  getTestRun(id: number): Promise<TestRun | undefined>;
  createTestRun(testRun: InsertTestRun): Promise<TestRun>;
  updateTestRunStatus(id: number, status: string): Promise<void>;

  getTransitionsByTestRun(testRunId: number): Promise<Transition[]>;
  createTransition(transition: InsertTransition): Promise<Transition>;

  getViolationsByTestRun(testRunId: number): Promise<Violation[]>;
  getAllViolations(): Promise<Violation[]>;
  createViolation(violation: InsertViolation): Promise<Violation>;
}

export class DatabaseStorage implements IStorage {
  async getTestRuns(): Promise<TestRun[]> {
    return await db.select().from(testRuns).orderBy(desc(testRuns.createdAt));
  }

  async getTestRun(id: number): Promise<TestRun | undefined> {
    const [run] = await db.select().from(testRuns).where(eq(testRuns.id, id));
    return run;
  }

  async createTestRun(testRun: InsertTestRun): Promise<TestRun> {
    const [run] = await db.insert(testRuns).values(testRun).returning();
    return run;
  }

  async updateTestRunStatus(id: number, status: string): Promise<void> {
    await db.update(testRuns).set({ status }).where(eq(testRuns.id, id));
  }

  async getTransitionsByTestRun(testRunId: number): Promise<Transition[]> {
    return await db
      .select()
      .from(transitions)
      .where(eq(transitions.testRunId, testRunId))
      .orderBy(desc(transitions.timestamp));
  }

  async createTransition(transition: InsertTransition): Promise<Transition> {
    const [t] = await db.insert(transitions).values(transition).returning();
    return t;
  }

  async getViolationsByTestRun(testRunId: number): Promise<Violation[]> {
    return await db
      .select()
      .from(violations)
      .where(eq(violations.testRunId, testRunId))
      .orderBy(desc(violations.timestamp));
  }

  async getAllViolations(): Promise<Violation[]> {
    return await db
      .select()
      .from(violations)
      .orderBy(desc(violations.timestamp));
  }

  async createViolation(violation: InsertViolation): Promise<Violation> {
    const [v] = await db.insert(violations).values(violation).returning();
    return v;
  }
}

export const storage = new DatabaseStorage();
