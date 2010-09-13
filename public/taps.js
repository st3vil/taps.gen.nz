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
        map, 'zoom_changed', function () {
            ui_for_zoomlevel();
        }
    );
    
    google.maps.event.addListener(
        map, 'bounds_changed', function () {
            var newzoom = map.getZoom();
            if (newzoom <= oldzoom) {
                console.log("bounds changed");
                refresh_taps();
            }
        }
    );
}

// {{{ ui re. zoom level
function ui_for_zoomlevel (init) {
    console.log("ui_for_zoomlevel");
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

var almost_a_tap;
function start_placing_tap() {
    // user can abort by clicking other things
    var enplacement = google.maps.event.addListener(
        map, 'click', function(location) {
            var latLng = location.latLng;
            almost_a_tap = place_tap({
                title: "Garden Variety Tap",
                lat: latLng.lat(),
                lng: latLng.lng(),
            });
            tap_details(almost_a_tap);
        }
    );
    
    $("#create_tap")
        .attr("disabled", "disabled")
        .attr("value", "Now click on the map...")
        .append('<input type="button" value="cancel" id="cancel"></input>');
    $("#cancel").click(function () { cancel_placing_tap(); });
}

var bubble = new Bubble;
function Bubble () {
    this.open = open;
    this.close = close;
    var open_on_thing;
    var infowindow;
    function open (thing, content) {
        if (infowindow && open_on_thing == thing) {
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
            infowindow.open(map, thing);
        }
        open_on_thing = thing;
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
    bubble.open(tap,
        "Title: "+tap.details.title+"<br/>\n"
        + "Comment:<br/>\n"
        + "<p>"+tap.details.comment+"</p>"
        + '<a href="#" id="edit_tap_button">edit</a>'
    );
    $("#edit_tap_button").click(function () {
        edit_tap(tap);
    });
}

function edit_tap(tap) {
    bubble.open(tap,
        '<form action="#" id="edit_tap_form">'
        + '<input name="title" id="edit_tap_title" value="'
            +tap.details.title+'"></input>'
        + '<span id="save_tap_button">save</span>'
        + '</form>'
    );
    $("#save_tap_button").click(function () {
        edit_tap_submit(tap);
    });
}

function edit_tap_submit(bubble, tap) {
    tap.title = $("#edit_tap_title").val();
    
    console.log("Yeahp");
}

function cancel_placing_tap() {
    $("#create_tap")
        .removeAttr("disabled")
        .attr("value", "Create Tap");
    google.maps.event.removeListener(enplacement);
}

// {{{ tap mapping
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

function place_tap(newtap) {
    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(newtap.lat, newtap.lng),
        title: newtap.title,
        map: map,
        icon: 'drink.png',
    });
    if (newtap.tid) {
        marker.tid = newtap.tid;
        tapset[newtap.tid] = marker;
    }

    google.maps.event.addListener(marker, 'click', function (clickevent) {
        tap_details(marker);
    });

    console.log("Marker: ", marker);
    return marker;
}

function unplace_tap(tap) {
    var tid;
    var marker;
    if (typeof(tap) == "object") {
        marker = tap;
        tid = marker.tid;
    }
    else {
        tid = tap;
        marker = tapset[tid];
    }

    marker.setMap();
    delete tapset[tid];
}

