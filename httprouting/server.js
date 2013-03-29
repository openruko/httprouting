var pg = require('pg');
var http = require('http');
var https = require('https');
var fs = require('fs');
var Path = require('path');
var httpProxy = require('http-proxy');
var conf = require('./conf');
var _ = require('underscore');
var memoize = require('memoizee');
var async = require('async');

httpProxy.setMaxSockets(conf.httprouting.maxSockets);

var pgClient = new pg.Client(conf.pg);
pgClient.connect();

pgClient.query('SET search_path TO openruko_data,public;');

var tls = {
  key: fs.readFileSync(Path.join(__dirname, '../certs/server-key.pem')),
  cert: fs.readFileSync(Path.join(__dirname, '../certs/server-cert.pem'))
};

exports.start = function(cb){
  async.parallel([
    function(cb){
      var server = http.createServer(onRequest);
      server.on('upgrade', proxyWebSockets);
      server.listen(conf.httprouting.port, cb);
    },
    function(cb){
      if(!conf.httprouting.tls) return cb();
      var tlsServer = https.createServer(tls, onRequest);
      tlsServer.on('upgrade', proxyWebSockets);
      tlsServer.listen(conf.httprouting.tlsPort, cb);
    }
  ], cb);

  function proxyWebSockets(req, socket, head) {
    getRandomInstanceFromRequest(req, function(err, instance){
      if(err) return error(err);

      proxy.proxyWebSocketRequest(req, socket, head , { host: instance.dyno_hostname, port: +instance.port } );
    });
  }

  var proxy = new httpProxy.RoutingProxy();
  function onRequest(req, res) {
    var buffer = httpProxy.buffer(req);

    getRandomInstanceFromRequest(req, function(err, instance){
      if(err) return error(err);

      if(!instance) {
        res.writeHead(404);
        return res.end('Not found');
      }
      console.log('Will proxy', req.url, 'to ' + instance.dyno_hostname + ':', instance.port);
      proxy.proxyRequest(req, res, {
        host: instance.dyno_hostname,
        port: +instance.port,
        buffer: buffer
      });
    });

    function error(err){
      console.error(err);
      res.writeHead(500);
      return res.end('Internal Error');
    }
  }
};

function _getRandomInstance(name, cb){
  pgClient.query("SELECT * FROM instance INNER JOIN app ON(instance.app_id = app.id) INNER JOIN instance_state ON(instance.id = instance_state.instance_id) WHERE instance.retired = false AND openruko_data.instance_state.state = 'running' AND app.name = $1;", [name], function(err, result) {
    if(err) return cb(err);

    var instance = _(result.rows).shuffle()[0];
    cb(null, instance);
  });
}

// TODO memoize will make test harder to debug.
// Is it really useful ? It looks to be a premature optimization.
//var getRandomInstance = memoize(_getRandomInstance, { async: true, maxAge: 1000 });
var getRandomInstance = _getRandomInstance;

// sort of middleware shared by http and websocket request
function getRandomInstanceFromRequest(req, next){
  var host = req.headers.host;
  if(!host) return next(new Error('Host not present in the headers'));

  //only keep the app name from the HOST
  var name = host.replace(/\..*/g, '');

  getRandomInstance(name, function(err, instance){
    if(err) return next(err);
    next(null, instance);
  });
}

