.PHONY: push

push:
	rsync -avz ./* root@prod:./tkml/ --exclude node_modules