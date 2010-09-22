package TapDB::TapDetails;

use strict;
use warnings;

use base 'DBIx::Class';

__PACKAGE__->load_components("Core");
__PACKAGE__->table("tap_details");
__PACKAGE__->add_columns(
  "tid",
  { data_type => "integer", default_value => undef, is_nullable => 1, size => 4 },
  "blurb",
  {
    data_type => "text",
    default_value => undef,
    is_nullable => 1,
    size => undef,
  },
  "no_handle",
  { data_type => "boolean", default_value => undef, is_nullable => 1, size => 1 },
  "nozzled",
  { data_type => "boolean", default_value => undef, is_nullable => 1, size => 1 },
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
__PACKAGE__->belongs_to("person", "TapDB::People", { username => "person" });
__PACKAGE__->belongs_to("tid", "TapDB::TapLoc", { tid => "tid" });


# Created by DBIx::Class::Schema::Loader v0.04006 @ 2010-09-19 20:46:27
# DO NOT MODIFY THIS OR ANYTHING ABOVE! md5sum:bV43nYhxlw81yErkRDOnOg


# You can replace this text with custom content, and it will be preserved on regeneration
1;
