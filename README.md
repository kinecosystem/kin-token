# Kin Token Contracts

Here be smart contracts for the [Kin token][kin token].

![Kin Token](kin.png)

Kin is a cryptocurrency built on top of the [Ethereum][ethereum] blockchain.
It is envisioned as a general purpose cryptocurrency for use in everyday digital services such as chat, social media, and payments.
Kin will be the unit of account for all economic transactions within the Kin Ecosystem,
and it will serve as the basis of interoperability with other digital services.

## Contracts

Please see the [contracts/](contracts) directory.

## Develop

Contracts are written in [Solidity][solidity] and tested using [Truffle][truffle] and [testrpc][testrpc].

### Depenencies

```bash
# Install Truffle and testrpc packages globally:
$ npm install -g truffle ethereumjs-testrpc

# Install local node dependencies:
$ npm install
```

### Test

```bash
# Initialize a testrpc instance
$ ./scripts/testrpc.sh

# This will compile and test the contracts using truffle
$ truffle test

# Enable long tests
$ LONG_TESTS=1 truffle test
```

### Docker

Alternatively, a Docker image is provided on a best-effort basis, though we recommend to run natively.

Requires [Docker Compose][docker compose].

```bash
# See Makefile for more commands.
$ make build test

# If you want to run a test for a single contract:
$ docker-compose run --rm truffle npm test test/VestingTrustee.js
```


[kin token]: https://kin.kik.com
[ethereum]: https://www.ethereum.org/

[solidity]: https://solidity.readthedocs.io/en/develop/
[truffle]: http://truffleframework.com/
[testrpc]: https://github.com/ethereumjs/testrpc

[docker compose]: https://docs.docker.com/compose/
