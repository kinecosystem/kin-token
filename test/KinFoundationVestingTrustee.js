import BigNumber from 'bignumber.js';
import expectRevert from './helpers/expectRevert';
import time from './helpers/time';

const KinToken = artifacts.require('../contracts/KinToken.sol');
const KinFoundationVestingTrustee = artifacts.require('../contracts/KinFoundationVestingTrusteeMock.sol');

contract('KinFoundationVestingTrustee', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const WEEK = 7 * DAY;
    const YEAR = 365 * DAY;

    const VESTING_FREQUENCY = 1 * DAY;
    const DAYS_IN_YEAR = 365;

    const TEN_TRILLION = new BigNumber(10).pow(13);
    const TOKEN_DECIMALS = new BigNumber(10).pow(18);

    // 60% of created tokens are allocated to Kin Foundation.
    const TOTAL_ALLOCATION = (
        TEN_TRILLION.
        mul(TOKEN_DECIMALS).
        mul(60).
        div(100).
        floor());

    // 20% of remaining trustee balance are vested every year.
    const ANNUAL_GRANT_PERCENTAGE = new BigNumber(20).div(100);
    const ANNUAL_GRANTS_YEARS = 60;

    // Generates annual grants array for years 0 till 60.
    const generateAnnualGrants = () => {
        let vesting = TOTAL_ALLOCATION;
        let annualGrants = [];

        for (let year = 0; year < ANNUAL_GRANTS_YEARS; ++year) {
            let grant;
            if (year < ANNUAL_GRANTS_YEARS - 1) {
                grant = vesting.mul(ANNUAL_GRANT_PERCENTAGE);
            } else {
                // Last year should transfer all remaining funds.
                grant = vesting;
            }
            annualGrants.push(grant);
            vesting = vesting.minus(grant);
        }

        return annualGrants;
    };

    const ANNUAL_GRANTS = generateAnnualGrants();

    let now;
    let owner = accounts[0];
    let kinFoundation = accounts[1];
    let stranger = accounts[2];
    let token;
    let trustee;

    // Initialize time.
    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

        token = await KinToken.new();
    });

    describe('construction', async () => {
        it('test annual grants against hard coded values', async () => {
            assert.lengthOf(ANNUAL_GRANTS, 60);

            assert.equal(ANNUAL_GRANTS[0].toNumber(), 1.2e30);
            assert.equal(ANNUAL_GRANTS[1].toNumber(), 9.6e29);
            assert.equal(ANNUAL_GRANTS[7].toNumber(), 2.5165824e29);
            assert.equal(ANNUAL_GRANTS[59].toNumber(), 1.1493716556494166437687604e25);
        });

        it('should not allow to initialize with 0 kin token address', async () => {
            await expectRevert(KinFoundationVestingTrustee.new(0, kinFoundation));
        });

        it('should not allow to initialize with null kin token address', async () => {
            await expectRevert(KinFoundationVestingTrustee.new(0, kinFoundation));
        });

        it('should not allow to initialize with 0 kin foundation address', async () => {
            await expectRevert(KinFoundationVestingTrustee.new(token.address, 0));
        });

        it('should be initialized with valid members', async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);

            assert.equal(await trustee.kin(), token.address);
            assert.equal(await trustee.kinFoundation(), kinFoundation);
            assert.equal(await trustee.startTime(), 0);
            assert.equal(await trustee.transferred(), 0);
        });

        it('should be initialized with valid vesting period values', async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);

            assert.equal(await trustee.getAnnualGrantsLength(), ANNUAL_GRANTS_YEARS);

            let vesting = TOTAL_ALLOCATION;
            let annualGrants = [];
            for (let year = 0; year < ANNUAL_GRANTS_YEARS; ++year) {
                console.log(`\tTesting vesting grant for year ${year} ...`);

                let grant;
                if (year < ANNUAL_GRANTS_YEARS - 1) {
                    grant = vesting.mul(ANNUAL_GRANT_PERCENTAGE);
                } else {
                    // Last year should transfer all remaining funds.
                    grant = vesting;
                }

                annualGrants.push(grant);
                vesting = vesting.minus(grant);

                assert.equal((await trustee.ANNUAL_GRANTS(year)).toNumber(), ANNUAL_GRANTS[year].toNumber());
            }

            // Test all annual grants sum up to entire allocation.
            assert.equal(annualGrants.reduce((a, b) => b.plus(a), 0).toNumber(), TOTAL_ALLOCATION.toNumber());
            assert.equal(vesting, 0);
        });

        context('with intialized vesting trustee', async () => {
            it('should be ownable', async () => {
                trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
                assert.equal(await trustee.owner(), owner);
            });

            let balance = 1000;
            context(`with ${balance} tokens assigned to the trustee`, async () => {
                beforeEach(async () => {
                    token = await KinToken.new();
                    trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
                    await token.mint(trustee.address, balance);
                });

                it(`should have balance of ${balance}`, async () => {
                    let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                    assert.equal(trusteeBalance, balance);
                });

                it('should be able to update balance', async () => {
                    let value = 10;

                    await token.mint(trustee.address, value);
                    let trusteeBalance = (await token.balanceOf(trustee.address)).toNumber();
                    assert.equal(trusteeBalance, balance + value);
                });
            });
        });
    });

    describe('grant', async () => {
        beforeEach(async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
            await token.mint(trustee.address, TOTAL_ALLOCATION);
        });

        it('should not allow granting tokens with 0 time', async () => {
            await expectRevert(trustee.grant(0));
        });

        it('should allow granting tokens with positive time', async () => {
            await trustee.grant(1);
        });

        it('should not allow granting tokens more than once', async () => {
            await trustee.grant(1);
            await expectRevert(trustee.grant(1));
        });

        it('should allow granting tokens with "now" time', async () => {
            await trustee.grant(now);
        });

        it('should allow granting tokens with "future" time', async () => {
            await trustee.grant(now + 1000);
        });

        it('should initialize a proper grant', async () => {
            await trustee.grant(now);

            assert.equal((await trustee.startTime()).toNumber(), now);
        });
    });

    // Returns vested tokens accoridng to given year and day in the year.
    const calculateVestedTokens = (year, offset) => {
        // If we're before the start of the vesting period, then nothing is vested.
        if (year == 0 && offset == 0) {
            return new BigNumber(0);
        }

        // If we're after the end of the vesting period - everything is vested.
        if (year > 59) {
            return TOTAL_ALLOCATION;
        }

        // Add grants from all years up to the given one, not including.
        let vested = new BigNumber(0);
        for (let y = 0; y < year; ++y) {
            vested = vested.plus(ANNUAL_GRANTS[y]);
        }

        // Add this year's grant up to the current day.
        //
        // NOTE we use floor() to round up to the each day, ignoring additional minutes and hours in that day.
        const pastPeriods = new BigNumber(offset).div(VESTING_FREQUENCY).floor();
        const vestingPeriodsPast = ANNUAL_GRANTS[year].mul(pastPeriods).div(DAYS_IN_YEAR).floor();
        vested = vested.plus(vestingPeriodsPast);

        return vested;
    };

    describe('calculate vested tokens', async () => {
        it('should not allow to calculate tokens if vesting is not enabled', async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
            await token.mint(trustee.address, TOTAL_ALLOCATION);

            await expectRevert(trustee.calculateVestedTokens(0));
            await expectRevert(trustee.calculateVestedTokens(1));
            await expectRevert(trustee.calculateVestedTokens(now));
            await expectRevert(trustee.calculateVestedTokens(now + (1 * YEAR)));
        });

        context('should calculate correct amount of vested tokens', async () => {
            beforeEach(async () => {
                trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
                await token.mint(trustee.address, TOTAL_ALLOCATION);
                await trustee.grant(now);
            });

            it('before vesting has started', async () => {
                assert.equal((await trustee.calculateVestedTokens(now - 1)).toNumber(), 0);
                assert.equal((await trustee.calculateVestedTokens(now - 10)).toNumber(), 0);
                assert.equal((await trustee.calculateVestedTokens(now - 100)).toNumber(), 0);
            });

            it('after 61 years have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + 60 * YEAR)).toNumber(),
                    TOTAL_ALLOCATION.toNumber());
            });

            it('after 100 years have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + 100 * YEAR)).toNumber(),
                    TOTAL_ALLOCATION.toNumber());
            });

            it('after 1000 years have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + 1000 * YEAR)).toNumber(),
                    TOTAL_ALLOCATION.toNumber());
            });

            it('after 0 days have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now)).toNumber(), 0);
            });

            it('after 1 minute have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + (1 * MINUTE))).toNumber(), 0);
            });

            it('after 2 hours have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + (2 * HOUR))).toNumber(), 0);
            });

            it('after 1 days + 20 minutes have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + (1 * DAY) + (20 * MINUTE))).toNumber(),
                ANNUAL_GRANTS[0].mul(1).div(DAYS_IN_YEAR).toNumber());
            });

            it('after 2 days + 39 minutes have passed', async () => {
                assert.equal((await trustee.calculateVestedTokens(now + (2 * DAY) + (39 * MINUTE))).toNumber(),
                ANNUAL_GRANTS[0].mul(2).div(DAYS_IN_YEAR).toNumber());
            });

            it('after 1 year + 19 days have passed', async () => {
                let vested = new BigNumber(0);
                vested = vested.plus(ANNUAL_GRANTS[0]);
                vested = vested.plus(ANNUAL_GRANTS[1].mul(19).div(DAYS_IN_YEAR));
                assert.equal((await trustee.calculateVestedTokens(now + (1 * YEAR) + (19 * DAY))).toNumber(),
                    vested.toNumber());
            });

            it('after 20 years + 49 days + 6 minutes have passed', async () => {
                let vested = new BigNumber(0);
                for (let y = 0; y < 20; ++y) {
                    vested = vested.plus(ANNUAL_GRANTS[y]);
                }
                vested = vested.plus(ANNUAL_GRANTS[20].mul(49).div(DAYS_IN_YEAR));

                assert.equal((await trustee.calculateVestedTokens(now + (20 * YEAR) + (49 * DAY) + (6 * MINUTE))).toNumber(),
                    vested.toNumber());
            });

            [
                { desc: 'on the 1st day of every year + 12 hours', offset: (0 * DAY) + (12 * HOUR), },
                { desc: 'on the 2nd day of every year', offset: 1 * DAY, },
                { desc: 'on the 7th day of every year + 3 hours', offset: (1 * WEEK) + (3 * HOUR), },
                { desc: 'on the 30th day of every year', offset: 30 * DAY, },
                { desc: 'on the 120th day of every year + 20 minutes', offset: (120 * DAY) + (20 * MINUTE), },
                { desc: 'on the 182th day (middle) of every year', offset: Math.floor(YEAR / 2), },
                { desc: 'on the 240th day of every year + 23 hours + 59 minutes', offset: (240 * DAY) + (23 * HOUR) + (59 * MINUTE), },
                { desc: 'on the 364th day (end) of every year', offset: YEAR - 1, },
            ].forEach(async (t) => {
                context(`when attempting to calculate once ${t.desc}`, async () => {
                    // Test for all years, along with two years after vesting has finished.
                    for (let year = 0; year < ANNUAL_GRANTS_YEARS + 2; ++year) {
                        it(`Year ${year} ...`, async () => {
                            // Ignore hour, minute, second offset, and only take the day into account.
                            const day = Math.floor(t.offset / DAY);

                            const vested = calculateVestedTokens(year, day * DAY);
                            const currentTime = now + (year * YEAR) + t.offset;

                            // calculateVestedTokens() should ignore minute, hour offsets, and only take days into
                            // account.
                            assert.equal((await trustee.calculateVestedTokens(currentTime)).toNumber(),
                                vested.toNumber());
                        });
                    }
                });
            });
        });

        it('should not allow to unlock vested tokens from an account other than Kin Foundation', async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
            await token.mint(trustee.address, TOTAL_ALLOCATION);

            await trustee.grant(now);
            await expectRevert(trustee.unlockVestedTokens({from: owner}));
            await expectRevert(trustee.unlockVestedTokens({from: stranger}));
        });
    });

    const increaseTime = async (by) => {
        await time.increaseTime(by);
        now += by;
    };

    describe('unlock tokens', async () => {
        context('should transfer correct amount of vested tokens', async () => {
            beforeEach(async () => {
                trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
                await token.mint(trustee.address, TOTAL_ALLOCATION);
                await token.endMinting(); // Required for transferring tokens when calling unlockVestedTokens()
            });

            it('before vesting has started', async () => {
                await trustee.grant(now + 1 * YEAR);
                await trustee.unlockVestedTokens({from: kinFoundation});

                assert.equal((await token.balanceOf(kinFoundation)).toNumber(), 0);
                assert.equal((await token.balanceOf(trustee.address)).toNumber(), TOTAL_ALLOCATION.toNumber());
            });

            it('after vesting has ended', async () => {
                await trustee.grant(now);
                await increaseTime(60 * YEAR);
                await trustee.unlockVestedTokens({from: kinFoundation});

                assert.equal((await token.balanceOf(kinFoundation)).toNumber(), TOTAL_ALLOCATION.toNumber());
                assert.equal((await token.balanceOf(trustee.address)).toNumber(), 0);
            });
        });

        [
            { desc: 'on the 1st day of every year + 2 hours', offset: (0 * DAY) + (2 * HOUR), },
            { desc: 'on the 2nd day of every year', offset: 1 * DAY, },
            { desc: 'on the 7th day of every year + 8 hours', offset: (1 * WEEK) + (8 * HOUR), },
            { desc: 'on the 30th day of every year', offset: 30 * DAY, },
            { desc: 'on the 120th day of every year + 22 hours + 45 minutes', offset: (120 * DAY) + (22 * HOUR) + (45 * MINUTE), },
            { desc: 'on the 182th day (middle) of every year', offset: Math.floor(YEAR / 2), },
            { desc: 'on the 240th day of every year + 23 hours + 50 minutes', offset: (240 * DAY) + (23 * HOUR) + (50 * MINUTE), },
            { desc: 'on the 364th day (end) of every year + 18 hours', offset: (364 * DAY) + (18 * HOUR), },
        ].forEach(async (t) => {
            context(`should transfer correct amount of vested tokens when attempting to unlock ${t.desc}`, async () => {
                // We need to create a new token for every yearly test, because we have to end minting for transfers to \
                // be allowed.
                beforeEach(async () => {
                    token = await KinToken.new();
                    trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
                    await token.mint(trustee.address, TOTAL_ALLOCATION);

                    // Required for transferring tokens when calling unlockVestedTokens()
                    await token.endMinting();

                    await trustee.grant(now);
                });

                // Test for all years as well as two years after vesting has finished.
                for (let year = 0; year < ANNUAL_GRANTS_YEARS + 2; ++year) {
                    it(`Year ${year} ...`, async () => {
                        const vested = calculateVestedTokens(year, t.offset);
                        const vesting = TOTAL_ALLOCATION.minus(vested);

                        await increaseTime((year * YEAR) + t.offset + 100);

                        await trustee.unlockVestedTokens({from: kinFoundation});
                        assert.equal((await token.balanceOf(kinFoundation)).toNumber(), vested.toNumber());
                        assert.equal((await token.balanceOf(trustee.address)).toNumber(), vesting.toNumber());

                        // Values should be invariant when calling more than once on the same day.
                        for (let unlock = 0; unlock < 3; ++unlock) {
                            // Advance time one more day.
                            await increaseTime(10); // 10s
                            await trustee.unlockVestedTokens({from: kinFoundation});
                            assert.equal((await token.balanceOf(kinFoundation)).toNumber(), vested.toNumber());
                            assert.equal((await token.balanceOf(trustee.address)).toNumber(), vesting.toNumber());
                        }
                    });
                }
            });
        });
    });

    describe('revoke', async () => {
        beforeEach(async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
            await token.mint(trustee.address, TOTAL_ALLOCATION);

            // Required for transferring tokens back to owner when calling revoke().
            await token.endMinting();
        });

        context('before granting', async () => {
            it('should not allow to revoke before grant has been granted', async () => {
                await expectRevert(trustee.revoke({from: owner}));
            });
        });

        context('after granting', async () => {
            beforeEach(async () => {
                await trustee.grant(now);
            });

            it('should not allow to revoke from not an owner', async () => {
                await expectRevert(trustee.revoke({from: stranger}));
            })

            it('should be invariant to revoking multiple times', async () => {
                await expectRevert(trustee.revoke({from: stranger}));
                await expectRevert(trustee.revoke({from: stranger}));
            })

            it('should not allow to revoke as Kin Foundation', async () => {
                await expectRevert(trustee.revoke({from: kinFoundation}));
            })

            it('should be invariant to revoking multiple times as Kin Foundation', async () => {
                await expectRevert(trustee.revoke({from: kinFoundation}));
                await expectRevert(trustee.revoke({from: kinFoundation}));
            })

            it('should not allow to revoke more than once', async () => {
                await trustee.revoke({from: owner});
                await expectRevert(trustee.revoke({from: owner}));
                await expectRevert(trustee.revoke({from: owner}));
            });

            it('should not allow to execute another grant after revoke', async () => {
                await trustee.revoke({from: owner});
                await expectRevert(trustee.grant(now));
            });

            it('should not allow to calculate vested tokens after revoke', async () => {
                await trustee.revoke({from: owner});
                await expectRevert(trustee.unlockVestedTokens({from: kinFoundation}));
            });

            it('should not allow to unlock vested tokens after revoke', async () => {
                await trustee.revoke({from: owner});
                await expectRevert(trustee.unlockVestedTokens({from: kinFoundation}));
            });

            it('should not allow to unlock vested tokens after all tokens have been unlocked', async () => {
                await increaseTime(60 * YEAR);
                await trustee.unlockVestedTokens({from: kinFoundation});
                await expectRevert(trustee.revoke({from: owner}));
            });

            context('should refund remaining funds to owner upon revoking', async () => {
                it('before unlocking any vested tokens', async () => {
                    await trustee.revoke({from: owner});
                    assert.equal((await token.balanceOf(kinFoundation)).toNumber(), 0);
                    assert.equal((await token.balanceOf(owner)).toNumber(), TOTAL_ALLOCATION.toNumber());
                    assert.equal((await token.balanceOf(trustee.address)).toNumber(), 0);
                });

                it('after 60 years have passed', async () => {
                    await increaseTime(60 * YEAR);
                    await trustee.revoke({from: owner});
                    assert.equal((await token.balanceOf(kinFoundation)).toNumber(), 0);
                    assert.equal((await token.balanceOf(owner)).toNumber(), TOTAL_ALLOCATION.toNumber());
                    assert.equal((await token.balanceOf(trustee.address)).toNumber(), 0);
                });

                it('after unlocking some vested tokens', async () => {
                    const year = 5;
                    const day = 20;

                    const vested = calculateVestedTokens(year, day * DAY);
                    const vesting = TOTAL_ALLOCATION.minus(vested);

                    await increaseTime((year * YEAR) + (day * DAY) + 100);
                    await trustee.unlockVestedTokens({from: kinFoundation});

                    await trustee.revoke({from: owner});
                    assert.equal((await token.balanceOf(kinFoundation)).toNumber(), vested.toNumber());
                    assert.equal((await token.balanceOf(owner)).toNumber(), vesting.toNumber());
                    assert.equal((await token.balanceOf(trustee.address)).toNumber(), 0);
                });
            });
        });
    });

    describe('events', async () => {
        beforeEach(async () => {
            trustee = await KinFoundationVestingTrustee.new(token.address, kinFoundation);
            await token.mint(trustee.address, TOTAL_ALLOCATION);

            // Required for unlocking tokens and revoking grant.
            await token.endMinting();
        });

        it('should emit events when granting vesting', async () => {
            let result = await trustee.grant(now);

            assert.lengthOf(result.logs, 1);
            let event = result.logs[0];
            assert.equal(event.event, 'NewGrant');
            assert.equal(event.args._from, owner);
            assert.equal(event.args._value.toNumber(), TOTAL_ALLOCATION.toNumber());
        });

        it('should emit events when unlocking tokens', async () => {
            await trustee.grant(now);
            await increaseTime(1 * YEAR);
            let result = await trustee.unlockVestedTokens({from: kinFoundation});

            assert.lengthOf(result.logs, 1);
            let event = result.logs[0];
            assert.equal(event.event, 'TokensUnlocked');
            assert.equal(event.args._to, kinFoundation);
            assert.equal(event.args._value.toNumber(), ANNUAL_GRANTS[0].toNumber());

            // Additional calls should not emit events.
            result = await trustee.unlockVestedTokens({from: kinFoundation});
            assert.lengthOf(result.logs, 0);

            result = await trustee.unlockVestedTokens({from: kinFoundation});
            assert.lengthOf(result.logs, 0);
        });

        it('should emit events when revoking grant before unlocking any tokens', async () => {
            await trustee.grant(now);
            let result = await trustee.revoke({from: owner});

            assert.lengthOf(result.logs, 1);
            let event = result.logs[0];
            assert.equal(event.event, 'GrantRevoked');
            assert.equal(event.args._holder, kinFoundation);
            assert.equal(event.args._refund.toNumber(), TOTAL_ALLOCATION.toNumber());
        });

        it('should emit events when revoking grant after unlocking some tokens', async () => {
            await trustee.grant(now);
            await increaseTime(1 * YEAR);
            await trustee.unlockVestedTokens({from: kinFoundation});

            let result = await trustee.revoke({from: owner});

            assert.lengthOf(result.logs, 1);
            let event = result.logs[0];
            assert.equal(event.event, 'GrantRevoked');
            assert.equal(event.args._holder, kinFoundation);

            const vested = ANNUAL_GRANTS[0];
            const vesting = TOTAL_ALLOCATION.minus(vested);
            assert.equal(event.args._refund.toNumber(), vesting.toNumber());
        });
    });
});
