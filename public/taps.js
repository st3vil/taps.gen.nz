var map;
var tapset = {};
var server = "http://taps.gen.nz:3000/";
var ajax_busy = 0;
var ajax_too_soon = 0;
var oldzoom = 18;
var showing_taps = 1;
function initialise() {
    var latlng = new google.maps.LatLng(-41.31532674688257, 174.78381760978698);
    map = new google.maps.Map(
        document.getElementById("map_canvas"),
        {
            zoom: oldzoom,
            center: latlng,
            mapTypeId: google.maps.MapTypeId.HYBRID
        }
    );

    ui_for_zoomlevel("init");
    
    google.maps.event.addListener(
        map, 'bounds_changed', function () {
            var newzoom = map.getZoom();
            if (newzoom <= oldzoom) {
                refresh_taps();
            }
            if (oldzoom != newzoom) {
                ui_for_zoomlevel();
            }
        }
    );
}

// {{{ ui re. zoom level
function ui_for_zoomlevel (init) {
    var newzoom = map.getZoom();
    if ((init || oldzoom < 18) && newzoom >= 18) {
        show_taps();
    }
    else if ((init || oldzoom < 19) && newzoom >= 19) {
        show_create_tap_button();
    }
    else if ((init || oldzoom >= 18) && newzoom < 18) {
        dont_show_taps();
    }
    else if ((init || oldzoom >= 19) && newzoom < 19) {
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
    for (tid in tapset) {
        unplace_tap(tid);
    }
}

function show_create_tap_button () {
    $("#create_tap").html(
        '<input id="create_tap_button" type="button" value="Create Tap"></input>'
    );
    $("#create_tap_button").click(function () {
        start_placing_tap();
    });
}

function dont_show_create_tap_button () {
    $("#create_tap").html("Zoom in to create taps.");
}
// }}}

// {{{ details
var bubble = new Bubble;
function Bubble () {
    this.open = open;
    this.close = close;
    var infowindow;
    function open (thing, content) {
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
                function () { infowindow = null; }
            );
            infowindow.open(map, thing.marker);
        }
        this.current_thing = thing;
    }
    function close () {
        infowindow.close;
        infowindow = null;
    }
}

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
function start_placing_tap() {
    var enplacement = google.maps.event.addListener(
        map, 'click', function(location) {
            var latLng = location.latLng;
            almost_a_tap = place_tap({
                lat: latLng.lat(),
                lng: latLng.lng(),
            });
            edit_tap(almost_a_tap);
        }
    );
    
    $("#create_tap")
        .attr("disabled", "disabled")
        .attr("value", "Now click on the map...")
        .append('<input type="button" value="cancel" id="cancel"></input>');
    $("#cancel").click(function () { cancel_placing_tap(emplacement); });
}
function cancel_placing_tap(emplacement) {
    $("#create_tap")
        .removeAttr("disabled")
        .attr("value", "Create Tap");
    google.maps.event.removeListener(enplacement);
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

    console.log("edit_tap", tap);

    var no_handle_checkedness = "";
    if (tap.details.no_handle) {
        no_handle_checkedness = ' checked="checked"';
    }
    var nozzled_checkedness = "";
    if (tap.details.nozzled) {
        nozzled_checkedness = ' checked="checked"';
    }

    bubble.open(tap,
'<form action="#" id="edit_tap_form">' +
'<textarea style="width: 95%" name="blurb" id="edit_tap_blurb">'+tap.details.blurb+'</textarea><br/>' +
'<input type="checkbox" name="no_handle" id="edit_tap_no_handle"'+no_handle_checkedness+
'></input><label for="no_handle">No handle</label><br/>' +
'<input type="checkbox" name="nozzled" id="edit_tap_nozzled"'+nozzled_checkedness+
'></input><label for="nozzled">Nozzled</label><br/>' +
'<span class="link" id="save_tap_button" onclick="edit_tap_submit();">save</span>' +
'<span class="link" id="cancel_tap_button" onclick="edit_tap_cancel();" style="float: right">cancel</span>' +
'</form>'
    );
}

function edit_tap_cancel(tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
    tap_details(tap);
}

function edit_tap_submit(tap) {
    if (!tap) {
        tap = bubble.current_thing;
    }
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
                tap_details(tap);
            }
        );
    }
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
    if (ajax_busy || showing_taps == 0) {
        return;
    }
    if (ajax_too_soon) {
        console.log("refreshing taps later");
        refresh_taps_when_ajax_ready = 1;
        return;
    }
    else {
        ajax_too_soon = 1;
        setTimeout("ajax_ready()", 1000);
    }

    var bounds = map.getBounds();
    if (!bounds) {
        console.log("wtf: map.getBounds() returned undef");
        setTimeout("refresh_taps()", 500);
        return;
    }
    var northEast = bounds.getNorthEast();
    var southWest = bounds.getSouthWest();
    var bounds_string = northEast.toUrlValue()+"\t"+southWest.toUrlValue();
    $.getJSON(
        server + "get_taps_in_bounds",
        { bounds: bounds_string },
        function (newtapset) {
            $.each(tapset, function(tid, tap) {
                if (tid in newtapset) {
                }
                else {
                    console.log("Tap "+tid+" goes away");
                    unplace_tap(tid);
                }
            });
            $.each(newtapset, function(tid, newtap) {
                if (tid in tapset) {
                    // already there
                }
                else {
                    var marker = place_tap(newtap);
                }
            });
            console.log("tapset:", tapset);
            busy = 0;
        }
    );
}
// }}}

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

    tap.marker.setMap();
    delete tapset[tid];
}

