# HTTP Routing

## Introduction

Openruko will load balance and route requests to `myapp.mymachine.me` to your
dyno.

HTTP, HTTPS and WebSockets are supported.


## Requirements

Node.js 0.8.x

## Installation

```
git clone https://github.com/Filirom1/httprouting.git httprouting  
cd httprouting 
```

Install node.js dependencies:
```
make init
```

Create certs for HTTPS:
```
make certs
```

## Environment Variables

apiserver/bin/apiserver will check for the presence of several environment variables,
these must be configured as part of the process start - e.g. configured in 
supervisord or as part of boot script see ./apiserver/conf.js

* PG_USER - Your login name, unless you set something else.
* HTTPROUTING_TLS - Set to true if you want HTTPS

## Launch

```
$ cat > .env << EOF
PG_USER=$YOUR_LOGIN_NAME
EOF

foreman start
```

## Help and Todo

A lot...

This is just a quick and dirt reverse proxy, we can do things a lot better.

## License

httprouting and other openruko components are licensed under MIT.  
[http://opensource.org/licenses/mit-license.php](http://opensource.org/licenses/mit-license.php)

## Authors and Credits

Filirom1
