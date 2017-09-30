#!/usr/bin/env bash

port=8545

# Import common variables.
. scripts/common.sh

# Executes cleanup function at script exit.
trap cleanup EXIT

if testrpc_running $port; then
  echo "Using existing testrpc instance"
else
  echo "Starting our own testrpc instance" 
  eval testrpc "$accounts" -u 0 -u 1 -p "$port" > /dev/null &
  testrpc_pid=$!
fi

# Now run truffle test.
truffle test "$@"
