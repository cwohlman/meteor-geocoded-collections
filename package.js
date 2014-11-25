Package.describe({
  name: 'cwohlman:geocoded-collection',
  summary: 'Auto-geocode your collection documents',
  version: "0.1.1",
  git: 'https://github.com/cwohlman/meteor-geocoded-collections.git'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  api.use('matb33:collection-hooks@0.7.6');
  api.use('mongo');
  api.use('http');
  api.use('underscore');

  api.addFiles('geocode.js');
  api.addFiles('cwohlman:meteor-geocoded-collection.js');

  api.export('Geocode');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('cwohlman:geocoded-collection');
  api.addFiles('cwohlman:meteor-geocoded-collection-tests.js');
});
