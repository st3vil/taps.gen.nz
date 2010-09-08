var map;
var tapset = {};
var server = "http://taps.gen.nz:3000/";
var busy = 0;
var oldzoom = 18;
var showing_taps = 1; // bool
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
    
    google.maps.event.addListener(
        map, 'bounds_changed', function () {
            refresh_taps();
        }
    );

    ui_for_zoomlevel();
    google.maps.event.addListener(
        map, 'zoom_changed', function () {
            ui_for_zoomlevel();
        }
    );
}

// {{{ ui re. zoom level
function ui_for_zoomlevel (for_reinit) {
    var newzoom = map.getZoom();
    if (oldzoom < 18 && newzoom >= 18) {
        show_taps();
    }
    else if ((for_reinit || oldzoom < 19) && newzoom >= 19) {
        show_create_tap_button();
    }
    else if (oldzoom >= 18 && newzoom < 18) {
        dont_show_taps();
    }
    else if (oldzoom >= 19 && newzoom < 19) {
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
    $("#create_tap").contents(
        '<input id="create_tap_button" type="button" value="Create Tap"></input>'
    );
    $("#create_tap_button").click(function () {
        start_placing_tap();
    });
}

function dont_show_create_tap_button () {
    $("#create_tap").contents("Zoom in to create taps.");
}
// }}}

function start_placing_tap() {
    // user can abort by clicking other things
    var enplacement = google.maps.event.addListener(
        map, 'click', function(latLng) {
           console.log("omg", latLng); 
        }
    );
    var cancel = function () {
        $("#create_tap")
            .removeAttr("disabled")
            .attr("value", "Create Tap");
        google.maps.event.removeListener(emplacement);
    };
    $("#create_tap")
        .attr("disabled", "disabled")
        .attr("value", "Now click on the map...")
        .append('<input type="button" value="cancel" id="cancel"></input>');
    $("#cancel").click(function () { cancel(); });
}



function refresh_taps() {
    // todo ajax throttling
    if (busy || showing_taps == 0) {
        return;
    }
    busy = 1;

    var bounds = map.getBounds();
    console.log("getting new tap data.")
    var northEast = bounds.getNorthEast();
    var southWest = bounds.getSouthWest();
    $.getJSON(
        server + "get_taps_in_bounds",
        { ne_lat: northEast.lat(),
          ne_lng: northEast.lng(),
          sw_lat: southWest.lat(),
          sw_lng: southWest.lng() },
        function (newtapset) {
            console.log("tapset before:", tapset);
            $.each(tapset, function(tid, tap) {
                if (tid in newtapset) {
                    console.log("Tap "+tid+" stays on");
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
            console.log("tapset after:", tapset);
            busy = 0;
        }
    );
    console.log("done.");
}

function place_tap(newtap) {
    console.log("Placing new tap", newtap);
    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(
            newtap.lat, newtap.lng),
        title: newtap.title,
        map: map,
        icon: 'drink.png',
    });
    console.log("new tid: ", newtap.tid);
    if (newtap.tid) {
        tapset[newtap.tid] = marker;
    }
    console.log("Marker: ", marker);
    return marker;
}

function unplace_tap(tid) {
    var marker = tapset[tid];
    marker.setMap();

    delete tapset[tid];
}

"yeah baby"
