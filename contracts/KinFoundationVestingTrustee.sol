pragma solidity ^0.4.15;

import './SafeMath.sol';
import './Ownable.sol';
import './TokenHolder.sol';
import './KinToken.sol';

/// @title Kin Foundation vesting trustee.
contract KinFoundationVestingTrustee is Ownable, TokenHolder {
    using SafeMath for uint256;

    // KIN ERC20 token contract address.
    KinToken public kin;

    // Kin Foundation wallet address.
    address public kinFoundation;

    // Funds already transferred to Kin Foundation.
    uint256 public transferred = 0;

    // Vesting start time.
    uint256 public startTime;

    // Total vesting length.
    uint256 public TOTAL_VESTING_TIME = 60 years;

    // Annual grants for Kin Foundation. Each member index represents the amount of KIN granted in that year e.g.
    // member #0 is the funds vested for the first year, and member #2 is for the third year.
    //
    // For more information see the Kin whitepaper, chapter 6.
    uint256[60] public ANNUAL_GRANTS = [
        1.2e30,
        9.6e29,
        7.68e29,
        6.144e29,
        4.9152e29,
        3.93216e29,
        3.145728e29,
        2.5165824e29,
        2.01326592e29,
        1.610612736e29,
        1.2884901888e29,
        1.03079215104e29,
        8.24633720832e28,
        6.597069766656e28,
        5.2776558133248e28,
        4.22212465065984e28,
        3.377699720527872e28,
        2.7021597764222976e28,
        2.16172782113783808e28,
        1.729382256910270464e28,
        1.3835058055282163712e28,
        1.10680464442257309696e28,
        8.85443715538058477568e27,
        7.083549724304467820544e27,
        5.6668397794435742564352e27,
        4.53347182355485940514816e27,
        3.626777458843887524118528e27,
        2.9014219670751100192948224e27,
        2.32113757366008801543585792e27,
        1.856910058928070412348686336e27,
        1.485528047142456329878949068e27,
        1.188422437713965063903159255e27,
        9.50737950171172051122527404e26,
        7.60590360136937640898021923e26,
        6.08472288109550112718417538e26,
        4.86777830487640090174734031e26,
        3.89422264390112072139787225e26,
        3.1153781151208965771182978e26,
        2.49230249209671726169463824e26,
        1.99384199367737380935571059e26,
        1.59507359494189904748456847e26,
        1.27605887595351923798765478e26,
        1.02084710076281539039012382e26,
        8.1667768061025231231209906e25,
        6.5334214448820184984967924e25,
        5.226737155905614798797434e25,
        4.1813897247244918390379472e25,
        3.3451117797795934712303577e25,
        2.6760894238236747769842862e25,
        2.1408715390589398215874289e25,
        1.7126972312471518572699432e25,
        1.3701577849977214858159545e25,
        1.0961262279981771886527636e25,
        8.769009823985417509222109e24,
        7.015207859188334007377687e24,
        5.61216628735066720590215e24,
        4.48973302988053376472172e24,
        3.591786423904427011777376e24,
        2.873429139123541609421901e24,
        1.1493716556494166437687604e25
    ];

    // The frequency by which the grant will vest.
    uint256 public constant VESTING_FREQUENCY = 1 days;

    // Used for calculating daily vested funds in calculateVestedTokens().
    uint256 private constant DAYS_IN_YEAR = 365;

    event NewGrant(address indexed _from, uint256 _value);
    event TokensUnlocked(address indexed _to, uint256 _value);
    event GrantRevoked(address indexed _holder, uint256 _refund);

    /// @dev Reverts if Kin token or Kin Foundation addresses are set to zero.
    modifier initialized() {
        require(kin != address(0) && kinFoundation != address(0));

        _;
    }

    /// @dev Reverts if the grant has not been given yet.
    modifier granted() {
        require(startTime != 0);

        _;
    }

    /// @dev Reverts if the grant has been given already.
    modifier notGranted() {
        require(startTime == 0);

        _;
   }

    /// @dev Reverts if called by anyone besides Kin Foundation wallet address.
    modifier onlyKinFoundation() {
        require(msg.sender == kinFoundation);

        _;
    }

    /// @dev Constructor that initializes the address of the KinToken contract.
    /// @param _kin KinToken The address of the previously deployed KinToken smart contract.
    /// @param _kinFoundation address The address of Kin Foundation wallet.
    function KinFoundationVestingTrustee(KinToken _kin, address _kinFoundation) {
        require(_kin != address(0));
        require(_kinFoundation != address(0));

        kin = _kin;
        kinFoundation = _kinFoundation;
    }

    /// @dev Revoke the grant by invalidating members and transfer all remaining funds back to owner.
    function revoke() external onlyOwner initialized granted {
        // Don't allow to revoke if there isn't any KIN left.
        // This means all tokens have already been unlocked.
        require(kin.balanceOf(this) > 0);

        // Transfer (remaining) funds to owner.
        uint256 refund = kin.balanceOf(this);
        kin.transfer(owner, refund);

        GrantRevoked(kinFoundation, refund);

        // Clear token, Kin Foundation addresses, and vesting time.
        kin = (KinToken)(0);
        kinFoundation = 0;
        startTime = 0;
    }

    /// @dev Grant tokens to Kin Foundation with a yearly vesting schedule.
    /// @param _startTime uint256 Vesting start time.
    function grant(uint256 _startTime) external onlyOwner initialized notGranted {
        // Given start time must be valid.
        require(_startTime > 0);

        // Require that the grant doesn't exceed the vesting contract balance.
        //
        // NOTE the current ANNUAL_GRANTS array length does not cause out of gas errors.
        uint256 funds = 0;
        for (uint256 i = 0; i < ANNUAL_GRANTS.length; ++i) {
            funds = funds.add(ANNUAL_GRANTS[i]);
        }
        assert(funds <= kin.balanceOf(address(this)));

        // Enable grant, by setting start, end time.
        startTime = _startTime;

        NewGrant(msg.sender, funds);
    }

    /// @dev Calculate amount of vested tokens at a specific time.
    /// @param _time uint256 The time to calculate vested tokens by.
    /// @return a uint256 representing the amount of vested tokens.
    function calculateVestedTokens(uint256 _time) public constant initialized granted returns (uint256) {
        // If we're before the start of the vesting period, then nothing is vested.
        if (_time < startTime) {
            return 0;
        }

        // If we're after the end of the vesting period - everything is vested.
        if (_time >= startTime.add(TOTAL_VESTING_TIME)) {
            return kin.balanceOf(address(this));
        }

        // Add all grants from past years, not including the current one.
        uint256 yearsPast = _time.sub(startTime).div(1 years);
        uint256 funds = 0;
        for (uint256 i = 0; i < yearsPast; ++i) {
            funds = funds.add(ANNUAL_GRANTS[i]);
        }

        // For the current year, add the amount of funds granted on a daily basis.
        uint256 periodsPast = _time.sub(startTime).sub(yearsPast.mul(1 years)).div(VESTING_FREQUENCY);
        uint256 vestingPeriodsPast = ANNUAL_GRANTS[yearsPast].mul(periodsPast).div(DAYS_IN_YEAR);
        funds = funds.add(vestingPeriodsPast);

        return funds;
    }

    /// @dev Unlock vested tokens and transfer them to Kin Foundation wallet.
    function unlockVestedTokens() external onlyKinFoundation initialized granted {
        // Get the total amount of vested tokens, according to grant.
        uint256 vested = calculateVestedTokens(now);
        if (vested == 0) {
            return;
        }

        // Make sure the grantee only gets the remaining vested funds that were not transferred to it yet.
        uint256 transferable = vested.sub(transferred);
        if (transferable == 0) {
            return;
        }

        transferred = transferred.add(transferable);
        kin.transfer(msg.sender, transferable);

        TokensUnlocked(msg.sender, transferable);
    }
}
