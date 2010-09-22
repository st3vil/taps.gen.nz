package TapDB::People;

use strict;
use warnings;

use base 'DBIx::Class';

__PACKAGE__->load_components("Core");
__PACKAGE__->table("people");
__PACKAGE__->add_columns(
  "username",
  {
    data_type => "text",
    default_value => undef,
    is_nullable => 1,
    size => undef,
  },
  "password",
  {
    data_type => "text",
    default_value => undef,
    is_nullable => 1,
    size => undef,
  },
  "email",
  {
    data_type => "text",
    default_value => undef,
    is_nullable => 1,
    size => undef,
  },
  "registered",
  {
    data_type => "timestamp with time zone",
    default_value => undef,
    is_nullable => 1,
    size => 8,
  },
);
__PACKAGE__->add_unique_constraint("people_username_key", ["username"]);
__PACKAGE__->has_many(
  "tap_details",
  "TapDB::TapDetails",
  { "foreign.person" => "self.username" },
);
__PACKAGE__->has_many(
  "tap_locs",
  "TapDB::TapLoc",
  { "foreign.person" => "self.username" },
);


# Created by DBIx::Class::Schema::Loader v0.04006 @ 2010-09-19 20:46:27
# DO NOT MODIFY THIS OR ANYTHING ABOVE! md5sum:vor6xXAKk1v+Xffj9/V0fA


# You can replace this text with custom content, and it will be preserved on regeneration
1;
