import { describe, expect, it } from 'vitest';
import { loadSchemaSql } from './db.js';

describe('database schema scaffold', () => {
  it('uses the Stage 2 room naming and core 1v1 invariants', async () => {
    const sql = await loadSchemaSql();

    expect(sql).toMatch(/create table if not exists rooms\s*\(\s*room_id text primary key/i);
    expect(sql).toMatch(/short_code text not null unique/i);
    expect(sql).toMatch(/revision integer not null default 0/i);
    expect(sql).toMatch(/role text not null check \(role in \('host', 'guest'\)\)/i);
    expect(sql).toMatch(/seat text check \(seat in \('red', 'black'\)\)/i);
    expect(sql).toMatch(/create unique index if not exists room_matches_one_active_per_room/i);
    expect(sql).toMatch(/where status = 'active'/i);
    expect(sql).toMatch(/create unique index if not exists room_participants_one_active_host_per_room/i);
    expect(sql).toMatch(/where role = 'host' and status = 'connected'/i);
    expect(sql).toMatch(/create unique index if not exists room_participants_one_active_seat_per_room/i);
    expect(sql).toMatch(/where status = 'connected' and seat in \('red', 'black'\)/i);
  });
});
