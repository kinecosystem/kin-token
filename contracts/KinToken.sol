pragma solidity ^0.4.15;

import './Ownable.sol';
import './SafeMath.sol';
import './BasicToken.sol';
import './TokenHolder.sol';

/// @title Kin token contract.
contract KinToken is Ownable, BasicToken, TokenHolder {
    using SafeMath for uint256;

    string public constant name = "Kin";
    string public constant symbol = "KIN";

    // Using same decimal value as ETH (makes ETH-KIN conversion much easier).
    uint8 public constant decimals = 18;

    // States whether creating more tokens is allowed or not.
    // Used during token sale.
    bool public isMinting = true;

    event MintingEnded();

    modifier onlyDuringMinting() {
        require(isMinting);

        _;
    }

    modifier onlyAfterMinting() {
        require(!isMinting);

        _;
    }

    /// @dev Mint Kin tokens.
    /// @param _to address Address to send minted Kin to.
    /// @param _amount uint256 Amount of Kin tokens to mint.
    function mint(address _to, uint256 _amount) external onlyOwner onlyDuringMinting {
        totalSupply = totalSupply.add(_amount);
        balances[_to] = balances[_to].add(_amount);

        Transfer(0x0, _to, _amount);
    }

    /// @dev End minting mode.
    function endMinting() external onlyOwner {
        if (isMinting == false) {
            return;
        }

        isMinting = false;

        MintingEnded();
    }

    /// @dev Same ERC20 behavior, but reverts if still minting.
    /// @param _spender address The address which will spend the funds.
    /// @param _value uint256 The amount of tokens to be spent.
    function approve(address _spender, uint256 _value) public onlyAfterMinting returns (bool) {
        return super.approve(_spender, _value);
    }

    /// @dev Same ERC20 behavior, but reverts if still minting.
    /// @param _to address The address to transfer to.
    /// @param _value uint256 The amount to be transferred.
    function transfer(address _to, uint256 _value) public onlyAfterMinting returns (bool) {
        return super.transfer(_to, _value);
    }

    /// @dev Same ERC20 behavior, but reverts if still minting.
    /// @param _from address The address which you want to send tokens from.
    /// @param _to address The address which you want to transfer to.
    /// @param _value uint256 the amount of tokens to be transferred.
    function transferFrom(address _from, address _to, uint256 _value) public onlyAfterMinting returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }
}
