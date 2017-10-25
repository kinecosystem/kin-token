pragma solidity ^0.4.15;

import '../../contracts/KinFoundationVestingTrustee.sol';

contract KinFoundationVestingTrusteeMock is KinFoundationVestingTrustee {
    function KinFoundationVestingTrusteeMock(KinToken _kin, address _kinFoundation)
        KinFoundationVestingTrustee(_kin, _kinFoundation) {
    }

    /// @dev Web3 helpers functions.
    function getAnnualGrantsLength() external constant returns (uint256) {
        return ANNUAL_GRANTS.length;
    }
}
