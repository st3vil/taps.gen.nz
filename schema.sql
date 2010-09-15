-- taps.gen.nz schema

CREATE TABLE tap_loc (
    tid serial unique,
    lat numeric(9, 6),
    lng numeric(9, 6),
    effective_from timestamptz default now(),
    person text references people(username)
);

CREATE TABLE tap_details (
    tid integer references tap_loc(tid) on delete cascade,
    blurb text,
    no_handle bool,
    nozzled bool,
    effective_from timestamptz default now(),
    person text references people(username)
);

CREATE TABLE people (
    username text unique,
    password text,
    email text,
    registered timestamptz
);

CREATE TABLE hst_tap_loc (
    LIKE tap_loc,
    effective_until timestamptz default now()
);

CREATE TABLE hst_tap_details (
    LIKE tap_details,
    effective_until timestamptz default now()
);

CREATE OR REPLACE FUNCTION make_history() RETURNS TRIGGER AS $arr$
DECLARE
    THE_ROW record;
BEGIN
    THE_ROW := NEW;
    IF TG_OP = 'DELETE' THEN
        THE_ROW := OLD;
    END IF;

    IF TG_RELNAME = 'tap_loc' THEN
        INSERT INTO hst_tap_loc (tid, lat, lng, effective_from, person) VALUES (THE_ROW.tid, THE_ROW.lat, THE_ROW.lng, THE_ROW.effective_from, THE_ROW.person);
    END IF;
    IF TG_RELNAME = 'tap_details' THEN
        INSERT INTO hst_tap_details (tid, blurb, no_handle, nozzled, effective_from, person) VALUES (THE_ROW.tid, THE_ROW.blurb, THE_ROW.no_handle, THE_ROW.nozzled, THE_ROW.effective_from, THE_ROW.person);
    END IF;
    RETURN NEW;
END;
$arr$ LANGUAGE plpgsql;

CREATE TRIGGER make_tap_loc_history BEFORE INSERT OR UPDATE OR DELETE ON tap_loc
    FOR EACH ROW EXECUTE PROCEDURE make_history();
CREATE TRIGGER make_tap_details_history BEFORE INSERT OR UPDATE OR DELETE ON tap_details
    FOR EACH ROW EXECUTE PROCEDURE make_history();

