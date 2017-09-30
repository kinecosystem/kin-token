#!/usr/bin/env bash

port=8545

# Import common variables.
. scripts/common.sh

if testrpc_running $port; then
  echo "Using existing testrpc instance"
else
  echo "Starting our own testrpc instance" 
  eval testrpc "$accounts" -u 0 -u 1 -p "$port"
fi
