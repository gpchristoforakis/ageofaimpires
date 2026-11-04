const {DatabaseSync} = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
module.exports = () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(path.join(__dirname, '../migrations/0001-comments.sql'), 'utf8'));
  const db = {
    sql,
    prepare(query) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async all() { return {results: sql.prepare(query).all(...args)}; },
        async run() { return {meta: sql.prepare(query).run(...args)}; },
        execute() {
          if (/^SELECT/i.test(query)) return {results: sql.prepare(query).all(...args)};
          return {results: [], meta: sql.prepare(query).run(...args)};
        },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
};
