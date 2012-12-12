var env = process.env;

module.exports = {
  httprouting: {
    port: env.HTTPROUTING_PORT || 8080,
    tls: env.HTTPROUTING_TLS || false,
    tlsPort: env.HTTPROUTING_TLS_PORT || 8443,
    maxSockets: env.HTTPROUTING_MAX_SOCKETS || 100
  },
  pg: {
    database: env.PG_DATABASE || 'openruko',
    hostname: env.PG_HOST || 'localhost',
    user: env.PG_USER || 'openruko',
    password: env.PG_PASSWORD || 'openruko',
    schema: env.PG_SCHEMA || 'openruko_api'
  },
  logplex: {
    hostname: env.LOGPLEX_HOST || 'localhost',
    webPort: env.LOGPLEX_WEB_PORT || 9996,
    udpPort: env.LOGPLEX_UDP_PORT || 9999
  }
}
