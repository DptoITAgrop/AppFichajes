-- Add card_id field to profiles table for card reader integration
alter table public.profiles
add column if not exists card_id text unique;

-- Create index for faster card lookups
create index if not exists profiles_card_id_idx on public.profiles(card_id);

-- Add comment
comment on column public.profiles.card_id is 'Unique card ID for card reader time tracking system';
