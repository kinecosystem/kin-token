const SafeMath = artifacts.require('./SafeMath.sol');
const Ownable = artifacts.require('./Ownable.sol');

const KinToken = artifacts.require('./KinToken.sol');

module.exports = (deployer) => {
    deployer.deploy(SafeMath);
    deployer.deploy(Ownable);

    deployer.link(Ownable, KinToken);
    deployer.link(SafeMath, KinToken);

    deployer.deploy(KinToken);
};
