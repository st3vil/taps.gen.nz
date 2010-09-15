-- taps.gen.nz schema

CREATE TABLE tap_loc (
  tid serial unique,
  lat numeric(9, 6),
  lng numeric(9, 6)
);

CREATE TABLE tap_details (
    tid integer references tap_loc(tid) on delete cascade,
    blurb text,
    no_handle bool,
    nozzled bool
);

CREATE TABLE people (
    username text unique,
    password text,
    email text,
    registered timestamptz
);

