-- taps.gen.nz schema

CREATE TABLE tap_loc (
  tid serial,
  lat numeric(9, 6),
  lng numeric(9, 6)
);

CREATE TABLE tap_details (
    tid integer references tap_loc(tid) on delete cascade,
    comment text
);


