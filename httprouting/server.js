var pg = require('pg');
var http = require('http');
var https = require('https');
var fs = require('fs');
var Path = require('path');
var httpProxy = require('http-proxy');
var conf = require('./conf');
var _ = require('underscore');
var memoize = require('memoizee');

httpProxy.setMaxSockets(conf.httprouting.maxSockets);

var pgClient = new pg.Client(conf.pg);
pgClient.connect();

pgClient.query('SET search_path TO openruko_data,public;');

var tls = {
  key: fs.readFileSync(Path.join(__dirname, '../certs/server-key.pem')),
  cert: fs.readFileSync(Path.join(__dirname, '../certs/server-cert.pem'))
};

exports.start = function(cb){
  var server = http.createServer(onRequest);
  server.on('upgrade', proxyWebSockets);
  server.listen(conf.httprouting.port);

  if(conf.httprouting.tls){
    var tlsServer = https.createServer(tls, onRequest);
    tlsServer.on('upgrade', proxyWebSockets);
    tlsServer.listen(conf.httprouting.tlsPort);
  }

  function proxyWebSockets(req, socket, head) {
    proxy.proxyWebSocketRequest(req, socket, head);
  }

  var proxy = new httpProxy.RoutingProxy();
  function onRequest(req, res) {
    var buffer = httpProxy.buffer(req);

    var host = req.headers.host;
    if(!host) return error(new Error('Host not present in the headers'));
    
    //verify potentially-malicious domains
    var regex = new RegExp("^([a-z0-9.-]+|\[[a-f0-9]*:[a-f0-9:]+\])(:\d+)?$");
    if(!regex.test(host)) return error(new Error('Host potentially malicious'));
    
    
    //only keep the app name from the HOST
    var name = host.replace(/\..*/g, '');

    getRandomInstance(name, function(err, instance){
      if(err) return error(err);

      if(!instance) {
        res.writeHead(404);
        return res.end('Not found');
      }

      console.log('Will proxy', name, 'to', instance.port);
      proxy.proxyRequest(req, res, {
        host: 'localhost',
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
  pgClient.query('SELECT port FROM instance INNER JOIN app ON(instance.app_id = app.id) WHERE instance.retired = false AND app.name = $1;', [name], function(err, result) {
    if(err) return cb(err);

    var instance = _(result.rows).shuffle()[0];
    cb(null, instance);
  });
}

var getRandomInstance = memoize(_getRandomInstance, { async: true, maxAge: 1000 });
