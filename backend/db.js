/**
 * Database initialization and management
 * SQLite database for storing GRs, alerts, and references
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db = null;

/**
 * Initialize database
 */
export async function initDB(dbPath = './backend/data/maharashtra-gr.db') {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA journal_mode = WAL');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS grs (
      id TEXT PRIMARY KEY,
      department TEXT NOT NULL,
      gr_number TEXT,
      subject TEXT,
      date TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      content_json TEXT NOT NULL,
      created_by TEXT,
      approved_by TEXT,
      rejected_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS gr_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gr_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      source_gr_id TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gr_id) REFERENCES grs(id)
    );

    CREATE TABLE IF NOT EXISTS gr_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gr_id TEXT NOT NULL,
      referenced_gr_id TEXT,
      reference_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gr_id) REFERENCES grs(id)
    );

    CREATE TABLE IF NOT EXISTS gr_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gr_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gr_id) REFERENCES grs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_grs_department ON grs(department);
    CREATE INDEX IF NOT EXISTS idx_grs_status ON grs(status);
    CREATE INDEX IF NOT EXISTS idx_grs_date ON grs(date);
    CREATE INDEX IF NOT EXISTS idx_alerts_gr_id ON gr_alerts(gr_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON gr_alerts(severity);
  `);

  // Safely alter existing table to add source_gr_id column if it doesn't exist
  try {
    await db.exec('ALTER TABLE gr_alerts ADD COLUMN source_gr_id TEXT');
  } catch {
    // Ignore error if column already exists
  }

  return db;
}

/**
 * Save a GR to database
 */
export async function saveGR(gr, userId) {
  const db_instance = await initDB();

  await db_instance.run(
    `INSERT OR REPLACE INTO grs (id, department, gr_number, subject, date, status, content_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gr.id,
      gr.department,
      gr.metadata?.grNumber,
      gr.metadata?.subject,
      gr.metadata?.date,
      gr.status || 'draft',
      JSON.stringify(gr),
      userId,
    ]
  );

  return gr.id;
}

/**
 * Get GR from database
 */
export async function getGR(grId) {
  const db_instance = await initDB();

  const row = await db_instance.get('SELECT content_json, status, created_by, approved_by FROM grs WHERE id = ?', [grId]);

  if (!row) return null;
  try {
    const gr = JSON.parse(row.content_json);
    gr.status = row.status;
    gr.created_by = row.created_by;
    gr.approved_by = row.approved_by;
    return gr;
  } catch (e) {
    console.error('Failed to parse GR JSON content:', e);
    return null;
  }
}

/**
 * Save alerts
 */
export async function saveAlerts(grId, alerts) {
  const db_instance = await initDB();

  // Clear existing alerts for this GR to avoid duplicates
  await db_instance.run('DELETE FROM gr_alerts WHERE gr_id = ?', [grId]);

  for (const alert of alerts) {
    await db_instance.run(
      `INSERT INTO gr_alerts (gr_id, severity, category, title, description, source_gr_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [grId, alert.severity, alert.category, alert.title, alert.description, alert.sourceGrId || null]
    );
  }
}

/**
 * Get alerts for a GR
 */
export async function getAlerts(grId) {
  const db_instance = await initDB();

  const rows = await db_instance.all(
    'SELECT * FROM gr_alerts WHERE gr_id = ? AND resolved = 0 ORDER BY severity DESC',
    [grId]
  );

  return rows.map(row => ({
    id: row.id,
    grId: row.gr_id,
    severity: row.severity,
    category: row.category,
    title: row.title,
    description: row.description,
    sourceGrId: row.source_gr_id,
    resolved: row.resolved,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at
  }));
}

/**
 * Update GR status
 */
export async function updateGRStatus(grId, status, userId, reason = null) {
  const db_instance = await initDB();

  // Load current content_json first to update the status inside it
  const row = await db_instance.get('SELECT content_json FROM grs WHERE id = ?', [grId]);
  if (row) {
    try {
      const gr = JSON.parse(row.content_json);
      gr.status = status;
      if (status === 'approved') {
        gr.approved_by = userId;
      } else if (status === 'rejected') {
        gr.rejectedReason = reason;
      }
      await db_instance.run(
        `UPDATE grs SET status = ?, content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, JSON.stringify(gr), grId]
      );
    } catch (e) {
      console.error('Failed to parse and update content_json in updateGRStatus:', e);
      await db_instance.run(
        `UPDATE grs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, grId]
      );
    }
  } else {
    await db_instance.run(
      `UPDATE grs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, grId]
    );
  }

  if (status === 'approved') {
    await db_instance.run(
      `UPDATE grs SET approved_by = ? WHERE id = ?`,
      [userId, grId]
    );
  } else if (status === 'rejected') {
    await db_instance.run(
      `UPDATE grs SET rejected_reason = ? WHERE id = ?`,
      [reason, grId]
    );
  }

  await db_instance.run(
    `INSERT INTO gr_history (gr_id, action, actor, comment)
     VALUES (?, ?, ?, ?)`,
    [grId, status, userId, reason]
  );
}

/**
 * Get all GRs (with filtering)
 */
export async function getAllGRs(filters = {}) {
  const db_instance = await initDB();

  let query = 'SELECT * FROM grs WHERE 1=1';
  const params = [];

  if (filters.department) {
    query += ' AND department = ?';
    params.push(filters.department);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.createdBy) {
    query += ' AND created_by = ?';
    params.push(filters.createdBy);
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const rows = await db_instance.all(query, params);

  return rows.map(row => ({
    ...JSON.parse(row.content_json),
    status: row.status,
    created_by: row.created_by,
    approved_by: row.approved_by,
    created_at: row.created_at,
  }));
}

/**
 * Save references for a GR
 */
export async function saveReferences(grId, references) {
  const db_instance = await initDB();

  // Clear existing references for this GR to avoid duplicates
  await db_instance.run('DELETE FROM gr_references WHERE gr_id = ?', [grId]);

  if (!references || references.length === 0) return;

  for (const ref of references) {
    await db_instance.run(
      `INSERT INTO gr_references (gr_id, referenced_gr_id, reference_text)
       VALUES (?, ?, ?)`,
      [grId, ref.sourceGrId || null, ref.sourceText || ref.grNumber]
    );
  }
}

/**
 * Get references for a GR
 */
export async function getReferences(grId) {
  const db_instance = await initDB();
  const rows = await db_instance.all(
    'SELECT * FROM gr_references WHERE gr_id = ?',
    [grId]
  );
  return rows.map(row => ({
    id: row.id,
    grId: row.gr_id,
    referencedGrId: row.referenced_gr_id,
    referenceText: row.reference_text
  }));
}

export { db };

