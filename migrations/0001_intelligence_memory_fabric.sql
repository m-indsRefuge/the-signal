PRAGMA defer_foreign_keys = ON;

CREATE TABLE ih_evidence_records (
  evidence_id TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK(length(content_digest)=64 AND content_digest=lower(content_digest)),
  domain_id TEXT NOT NULL,
  domain_version TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_schema_id TEXT NOT NULL,
  source_schema_version INTEGER NOT NULL CHECK(source_schema_version>=1),
  source_identity TEXT NOT NULL,
  authoritative_position_json TEXT NOT NULL,
  authoritative_tick INTEGER,
  acceptance_state TEXT NOT NULL,
  classification TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE ih_evidence_relations (
  relation_id TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  source_evidence_id TEXT NOT NULL REFERENCES ih_evidence_records(evidence_id),
  target_evidence_id TEXT NOT NULL REFERENCES ih_evidence_records(evidence_id),
  recorded_at TEXT NOT NULL,
  CHECK(source_evidence_id <> target_evidence_id)
);

CREATE TABLE ih_memory_records (
  memory_id TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK(length(content_digest)=64 AND content_digest=lower(content_digest)),
  memory_kind TEXT NOT NULL CHECK(memory_kind='episodic'),
  domain_id TEXT NOT NULL,
  domain_version TEXT NOT NULL,
  significance TEXT NOT NULL,
  acceptance_state TEXT NOT NULL,
  classification TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE ih_memory_evidence (
  attachment_id TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  memory_id TEXT NOT NULL REFERENCES ih_memory_records(memory_id),
  evidence_id TEXT NOT NULL REFERENCES ih_evidence_records(evidence_id),
  role TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence>=0),
  UNIQUE(memory_id, evidence_id, role)
);

CREATE TABLE ih_memory_relations (
  relation_id TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  source_memory_id TEXT NOT NULL REFERENCES ih_memory_records(memory_id),
  target_memory_id TEXT NOT NULL REFERENCES ih_memory_records(memory_id),
  recorded_at TEXT NOT NULL,
  CHECK(source_memory_id <> target_memory_id)
);

CREATE INDEX ih_evidence_domain_time_idx ON ih_evidence_records(domain_id, recorded_at DESC, evidence_id);
CREATE INDEX ih_evidence_domain_tick_idx ON ih_evidence_records(domain_id, authoritative_tick DESC, evidence_id);
CREATE INDEX ih_evidence_type_idx ON ih_evidence_records(source_type, acceptance_state, classification, retention_class);
CREATE INDEX ih_evidence_source_idx ON ih_evidence_records(source_schema_id, source_identity);
CREATE INDEX ih_evidence_relation_source_idx ON ih_evidence_relations(source_evidence_id, relation_type, recorded_at);
CREATE INDEX ih_evidence_relation_target_idx ON ih_evidence_relations(target_evidence_id, relation_type, recorded_at);
CREATE INDEX ih_memory_domain_time_idx ON ih_memory_records(domain_id, recorded_at DESC, memory_id);
CREATE INDEX ih_memory_type_idx ON ih_memory_records(memory_kind, significance, acceptance_state, classification, retention_class);
CREATE INDEX ih_memory_evidence_memory_idx ON ih_memory_evidence(memory_id, role, sequence, attachment_id);
CREATE INDEX ih_memory_evidence_evidence_idx ON ih_memory_evidence(evidence_id, role, memory_id);
CREATE INDEX ih_memory_relation_source_idx ON ih_memory_relations(source_memory_id, relation_type, recorded_at);
CREATE INDEX ih_memory_relation_target_idx ON ih_memory_relations(target_memory_id, relation_type, recorded_at);

CREATE TRIGGER ih_evidence_records_no_update BEFORE UPDATE ON ih_evidence_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_evidence_records_no_delete BEFORE DELETE ON ih_evidence_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_evidence_relations_no_update BEFORE UPDATE ON ih_evidence_relations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_evidence_relations_no_delete BEFORE DELETE ON ih_evidence_relations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_records_no_update BEFORE UPDATE ON ih_memory_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_records_no_delete BEFORE DELETE ON ih_memory_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_evidence_no_update BEFORE UPDATE ON ih_memory_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_evidence_no_delete BEFORE DELETE ON ih_memory_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_relations_no_update BEFORE UPDATE ON ih_memory_relations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER ih_memory_relations_no_delete BEFORE DELETE ON ih_memory_relations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
