#!/usr/bin/env perl

use FindBin '$Bin';
use lib glob("$Bin/include/*");
use lib "$Bin/lib";

use Mojolicious::Lite;
use Crypt::Password;
use Email::Send;
use Email::Send::Gmail;
use Email::Simple::Creator;
use YAML::Syck;
use URI;
use DBI;

my $site_url = "http://".(`hostname` =~ /steve/ ? "dev." : "")."taps.gen.nz/";

my $email_from = 'taps.gen.nz@gmail.com';
my $email_sender = setup_email();

my $dbh = DBI->connect('dbi:Pg:dbname=taps') or die $!;

my $select_taps_in_bounds = $dbh->prepare(q {
    SELECT tid, lat, lng FROM tap_loc
    WHERE lat <= ? AND lat >= ?
      AND lng <= ? AND lng >= ?
});
my $select_tap_details = $dbh->prepare(q {
    SELECT tid, blurb, no_handle, nozzled FROM tap_details
    WHERE tid = ?
});

get '/' => sub {
    my $self = shift;
    $self->render(server => $site_url);
} => 'index';

get '/aboutus' => 'aboutus';

get '/get_taps_in_bounds' => sub {
    my $self = shift;
    my ($ne_lat, $ne_lng) = unpack_uri_latlng($self->param("ne_bound"));
    my ($sw_lat, $sw_lng) = unpack_uri_latlng($self->param("sw_bound"));
    
    $select_taps_in_bounds->execute(
        $ne_lat, $sw_lat,
        $ne_lng, $sw_lng
    );
    my $taps = $select_taps_in_bounds->fetchall_hashref("tid");
    $self->render_json($taps);
};

get '/tap_details' => sub {
    my $self = shift;
    my $tid = $self->param("tid");
    $tid or die "no tid param";
    my $tap = read_tap_details($tid);
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
        $self->app->log->info("Auth failed: no such user: $user");
        return $self->render_json({ error => "no such user" });
    }
    unless ($registered) {
        $self->app->log->info("Auth failed: not verified: $user");
        return $self->render_json({ error => "unverified"});
    }
    unless (password($hashed)->check($pass)) {
        $self->app->log->info("Auth failed: bad password: $user/$pass");
        return $self->render_json({ error => "bad password" });
    }
    $self->app->log->info("Auth okay: $user");
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
        $dbh->do("BEGIN");
        $self->app->log->info("Register: user=$name, email=$email");
        my $hashed = password($password);
        my $rc = $dbh->do("INSERT INTO people (username, password, email)
            VALUES (?, ?, ?)", undef,          $name,    $hashed,  $email
        );
        if (!$rc) {
            my $db_error = $dbh->errstr;
            $dbh->do("ABORT");
            if ($db_error eq 'ERROR:  duplicate key value violates unique constraint "people_username_key"') {
                $error = "username already taken";
            }
            else {
                $error = "something weird";
                $self->app->log->error("unhandled db error on user insert: $db_error");
            }
        }
        else {
            my $code = hashed_to_secretcode($hashed);
            $self->app->log->info("Register: sending email");
            my $gmail_error = send_email($email, "verification", $code, $name);
            if ($gmail_error) {
                $dbh->do("ABORT");
                if ($gmail_error eq "invalid email address") {
                    $error = $gmail_error;
                }
                else {
                    $error = "something weird";
                    $self->app->log->error("unhandled gmail error: gmail_error");
                }
            }
            else {
                $dbh->do("COMMIT");
            }
        }
    }
    if ($error) {
        $self->app->log->info("Register: failed: $error");
        return $self->render_json({error => $error});
    }
    $self->app->log->info("Register: done");
    return $self->render_json({yeah => $@});
};

get '/recover' => sub {
    my $self = shift;
    my $email = $self->param("email");
    $self->app->log->info("Recover: email=$email");
    my ($name, $hashed) = $dbh->selectrow_array(
        "SELECT username, password FROM people
        WHERE email = ?", undef, $email
    );
    unless ($hashed) {
        $self->app->log->info("Recover: email not found");
        return $self->render_json({error => "email not found"});
    }
    $hashed = password((split(/\$/, $hashed))[-1].localtime().rand());
    $dbh->do("UPDATE people SET password = ? WHERE username = ?", undef, $hashed, $name);
    my $code = hashed_to_secretcode($hashed);
    $self->app->log->info("Recover: name=$name code=$code");
    my $email_error = send_email($email, "recovery", $code);
    $self->app->log->error("recover email error: $email_error") if $email_error;
    $self->app->log->info("Recover: done.");
    $self->render_json({done => $name});
};

get '/verify' => sub {
    my $self = shift;
    my $name = $self->param("name");
    my $code = $self->param("code");
    my $gimme = $self->param("gimme") || "human";
    $self->app->log->info("Verify: name=$name code=$code for=$gimme");
    my $hashed = $dbh->selectrow_array(
        "SELECT password FROM people
        WHERE username = ?", undef, $name
    );
    unless ($hashed) {
        $self->app->log->info("Verify: name not found");
        $self->render_json({ error => "invalid" });
    }
    my $expected = hashed_to_secretcode($hashed);

    if ($code eq $expected) {
        $self->app->log->info("Verify: okay");
        $dbh->do("UPDATE people SET registered = now()
            WHERE username = ?", undef, $name);
        $self->session(user => $name);
        if ($gimme eq "json") {
            $self->render_json({ okay => ":D" });
        }
        else {
            $self->flash(verified => "yes");
            $self->redirect_to("index");
        }
    }
    else {
        $self->app->log->info("Verify: failed ($code ne $expected)");
        if ($gimme eq "json") {
            $self->render_json({ error => "invalid" });
        }
        else {
            $self->flash(verified => "fail");
            $self->redirect_to("index");
        }
    }
};

get '/check_login' => sub {
    my $self = shift;
    my $name = $self->session("user");
    $self->app->log->info("Check Login: ".($name?"user=$name":"negatory"));
    return $self->render_json(
        $name ? { logged_in => $name } : { not => ":O" }
    );
};

get '/logout' => sub {
    my $self = shift;
    $self->app->log->info("Logout: user=".$self->session("user"));
    $self->session(expires => 1);
    return $self->render_json({ okay => ":(" });
};

under sub {
    my $self = shift;

    return 1 if $self->session("user");
    return 0; # todo does Not Found html... ideally it would be a 401 and no data
};

get '/changepass' => sub {
    my $self = shift;
    my $password = $self->param("password");
    my $password2 = $self->param("password2");
    my $response;
    if (!$password || !$password2) {
        $response = "fill out the form!";
    }
    elsif ($password ne $password2) {
        $response = "passwords dont match";
    }
    unless ($response) {
        my $name = $self->session("user");
        my $hashed = password($password);
        $dbh->do("UPDATE people SET password = ? WHERE username = ?",
            undef, $hashed, $name);
        $response = "password changed!"
    }
    $self->app->log->info("Changepass: $response");
    $self->render_json($response);
};

get '/edit_tap_details' => sub {
    my $self = shift;
    $self->app->log->info("Edit Tap Details: ".$self->param("tid"));
    my $tap = write_tap_details({
        tid => $self->param("tid"),
        blurb => $self->param("blurb"),
        no_handle => $self->param("no_handle"),
        nozzled => $self->param("nozzled"),
        user => $self->session("user"),
    });
    $self->render_json($tap);
};

get '/move_tap' => sub {
    my $self = shift;
    my $tid = $self->param("tid");
    my ($lat, $lng) = $self->param("location") =~
        m{\A( -?\d+\.?\d* ),( -?\d+\.?\d* )\Z}xs;

    $self->app->log->info("Move Tap: $tid to $lat, $lng");
    $dbh->do("UPDATE tap_loc SET lat = ?, lng = ? WHERE tid = ?",
        undef, $lat, $lng, $tid);
    $self->render_json({okay=>":)"});
};

get '/delete_tap' => sub {
    my $self = shift;
    my $tid = $self->param("tid");
    $self->app->log->info("Delete Tap: $tid");
    $dbh->do("DELETE FROM tap_loc WHERE tid = ?", undef, $tid);

    $self->render_json({okay=>"gone"});
};

get '/create_tap' => sub {
    my $self = shift;
    my $lat = $self->param("lat");
    my $lng = $self->param("lng");
    $self->app->log->info("Create Tap: $lat, $lng by ". $self->session("user"));

    my $tap_loc = sql_one("INSERT INTO tap_loc (lat, lng, discovered_by, touched_by)"
        ."VALUES (?, ?, ?, ?) RETURNING *", $lat, $lng, ($self->session("user"))x2);

    my $tid = $tap_loc->{tid};
    $self->app->log->info("Create Tap: tid=$tid");

    my $tap = write_tap_details({
        tid => $tid,
        blurb => $self->param("blurb"),
        no_handle => $self->param("no_handle"),
        nozzled => $self->param("nozzled"),
        user => $self->session("user"),
    });

    $self->render_json($tap);
};

sub sql {
    my ($sql, @bind) = @_;
    $dbh->selectall_arrayref($sql, {Slice=>{}}, @bind);
}
sub sql_one {
    my ($sql, @bind) = @_;
    return shift @{ $dbh->selectall_arrayref($sql, {Slice=>{}}, @bind) };
}
sub make_update_sql {
    my ($table, $setfields) = @_;
    my @params;
    my $sql = "UPDATE $table SET ". join(", ",
        map { push @params, $setfields->{$_}; "$_ = ?" } keys %$setfields);
    return ($sql, @params);
}

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
    my $new = shift;

    $new->{tid} || die "no tap id (tid)";

    my $tap = sql_one("SELECT * FROM tap_details WHERE tid = ?", $new->{tid});
    my $new_tap;

    if (exists $tap->{blurb}) {
        my @changed;
        for (qw{blurb no_handle nozzled}) {
            if ($tap->{$_} ne $new->{$_}) {
                push @changed, [$_, $tap->{$_}, $new->{$_}];
            }
        }
        unless (@changed) {
            app->log->info("Nothing changed on $new->{tid}");
            return $tap;
        }
        else {
            app->log->info(join("\n", "Updating tap $new->{tid}:",
                map { "  $_->[0]: '$_->[1]' -> '$_->[2]'" } @changed));
        }

        push @changed, [ "touched_by", undef, $new->{user} ];
        my $update_fields = { map { $_->[0] => $_->[2] } @changed };
        my ($sql, @params) = make_update_sql("tap_details", $update_fields);
        $new_tap = sql_one("$sql WHERE tid = ? RETURNING *", @params, $new->{tid});
    }
    else {
        $new_tap = sql_one("INSERT INTO tap_details ("
            ."tid, blurb, no_handle, nozzled, touched_by"
            .") VALUES (?, ?, ?, ?, ?) RETURNING *",
            map { $new->{$_} } qw{tid blurb no_handle nozzled}
        );
    }

    return $new_tap
}

sub unpack_uri_latlng {
    my $string = shift || '';
    my ($lat, $lng) = $string =~ m{\A ( -?\d+\.?\d* ) , ( -?\d+\.?\d* ) \Z}xs;
    return ($lat, $lng);
}

sub setup_email {
    my $secrets = LoadFile(app->home."/.secrets");
    my $email_password = $secrets->{email_password};
    die "undef email password" unless $email_password;
    my $email_sender = Email::Send->new({
        mailer => 'Gmail',
        mailer_args => [
            username => $email_from,
            password => $email_password,
        ],
    });
    return $email_sender;
}

sub send_email {
    my $email_to = shift;
    my $order = shift;

    my ($subject, $message);
    if ($order eq "verification") {
        my ($code, $name) = @_;
        app->log->info("Send Email: Welcome: to=$email_to code=$code name=$name");
        my $uri = new URI($site_url);
        $uri->path("verify");
        $uri->query_form(name => $name, code => $code);
        $subject = "Welcome";
        $message = <<"EOEMAIL";
Kia Ora $name,

Welcome to taps.gen.nz! Your verification code is: $code

You can independently click here:
  $uri

Thank you for your participation!
Steve.
EOEMAIL
    }
    elsif ($order eq "recovery") {
        my ($code) = @_;
        app->log->info("Send Email: Recovery: to=$email_to code=$code");
        $subject = "Password Recovery";
        $message = <<"EOEMAIL";
Hello Mr/Mrs Forgetful!

Your recovery code is: $code

Thanks for trying.
Steve.
EOEMAIL
    }
    else {
        app->log->error("unhandled call to send_email: @_");
    }

    my $email = Email::Simple->create(
        header => [
            From => $email_from,
            To => $email_to,
            Subject => "[taps.gen.nz] $subject",
        ],
        body => $message,
    );

    eval { $email_sender->send($email) };

    if ($@) {
        app->log->error("Error sending email: $@");
        return $@;
    }

    return undef
}

sub hashed_to_secretcode {
    my $hashed = shift;
    $hashed =~ s/[^\w]//g;
    return substr $hashed, -7;
}

app->start;
__DATA__
