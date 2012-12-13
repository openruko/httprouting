.PHONY: init certs database

init:
	npm install .

certs:
	mkdir -p certs/
	openssl genrsa -out certs/server-key.pem 1024
	openssl req -new -subj '/CN=www.mymachine.me/O=Openruko/C=US/ST=Oregon/L=Portland' -key certs/server-key.pem -out certs/server-csr.pem
	openssl x509 -req -in certs/server-csr.pem -signkey certs/server-key.pem -out certs/server-cert.pem


