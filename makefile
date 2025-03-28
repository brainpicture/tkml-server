.PHONY: push

push: fetch
	rsync -avz ./* root@prod:./tkml/ --exclude node_modules

fetch:
	curl -o tkml.server.js https://tkml.app/tkml.server.js

dev:
	bun run --watch server.ts