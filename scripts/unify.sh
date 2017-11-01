#!/bin/sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function unify() {
	grep -v "^[pragma|import]" $DIR/$1 >> Unified.sol
}

echo "pragma solidity ^0.4.15;" > Unified.sol

unify ../contracts/Ownable.sol
unify ../contracts/SafeMath.sol
unify ../contracts/ERC20.sol
unify ../contracts/BasicToken.sol
unify ../contracts/TokenHolder.sol
unify ../contracts/KinToken.sol
unify ../contracts/VestingTrustee.sol
unify ../contracts/KinTokenSale.sol
unify ../contracts/KinFoundationVestingTrustee.sol
