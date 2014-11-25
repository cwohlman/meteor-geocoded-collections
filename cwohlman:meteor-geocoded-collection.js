var get = function (objectOrModifier, path) {
  if (_.has(objectOrModifier, path)) {
    return objectOrModifier[path];
  } else {
    var result = objectOrModifier;
    _.find(path.split('.'), function (part) {
      if (!_.has(result, part)) return true;
      else {
        result = result[part];
        return false;
      }
    });
    return result;
  }
};

var set = function (object, path, value) {
  var parent = object;
  var key;
  _.find(path.split('.'), function (part) {
    // ensure parent object exists exists
    if (key) {
      parent[key] = parent[key] || {};
      parent = parent[key];
    }
    key = part;
  });
  parent[key] = value;
};

Mongo.Collection.prototype.geocodeDocument = Meteor.wrapAsync(function (
  modifier, doc, fields, geoField, callback) {
    // XXX check arguments

    // flag whether modifier was passed in.
    var documentHasModifier;

    if (modifier) {
      documentHasModifier = true;

      // apply modifier to doc. When geocoding we need the complete document,
      // not just the fields which have changed.
      var _collection = new Mongo.Collection(null);
      var _id = _.collection.insert(doc);
      _collection.update(_id, modifier);
      doc = _collection.findOne(_id);
    } else {
      documentHasModifier = false;

      // create a mock modifier to be used when checking for changed fields.
      modifier = {
        $set: doc
      };
    }

    // XXX for completeness we might want to check all mongodb operators
    // or use the fieldNames argument to check and see whether the geocode
    // field was modified.
    var geocodeWasSet = _.any(['$set', '$unset'], function (a) {
      return !!get(modifier[a], geoField);
    });

    // If geocodeWasSet we assume it is correct, this allows us to geocode on
    // the client, or even to allow the user to tweak the geocoding (for cases
    // where the address is not precise enough)
    if (geocodeWasSet) return callback();

    // XXX for completeness we might want to check all mongodb operators
    var geoFieldWasModified = _.any(['$set', '$unset'], function (operator) {
      return _.any(fields, function (field) {
        return !!get(modifier[operator], field);
      });
    });

    // If no geoFields were modified we don't need to geocode.
    if (!geoFieldWasModified) return callback();

    // Now we geocode the document
    var valuesToGeocode = _.map(fields, function (field) {
      return get(doc, field);
    });

    var hasValuesToGeocode = _.all(valuesToGeocode, _.isEmpty);

    // We unset the geoField if all geocodedFields are empty.
    if (!hasValuesToGeocode && documentHasModifier) {
      modifier.$unset = modifier.$unset || {};
      modifier.$unset[geoField] = true;
    }

    // Return immediately if all geocoded fields are empty
    if (!hasValuesToGeocode) {
      return callback();
    }

    Geocode.get(valuesToGeocode, function (error, result) {
      if (error) callback(error);
      else if (!result) callback(new Error('Geocoding Failed'));
      else {
        var mongodbPoint = {
          type: 'Point'
          , coordinates: [result.lng, result.lat]
        };
        modifier.$set = modifier.$set || {};
        if (documentHasModifier) {
          modifier.$set[geoField] = mongodbPoint;
        } else {
          set(modifier.$set, geoField, mongodbPoint);
        }
        callback();
      }
    });
});


Mongo.Collection.prototype.geocodeFields = function (fields, geoField) {
  geoField = geoField || "geo";

  check(fields, [String]);
  check(geoField, String);

  var processDoc = function (doc, callback) {
    var val = doc;
    var last;
    var parts = geoField.split('.');
    _.each(parts, function (a, i) {
      if (i == parts.length - 1) last = a;
      else val = val[a];
    });


    if (!val[last]) {
      var geoQuery = _.map(fields, function (field) {
        var val = doc;
        _.each(field.split('.'), function (a) {val = val[a];});

        if (_.isString(val)) {
          return val;
        }
      });
      geoQuery = _.filter(geoQuery, _.identity).join(' ');

      Geocode.get(geoQuery, function (error, result) {
        if (error) callback(error);
        else if (result) {
          val[last] = {
            type: 'Point'
            , coordinates: [result.lng, result.lat]
          };
          callback();
        }
        else {
          callback();
        }
      });

    } else if (_.isFunction(callback)) {
      callback();
    }
  };

  if (Meteor.isServer) {
    // Safe to run as part of before/after hooks
    this.before.insert(function (userId, doc) {
      processDoc(doc);
    });
    this.before.update(function (userId, doc, fieldNames, modifier) {
      // We don't support $push since our geocoding doesn't handle arrays anyway.
      if (modifier.$set && !modifier.$set[geoField]) {

      }
    });
  } else {
    var _insert = this.insert;
    this.insert = function (doc, callback) {
      var self = this;
      var args = _.toArray(arguments);
      doc._id = doc._id || Random.id();
      processDoc(doc, function (error, result) {
        if (error) callback(error);
        else _insert.apply(self, args);
      });
      return doc._id;
    };
  }
};
