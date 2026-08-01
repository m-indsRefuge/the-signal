import migration from "../migrations/0001_intelligence_memory_fabric.sql?raw";
import d1Source from "../app/platform/intelligence-memory/d1/d1-memory-repository.ts?raw";
import { describe, expect, it } from "vitest";
import {
  D1MemoryRepository,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type D1ResultLike,
} from "../app/platform/intelligence-memory/d1/d1-memory-repository";

class Statement implements D1PreparedStatementLike {
  readonly sql: string;
  values: readonly unknown[] = [];
  constructor(sql: string) {
    this.sql = sql;
  }
  bind(...values: readonly never[]) {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async run<T>(): Promise<D1ResultLike<T>> {
    return { success: true, results: [] };
  }
  async all<T>(): Promise<D1ResultLike<T>> {
    return { success: true, results: [] };
  }
}
class Database implements D1DatabaseLike {
  readonly statements: Statement[] = [];
  prepare(sql: string) {
    const statement = new Statement(sql);
    this.statements.push(statement);
    return statement;
  }
  async batch<T>(
    statements: readonly D1PreparedStatementLike[],
  ): Promise<readonly D1ResultLike<T>[]> {
    return statements.map(() => ({ success: true, results: [] }));
  }
}

describe("KTS-I4-D D1 repository and migration", () => {
  for (const table of [
    "ih_evidence_records",
    "ih_evidence_relations",
    "ih_memory_records",
    "ih_memory_evidence",
    "ih_memory_relations",
  ])
    it(`creates table ${table}`, () => expect(migration).toContain(`CREATE TABLE ${table}`));
  for (const table of [
    "ih_evidence_records",
    "ih_evidence_relations",
    "ih_memory_records",
    "ih_memory_evidence",
    "ih_memory_relations",
  ])
    it(`protects ${table} from update`, () =>
      expect(migration).toContain(`BEFORE UPDATE ON ${table}`));
  for (const table of [
    "ih_evidence_records",
    "ih_evidence_relations",
    "ih_memory_records",
    "ih_memory_evidence",
    "ih_memory_relations",
  ])
    it(`protects ${table} from delete`, () =>
      expect(migration).toContain(`BEFORE DELETE ON ${table}`));
  it("contains no destructive drop statement", () =>
    expect(migration).not.toMatch(/DROP\s+TABLE/i));
  it("defines foreign keys", () => expect(migration).toContain("REFERENCES ih_evidence_records"));
  it("indexes authoritative ticks", () =>
    expect(migration).toContain("ih_evidence_domain_tick_idx"));
  it("indexes contradictions through relation types", () =>
    expect(migration).toContain("ih_evidence_relation_source_idx"));
  it("uses text public identities", () =>
    expect(migration).toContain("evidence_id TEXT PRIMARY KEY"));
  it("does not use autoincrement", () => expect(migration).not.toMatch(/AUTOINCREMENT/i));
  it("requires injected database", () =>
    expect(() => new D1MemoryRepository({} as never)).toThrow());
  it("accepts a D1-compatible injected database", () =>
    expect(new D1MemoryRepository(new Database())).toBeInstanceOf(D1MemoryRepository));
  it("uses prepared statements", () => expect(d1Source).toContain(".prepare("));
  it("uses bound parameters", () => expect(d1Source).toContain(".bind("));
  it("uses D1 batch semantics", () => expect(d1Source).toContain(".batch("));
  it("contains no global env binding", () => expect(d1Source).not.toMatch(/\benv\.[A-Z_]+/));
  it("contains no network API", () =>
    expect(d1Source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/));
  it("contains no payload logger", () =>
    expect(d1Source).not.toMatch(/console\.(log|info|debug|warn|error)/));
  it("contains no update repository method", () =>
    expect(d1Source).not.toContain("updateEvidence("));
  it("contains no delete repository method", () =>
    expect(d1Source).not.toContain("deleteEvidence("));
  it("does not import Wrangler configuration", () => expect(d1Source).not.toContain("wrangler"));
});
