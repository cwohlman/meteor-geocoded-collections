var get = function (objectOrModifier, path) {
  if (!_.isObject(objectOrModifier)) return undefined;
  if (_.has(objectOrModifier, path)) {
    return objectOrModifier[path];
  } else {
    var result = objectOrModifier;
    if (_.find(path.split('.'), function (part) {
      if (!_.has(result, part)) return true;
      else {
        result = result[part];
        return false;
      }
    })) return undefined;
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
      var _id = _collection.insert(doc);
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

    var hasValuesToGeocode = !_.all(valuesToGeocode, _.isEmpty);

    // We unset the geoField if all geocodedFields are empty.
    if (!hasValuesToGeocode && documentHasModifier) {
      modifier.$unset = modifier.$unset || {};
      modifier.$unset[geoField] = true;
    }

    // Return immediately if all geocoded fields are empty
    if (!hasValuesToGeocode) {
      return callback();
    }

    Geocode.get(valuesToGeocode.join(' '), function (error, result) {
      if (error) return callback(error);
      else if (!result) {
        return callback(
          new Meteor.Error('geocoding-failed', 'Geocoding Failed'));
      }
      else {
        var mongodbPoint = {
          type: 'Point'
          , coordinates: [result.geometry.location.lng, result.geometry.location.lat]
        };
        modifier.$set = modifier.$set || {};
        if (documentHasModifier) {
          modifier.$set[geoField] = mongodbPoint;
        } else {
          set(modifier.$set, geoField, mongodbPoint);
        }
        return callback();
      }
    });
});


Mongo.Collection.prototype.geocodeFields = function (fields, geoField) {
  geoField = geoField || "geo";

  check(fields, [String]);
  check(geoField, String);

  if (Meteor.isServer) {
    this._ensureIndex({geo : "2dsphere"});

    // Server side works differently from client side, this is because server
    // side we have fibers, but we don't have any garuntee that
    // Collection.insert will be called (as opposed to some internal method)
    // the collectionhooks package goes to the trouble of ensuring this method
    // will be called before an insert;
    this.before.insert(function (userId, doc) {
      Mongo.Collection.prototype.geocodeDocument(null, doc, fields, geoField);
    });

    this.before.update(function (userId, doc, fieldNames, modifier) {
      Mongo.Collection.prototype.geocodeDocument(
        modifier, doc, fields, geoField);
    });
  } else {
    var _insert = this.insert;
    var _update = this.update;

    this.insert = function (doc) {
      var args = _.toArray(arguments);
      var self = this;
      // doc = _.clone(doc);
      doc._id = doc._id || Random.id();
      Mongo.Collection.prototype.geocodeDocument(
        null, doc, fields, geoField, function (error, result) {
          if (error) {
            var callback = _.last(args);
            if (_.isFunction(callback)) callback(error);
            return;
          }
          _insert.apply(self, args);
      });
      return doc._id;
    };

    this.update = function (id, modifier) {
      var doc = this.findOne(id);
      var args = _.toArray(arguments);
      var self = this;
      Mongo.Collection.prototype.geocodeDocument(
        modifier, doc, fields, geoField, function (error, result) {
          if (error) {
            var callback = _.last(args);
            if (_.isFunction(callback)) callback(error);
            return;
          }
          _update.apply(self, args);
      });
    };
  }
};
