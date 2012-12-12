var pg = require('pg');
var http = require('http');
var https = require('https');
var fs = require('fs');
var Path = require('path');
var httpProxy = require('http-proxy');
var conf = require('./conf');
var _ = require('underscore');

httpProxy.setMaxSockets(conf.httprouting.maxSockets);

var pgClient = new pg.Client(conf.pg);
pgClient.connect();

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
  //only keep the app name from the HOST
  var name = req.headers.host.replace(/\..*/g, '');

  pgClient.query('SELECT port FROM openruko_data.instance WHERE retired = false AND name = $1;', [name], function(err, result) {
    if(err) return console.error(err);

    var instance = _(result.rows).shuffle()[0];
    if(!instance) {
      res.writeHead(404);
      return res.end('Not found');
    }

    console.log('Will proxy', name, 'to', instance.port);
    proxy.proxyRequest(req, res, {
      host: 'localhost',
      port: 1337, //+instance.port
      buffer: buffer
    });
  });
  }
}
// TODO: a lot, this is a quick and dirty reverse proxy
