
default: ;
.DEFAULT_GOAL: default

run_truffle := docker-compose run --rm truffle

compile:
	$(run_truffle) truffle compile
.PHONY: compile

test:
	$(run_truffle) npm test
.PHONY: test

test-long:
	docker-compose run --rm -e LONG_TESTS=1 truffle npm test
.PHONY: test-long

coverage:
	$(run_truffle) npm run-script coverage
.PHONY: coverage

codecov:
	$(run_truffle) npm run-script codecov
.PHONY: codecov

migrate:
	$(run_truffle) truffle migrate
.PHONY: migrate

console:
	$(run_truffle) npm run-script console
.PHONY: console

testrpc:
	$(run_truffle) npm run-script testrpc
.PHONY: testrpc

build:
	docker-compose build
.PHONY: build

log:
	docker-compose logs
.PHONY: log

sh:
	$(run_truffle) sh
.PHONY: sh

down:
	docker-compose down -v
.PHONY: down

clean: down
	docker-compose down --rmi all
.PHONY: clean
