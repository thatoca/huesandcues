-- Run this migration in the Supabase SQL editor before deploying the app.
alter table public.rooms
  add column if not exists second_clue_text text,
  add column if not exists round_phase text not null default 'selecting'
    check (round_phase in ('selecting', 'first_guess', 'second_clue', 'second_guess'));

alter table public.guesses
  add column if not exists marker smallint not null default 1
    check (marker in (1, 2));

-- A player can have one pawn for each phase, and both pawns may coexist.
alter table public.guesses drop constraint if exists guesses_room_id_round_player_id_key;
alter table public.guesses
  add constraint guesses_room_round_player_marker_key unique (room_id, round, player_id, marker);
