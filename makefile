.PHONY: push

push:
	rsync -avz ./* root@prod:./tkml/ --exclude node_modules

fetch:
	curl -o tkml.min.js https://tkml.app/tkml.min.js