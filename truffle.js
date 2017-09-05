require('babel-register');
require('babel-polyfill');

let provider;
let HDWalletProvider = require('truffle-hdwallet-provider');
let mnemonic = '[REDACTED]'; // fs.readFileSync(path.join("./secrets/", "deploy_mnemonic.key"), {encoding: "utf8"}).trim();

// HDWalletProvider has problems with solidity-coverage.
if (!process.env.SOLIDITY_COVERAGE){
  // Init ropsten wallet provider.
  provider = new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/')
}

module.exports = {
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*' // Match any network id
        },
        /* Ropsten disabled meanwhile to make sure there is no accidental deploy there.
        ropsten: {
            provider: provider,
            network_id: 3 // official id of the ropsten network
        },
        */
        coverage: {
            host: "localhost",
            network_id: "*",
            port: 8555,
            gas: 0xfffffffffff,
            gasPrice: 0x01
        }
    },
    mocha: {
        useColors: true,
        slow: 30000,
        bail: true
    }
};
