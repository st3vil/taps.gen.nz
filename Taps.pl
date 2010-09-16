#!/usr/bin/env perl

use Mojolicious::Lite;
use Crypt::Password;
use DBI;
my $dbh = DBI->connect('dbi:Pg:dbname=taps') or die $!;
my $select_taps_in_bounds = $dbh->prepare(q {
    SELECT tid, lat, lng FROM tap_loc
    WHERE lat <= ? AND lat >= ?
      AND lng <= ? AND lng >= ?
});
my $insert_new_tap = $dbh->prepare(q {
    INSERT INTO tap_loc (lat, lng) VALUES (?, ?)
    RETURNING tid
});
my $insert_tap_details = $dbh->prepare(q {
    INSERT INTO tap_details (tid, blurb, no_handle, nozzled) VALUES (?, ?, ?, ?)
});
my $select_tap_details = $dbh->prepare(q {
    SELECT tid, blurb, no_handle, nozzled FROM tap_details
    WHERE tid = ?
});

get '/' => 'index';

get '/get_taps_in_bounds' => sub {
    my $self = shift;
    my $bounds = $self->param("bounds");
    my ($ne_lat, $ne_lng, $sw_lat, $sw_lng) = $bounds =~ m{ \A
        ( -?\d+\.?\d* ) ,
        ( -?\d+\.?\d* ) \t
        ( -?\d+\.?\d* ) ,
        ( -?\d+\.?\d* )
        \Z }xs;

    $self->app->log->debug("Params: NE: $ne_lat, $ne_lng SW: $sw_lat, $sw_lng");
    
    $select_taps_in_bounds->execute(
        $ne_lat, $sw_lat,
        $ne_lng, $sw_lng
    );
    my $taps = $select_taps_in_bounds->fetchall_hashref("tid");
    $self->app->log->debug("taps:\n".join("\n",
        map { join("\t", values %$_) } values %$taps));
    $self->render_json($taps);
};

get '/tap_details' => sub {
    my $self = shift;
    my $tap = read_tap_details($self->param("tid"));
    $self->render_json($tap);
};

get '/login' => sub {
    my $self = shift;
    my $user = $self->param('user');
    my $pass = $self->param('password');
    my ($hashed, $registered) = $dbh->selectrow_array(
        "SELECT password, registered FROM people
        WHERE username = ?", undef, $user
    );
    unless ($hashed) {
        return $self->render_json({ error => "no such user" });
    }
    unless ($registered) {
        return $self->render_json({ error => "unverified"});
    }
    unless (password($hashed)->check($pass)) {
        return $self->render_json({ error => "bad password" });
    }
    $self->session(user => $user);
    return $self->render_json({ okay => ":D" });
};

get '/register' => sub {
    my $self = shift;
    my $name = $self->param("name");
    my $password = $self->param("password");
    my $password2 = $self->param("password2");
    my $email = $self->param("email");
    my $error;
    if ($name !~ /^[\w\d]+$/) {
        $error = "name: alphanumerals only";
    }
    elsif (!$password || !$password2) {
        $error = "password!";
    }
    elsif ($password ne $password2) {
        $error = "passwords dont match";
    }
    elsif ($email !~ /^.+@.+\..+$/) {
        $error = "invalid email";
    }
    unless ($error) {
        $dbh->do("INSERT INTO people (username, password, email)
            VALUES (?, ?, ?)", undef,
            $name, password($password), $email
        );
    }
    if ($error) {
        return $self->render_json({error => $error});
    }
    return $self->render_json({yeah => $@});
};

get '/verify' => sub {
    my $self = shift;
    my $name = $self->param("name");
    my $code = $self->param("code");
    my $gimme = $self->param("gimme");
    my $hashed = $dbh->selectrow_array(
        "SELECT password FROM people
        WHERE username = ?", undef, $name
    );
    my ($expected) = $hashed =~ /(.{7})$/;
    if ($code eq $expected) {
        $dbh->do("UPDATE people SET registered = now()
            WHERE username = ?", undef, $name);
        $self->session(user => $name);
        return $self->render_json({ okay => ":D" });
    }
    else {
        return $self->render_json({ error => "invalid" });
    }
};

get '/check_login' => sub {
    my $self = shift;
    my $name = $self->session("user");
    return $self->render_json(
        $name ? { logged_in => $name } : { not => ":O" }
    );
};

get '/logout' => sub {
    my $self = shift;
    $self->session(expires => 1);
    return $self->render_json({ okay => ":(" });
};

under sub {
    my $self = shift;

    return 1 if $self->session("user");
    return 0; # does Not Found html... ideally it would be a 401 and no data
};

get '/edit_tap_details' => sub {
    my $self = shift;
    my $tap = write_tap_details(
        $self->param("tid"),
        $self->param("blurb"),
        $self->param("no_handle"),
        $self->param("nozzled"),
    );
    $self->render_json($tap);
};

get '/move_tap' => sub {
    my $self = shift;
    my $tid = $self->param("tid");
    my ($lat, $lng) = $self->param("location") =~
        m{\A( -?\d+\.?\d* ),( -?\d+\.?\d* )\Z}xs;

    $dbh->do("UPDATE tap_loc SET lat = ?, lng = ? WHERE tid = ?",
        undef, $lat, $lng, $tid);
    $self->render_json({okay=>":)"});
};

get '/delete_tap' => sub {
    my $self = shift;
    my $tid = $self->param("tid");
    $dbh->do("DELETE FROM tap_loc WHERE tid = ?", undef, $tid);

    $self->render_json({okay=>"gone"});
};

get '/create_tap' => sub {
    my $self = shift;
    my $lat = $self->param("lat");
    my $lng = $self->param("lng");
    $insert_new_tap->execute($lat, $lng);
    my ($tid) = $insert_new_tap->fetchrow_array();

    $self->app->log->debug("new tap tid: $tid");

    my $tap = write_tap_details(
        $tid,
        $self->param("blurb"),
        $self->param("no_handle"),
        $self->param("nozzled"),
    );

    $self->render_json($tap);
};

sub read_tap_details {
    my $tid = shift;

    $select_tap_details->execute($tid);
    my $tap = $select_tap_details->fetchrow_hashref;
    return {
        tid => $tid,
        blurb => $tap->{blurb} || "Water!",
        no_handle => $tap->{no_handle},
        nozzled => $tap->{nozzled},
    }
}

sub write_tap_details {
    my $tid = shift;
    # replace this with a pl/pgsql history function
    $dbh->do("delete from tap_details where tid = ?", undef, $tid);
    $insert_tap_details->execute($tid, @_);
    return read_tap_details($tid);
}

app->start;
__DATA__
