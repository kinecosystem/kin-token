pragma solidity ^0.4.15;

import '../../contracts/MultiSigWallet.sol';

contract MultiSigWalletMock is MultiSigWallet {
    uint256 public transactionId;

    function MultiSigWalletMock(address[] _owners, uint _required) MultiSigWallet(_owners, _required) {
    }

    function submitTransaction(address _destination, uint _value, bytes _data) public returns (uint _transactionId) {
        transactionId = super.submitTransaction(_destination, _value, _data);

        return transactionId;
    }
}
