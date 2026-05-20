create table if not exists "contacts" ("id" integer, "first" text not null, "last" text not null, "avatar" text, "bsky" text not null, "notes" text not null, "favorite" integer default 0, "createdAt" text default current_timestamp, constraint "contacts_pk" primary key ("id"));
create index if not exists "contacts_last_createdat_idx" on "contacts" ("last", "createdAt");
