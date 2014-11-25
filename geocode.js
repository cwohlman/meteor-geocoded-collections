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
        result.data.results[0] &&
        result.data.results[0].geometry &&
        result.data.results[0].geometry.location;
    };

    HTTP.get(url, function (error, result) {
      if (error) callback(error);
      else callback(null, parseResult(result));
    });
  })
};
