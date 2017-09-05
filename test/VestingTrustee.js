import expectRevert from './helpers/expectRevert';
import time from './helpers/time';

const KinToken = artifacts.require('../contracts/KinToken.sol');
const VestingTrustee = artifacts.require('../contracts/VestingTrustee.sol');

contract('VestingTrustee', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * 60;
    const MONTH = 30 * DAY;
    const YEAR = 12 * MONTH;

    let now;
    let granter = accounts[0];
    let token;
    let trustee;

    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

        token = await KinToken.new();
        trustee = await VestingTrustee.new(token.address, {from: granter});
    });

    const getGrant = async (address) => {
        let grant = await trustee.grants(address);

        return {
            value: grant[0],
            start: grant[1],
            cliff: grant[2],
            end: grant[3],
            installmentLength: grant[4],
            transferred: grant[5],
            revokable: grant[6]
        };
    };

    describe('construction', async () => {
        it('should be initialized with a valid address', async () => {
            await expectRevert(VestingTrustee.new());
        });

        it('should be ownable', async () => {
            assert.equal(await trustee.owner(), accounts[0]);
        });

        let balance = 1000;
        context(`with ${balance} tokens assigned to the trustee`, async () => {
            beforeEach(async () => {
                await token.mint(trustee.address, balance);
            });

            it(`should equal to ${balance}`, async () => {
                let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                assert.equal(trusteeBalance, balance);
            });

            it('should be able to update', async () => {
                let value = 10;

                await token.mint(trustee.address, value);
                let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                assert.equal(trusteeBalance, balance + value);
            });
        });
    });

    describe('grant', async () => {
        let balance = 10000;

        context(`with ${balance} tokens assigned to the trustee`, async () => {
            beforeEach(async () => {
                await token.mint(trustee.address, balance);
            });

            it('should initially have no grants', async () => {
                assert.equal((await trustee.totalVesting()).toNumber(), 0);
            });

            it('should not allow granting to 0', async () => {
                await expectRevert(trustee.grant(0, 1000, now, now, now + 10 * YEAR, 1 * DAY, false));
            });

            it('should not allow granting to self', async () => {
                await expectRevert(trustee.grant(trustee.address, 1000, now, now, now + 10 * YEAR, 1 * DAY, false));
            });

            it('should not allow granting 0 tokens', async () => {
                await expectRevert(trustee.grant(accounts[0], 0, now, now, now + 3 * YEAR, 1 * DAY, false));
            });

            it('should not allow granting with a cliff before the start', async () => {
                await expectRevert(trustee.grant(accounts[0], 0, now, now - 1, now + 10 * YEAR, 1 * DAY, false));
            });

            it('should not allow granting with a cliff after the vesting', async () => {
                await expectRevert(trustee.grant(accounts[0], 0, now, now + YEAR, now + MONTH, 1 * DAY, false));
            });

            it('should not allow granting with 0 installment', async () => {
                await expectRevert(trustee.grant(accounts[0], 0, now, now + YEAR, now + MONTH, 0, false));
            });

            it('should not allow granting with installment longer than the vesting period', async () => {
                await expectRevert(trustee.grant(accounts[0], 0, now, now + YEAR, now + MONTH, 2 * YEAR, false));
            });

            it('should not allow granting tokens more than once', async () => {
                await trustee.grant(accounts[0], 1000, now, now, now + 10 * YEAR, 1 * DAY, false);

                await expectRevert(trustee.grant(accounts[0], 1000, now, now, now + 10 * YEAR, 1 * DAY, false));
            });

            it('should not allow granting from not an owner', async () => {
                await expectRevert(trustee.grant(accounts[0], 1000, now, now + MONTH, now + YEAR, 1 * DAY, false,
                    {from: accounts[1]}));
            });

            it('should not allow granting more than the balance in a single grant', async () => {
                await expectRevert(trustee.grant(accounts[0], balance + 1, now, now + MONTH, now + YEAR, 1 * DAY, false));
            });

            it('should not allow granting more than the balance in multiple grants', async () => {
                await trustee.grant(accounts[0], balance - 10, now, now + MONTH, now + YEAR, 1 * DAY, false);
                await trustee.grant(accounts[1], 7, now, now + MONTH, now + YEAR, 1 * DAY, false);
                await trustee.grant(accounts[2], 3, now, now + 5 * MONTH, now + YEAR, 1 * DAY, false);

                await expectRevert(trustee.grant(accounts[3], 1, now, now, now + YEAR, 1 * DAY, false));
            });

            it('should record a grant and increase grants count and total vesting', async () => {
                let totalVesting = (await trustee.totalVesting()).toNumber();
                assert.equal(totalVesting, 0);

                let value = 1000;
                let start = now;
                let cliff = now + MONTH;
                let end = now + YEAR;
                let installmentLength = 1 * DAY;
                await trustee.grant(accounts[0], value, start, cliff, end, installmentLength, false);

                assert.equal((await trustee.totalVesting()).toNumber(), totalVesting + value);
                let grant = await getGrant(accounts[0]);
                assert.equal(grant.value, value);
                assert.equal(grant.start, start);
                assert.equal(grant.cliff, cliff);
                assert.equal(grant.end, end);
                assert.equal(grant.installmentLength, installmentLength);
                assert.equal(grant.transferred, 0);

                let value2 = 2300;
                let start2 = now + 2 * MONTH;
                let cliff2 = now + 6 * MONTH;
                let end2 = now + YEAR;
                let installmentLength2 = 3 * MONTH;
                await trustee.grant(accounts[1], value2, start2, cliff2, end2, installmentLength2, false);

                assert.equal((await trustee.totalVesting()).toNumber(), totalVesting + value + value2);
                let grant2 = await getGrant(accounts[1]);
                assert.equal(grant2.value, value2);
                assert.equal(grant2.start, start2);
                assert.equal(grant2.cliff, cliff2);
                assert.equal(grant2.end, end2);
                assert.equal(grant2.installmentLength, installmentLength2);
                assert.equal(grant2.transferred, 0);
            });
        });
    });

    describe('revoke', async () => {
        let grantee = accounts[1];
        let notOwner = accounts[9];
        let balance = 100000;

        context(`with ${balance} tokens assigned to the trustee`, async () => {
            beforeEach(async () => {
                await token.mint(trustee.address, balance);
            });

            context('after minting has ended', async () => {
                beforeEach(async () => {
                    await token.endMinting();
                });

                it('should throw an error when revoking a non-existing grant', async () => {
                    await expectRevert(trustee.revoke(accounts[9]));
                });

                it('should not be able to revoke a non-revokable grant', async () => {
                    await trustee.grant(grantee, balance, now, now + MONTH, now + YEAR, 1 * DAY, false);

                    await expectRevert(trustee.revoke(grantee));
                });

                it('should only allow revoking a grant by an owner', async () => {
                    let grantee = accounts[1];

                    await trustee.grant(grantee, balance, now, now + MONTH, now + YEAR, 1 * DAY, true);
                    await expectRevert(trustee.revoke(grantee, {from: accounts[9]}));

                    await trustee.revoke(grantee, {from: granter});
                });
            });

            [
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: DAY, unlocked: 83 },
                        // 1 second after che cliff and previous unlock/withdraw.
                        { diff: 1, unlocked: 0 },
                        // 1 month after the cliff.
                        { diff: MONTH - 1, unlocked: 83 },
                        // At half of the vesting period.
                        { diff: 4 * MONTH, unlocked: 1000 / 2 - 2 * 83 },
                        // At the end of the vesting period.
                        { diff: 6 * MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: DAY, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: DAY, unlocked: 83 },
                        // 1 second before the installment length.
                        { diff: DAY - 1, unlocked: 0 },
                        // Instalment length.
                        { diff: 1, unlocked: 2 },
                        // 1 month after the cliff.
                        { diff: MONTH - 1, unlocked: 81 },
                        // 1000 seconds before the installment length.
                        { diff: DAY - 1000, unlocked: 0 },
                         // Another instalment length.
                        { diff: 1000, unlocked: 2 },
                        // At half of the vesting period.
                        { diff: 4 * MONTH, unlocked: 1000 / 2 - 83 - 2 - 81 - 2 },
                        // At the end of the vesting period.
                        { diff: 6 * MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: YEAR + DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: YEAR - DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: YEAR + DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: YEAR - DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: 0, endOffset: YEAR, installmentLength: 3 * MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the start of the vesting.
                        { diff: DAY, unlocked: 0 },
                        // 1 month after the start of the vesting.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // 2 months after the start of the vesting.
                        { diff: MONTH, unlocked: 0 },
                        // 3 months after the start of the vesting.
                        { diff: MONTH, unlocked: 250 },
                        { diff: MONTH, unlocked: 0 },
                        // Another installment.
                        { diff: 2 * MONTH, unlocked: 250 },
                        // After the vesting period.
                        { diff: YEAR, unlocked: 1000 - 2 * 250 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 2 * YEAR, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: YEAR, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 2 },
                        { diff: YEAR, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 2 },
                        { diff: YEAR, unlocked: 0 }
                    ]
                }
            ].forEach(async (grant) => {
                context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                    `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {
                    // We'd allow (up to) 10 tokens vesting error, due to possible timing differences during the tests.
                    const MAX_ERROR = 10;

                    let holder = accounts[1];

                    for (let i = 0; i < grant.results.length; ++i) {
                        it(`should revoke the grant and refund tokens after ${i + 1} transactions`, async () => {
                            trustee = await VestingTrustee.new(token.address, {from: granter});
                            await token.mint(trustee.address, grant.tokens);
                            await token.endMinting();
                            await trustee.grant(holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset,
                                now + grant.endOffset, grant.installmentLength, true);

                            // Get previous state.
                            let totalVesting = (await trustee.totalVesting()).toNumber();
                            let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                            let userBalance = (await token.balanceOf(holder)).toNumber();
                            let transferred = (await getGrant(holder)).transferred.toNumber();
                            let granterBalance = (await token.balanceOf(granter)).toNumber();

                            let totalUnlocked = 0;

                            for (let j = 0; j <= i; ++j) {
                                let res = grant.results[j];

                                // Jump forward in time by the requested diff.
                                await time.increaseTime(res.diff);
                                await trustee.unlockVestedTokens({from: holder});

                                totalUnlocked += res.unlocked;
                            }

                            // Verify the state after the multiple unlocks.
                            let totalVesting2 = (await trustee.totalVesting()).toNumber();
                            let trusteeBalance2 = (await token.balanceOf(trustee.address)).toNumber();
                            let userBalance2 = (await token.balanceOf(holder)).toNumber();
                            let transferred2 = (await getGrant(holder)).transferred.toNumber();

                            assert.approximately(totalVesting2, totalVesting - totalUnlocked, MAX_ERROR);
                            assert.approximately(trusteeBalance2, trusteeBalance - totalUnlocked, MAX_ERROR);
                            assert.approximately(userBalance2, userBalance + totalUnlocked, MAX_ERROR);
                            assert.approximately(transferred2, transferred + totalUnlocked, MAX_ERROR);

                            let refundTokens = grant.tokens - totalUnlocked;

                            console.log(`\texpecting ${refundTokens} tokens refunded after ${i + 1} transactions`);

                            let vestingGrant = await getGrant(holder);
                            assert.equal(vestingGrant.value, grant.tokens);

                            await trustee.revoke(holder);

                            let totalVesting3 = (await trustee.totalVesting()).toNumber();
                            let trusteeBalance3 = (await token.balanceOf(trustee.address)).toNumber();
                            let userBalance3 = (await token.balanceOf(holder)).toNumber();
                            let granterBalance2 = (await token.balanceOf(granter)).toNumber();

                            assert.approximately(totalVesting3, totalVesting2 - refundTokens, MAX_ERROR);
                            assert.approximately(trusteeBalance3, trusteeBalance2 - refundTokens, MAX_ERROR);
                            assert.equal(userBalance3, userBalance2);
                            assert.approximately(granterBalance2, granterBalance + refundTokens, MAX_ERROR);

                            let vestingGrant2 = await getGrant(holder);
                            assert.equal(vestingGrant2.tokens, undefined);
                        });
                    }
                });
            });
        });
    });

    describe('vestedTokens', async () => {
        let balance = 10 ** 12;

        beforeEach(async () => {
            await token.mint(trustee.address, balance);
        });

        it('should return 0 for non existing grant', async () => {
            let holder = accounts[5];
            let grant = await getGrant(holder);

            assert.equal(grant.value, 0);
            assert.equal((await trustee.vestedTokens(holder, now + 100 * YEAR)).toNumber(), 0);
        });

        [
            {
                tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH - 1, vested: 0 },
                    { offset: MONTH, vested: Math.floor(1000 / 12) },
                    { offset: MONTH + 0.5 * DAY, vested: Math.floor(1000 / 12) + Math.floor(0.5 * (1000 / 12 / 30)) },
                    { offset: 2 * MONTH, vested: 2 * Math.floor(1000 / 12) },
                    { offset: 0.5 * YEAR, vested: 1000 / 2 },
                    { offset: 0.5 * YEAR + 3 * DAY, vested: 1000 / 2 + Math.floor(3 * (1000 / 12 / 30)) },
                    { offset: YEAR, vested: 1000 },
                    { offset: YEAR + DAY, vested: 1000 }
                ]
            },
            {
                tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: DAY, results: [
                    { offset: 0, vested: 0 },
                    { offset: DAY, vested: 0 },
                    { offset: MONTH - 1, vested: 0 },
                    { offset: MONTH, vested: Math.floor(1000 / 12) },
                    { offset: MONTH + 1, vested: Math.floor(1000 / 12) },
                    { offset: MONTH + 1000, vested: Math.floor(1000 / 12) },
                    { offset: MONTH + DAY, vested: Math.floor(1000 / 12 + 1000 / 12 / 30) },
                    { offset: 2 * MONTH, vested: 2 * Math.floor(1000 / 12) },
                    { offset: 2 * MONTH + 1, vested: Math.floor(2 * (1000 / 12)) },
                    { offset: 2 * MONTH + 0.5 * DAY, vested: Math.floor(2 * (1000 / 12)) },
                    { offset: 2 * MONTH + 5 * DAY, vested: Math.floor(2 * (1000 / 12) + 5 * (1000 / 12 / 30)) },
                    { offset: 0.5 * YEAR, vested: 1000 / 2 },
                    { offset: YEAR, vested: 1000 },
                    { offset: YEAR + DAY, vested: 1000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: Math.floor(10000 / 12 / 4) },
                    { offset: 0.5 * YEAR, vested: 10000 / 8 },
                    { offset: YEAR, vested: 10000 / 4 },
                    { offset: 2 * YEAR, vested: 10000 / 2 },
                    { offset: 3 * YEAR, vested: 10000 * 0.75 },
                    { offset: 4 * YEAR, vested: 10000 },
                    { offset: 4 * YEAR + MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: MONTH, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: Math.floor(10000 / 12 / 4) },
                    { offset: MONTH + DAY, vested: Math.floor(10000 / 12 / 4) },
                    { offset: MONTH + 10 * DAY, vested: Math.floor(10000 / 12 / 4) },
                    { offset: 2 * MONTH, vested: 2 * Math.floor(10000 / 12 / 4) },
                    { offset: 0.5 * YEAR, vested: 10000 / 8 },
                    { offset: 0.5 * YEAR + 10 * DAY, vested: 10000 / 8 },
                    { offset: YEAR, vested: 10000 / 4 },
                    { offset: YEAR + DAY, vested: 10000 / 4 },
                    { offset: 2 * YEAR, vested: 10000 / 2 },
                    { offset: 3 * YEAR, vested: 10000 * 0.75 },
                    { offset: 4 * YEAR, vested: 10000 },
                    { offset: 4 * YEAR + MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: YEAR, endOffset: 4 * YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: 0 },
                    { offset: 0.5 * YEAR, vested: 0 },
                    { offset: YEAR, vested: 10000 / 4 },
                    { offset: YEAR + MONTH, vested:  Math.floor(10000 / 4 + 10000 / 4 / 12) },
                    { offset: YEAR + 2 * MONTH, vested: Math.floor(10000 / 4 + 2 * (10000 / 4 / 12)) },
                    { offset: YEAR + 3 * MONTH, vested: Math.floor(10000 / 4 + 3 * (10000 / 4 / 12)) },
                    { offset: 2 * YEAR, vested: 10000 / 2 },
                    { offset: 3 * YEAR, vested: 10000 * 0.75 },
                    { offset: 3 * YEAR + MONTH, vested: Math.floor(10000 * 0.75 + 10000 / 4 / 12) },
                    { offset: 3 * YEAR + 2 * MONTH, vested: Math.floor(10000 * 0.75 + 2 * (10000 / 4 / 12)) },
                    { offset: 3 * YEAR + 3 * MONTH, vested: Math.floor(10000 * 0.75 + 3 * (10000 / 4 / 12)) },                    { offset: 4 * YEAR, vested: 10000 },
                    { offset: 4 * YEAR + MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: YEAR, endOffset: 4 * YEAR, installmentLength: 3 * MONTH, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: 0 },
                    { offset: 0.5 * YEAR, vested: 0 },
                    { offset: YEAR, vested: 10000 / 4 },
                    { offset: YEAR + MONTH, vested: 10000 / 4 },
                    { offset: YEAR + 2 * MONTH, vested: 10000 / 4 },
                    { offset: YEAR + 3 * MONTH, vested: Math.floor(10000 / 4 + 3 * (10000 / 4 / 12)) },
                    { offset: 2 * YEAR, vested: 10000 / 2 },
                    { offset: 3 * YEAR, vested: 10000 * 0.75 },
                    { offset: 3 * YEAR + MONTH, vested: 10000 * 0.75 },
                    { offset: 3 * YEAR + 2 * MONTH, vested: 10000 * 0.75 },
                    { offset: 3 * YEAR + 3 * MONTH, vested: Math.floor(10000 * 0.75 + 3 * (10000 / 4 / 12)) },
                    { offset: 4 * YEAR, vested: 10000 },
                    { offset: 4 * YEAR + MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 100000000, startOffset: 0, cliffOffset: 0, endOffset: 2 * YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: Math.floor(100000000 / 12 / 2) },
                    { offset: 2 * MONTH, vested: Math.floor(2 * (100000000 / 12 / 2)) },
                    { offset: 0.5 * YEAR, vested: 100000000 / 4 },
                    { offset: YEAR, vested: 100000000 / 2 },
                    { offset: 2 * YEAR, vested: 100000000 },
                    { offset: 3 * YEAR, vested: 100000000 }
                ]
            },
            {
                tokens: 100000000, startOffset: 0, cliffOffset: 0, endOffset: 2 * YEAR, installmentLength: YEAR, results: [
                    { offset: 0, vested: 0 },
                    { offset: MONTH, vested: 0 },
                    { offset: 2 * MONTH, vested: 0 },
                    { offset: 0.5 * YEAR, vested: 0 },
                    { offset: YEAR, vested: 100000000 / 2 },
                    { offset: YEAR + MONTH, vested: 100000000 / 2 },
                    { offset: YEAR + 2 * MONTH, vested: 100000000 / 2 },
                    { offset: YEAR + 10 * MONTH, vested: 100000000 / 2 },
                    { offset: 2 * YEAR, vested: 100000000 },
                    { offset: 3 * YEAR, vested: 100000000 }
                ]
            },
        ].forEach((grant) => {
            context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {

                beforeEach(async () => {
                    await trustee.grant(accounts[2], grant.tokens, now + grant.startOffset, now + grant.cliffOffset,
                        now + grant.endOffset, grant.installmentLength, false);
                });

                grant.results.forEach(async (res) => {
                    it(`should vest ${res.vested} out of ${grant.tokens} at time offset ${res.offset}`, async () => {
                        let result = (await trustee.vestedTokens(accounts[2], now + res.offset)).toNumber();
                        assert.equal(result, res.vested);
                    });
                });
            });
        });
    });

    describe('unlockVestedTokens', async () => {
        // We'd allow (up to) 10 tokens vesting error, due to possible timing differences during the tests.
        const MAX_ERROR = 10;

        let balance = 10 ** 12;

        beforeEach(async () => {
            await token.mint(trustee.address, balance);
        });

        context('after minting has ended', async () => {
            beforeEach(async () => {
                await token.endMinting();
            });

            it('should not allow unlocking a non-existing grant', async () => {
                let holder = accounts[5];
                let grant = await getGrant(holder);

                assert.equal(grant.value, 0);

                await expectRevert(trustee.unlockVestedTokens({from: holder}));
            });

            it('should not allow unlocking a rovoked grant', async () => {
                let grantee = accounts[1];

                await trustee.grant(grantee, balance, now, now + MONTH, now + YEAR, 1 * DAY, true);
                await trustee.revoke(grantee, {from: granter});

                await expectRevert(trustee.unlockVestedTokens({from: granter}));
            });

            [
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: DAY, unlocked: 83 },
                        // 1 second after che cliff and previous unlock/withdraw.
                        { diff: 1, unlocked: 0 },
                        // 1 month after the cliff.
                        { diff: MONTH - 1, unlocked: 83 },
                        // At half of the vesting period.
                        { diff: 4 * MONTH, unlocked: 1000 / 2 - 2 * 83 },
                        // At the end of the vesting period.
                        { diff: 6 * MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: DAY, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: DAY, unlocked: 83 },
                        // 1 second before the installment length.
                        { diff: DAY - 1, unlocked: 0 },
                        // Instalment length.
                        { diff: 1, unlocked: 2 },
                        // 1 month after the cliff.
                        { diff: MONTH - 1, unlocked: 81 },
                        // 1000 seconds before the installment length.
                        { diff: DAY - 1000, unlocked: 0 },
                         // Another instalment length.
                        { diff: 1000, unlocked: 2 },
                        // At half of the vesting period.
                        { diff: 4 * MONTH, unlocked: 1000 / 2 - 83 - 2 - 81 - 2 },
                        // At the end of the vesting period.
                        { diff: 6 * MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: YEAR + DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: YEAR - DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: YEAR + DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: YEAR - DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: 0, endOffset: YEAR, installmentLength: 3 * MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the start of the vesting.
                        { diff: DAY, unlocked: 0 },
                        // 1 month after the start of the vesting.
                        { diff: MONTH - DAY, unlocked: 0 },
                        // 2 months after the start of the vesting.
                        { diff: MONTH, unlocked: 0 },
                        // 3 months after the start of the vesting.
                        { diff: MONTH, unlocked: 250 },
                        { diff: MONTH, unlocked: 0 },
                        // Another installment.
                        { diff: 2 * MONTH, unlocked: 250 },
                        // After the vesting period.
                        { diff: YEAR, unlocked: 1000 - 2 * 250 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 1000000 / 4 },
                        { diff: YEAR, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 2 * YEAR, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: YEAR, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 2 },
                        { diff: YEAR, unlocked: 0 },
                        { diff: YEAR, unlocked: 1000000 / 2 },
                        { diff: YEAR, unlocked: 0 }
                    ]
                }
            ].forEach(async (grant) => {
                context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                    `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {

                    let holder = accounts[1];

                    beforeEach(async () => {
                        await trustee.grant(holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset, now +
                            grant.endOffset, grant.installmentLength, false);
                    });

                    it('should unlock tokens according to the schedule', async () => {
                        for (let res of grant.results) {
                            console.log(`\texpecting ${res.unlocked} tokens unlocked and transferred after another ` +
                                `${res.diff} seconds`);

                            // Get previous state.
                            let totalVesting = (await trustee.totalVesting()).toNumber();
                            let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                            let userBalance = (await token.balanceOf(holder)).toNumber();
                            let transferred = (await getGrant(holder)).transferred.toNumber();

                            // Jump forward in time by the requested diff.
                            await time.increaseTime(res.diff);
                            await trustee.unlockVestedTokens({from: holder});

                            // Verify new state.
                            let totalVesting2 = (await trustee.totalVesting()).toNumber();
                            let trusteeBalance2 = (await token.balanceOf(trustee.address)).toNumber();
                            let userBalance2 = (await token.balanceOf(holder)).toNumber();
                            let transferred2 = (await getGrant(holder)).transferred.toNumber();

                            assert.approximately(totalVesting2, totalVesting - res.unlocked, MAX_ERROR);
                            assert.approximately(trusteeBalance2, trusteeBalance - res.unlocked, MAX_ERROR);
                            assert.approximately(userBalance2, userBalance + res.unlocked, MAX_ERROR);
                            assert.approximately(transferred2, transferred + res.unlocked, MAX_ERROR);
                        }
                    });
                });
            });
        });

        it('should allow revoking multiple grants', async () => {
            let grants = [
                {tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, holder: accounts[1]},
                {tokens: 1000, startOffset: 0, cliffOffset: MONTH, endOffset: YEAR, installmentLength: 1, holder: accounts[2]},
                {tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * YEAR, installmentLength: 1, holder: accounts[3]},
                {tokens: 1245, startOffset: 0, cliffOffset: 0, endOffset: 1 * YEAR, installmentLength: 1, holder: accounts[4]},
                {tokens: 233223, startOffset: 0, cliffOffset: 2 * MONTH, endOffset: 2 * YEAR, installmentLength: 1, holder: accounts[5]}
            ];

            let granterBalance = (await token.balanceOf(granter)).toNumber();
            let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
            assert.equal(granterBalance, 0);
            assert.equal(trusteeBalance, balance);

            let totalGranted = 0;

            for (let grant of grants) {
                await token.mint(trustee.address, grant.tokens);
                await trustee.grant(grant.holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset, now +
                    grant.endOffset, grant.installmentLength, true);

                totalGranted += grant.tokens;
            }

            await token.endMinting();

            let granterBalance2 = (await token.balanceOf(granter)).toNumber();
            let trusteeBalance2 = (await token.balanceOf(trustee.address)).toNumber();
            assert.equal(granterBalance2, 0);
            assert.equal(trusteeBalance2, trusteeBalance + totalGranted);

            for (let grant of grants) {
                await trustee.revoke(grant.holder);
            }

            let granterBalance3 = (await token.balanceOf(granter)).toNumber();
            let trusteeBalance3 = (await token.balanceOf(trustee.address)).toNumber();
            assert.equal(granterBalance3, totalGranted);
            assert.equal(trusteeBalance3, trusteeBalance2 - totalGranted);
        });
    });

    describe('events', async () => {
        const balance = 10000;
        const grantee = accounts[1];

        let value;
        let start;
        let cliff;
        let end;
        let installmentLength;

        beforeEach(async () => {
            await token.mint(trustee.address, balance);
            await token.endMinting();

            value = 1000;
            start = now;
            cliff = now + MONTH;
            end = now + YEAR;
            installmentLength = 1 * DAY;
        });

        it('should emit events when granting vesting', async () => {
            let result = await trustee.grant(grantee, value, start, cliff, end, installmentLength, false);

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'NewGrant');
            assert.equal(event.args._from, granter);
            assert.equal(event.args._to, grantee);
            assert.equal(Number(event.args._value), value);
        });

        it('should emit events when revoking a grant', async () => {
            await trustee.grant(grantee, value, start, cliff, end, installmentLength, true);
            let result = await trustee.revoke(grantee);

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'GrantRevoked');
            assert.equal(event.args._holder, grantee);
            assert.equal(Number(event.args._refund), value);
        });

        it('should emit events when unlocking tokens', async () => {
            await trustee.grant(grantee, value, start, cliff, end, installmentLength, true);
            await time.increaseTime(cliff);
            let result = await trustee.unlockVestedTokens({from: grantee});

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'TokensUnlocked');
            assert.equal(event.args._to, grantee);
            assert.equal(Number(event.args._value), value);
        });
    });
});
