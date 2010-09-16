var map;
var tapset = {};
var server = "http://taps.gen.nz:3000/";
var ajax_busy = 0;
var ajax_too_soon = 0;
var oldzoom = 18;
var showing_taps = 1;
var user;
function initialise() {
    var latlng = new google.maps.LatLng(-41.31532674688257, 174.78381760978698);
    map = new google.maps.Map(
        document.getElementById("map_canvas"),
        {
            zoom: oldzoom,
            center: latlng,
            mapTypeId: google.maps.MapTypeId.HYBRID,
            disableDefaultUI: true,
            navigationControl: true
        }
    );

    ui_for_zoomlevel("init");
    
    google.maps.event.addListener(
        map, 'idle', function () {
            var newzoom = map.getZoom();
            if (newzoom <= oldzoom) {
                refresh_taps();
            }
            if (oldzoom != newzoom) {
                ui_for_zoomlevel();
            }
        }
    );

    check_login();
}

// {{{ users
function check_login() {
    $.getJSON(
        server + 'check_login',
        {},
        function (result) {
            if (result.logged_in) {
                user_logged_in_as(result.logged_in);
            }
        }
    );
}
function the_user_login_form () {
    start_usering();
    $("#user_login_form").fadeIn();
}
function start_usering () {
    $("#user_non").fadeOut();
    setTimeout('$("#cancel_usering_button").fadeIn();', 500);
}
function user_login_form_submit () {
    $("#user_login_form").addClass("thinking");
    var name = $("#login_name").val();
    var password = $("#login_password").val();
    $.getJSON(
        server + 'login',
        { user: name,
          password: password },
        function (result) {
            cancel_usering("almost");
            if (result.error) {
                cancel_usering();
                angry_popout("login failed! gah");
            }
            else {
                $("#cancel_usering_button").fadeOut();
                user_logged_in_as(name);
            }
        }
    );
}
function angry_popout (text) {
    $("#the_angry_popout").text(text).fadeIn();
    setTimeout("angry_popout_tidyup()", 3000);
}
function angry_popout_tidyup() {
    $("#the_angry_popout").fadeOut();
    setTimeout('$("#the_angry_popout").text("");', 500);
}
function user_logged_in_as (name) {
    user = name;
    $("#user_hello_name").text(name);
    $("#user_non").fadeOut();
    setTimeout('$("#user_hello").fadeIn()', 500);
    $("#menu_create").fadeIn();
    if (map.getZoom >= zoom_thresh_createtaps) {
        show_create_tap_button();
    }
    else {
        dont_show_create_tap_button();
    }
}
function user_login_failed_tidyup () {
    $("#user_login_failed").fadeOut();
}
function the_user_registration_form () {
    start_usering();
    $("#user_registration_form").fadeIn();
}
function user_registration_form_submit () {
    $("#user_registration_form").addClass("thinking");
    $("#user_register_form_errors").text("").fadeOut();
    var name = $("#register_name").val();
    var password = $("#register_password").val();
    var password2 = $("#register_password2").val();
    var email = $("#register_email").val();
    $.getJSON(
        server + 'register',
        { name: name,
          password: password,
          password2: password2,
          email: email },
        function (result) {
            if (result.error) {
                $("#user_registration_form").removeClass("thinking")
                $("#user_register_form_errors").text(result.error).fadeIn();
            }
            else {
                $("#user_registration_form").fadeOut().removeClass("thinking")
                $("#user_registration_submat").fadeIn();
                $("#verify_username").val(name);
            }
        }
    );
}
function user_registration_verify_code () {
    var code = $("#secret_code").val();
    var name = $("#verify_username").val();
    $.getJSON(
        server + 'verify',
        { code: code,
          name: name,
          gimme: "json"},
        function (result) {
            if (result.error) {
                $("#verify_failed_words").fadeIn();
            }
            else {
                cancel_usering();
                user_logged_in_as(name);
            }
        }
    );
}
function close_regverify_open_recover_password () {
    cancel_usering("almost");
    user_recover_password();
}
function cancel_usering (almost) {
    $("#user_login_form").fadeOut().removeClass("thinking")
    $("#user_registration_form").fadeOut().removeClass("thinking")
    $("#user_registration_submat").fadeOut();  
    $("#verify_failed_words").fadeOut();
    $("#user_register_form_errors").text("").fadeOut();
    
    $("#user_recovery").fadeOut().removeClass("thinking");
    $("#user_recovery_form").fadeOut();
    $("#user_recovery_secretform").fadeOut();
    $("#user_recovery_success").fadeOut();

    $("#user_passwordchange").fadeOut().removeClass("thinking");

    if (!almost) {
        $("#cancel_usering_button").fadeOut();
        if (user) {
           setTimeout('$("#user_hello").fadeIn()', 500);
        }
        else {
           setTimeout('$("#user_non").fadeIn()', 500);
        }
    }
}
function user_logout () {
    $.getJSON(
        server + 'logout',
        {},
        function (result) {
            $("#user_hello").fadeOut();
            $("#user_hello_name").text("you");
            $("#user_non").fadeIn();
            user = null;
            $("#menu_create").fadeOut();
        }
    );
}
function user_login_recovery () {
    cancel_usering("almost");
    start_usering();
    $("#user_recovery").fadeIn();
    $("#user_recovery_form").fadeIn();
    $("#recovery_email").val("");
}
var user_recovery_name;
function user_login_recovery_submit () {
    $("#user_recovery").addClass("thinking");
    var email = $("#recovery_email").val();
    $.getJSON(
        server + 'recover',
        { email: email },
        function (res) {
            if (res.error) {
                cancel_usering();
                angry_popout(res.error);
            }
            else {
                user_recovery_name = res.done;
                $("#user_recovery_form").fadeOut();
                setTimeout('$("#user_recovery").removeClass("thinking");'
                    +'$("#user_recovery_secretform").fadeIn();', 500);
            }
        }
    );
}
function user_login_recovery_verify () {
    $("#user_recovery").addClass("thinking");
    var code = $("#recovery_secret").val();
    $.getJSON(
        server + 'verify',
        { name: user_recovery_name,
          code: code,
          gimme: "json" },
        function (res) {
            if (res.error) {
                cancel_usering();
                angry_popout("INCORRECT");
            }
            else {
                user_logged_in_as(user_recovery_name);
                $("#user_recovery_secretform").fadeOut();
                setTimeout('$("#user_recovery").removeClass("thinking");'
                    +'$("#user_recovery_success").fadeIn();', 500);
                setTimeout('user_login_recovery_alldone();', 5000);
            }
        }
    );
}
function user_login_recovery_alldone () {
    cancel_usering();
    user_password_change();
}
function user_password_change() {
    start_usering();
    $("#user_passwordchange").fadeIn();
}
function user_password_change_submit () {
    $("#user_passwordchange").addClass("thinking");
    var password = $("#change_password").val();
    var password2 = $("#change_password2").val();
    $.getJSON(
        server + 'changepass',
        { password: password,
          password2: password2 },
        function (res) {
            cancel_usering();
            angry_popout(res);
        }
    );
}
// }}}

// {{{ ui re. zoom level
var zoom_thresh_showtaps = 17;
var zoom_thresh_createtaps = 19;
var zoom_showtaps;
var zoom_createtaps;
function ui_for_zoomlevel (init) {
    var newzoom = map.getZoom();
    var zoom_showtaps_was = zoom_showtaps;
    var zoom_createtaps_was = zoom_createtaps;
    
    zoom_showtaps = newzoom >= zoom_thresh_showtaps;
    zoom_createtaps = newzoom >= zoom_thresh_createtaps;

    if (zoom_showtaps && !zoom_showtaps_was) {
        show_taps();
    }
    else if (!zoom_showtaps && (zoom_showtaps_was || zoom_showtaps_was == null)) {
        dont_show_taps();
    }

    if (zoom_createtaps && !zoom_createtaps_was) {
        show_create_tap_button();
    }
    else if ((!zoom_createtaps || !user)
             && (zoom_createtaps_was || zoom_createtaps_was == null)) {
        dont_show_create_tap_button();
    }
    oldzoom = newzoom;
}

function show_taps () {
    $("#not_showing_taps").fadeOut();
    showing_taps = 1;
    refresh_taps();
}

function dont_show_taps () {
    $("#not_showing_taps").fadeIn();
    showing_taps = 0;
    refresh_taps();
}

function show_create_tap_button () {
    unlock_ui();
    $("#create_tap_not").fadeOut();
    setTimeout('$("#create_tap_button").fadeIn();', 500);
}

function dont_show_create_tap_button () {
    $("#create_tap_button").fadeOut();
    setTimeout('$("#create_tap_not").fadeIn();', 500);
}

function lock_ui() {
    $("#create_tap_button").attr("disabled", "disabled");
}

function unlock_ui() {
    $("#create_tap_button").removeAttr("disabled");
}
// }}}

// {{{ bubble
var bubble = new Bubble;
function Bubble () {
    this.open = open;
    this.close = close;
    var infowindow;
    function open (thing, content, closecode) {
        if (infowindow && this.current_thing === thing) {
            infowindow.setContent(content);
        }
        else {
            if (infowindow) {
                infowindow.close();
            }
            infowindow = new google.maps.InfoWindow({
                content: content
            });
            google.maps.event.addListener(infowindow, 'closeclick',
                function () {
                    if (closecode) {
                        closecode();
                    }
                    infowindow = null;
                }
            );
            infowindow.open(map, thing.marker);
        }
        this.current_thing = thing;
    }
    function close () {
        infowindow.close();
        infowindow = null;
    }
}
// }}}

// {{{ details
function tap_details(tap) {
    if (!tap.details) {
        $.getJSON(
            server + "tap_details",
            { tid: tap.tid },
            function (tapdetails) {
                tap.details = tapdetails;
                tap_details(tap);
            }
        );
        return;
    }
    var content = '<span id="tap_details">'+"\n";
    content += '<p>'+ tap.details.blurb +'</p>';
    if (tap.details.no_handle) {
        content += '<img src="/wrench.png" id="use_a_wrench"/>'
            +'<label for="use_a_wrench">No Handle!</label>';
    }
    if (tap.details.nozzled) {
        content += '<img src="/thumb_up.png" id="lovely"/>'
            +'<label for="lovely">Nozzled</label>';
    }
    content += '<br/>';
    content += '<span class="link" id="edit_tap_button" onclick="edit_tap();">edit</span>';
    content += '</span>';
    bubble.open(tap, content);
}

var almost_a_tap;
function create_tap() {
    almost_a_tap = google.maps.event.addListener(
        map, 'click', function(location) {
            stop_creating_tap()
            var latLng = location.latLng;
            almost_a_tap = place_tap({
                lat: latLng.lat(),
                lng: latLng.lng(),
            });
            edit_tap(almost_a_tap);
        }
    );
    $("#cancel_create_tap_button").fadeIn();
    $("#create_tap_howto").fadeIn();
}

function stop_creating_tap() {
    google.maps.event.removeListener(almost_a_tap);
    $("#cancel_create_tap_button").fadeOut();
    $("#create_tap_howto").fadeOut();
}

function edit_tap(tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    if (!tap.details) {
        tap.details = {
            blurb: "Water!",
        };
    }

    var content = '<form action="#" id="edit_tap_form">';
    content += '<textarea style="width: 20em; height:7em" name="blurb" id="edit_tap_blurb">'+
        tap.details.blurb+'</textarea><br/>';
    content +='<input type="checkbox" name="no_handle" id="edit_tap_no_handle"';
    if (tap.details.no_handle) {
        content += ' checked="checked"';
    }
    content += '><label for="no_handle">No handle</label><br/>';
    content += '<input type="checkbox" name="nozzled" id="edit_tap_nozzled"';
    if (tap.details.nozzled) {
        content += ' checked="checked"';
    }
    content += '><label for="nozzled">Nozzled</label><br/>' +
'<span class="link" id="save_tap_button" onclick="edit_tap_submit();">save</span> ';
    if (tap.tid) {
        content += '<span class="link" id="delete_tap_button" onclick="edit_tap_delete();">delete</span> ' +
            '<span class="link" id="move_tap_button" onclick="move_tap();">move</span>';
    }
    content += '<span class="link" id="cancel_tap_button" onclick="edit_tap_cancel();" style="float: right">cancel</span>' +
'</form>';

    bubble.open(tap, content,
        function () {
            if (!tap.tid) {
                unplace_tap(tap);
            }
            unlock_ui();
        }
    );
    lock_ui();
}

function edit_tap_cancel(tap) {
    unlock_ui();
    if (!tap) {
    $.each(tapset, function (tid, tap) {
        unplace_tap(tap);
    });
        tap = bubble.current_thing;
    }
    if (tap.tid) {
        tap_details(tap);
    }
    else {
        unplace_tap(tap);
        bubble.close();
    }
}

function edit_tap_delete (tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    bubble.open(tap, "<p>Sure you want to delete this tap?</p>"+
        '<span class="link" id="edit_tap_delete_sure" onclick="edit_tap_delete_surely();">sure</span>'+
        '<span class="link" id="edit_tap_delete_cancel" onclick="edit_tap_delete_cancel();" style="float: right">cancel</span>'
    );
}

function edit_tap_delete_surely(tap) {
    unlock_ui();
    if (!tap) {
        tap = bubble.current_thing;
    }
    $.getJSON(
        server + 'delete_tap',
        { tid: tap.tid },
        function (result) {
            unplace_tap(tap);
            bubble.close();
        }
    );
}
    
function edit_tap_delete_cancel(tap) {
    unlock_ui();
    if (!tap) {
        tap = bubble.current_thing;
    }
    tap_details(tap);
}

function edit_tap_submit(tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    unlock_ui();
    $("#edit_tap_form").addClass("thinking");
    tap.details.blurb = $("#edit_tap_blurb").val();
    tap.details.no_handle = $("#edit_tap_no_handle:checked").length;
    tap.details.nozzled = $("#edit_tap_nozzled:checked").length;

    console.log("submit tap", tap.details.no_handle, tap.details.nozzled, tap);
   
    if (tap.tid) {
        $.getJSON(
            server + "edit_tap_details",
            { tid: tap.tid,
              blurb: tap.details.blurb,
              no_handle: tap.details.no_handle,
              nozzled: tap.details.nozzled },
            function (tapdetails) {
                tap.details = tapdetails;
                tap_details(tap);
            }
        );
    }
    else {
        console.log("new tap", tap);
        $.getJSON(
            server + "create_tap",
            { lat: tap.lat,
              lng: tap.lng,
              blurb: tap.details.blurb,
              no_handle: tap.details.no_handle,
              nozzled: tap.details.nozzled },
            function (tapdetails) {
                tap.details = tapdetails;
                tap.tid = tap.details.tid;
                console.log("created", tap);
                tap_details(tap);
            }
        );
    }
}
// }}}

// {{{ move tap

function move_tap (tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    lock_ui();
    tap.original_position = tap.marker.getPosition();
    tap.marker.setDraggable(true);
    google.maps.event.addListener(tap.marker, 'dragstart',
        function () { bubble.close(); }
    );
    google.maps.event.addListener(tap.marker, 'dragend',
        function () {
            bubble.open(tap, '<span id="move_tap_dial"><p>Done? <span id="drag_done" class="link" onclick="move_tap_save();">save</span>'+
            ' / <span id="drag_cancel" class="link" onclick="move_tap_cancel();">cancel</span></p>'+
            '<p>You may, of course, keep dragging.</p></span>',
                function () { move_tap_cancel(tap) } );
        }
    );

    bubble.open(tap, "<p>Tap marker mode 'draggable' engaged, captain!</p>");
}

function move_tap_save (tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    unlock_ui();
    $("#move_tap_dial").addClass("thinking");
    tap.marker.setDraggable(false);
    var newplace = tap.marker.getPosition();
    $.getJSON(
        server + 'move_tap',
        { tid: tap.tid,
          location: newplace.toUrlValue() },
        function (tap) {
            delete tap.original_position;
            tap_details(tap);
        }
    );
}

function move_tap_cancel (tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    unlock_ui();
    tap.marker.setDraggable(false);
    tap.marker.setPosition(tap.original_position);
    tap_details(tap);
}


// }}}

// {{{ tap plotting
var refresh_taps_when_ajax_ready = 0;
function ajax_ready() {
    ajax_too_soon = 0;
    if (refresh_taps_when_ajax_ready) {
        refresh_taps_when_ajax_ready = 0;
        refresh_taps();
    }
}
function refresh_taps() {
    if (ajax_busy) {
        return;
    }
    if (showing_taps == 0) {
        $.each(tapset, function(tid, tap) {
            unplace_tap(tid);
        });
        return;
    }
    if (ajax_too_soon) {
        refresh_taps_when_ajax_ready = 1;
        return;
    }
    else {
        ajax_too_soon = 1;
        setTimeout("ajax_ready()", 1000);
    }

    var bounds = map.getBounds();
    if (!bounds) {
        setTimeout("refresh_taps()", 500);
        return;
    }
    var northEast = bounds.getNorthEast();
    var southWest = bounds.getSouthWest();
    $.getJSON(
        server + "get_taps_in_bounds",
        { ne_bound: northEast.toUrlValue(),
          sw_bound: southWest.toUrlValue() },
        function (newtapset) {
            if (showing_taps == 0) {
                return;
            }
            $.each(tapset, function(tid, tap) {
                if (!newtapset[tid]) {
                    unplace_tap(tid);
                }
            });
            $.each(newtapset, function(tid, newtap) {
                if (!tapset[tid]) {
                    var marker = place_tap(newtap);
                }
            });
            console.log("tapset:", tapset);
            busy = 0;
        }
    );
}
// }}}

// {{{ markering
function place_tap(tap) {
    tap.marker = new google.maps.Marker({
        position: new google.maps.LatLng(tap.lat, tap.lng),
        map: map,
        icon: 'drink.png',
    });

    if (tap.tid) {
        tapset[tap.tid] = tap;
    }

    google.maps.event.addListener(tap.marker, 'click',
        function (clickevent) { tap_details(tap); }
    );

    console.log("Tap placed: ", tap);
    return tap;
}

function unplace_tap(tapish) {
    var tid;
    var tap;
    if (typeof(tapish) == "object") {
        tap = tapish;
        tid = tap.tid;
    }
    else {
        tid = tapish;
        tap = tapset[tid];
    }
    if (tap.original_position) {
        return;
    }
    console.log("Tap "+tid+" goes away");
    tap.marker.setMap();
    delete tapset[tid];
}
/// }}}

