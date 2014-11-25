Package.describe({
  name: 'cwohlman:meteor-geocoded-collection',
  summary: ' /* Fill me in! */ ',
  version: '1.0.0',
  git: ' /* Fill me in! */ '
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  api.use('matb33:collection-hooks@0.7.6');
  api.use('mongo');
  api.use('http');
  api.use('underscore');

  api.addFiles('geocode.js');
  api.addFiles('cwohlman:meteor-geocoded-collection.js');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('cwohlman:meteor-geocoded-collection');
  api.addFiles('cwohlman:meteor-geocoded-collection-tests.js');
});
