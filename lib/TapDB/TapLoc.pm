package TapDB::TapLoc;

use strict;
use warnings;

use base 'DBIx::Class';

__PACKAGE__->load_components("Core");
__PACKAGE__->table("tap_loc");
__PACKAGE__->add_columns(
  "tid",
  {
    data_type => "integer",
    default_value => "nextval('tap_loc_tid_seq'::regclass)",
    is_nullable => 0,
    size => 4,
  },
  "lat",
  {
    data_type => "numeric",
    default_value => undef,
    is_nullable => 1,
    size => "6,9",
  },
  "lng",
  {
    data_type => "numeric",
    default_value => undef,
    is_nullable => 1,
    size => "6,9",
  },
  "effective_from",
  {
    data_type => "timestamp with time zone",
    default_value => "now()",
    is_nullable => 1,
    size => 8,
  },
  "person",
  {
    data_type => "text",
    default_value => undef,
    is_nullable => 1,
    size => undef,
  },
);
__PACKAGE__->add_unique_constraint("tid_unique", ["tid"]);
__PACKAGE__->has_many(
  "tap_details",
  "TapDB::TapDetails",
  { "foreign.tid" => "self.tid" },
);
__PACKAGE__->belongs_to("person", "TapDB::People", { username => "person" });


# Created by DBIx::Class::Schema::Loader v0.04006 @ 2010-09-19 20:46:27
# DO NOT MODIFY THIS OR ANYTHING ABOVE! md5sum:gvXnCxySe5wYxwUEdpyHZg


# You can replace this text with custom content, and it will be preserved on regeneration
1;
