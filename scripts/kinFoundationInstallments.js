// Generate annual grants values for the Kin Foundation vesting trustee.
//
// This script prints a JSON number array to STDOUT where each element, along
// with its location in the array, represents that year’s grant, which is 20%
// of the remaining token allocation. The last (60th) year includes all
// remaining unvested KIN that should be vested that on that year and in all
// the following ones.

const BigNumber = require('bignumber.js');

const ONE_TRILLION = new BigNumber(10).pow(12);
const TEN_TRILLION = ONE_TRILLION.mul(10);

// The Kin Foundation will be vested with 60% of the global KIN allocation.
const KIN_FOUNDATION_PERCENTAGE = new BigNumber(60).div(100);

// Using same decimal value as ETH (makes ETH-KIN conversion much easier).
const TOKEN_UNITS = new BigNumber(10).pow(18);

// Percentage of remaining allocation that should be vested every year.
const INSTALLMENT_PERCENTAGE = new BigNumber(20).div(100);

// Vesting schedule length.
const YEARS = new BigNumber(60);

let ALLOCATION = (
    TEN_TRILLION.
    mul(TOKEN_UNITS).
    mul(KIN_FOUNDATION_PERCENTAGE));

let INSTALLMENTS = [];
for (let y = 0; y < YEARS; ++y) {
    let installment;
    if (y < YEARS - 1) {
        // Each element member, along with its index, represents that year's grant.
        // Append it to the array.
        installment = ALLOCATION.mul(INSTALLMENT_PERCENTAGE).floor();
    } else {
        // For the 60th (last) year, sum all remaining KIN.
        installment = ALLOCATION;
    }

    INSTALLMENTS.push(installment);
    ALLOCATION = ALLOCATION.minus(installment);
}

// Print JSON array to STDOUT.
console.log(JSON.stringify(INSTALLMENTS));
