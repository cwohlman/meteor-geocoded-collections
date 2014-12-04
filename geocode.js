Geocode = {
  get: Meteor.wrapAsync(function (geoQuery, callback) {
    check(geoQuery, String);

    var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=';
    url += encodeURIComponent(geoQuery);

    if (Meteor.settings && Meteor.settings.gmapsApiKey) {
      url += "&key=" + Meteor.settings.gmapsApiKey;
    }

    var parseResult = function (result) {
      return result.data &&
        result.data.results &&
        result.data.results[0];
    };

    HTTP.get(url, function (error, result) {
      if (error) callback(error);
      else callback(null, parseResult(result));
    });
  })
  , distance: function (p1, p2) {

    // From http://stackoverflow.com/questions/1502590/calculate-distance-between-two-points-in-google-maps-v3
    var rad = function(x) {
      return x * Math.PI / 180;
    };

    var R = 6378137; // Earth’s mean radius in meter
    var dLat = rad(p2.lat - p1.lat);
    var dLong = rad(p2.lng - p1.lng);
    var a =
      Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
      Math.cos(rad(p1.lat)) *
      Math.cos(rad(p2.lat)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d; // returns the distance in meter
  }
};
