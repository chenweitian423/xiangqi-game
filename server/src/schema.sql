create table if not exists rooms (
  room_id text primary key,
  short_code text not null unique,
  revision integer not null default 0,
  status text not null check (status in ('waiting', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_participants (
  participant_id text primary key,
  room_id text not null references rooms(room_id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('host', 'guest')),
  seat text check (seat in ('red', 'black')),
  status text not null check (status in ('connected', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create table if not exists room_matches (
  match_id text primary key,
  room_id text not null references rooms(room_id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'finished', 'aborted')),
  opening_seat text not null check (opening_seat in ('red', 'black')),
  winner_seat text check (winner_seat in ('red', 'black')),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists room_moves (
  move_id text primary key,
  match_id text not null references room_matches(match_id) on delete cascade,
  move_index integer not null,
  seat text not null check (seat in ('red', 'black')),
  piece_id text not null,
  from_row smallint not null,
  from_col smallint not null,
  to_row smallint not null,
  to_col smallint not null,
  notation text not null,
  created_at timestamptz not null default now(),
  unique (match_id, move_index)
);

create table if not exists room_messages (
  message_id text primary key,
  room_id text not null references rooms(room_id) on delete cascade,
  participant_id text references room_participants(participant_id) on delete set null,
  body text not null,
  status text not null check (status in ('sent')),
  created_at timestamptz not null default now()
);

create unique index if not exists room_matches_one_active_per_room
  on room_matches (room_id)
  where status = 'active';

create unique index if not exists room_participants_one_active_host_per_room
  on room_participants (room_id)
  where role = 'host' and status = 'connected';

create unique index if not exists room_participants_one_active_seat_per_room
  on room_participants (room_id, seat)
  where status = 'connected' and seat in ('red', 'black');
