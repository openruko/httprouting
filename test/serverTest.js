var chai = require('chai-stack');
var expect = chai.expect;
chai.use(require('chai-http'));

var http = require('http');
var pg = require('pg');
var async = require('async');
var _ = require('underscore');
var request = require('request').defaults({strictSSL: false});
var server = require('../httprouting/server');
var conf = require('../httprouting/conf');

var client = new pg.Client(conf.pg);
client.connect();
client.query('SET search_path TO openruko_data,public;');

// Before running the test you need a DB setup.
// Setup the DB as explained in dynohost tests
describe('httprouting', function(){
  before(server.start);
  beforeEach(cleanDB);

  it('should return 404 when asking for a non existing app', function(done){
    request('http://toto.mymachine.me:' + conf.httprouting.port + '/', function(err, resp, body){
      if(err) return done(err);
      expect(resp).to.have.status(404);
      done();
    });
  });

  describe('whith one app', function(){
    var server;
    beforeEach(function(done){
      addApp(1, 'toto', 1234, done);
    });

    beforeEach(function(done){
      server = startServer(1, 'toto', 1234, done);
    });
    afterEach(function(done){
      server.close(done);
    });

    it('should proxy request to the app', function(done){
      request('http://toto.mymachine.me:' + conf.httprouting.port + '/', function(err, resp, body){
        if(err) return done(err);
        expect(resp).to.have.status(200);
        expect(body).to.be.equal('1234 - toto');
        done();
      });
    });

    it('should proxy https request to the app', function(done){
      request('https://toto.mymachine.me:' + conf.httprouting.tlsPort + '/', function(err, resp, body){
        if(err) return done(err);
        expect(resp).to.have.status(200);
        expect(body).to.be.equal('1234 - toto');
        done();
      });
    });

    describe('with a second app', function(){
      var server2;
      beforeEach(function(done){
        server2 = startServer(1, 'toto', 1235, done);
      });
      afterEach(function(done){
        server2.close(done);
      });

      it('should load balance requests to the two apps', function(done){
        var nodes = {};
        var count = 0;
        async.until(function(){
          return Object.keys(nodes).length === 2;
        }, function(cb){
          request('http://toto.mymachine.me:' + conf.httprouting.port + '/', function(err, resp, body){
            if(err) return done(err);
            count ++;
            expect(resp).to.have.status(200);
            expect(count).to.be.lte(5);
            nodes[body] = true;
            cb();
          });
        }, done);
      });
    });
  });
});


function cleanDB(cb){
  async.parallel([
    function(cb){
      client.query("DELETE FROM instance", cb);
    },
    function(cb){
      client.query("DELETE FROM app", cb);
    }
  ], cb);
}

function addApp(id, name, port, cb){
  client.query("INSERT INTO app (id, name, web_url, git_url) VALUES ($1,$2, '', '');", [id, name],  cb);
}

function startServer(id, name, port, cb){
  var server;
  async.parallel([
    function(cb){
      server = http.createServer(function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(port + ' - ' + name);
      });
      server.listen(port, cb);
    },
    function(cb){
      client.query("INSERT INTO instance (app_id, port, retired) VALUES($1,$2,$3);", [id, port, false], cb);
    }
  ], cb);
  return server;
}
