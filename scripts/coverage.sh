#!/usr/bin/env bash

port=8555

# Import common variables.
. scripts/common.sh

# Executes cleanup function at script exit.
trap cleanup EXIT

if testrpc_running $port; then
  echo "Using existing testrpc-sc instance"
else
  echo "Starting testrpc-sc to generate coverage"
  eval ./node_modules/.bin/testrpc-sc --port $port --gasLimit 0xfffffffffff "$accounts" -u 0 -u 1 > /dev/null & 
  testrpc_pid=$!
fi

SOLIDITY_COVERAGE=true solidity-coverage