pragma solidity ^0.4.15;

contract Migrations {
    address public owner;
    uint public lastCompletedMigration;

    modifier restricted() {
        if (msg.sender != owner) {
            revert();
        }

        _;
    }

    function Migrations() {
        owner = msg.sender;
    }

    function setCompleted(uint completed) restricted {
        lastCompletedMigration = completed;
    }

    function upgrade(address new_address) restricted {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(lastCompletedMigration);
    }
}
