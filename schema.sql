-- taps.gen.nz schema

CREATE TABLE tap_loc (
    tid serial unique,
    lat numeric(9, 6),
    lng numeric(9, 6),
    effective_from timestamptz default now(),
    discovered_by text references people(username),
    touched_by text references people(username)
);

CREATE TABLE tap_details (
    tid integer references tap_loc(tid) on delete cascade,
    blurb text,
    no_handle bool,
    nozzled bool,
    effective_from timestamptz default now(),
    touched_by text references people(username)
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
BEGIN
    IF TG_RELNAME = 'tap_loc' THEN
        INSERT INTO hst_tap_loc
            (tid, lat, lng, effective_from, discovered_by, touched_by)
          VALUES (NEW.tid, NEW.lat, NEW.lng, NEW.effective_from,
                  NEW.discovered_by, NEW.touched_by);
    END IF;
    IF TG_RELNAME = 'tap_details' THEN
        INSERT INTO hst_tap_details
            (tid, blurb, no_handle, nozzled, effective_from, touched_by)
          VALUES (NEW.tid, NEW.blurb, NEW.no_handle, NEW.nozzled,
                  NEW.effective_from, NEW.touched_by);
    END IF;
    RETURN NEW;
END;
$arr$ LANGUAGE plpgsql;

CREATE TRIGGER make_tap_loc_history BEFORE INSERT OR UPDATE ON tap_loc
    FOR EACH ROW EXECUTE PROCEDURE make_history();
CREATE TRIGGER make_tap_details_history BEFORE INSERT OR UPDATE ON tap_details
    FOR EACH ROW EXECUTE PROCEDURE make_history();

