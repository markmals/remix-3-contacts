import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type { Contact } from "./contacts.ts";

type Row = Record<string, SQLOutputValue>;

export function createStore(db: DatabaseSync) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id        INTEGER PRIMARY KEY,
      first     TEXT NOT NULL DEFAULT '',
      last      TEXT NOT NULL DEFAULT '',
      avatar    TEXT NOT NULL DEFAULT '',
      bsky      TEXT NOT NULL DEFAULT '',
      notes     TEXT NOT NULL DEFAULT '',
      favorite  INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_last_createdAt
      ON contacts (last, createdAt);
  `);

    function toContact(r: Row): Contact {
        return {
            id: String(r.id),
            first: (r.first ?? "") as string,
            last: (r.last ?? "") as string,
            avatar: (r.avatar ?? "") as string,
            bsky: (r.bsky ?? "") as string,
            notes: (r.notes ?? "") as string,
            favorite: !!r.favorite,
            createdAt: new Date(r.createdAt as string | number),
        };
    }

    function toSQL(v: unknown): SQLInputValue {
        if (v === null) return null;
        if (typeof v === "string") return v;
        if (typeof v === "number") return v;
        if (typeof v === "bigint") return v;
        if (v instanceof Uint8Array) return v;
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "boolean") return v ? 1 : 0;
        throw new TypeError(`Unsupported SQL value: ${String(v)}`);
    }

    const selectAll = db.prepare("SELECT * FROM contacts");
    const selectById = db.prepare("SELECT * FROM contacts WHERE id = ?");
    const insertDefault = db.prepare("INSERT INTO contacts DEFAULT VALUES");
    const insertSeed = db.prepare(`
      INSERT INTO contacts (first, last, avatar, bsky)
      VALUES (?, ?, ?, ?)
    `);
    const delById = db.prepare("DELETE FROM contacts WHERE id = ?");

    return {
        all(): Contact[] {
            return (selectAll.all() as Row[]).map(toContact);
        },

        get(id: string): Contact | null {
            const row = selectById.get(Number(id)) as Row | undefined;
            return row ? toContact(row) : null;
        },

        // Creates a blank contact, letting SQLite generate id + createdAt
        insert(): Contact {
            const result = insertDefault.run();
            const id = Number(result.lastInsertRowid);
            const row = selectById.get(id) as Row | undefined;
            if (!row) throw new Error("Insert succeeded but row could not be read back");
            return toContact(row);
        },

        // Used by seeding
        insertSeed(c: { first: string; last: string; avatar: string; bsky: string }): Contact {
            const result = insertSeed.run(c.first, c.last, c.avatar, c.bsky);
            const id = Number(result.lastInsertRowid);
            const row = selectById.get(id) as Row | undefined;
            if (!row) throw new Error("Seed insert succeeded but row could not be read back");
            return toContact(row);
        },

        update(id: string, patch: Partial<Contact>): Contact | null {
            // Never allow id/createdAt to be updated via patch
            const { id: _id, createdAt: _createdAt, ...rest } = patch;

            const entries = Object.entries(rest).filter(([, v]) => v !== undefined);
            if (entries.length === 0) return this.get(id);

            const cols = entries.map(([k]) => `${k} = ?`).join(", ");
            const vals = entries.map(([, v]) => toSQL(v));

            db.prepare(`UPDATE contacts SET ${cols} WHERE id = ?`).run(...vals, Number(id));
            return this.get(id);
        },

        delete(id: string): true {
            delById.run(Number(id));
            return true;
        },

        clear(): void {
            db.exec("DELETE FROM contacts");
        },
    };
}
