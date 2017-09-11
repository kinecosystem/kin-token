import BigNumber from 'bignumber.js';
import _ from 'lodash';
import expectRevert from './helpers/expectRevert';
import time from './helpers/time';

const KinToken = artifacts.require('../contracts/KinToken.sol');
const KinTokenSaleMock = artifacts.require('./helpers/KinTokenSaleMock.sol');
const VestingTrustee = artifacts.require('../contracts/VestingTrustee.sol');

// Before tests are run, 10 accounts are created with 10M ETH assigned to each.
// see scripts/ dir for more information.
contract('KinTokenSale', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const WEEK = 7 * DAY;
    const YEAR = 365 * DAY;

    let DEFAULT_GAS_PRICE = new BigNumber(100000000000);
    let GAS_COST_ERROR = process.env['SOLIDITY_COVERAGE'] ? 30000000000000000 : 0;

    const TOKEN_UNIT = 10 ** 18;

    // Maximum number of tokens in circulation.
    const MAX_TOKENS = new BigNumber(10 ** 13).mul(TOKEN_UNIT);

    // Maximum tokens sold here.
    const MAX_TOKENS_SOLD = new BigNumber(512195121951).mul(TOKEN_UNIT);
    const WEI_PER_USD = new BigNumber(TOKEN_UNIT).div(289).floor().toNumber();

    // This represents the USD price per one KIN, such MAX_TOKENS_SOLD * KIN_PER_USD is the $75M cap.
    const KIN_PER_USD = 6829 * TOKEN_UNIT;
    const KIN_PER_WEI = new BigNumber(KIN_PER_USD).div(WEI_PER_USD).floor().toNumber();

    const TIER_1_CAP = 100000 * WEI_PER_USD;
    const TIER_2_CAP = Math.pow(2, 256) - 1; // Maximum uint256 value
    const TIER_2_CAP_BIGNUMBER = new BigNumber(2).pow(256).minus(1);

    const HUNDRED_BILLION_KIN = Math.pow(10, 11) * TOKEN_UNIT;

    const KIN_TOKEN_GRANTS = [
        {grantee: '0x56ae76573ec54754bc5b6a8cbf04bbd7dc86b0a0', value: 60 * HUNDRED_BILLION_KIN, startOffset: 0, cliffOffset: 0, endOffset: 3 * YEAR, installmentLength: 1 * DAY, percentVested: 0},
        {grantee: '0x3bf4bbe253153678e9e8e540395c22bff7fca87d', value: 30 * HUNDRED_BILLION_KIN, startOffset: 0, cliffOffset: 0, endOffset: 120 * WEEK, installmentLength: 12 * WEEK, percentVested: 100}
    ];

    const PRESALE_TOKEN_GRANTS = [
        {grantee: '0xebfbfbdb8cbef890e8ca0143b5d9ab3fe15056c8', value: 2 * HUNDRED_BILLION_KIN, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x499d16bf3420f5d5d5fbdd9ca82ff863d505dcdd', value: 2 * HUNDRED_BILLION_KIN, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x06767930c343a330f8f04680cd2e3f5568feaf0a', value: 1 * HUNDRED_BILLION_KIN, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xf3bf7e748e954441bbbd4446062554f881bf89d5', value: 88235294100 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x1ed4304324baf24e826f267861bfbbad50228599', value: 4334 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x6f46cf5569aefa1acc1009290c8e043747172d89', value: 1473 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x90e63c3d53e0ea496845b7a03ec7548b70014a91', value: 6722 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x53d284357ec70ce289d6d64134dfac8e511c8a3d', value: 2800 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xc257274276a4e539741ca11b590b9447b26a8051', value: 1851 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xf27daff52c38b2c373ad2b9392652ddf433303c4', value: 1970 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x3d2e397f94e415d7773e72e44d5b5338a99e77d9', value: 5591 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xb8487eed31cf5c559bf3f4edd166b949553d0d11', value: 9581 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x00a651d43b6e209f5ada45a35f92efc0de3a5184', value: 3264 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x1b3cb81e51011b549d78bf720b0d924ac763a7c2', value: 605 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x6f52730dba7b02beefcaf0d6998c9ae901ea04f9', value: 6218 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x35da6abcb08f2b6164fe380bb6c47bd8f2304d55', value: 92 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x51f9c432a4e59ac86282d6adab4c2eb8919160eb', value: 2092 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x8f7147aaa34d9ae583a7aa803e8df9bd6b4cc185', value: 4046 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x8eb3fa7907ad2ef4c7e3ba4b1d2f2aac6f4b5ae6', value: 2504 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x3bf86ed8a3153ec933786a02ac090301855e576b', value: 4956 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xc4832ffa32bd12a1696e3fe2ff2b44fc89d3e683', value: 7405 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xbf09d77048e270b662330e9486b38b43cd781495', value: 1552 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x3de8c14c8e7a956f5cc4d82beff749ee65fdc358', value: 5032 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xab5801a7d398351b8be11c439e05c5b3259aec9b', value: 8640 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xdb6fd484cfa46eeeb73c71edee823e4812f9e2e1', value: 4249 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x9d2bfc36106f038250c01801685785b16c86c60d', value: 529 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x2b241f037337eb4acc61849bd272ac133f7cdf4b', value: 2429 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xb794f5ea0ba39494ce839613fffba74279579268', value: 469 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xe853c56864a2ebe4576a807d26fdc4a0ada51919', value: 6967 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x281055afc982d96fab65b3a49cac8b878184cb16', value: 3369 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xa1065e30ef94e4a89c2ef83afaa991af45bd7799', value: 3491 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x2543fc6d6a746cdc395d43b2f3b0e33e469f8f7f', value: 5197 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x9dc61cd3c76c82ed0b566005351fd55cd8e578e3', value: 1333 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xb6ce0f17952116884cd558e828c1f7e6ca027b68', value: 6198 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xed3835eaf9367f7943b6520e27ea6c23144d4a86', value: 372 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x6ba997a443426dbd1b79363b1f0dcd1f66b2a2c7', value: 3077 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x33e1c178e83f60d0ffa9b8780c6355dc42b77f9d', value: 1824 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xfdd913a83b30110a01f2f9e5f8cf4f20a2a60c6e', value: 9937 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x18bc87142f7449af54caa2c1b460e5ca24f3cab3', value: 3928 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xd5461272b55ca660ab8475bad6099ff66704bce3', value: 6911 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xae179f378f525437ec1b1357a015f5be2b499c81', value: 1574 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x1a5637275c7dafdd3eb0f5625fd5d59a1425bba4', value: 3231 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x009db764931f8a3ed2e20dc3af1373e4d33852e9', value: 9647 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x96107e5b992475d3862e7faa5450d4dbf36e82dc', value: 3309 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x7db259da13930642259312210a7049250670eec4', value: 8662 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xa1c92760c857e42aeb4732d643be5c5441bf0880', value: 5675 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x38205adbdfd56e76077b350685b595790d40f5eb', value: 9163 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x8b9ff9757d7a195e3ee48e760d5dceea6b7c22f1', value: 1618 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x4c1c6cd03f35a0aec1a8f634951f19ca85d21c8b', value: 2057 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x167a9333bf582556f35bd4d16a7e80e191aa6476', value: 6953 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xa7e4fecddc20d83f36971b67e13f1abc98dfcfa6', value: 6577 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x9f1de00776811f916790be357f1cabf6ac1eca65', value: 2964 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98', value: 4329 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xdc76cd25977e0a5ae17155770273ad58648900d3', value: 8433 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x5c4aa3c0e7f6917ee6c1204d85a01f08a80e6dd0', value: 2926 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x7d04d2edc058a1afc761d9c99ae4fc5c85d4c8a6', value: 6882 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x1706d193862da7f8c746aae63d514df93dfa5dbf', value: 7958 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0xcafb10ee663f465f9d10588ac44ed20ed608c11e', value: 9283 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50},
        {grantee: '0x316775a60ccc8147532a32eee332e7b944ca4ae6', value: 8402 * TOKEN_UNIT, startOffset: 0, cliffOffset: 1 * YEAR, endOffset: 1 * YEAR, installmentLength: 1 * DAY, percentVested: 50}
    ];

    const GRANTS = KIN_TOKEN_GRANTS.concat(PRESALE_TOKEN_GRANTS);
    const MAX_TOKEN_GRANTEES = 100;
    const GRANT_BATCH_SIZE = 10;

    let now;

    const increaseTime = async (by) => {
        await time.increaseTime(by);
        now += by;
    };

    // Return a structured pre-sale grant for a specific address.
    const getTokenGrant = async (sale, address) => {
        let tokenGrant = await sale.tokenGrants(address);

        return {
            value: tokenGrant[0].toNumber(),
            startOffset: tokenGrant[1].toNumber(),
            cliffOffset: tokenGrant[2].toNumber(),
            endOffset: tokenGrant[3].toNumber(),
            installmentLength: tokenGrant[4].toNumber(),
            percentVested: tokenGrant[5].toNumber()
        };
    };

    // Return a structured vesting grant for a specific address.
    const getGrant = async (trustee, address) => {
        let grant = await trustee.grants(address);

        return {
            value: grant[0].toNumber(),
            start: grant[1].toNumber(),
            cliff: grant[2].toNumber(),
            end: grant[3].toNumber(),
            installmentLength: grant[4].toNumber(),
            transferred: grant[5].toNumber(),
            revokable: grant[6]
        };
    };

    const addPresaleTokenGrants = async (sale) => {
        for (let i = 0; i < PRESALE_TOKEN_GRANTS.length; ++i) {
            const grant = PRESALE_TOKEN_GRANTS[i];

            console.log(`\t[${i + 1} / ${PRESALE_TOKEN_GRANTS.length}] adding pre-sale grant for ${grant.grantee}...`);

            await sale.addTokenGrant(grant.grantee, grant.value);
        }

        assert.equal((await sale.getTokenGranteesLength()).toNumber(), GRANTS.length);
    };

    const grantTokens = async (sale, grants) => {
        let lastGrantedIndex = 0;
        while (lastGrantedIndex < grants.length) {
            console.log(`\tgranting token grants (lastGrantedIndex: ${lastGrantedIndex})...`);

            await sale.grantTokens();

            let endIndex = Math.min(lastGrantedIndex + GRANT_BATCH_SIZE, grants.length);
            lastGrantedIndex = (await sale.lastGrantedIndex()).toNumber();
            assert.equal(lastGrantedIndex, endIndex);
        }

        console.log(`\tfinished granting token grants (lastGrantedIndex: ${lastGrantedIndex})...`);
    };

    // Checks if token grants exists.
    const testTokenGrantExists = async (sale, presaleTokenGrant) => {
        // Make sure that the grant exists in the token grantees list.
        let tokenGrantee;
        let tokenGranteesLength = (await sale.getTokenGranteesLength()).toNumber();

        // Search for grantee in list.
        for (let i = 0; i < tokenGranteesLength; ++i) {
            let tempTokenGrantee = await sale.tokenGrantees(i);
            if (tempTokenGrantee === presaleTokenGrant.grantee) {
                tokenGrantee = tempTokenGrantee;

                break;
            }
        }
        assert.equal(presaleTokenGrant.grantee, tokenGrantee);

        // Make sure that the grant exists in the token grants mapping.
        const tokenGrant = await getTokenGrant(sale, presaleTokenGrant.grantee);
        assert.deepEqual(_.omit(presaleTokenGrant, 'grantee'), tokenGrant);
    };

    // Delete a token grant and check
    const testDeleteTokenGrant = async (sale, presaleTokenGrant) => {
        // Make sure that the grant exists.
        await testTokenGrantExists(sale, presaleTokenGrant);

        // Delete the grant and then check that it no longer exists in the token grantees list.
        await sale.deleteTokenGrant(presaleTokenGrant.grantee);

        let tokenGranteesLength = (await sale.getTokenGranteesLength()).toNumber();
        for (let i = 0; i < tokenGranteesLength; ++i) {
            let tempTokenGrantee = await sale.tokenGrantees(i);
            if (tempTokenGrantee === presaleTokenGrant.grantee) {
                assert.fail(`Couldn't delete ${presaleTokenGrant.grantee} pre-sale grant!`);
            }
        }

        // Delete the grant and then check that it does no longer exist in the token grants mapping.
        const tokenGrant2 = await getTokenGrant(sale, presaleTokenGrant.grantee);
        assert.deepEqual(tokenGrant2, { value: 0, startOffset: 0, cliffOffset: 0, endOffset: 0, installmentLength: 0, percentVested: 0 });
    };

    // Get block timestamp.
    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    });

    describe('construction', async () => {
        let fundRecipient = accounts[5];

        it('should not allow to initialize with null funding recipient address', async () => {
            await expectRevert(KinTokenSaleMock.new(null, now + 100));
        });

        it('should not allow to initialize with 0 funding recipient address', async () => {
            await expectRevert(KinTokenSaleMock.new(0, now + 100));
        });

        it('should be initialized with a future starting time', async () => {
            await expectRevert(KinTokenSaleMock.new(fundRecipient, now - 100));
        });

        it('should be initialized with a derived ending time', async () => {
            let startTime = now + 100;
            let sale = await KinTokenSaleMock.new(fundRecipient, startTime);

            assert.equal((await sale.endTime()).toNumber(), startTime + (await sale.SALE_DURATION()).toNumber());
        });

        it('should deploy the KinToken contract and own it', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            assert(await sale.kin() != 0);

            let token = KinToken.at(await sale.kin());
            assert.equal(await token.owner(), sale.address);
        });

        it('should deploy the VestingTrustee contract and own it', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            let token = KinToken.at(await sale.kin());

            let trustee = VestingTrustee.at(await sale.trustee());
            assert.equal(await trustee.kin(), token.address);
            assert.equal(await trustee.owner(), sale.address);
        });

        it('should be initialized in minting enabled mode', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            let token = KinToken.at(await sale.kin());
            assert(await token.isMinting());
        });

        it('should be initialized with 0 total sold tokens', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            assert.equal((await sale.tokensSold()), 0);
        });

        it('should be initialized with 0 lastGrantedIndex', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            assert.equal((await sale.lastGrantedIndex()), 0);
        });

        it('should initialize token grants', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 100);
            assert.equal((await sale.getTokenGranteesLength()).toNumber(), KIN_TOKEN_GRANTS.length);

            for (const kinTokenGrant of KIN_TOKEN_GRANTS) {
                await testTokenGrantExists(sale, kinTokenGrant);
            }
        });

        it('should be ownable', async () => {
            let sale = await KinTokenSaleMock.new(fundRecipient, now + 10000);
            assert.equal(await sale.owner(), accounts[0]);
        });
    });

    describe('addTokenGrant', async () => {
        let sale;
        let fundRecipient = accounts[5];

        beforeEach(async () => {
            sale = await KinTokenSaleMock.new(fundRecipient, now + 1000);
        });

        it('should not allow to be called by non-owner', async () => {
            await expectRevert(sale.addTokenGrant(accounts[0], 1000, {from: accounts[7]}));
        });

        it('should not allow to be called with null address', async () => {
            await expectRevert(sale.addTokenGrant(null, 1000));
        });

        it('should not allow to be called with 0 address', async () => {
            await expectRevert(sale.addTokenGrant(0, 1000));
        });

        it('should not allow to be called with 0 value', async () => {
            await expectRevert(sale.addTokenGrant(accounts[0], 0));
        });

        it('should not allow granting the same address twice', async () => {
            await sale.addTokenGrant(accounts[0], 1000);
            await expectRevert(sale.addTokenGrant(accounts[0], 5000));;
        });

        it('should add pre-sale token grants', async () => {
            await addPresaleTokenGrants(sale);

            for (const tokenGrant of GRANTS) {
                console.log(`\tchecking if token grant for ${tokenGrant.grantee} exists...`);

                await testTokenGrantExists(sale, tokenGrant);
            }
        });

        context(`with ${MAX_TOKEN_GRANTEES} grants`, async () => {
            beforeEach(async () => {
                let tokenGranteesLength = (await sale.getTokenGranteesLength()).toNumber();

                for (let i = 0; i < MAX_TOKEN_GRANTEES - tokenGranteesLength; ++i) {
                    await sale.addTokenGrant(`0x${i + 1}`, 1000);
                }

                assert.equal((await sale.getTokenGranteesLength()).toNumber(), MAX_TOKEN_GRANTEES);
            });

            it('should not allow granting another grant', async () => {
                await expectRevert(sale.addTokenGrant(accounts[0], 5000));;
            });
        });
    });

    describe('deleteTokenGrant', async () => {
        let sale;
        let fundRecipient = accounts[5];

        beforeEach(async () => {
            sale = await KinTokenSaleMock.new(fundRecipient, now + 1000);
        });

        it('should not allow to be called by non-owner', async () => {
            await expectRevert(sale.deleteTokenGrant(accounts[0], {from: accounts[7]}));
        });

        it('should not allow to be called with 0 address', async () => {
            await expectRevert(sale.deleteTokenGrant(0));
        });

        it('should fail gracefully if called with a non-existing address', async () => {
            await sale.deleteTokenGrant(accounts[0]);
        });

        context('with pre-sale grants', async () => {
            beforeEach(async () => {
                await addPresaleTokenGrants(sale);
            });

            context(`with ${MAX_TOKEN_GRANTEES} grants`, async () => {
                beforeEach(async () => {
                    let tokenGranteesLength = (await sale.getTokenGranteesLength()).toNumber();

                    for (let i = 0; i < MAX_TOKEN_GRANTEES - tokenGranteesLength; ++i) {
                        await sale.addTokenGrant(`0x${i + 1}`, 1000);
                    }

                    assert.equal((await sale.getTokenGranteesLength()).toNumber(), MAX_TOKEN_GRANTEES);
                });

                it('should delete a single token grant', async () => {
                    await testDeleteTokenGrant(sale, PRESALE_TOKEN_GRANTS[5]);
                });
            });

            it('should delete a single token grant', async () => {
                await testDeleteTokenGrant(sale, PRESALE_TOKEN_GRANTS[5]);
            });

            it('should delete multiple token grants', async () => {
                for (const index of [ 0, 1, 10, 20, 21, 25, PRESALE_TOKEN_GRANTS.length - 1 ]) {
                    await testDeleteTokenGrant(sale, PRESALE_TOKEN_GRANTS[index]);
                }
            });

            it('should allow adding a pre-sale token grant after it was deleted', async () => {
                const presaleTokenGrant = PRESALE_TOKEN_GRANTS[10];

                await testDeleteTokenGrant(sale, presaleTokenGrant);

                // Re-add the same token grant and make sure it exists.
                await sale.addTokenGrant(presaleTokenGrant.grantee, presaleTokenGrant.value);

                await testTokenGrantExists(sale, presaleTokenGrant);
            });

            it('should allow adding pre-sale token grants after they were deleted', async () => {
                for (const index of [ 0, 5, 8, 9, 31, 32, 50, PRESALE_TOKEN_GRANTS.length - 1 ]) {
                    const presaleTokenGrant = PRESALE_TOKEN_GRANTS[index];

                    await testDeleteTokenGrant(sale, presaleTokenGrant);

                    // Re-add the same token grant and make sure it exists.
                    await sale.addTokenGrant(presaleTokenGrant.grantee, presaleTokenGrant.value);

                    await testTokenGrantExists(sale, presaleTokenGrant);
                }
            });
        });
    });

    describe('grantTokens', async () => {
        let sale;
        let start;
        let end;
        let fundRecipient = accounts[5];

        beforeEach(async () => {
            start = now + 1000;
            sale = await KinTokenSaleMock.new(fundRecipient, start);
            end = (await sale.endTime()).toNumber();
        });

        context('before sale has started', async () => {
            beforeEach(async () => {
                assert.isBelow(now, start);
            });

            it('should not allow to grant tokens before selling all tokens', async () => {
                await expectRevert(sale.grantTokens());
            });
        });

        context('during the sale', async () => {
            beforeEach(async () => {
                // Increase time to be the in the middle between start and end.
                await increaseTime(start - now + ((end - start) / 2));

                assert.isAbove(now, start);
                assert.isBelow(now, end);
            });

            it('should not allow to grant tokens before selling all tokens', async () => {
                await expectRevert(sale.grantTokens());
            });
        });

        context('after the sale', async () => {
            beforeEach(async () => {
                await sale.setTokensSold(MAX_TOKENS_SOLD.toNumber());
            });

            it('should not allow to be called by non-owner', async () => {
                await expectRevert(sale.grantTokens({from: accounts[7]}));
            });

            it('should grant Kin tokens to all non pre-sale grantees', async () => {
                await grantTokens(sale, KIN_TOKEN_GRANTS);
            });

            context('with pre-sale grants', async () => {
                beforeEach(async () => {
                    await addPresaleTokenGrants(sale);
                });

                it('should grant Kin and pre-sale tokens to all pre-sale grantees', async () => {
                    await grantTokens(sale, GRANTS);
                });
            });
        });
    });

    describe('participation caps', async () => {
        let sale;
        let fundRecipient = accounts[5];

        // Test all accounts have their participation caps set properly.
        beforeEach(async () => {
            sale = await KinTokenSaleMock.new(fundRecipient, now + 1000);

            for (let participant of accounts) {
                assert.equal((await sale.participationCaps(participant)).toNumber(), 0);
            }
        });

        describe('setTier1Participants', async () => {
            it('should be able to get called with an empty list of participants', async () => {
                await sale.setTier1Participants([]);
            });

            it('should not allow to be called by non-owner', async () => {
                await expectRevert(sale.setTier1Participants([], {from: accounts[7]}));
            });

            it('should set participation cap to TIER_1_CAP', async () => {
                let participants = [accounts[1], accounts[4]];

                await sale.setTier1Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_1_CAP);
                }
            });

            it('should allow upgrading existing participants to tier2', async () => {
                let participants = [accounts[2], accounts[3], accounts[4]];

                await sale.setTier1Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_1_CAP);
                }

                await sale.setTier2Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_2_CAP);
                }
            });
        });

        describe('setTier2Participants', async () => {
            it('should be able to get called with an empty list of participants', async () => {
                await sale.setTier2Participants([]);
            });

            it('should not allow to be called by non-owner', async () => {
                let stranger = accounts[7];
                assert.notEqual(await sale.owner(), stranger);

                await expectRevert(sale.setTier2Participants([], {from: stranger}));
            });

            it('should set participation cap to TIER_2_CAP', async () => {
                let participants = [accounts[1], accounts[4]];

                await sale.setTier2Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_2_CAP);
                }
            });

            it('should allow downgrading existing participatns to tier1', async () => {
                let participants = [accounts[2], accounts[3], accounts[4]];

                await sale.setTier2Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_2_CAP);
                }

                await sale.setTier1Participants(participants);

                for (let participant of participants) {
                    assert.equal((await sale.participationCaps(participant)).toNumber(), TIER_1_CAP);
                }
            });
        });
    });

    describe('finalize', async () => {
        let sale;
        let token;
        let start;
        let startFrom = 1000;
        let end;
        let fundRecipient = accounts[5];

        beforeEach(async () => {
            start = now + startFrom;
            sale = await KinTokenSaleMock.new(fundRecipient, start);
            end = (await sale.endTime()).toNumber();
            token = KinToken.at(await sale.kin());

            assert.equal(await token.isMinting(), true);
        });

        context('before sale has started', async () => {
            beforeEach(async () => {
                assert.isBelow(now, start);
            });

            it('should not allow to finalize before selling all tokens', async () => {
                await expectRevert(sale.finalize());
            });
        });

        context('during the sale', async () => {
            beforeEach(async () => {
                // Increase time to be the in the middle between start and end.
                await increaseTime(start - now + ((end - start) / 2));

                assert.isAbove(now, start);
                assert.isBelow(now, end);
            });

            it('should not allow to finalize before selling all tokens', async () => {
                await expectRevert(sale.finalize());
            });
        });

        let testFinalization = async () => {
            it('should not allow to finalize token sale without granting all token grants first', async () => {
                await expectRevert(sale.finalize());
            });

            it('should finish minting after sale was finalized', async () => {
                await grantTokens(sale, KIN_TOKEN_GRANTS);
                await sale.finalize();

                assert.equal(await token.isMinting(), false);
            });

            it('should not allow to finalize token sale more than once', async () => {
                await grantTokens(sale, KIN_TOKEN_GRANTS);
                await sale.finalize();

                await expectRevert(sale.finalize());
            });

            context('with pre-sale grants', async () => {
                beforeEach(async () => {
                    await addPresaleTokenGrants(sale);
                });

                describe('vesting', async () => {
                    // We'd allow (up to) 100 seconds of time difference between the execution (i.e., mining) of the
                    // contract.
                    const MAX_TIME_ERROR = 100;

                    let trustee;

                    // Calculates exactly how many tokens were issued and vested.
                    let calcVestedTokens = async (grant) => {
                        // Calculate total amount of tokens issued, while taking into account how many tokens where
                        // sold in the sale, for example:
                        //
                        // MAX_TOKENS = 10T
                        // MAX_TOKENS_SOLD = 0.1 * 10T = 10% of 10T
                        // Amount of tokens actually sold = sale.tokensSold = just 1 KIN
                        //
                        // Token distribution is 30% Kik, 60% Kin Foundation, 10% Participants (including pre-sale).
                        // Since only 1 KIN was sold and accounts to 10% of total tokens issued, this means total
                        // tokens \ issued is 10 KIN.
                        let totalTokensIssued = (await sale.tokensSold()).mul(MAX_TOKENS).div(MAX_TOKENS_SOLD);

                        let tokensGranted = totalTokensIssued.mul(grant.value).div(MAX_TOKENS).floor();
                        let tokensVesting = tokensGranted.mul(grant.percentVested).div(100).floor().toNumber();
                        let tokensTransferred = tokensGranted.sub(tokensVesting).toNumber();

                        return {vested: tokensVesting, transferred: tokensTransferred};
                    }

                    beforeEach(async () => {
                        await grantTokens(sale, GRANTS);
                        await sale.finalize();

                        trustee = VestingTrustee.at(await sale.trustee());

                        // Verify that both the KinTokenSale and the VestingTrustee share the same KinToken.
                        assert.equal(token.address, await trustee.kin());
                    });

                    it('should grant tokens', async () => {
                        for (const grant of GRANTS) {
                            let tokenGrant = await getGrant(trustee, grant.grantee);

                            let vestedTokens = await calcVestedTokens(grant);
                            console.log(`\texpecting ${vestedTokens.vested / TOKEN_UNIT} vested KIN...`);
                            console.log(`\texpecting ${vestedTokens.transferred / TOKEN_UNIT} issued KIN...`);

                            // Test granted and vested tokens.
                            assert.equal((await token.balanceOf(grant.grantee)).toNumber(), vestedTokens.transferred);

                            if (grant.percentVested > 0) {
                                assert.equal(tokenGrant.value, vestedTokens.vested);

                                // Test vesting time ranges.
                                assert.approximately(now + grant.startOffset, tokenGrant.start, MAX_TIME_ERROR);
                                assert.approximately(now + grant.cliffOffset, tokenGrant.cliff, MAX_TIME_ERROR);
                                assert.approximately(now + grant.endOffset, tokenGrant.end, MAX_TIME_ERROR);

                                // Test no funds have been transferred yet, since transfer should be requested by
                                // participant.
                                assert.equal(tokenGrant.transferred, 0);

                                // Grant should be revokable.
                                assert.equal(tokenGrant.revokable, true);
                            } else {
                                assert.deepEqual(tokenGrant, { value: 0, start: 0, cliff: 0, end: 0,
                                    installmentLength: 0, transferred: 0, revokable: false });
                            }
                        }
                    });

                    it('should grant the trustee enough tokens to support the grants', async () => {
                        let totalGranted = new BigNumber(0);

                        // Sum all vested tokens.
                        for (let grant of GRANTS) {
                            let vestedTokens = await calcVestedTokens(grant);
                            totalGranted = totalGranted.add(vestedTokens.vested);
                        }

                        assert.equal((await token.balanceOf(trustee.address)).toNumber(), totalGranted.toNumber());
                    });
                });
            });
        }

        context('after sale time has ended', async () => {
            beforeEach(async () => {
                await increaseTime(end - now + 1);
                assert.isAbove(now, end);
            });

            context('sold all of the tokens', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(MAX_TOKENS_SOLD.toNumber());
                });

                testFinalization();
            });

            context('sold only half of the tokens', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(MAX_TOKENS_SOLD.div(2).toNumber());
                });

                testFinalization();
            });

            context('sold only tenth of the tokens', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(MAX_TOKENS_SOLD.div(10).toNumber());
                });

                testFinalization();
            });
        });

        context('reached token cap', async () => {
            beforeEach(async () => {
                await sale.setTokensSold(MAX_TOKENS_SOLD.toNumber());
            });

            testFinalization();
        });
    });

    // Execute a transaction, and test balances and total tokens sold have been updated correctly, while also testing
    // for participation caps.
    //
    // NOTE: This function automatically finalizes the sale when the cap has been reached. This function is used in
    // various tests where plenty of transactions are called, and its hard to decide when to exactly call finalize. This
    // function does it for us.
    let verifyTransactions = async (sale, fundRecipient, method, transactions) => {
        let token = KinToken.at(await sale.kin());

        // Using large numerics, so we have to use BigNumber.
        let totalTokensSold = new BigNumber(0);

        let i = 0;
        for (const t of transactions) {
            // Set hard participation cap if mentioned in current transaction object. This means current object is not
            // a transaction but a special object that signals when to set a new hard cap.
            //
            // NOTE: We have to convert the new cap number to string before converting them to BigNumber, since JS
            // standard Number type doesn't support more than 15 significant digits.
            if (t.hasOwnProperty('hardParticipationCap')) {
                console.log(`\tsetting hard participation cap from ${(await sale.hardParticipationCap()).div(TOKEN_UNIT)} ` +
                    `to ${t.hardParticipationCap / TOKEN_UNIT}`
                );

                // Value is assumed to be of BigNumber type.
                await sale.setHardParticipationCap(t.hardParticipationCap);

                continue;
            }

            let tokens = new BigNumber(t.value.toString()).mul(KIN_PER_WEI);

            console.log(`\t[${++i} / ${transactions.length}] expecting account ${t.from} to buy up to ` +
                `${tokens.toNumber() / TOKEN_UNIT} KIN for ${t.value / TOKEN_UNIT} ETH`
            );

            // Cache original balances before executing the transaction.
            // We will test against these after the transaction has been executed.
            let fundRecipientETHBalance = web3.eth.getBalance(fundRecipient);
            let participantETHBalance = web3.eth.getBalance(t.from);
            let participantKINBalance = await token.balanceOf(t.from);
            let participantHistory = await sale.participationHistory(t.from);

            // Take into account the global hard participation cap.
            let participantCap = await sale.participationCaps(t.from);
            let hardParticipationCap = await sale.hardParticipationCap();
            participantCap = BigNumber.min(participantCap, hardParticipationCap);

            let tokensSold = await sale.tokensSold();
            assert.equal(totalTokensSold.toNumber(), tokensSold.toNumber());

            // If this transaction should fail, then theres no need to continue testing the current transaction and
            // test for updated balances, etc., since everything related to it was reverted.
            //
            // Reasons for failures can be:
            //  1. We already sold all the tokens
            //  2. Participant has reached its participation cap.
            if (MAX_TOKENS_SOLD.equals(tokensSold) ||
                participantHistory.greaterThanOrEqualTo(participantCap)) {

                await expectRevert(method(sale, t.value, t.from));

                continue;
            }

            // Execute transaction.
            let transaction = await method(sale, t.value, t.from);
            let gasUsed = DEFAULT_GAS_PRICE.mul(transaction.receipt.gasUsed);

            // Test for correct participant ETH, KIN balance, and total tokens sold:

            // NOTE: We take into account partial refund to the participant, in case transaction goes past its
            // participation cap.
            //
            // NOTE: We have to convert the (very) numbers to strings, before converting them to BigNumber, since JS
            // standard Number type doesn't support more than 15 significant digits.
            let contribution = BigNumber.min(t.value.toString(), participantCap.minus(participantHistory));
            tokens = contribution.mul(KIN_PER_WEI);

            // Take into account the remaining amount of tokens which can be still sold:
            tokens = BigNumber.min(tokens, MAX_TOKENS_SOLD.minus(tokensSold));
            contribution = tokens.div(KIN_PER_WEI);

            totalTokensSold = totalTokensSold.plus(tokens);

            // Test for total tokens sold.
            assert.equal((await sale.tokensSold()).toNumber(), tokensSold.plus(tokens).toNumber());

            // Test for correct participant ETH + Kin balances.

            // ETH:
            assert.equal(web3.eth.getBalance(fundRecipient).toNumber(),
                fundRecipientETHBalance.plus(contribution).toNumber());

            assert.approximately( web3.eth.getBalance(t.from).toNumber(),
                participantETHBalance.minus(contribution).minus(gasUsed).toNumber(), GAS_COST_ERROR);

            // KIN:
            assert.equal((await token.balanceOf(t.from)).toNumber(), participantKINBalance.plus(tokens).toNumber());

            // Test for updated participant cap.
            assert.equal((await sale.participationHistory(t.from)).toNumber(),
                participantHistory.plus(contribution).toNumber());

            // Test mint event.
            assert.lengthOf(transaction.logs, 1);
            let event = transaction.logs[0];
            assert.equal(event.event, 'TokensIssued');
            assert.equal(Number(event.args._tokens), tokens)

            // Finalize sale if the all tokens have been sold.
            if (totalTokensSold.equals(MAX_TOKENS_SOLD)) {
                console.log('\tFinalizing sale...');

                await grantTokens(sale, GRANTS);
                await sale.finalize();
            }
        }
    };

    let generateTokenTests = async (name, method) => {
        describe(name, async () => {
            let sale;
            let token;
            // accounts[0] (owner) is participating in the sale. We don't want
            // him to send and receive funds at the same time.
            let fundRecipient = accounts[11];
            let tier2Participant = accounts[9];
            let start;
            let startFrom = 1000;
            let end;
            let value = 1000;

            beforeEach(async () => {
                start = now + startFrom;
                sale = await KinTokenSaleMock.new(fundRecipient, start);
                end = (await sale.endTime()).toNumber();
                token = KinToken.at(await sale.kin());

                assert.equal(await token.isMinting(), true);

                await sale.setTier2Participants([tier2Participant]);
            });

            context('sale time has ended', async () => {
                beforeEach(async () => {
                    await increaseTime(end - now + 1);
                    assert.isAbove(now, end);
                });

                it('should not allow to execute', async () => {
                    await expectRevert(method(sale, value));
                });

                context('and finalized', async () => {
                    beforeEach(async () => {
                        await grantTokens(sale, KIN_TOKEN_GRANTS);
                        await sale.finalize();
                    });

                    it('should not allow to execute', async () => {
                        await expectRevert(method(sale, value));
                    });
                });
            });

            context('reached token cap', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(MAX_TOKENS_SOLD.toNumber());
                    assert.equal((await sale.tokensSold()).toNumber(), MAX_TOKENS_SOLD.toNumber());
                });

                it('should not allow to execute', async () => {
                    await expectRevert(method(sale, value));
                });

                context('and finalized', async () => {
                    beforeEach(async () => {
                        await grantTokens(sale, KIN_TOKEN_GRANTS);
                        await sale.finalize();
                    });

                    it('should not allow to execute', async () => {
                        await expectRevert(method(sale, value));
                    });
                });
            });

            context('before sale has started', async () => {
                beforeEach(async () => {
                    assert.isBelow(now, start);
                });

                it('should not allow to execute', async () => {
                    await expectRevert(method(sale, value));
                });
            });

            context('during the sale', async () => {
                beforeEach(async () => {
                    await increaseTime(start - now + ((end - start) / 2));
                    assert.isAbove(now, start);
                    assert.isBelow(now, end);
                });

                it('should not allow to execute with 0 ETH', async () => {
                    await expectRevert(method(sale, 0));
                });

                // Test if transaction execution is unallowed and prevented for UNREGISTERED participants.
                context('unregistered participants', async () => {
                    [
                        { from: accounts[1], value: 1 * TOKEN_UNIT },
                        { from: accounts[2], value: 2 * TOKEN_UNIT },
                        { from: accounts[3], value: 0.0001 * TOKEN_UNIT },
                        { from: accounts[4], value: 10 * TOKEN_UNIT }
                    ].forEach((t) => {
                        it(`should not allow to participate with ${t.value / TOKEN_UNIT} ETH`, async () => {
                            assert.equal((await sale.participationCaps(t.from)).toNumber(), 0);

                            await expectRevert(method(sale, t.value));
                        });
                    });
                });

                // Test transaction are allowed and executed correctly for registered participants.
                context('registered participants', async () => {
                    let owner = accounts[0];

                    let tier1Participant1 = accounts[1];
                    let tier1Participant2 = accounts[2];
                    let tier1Participant3 = accounts[3];

                    let tier2Participant1 = accounts[4];
                    let tier2Participant2 = accounts[5];
                    let tier2Participant3 = accounts[6];  // Not used in following tests. "Dummy" account.

                    // Use default (limited) hard participation cap
                    // and initialize tier 1 + tier 2 participants.
                    beforeEach(async () => {
                        await sale.setTier1Participants([
                            owner,
                            tier1Participant1,
                            tier1Participant2,
                            tier1Participant3
                        ]);
                        await sale.setTier2Participants([
                            tier2Participant1,
                            tier2Participant2,
                            tier2Participant3,
                        ]);
                    });

                    [
                        // Sanity test: test sending funds from account owner.
                        [
                            { from: owner, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 1 * TOKEN_UNIT },
                            { from: owner, value: 1 * TOKEN_UNIT },
                            { from: owner, value: 3 * TOKEN_UNIT },
                        ],
                        // Only tier 1 participants:
                        [
                            { from: tier1Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 150 * TOKEN_UNIT }
                        ],
                        // Tier 1 + Tier 2 participants:
                        [
                            { from: tier1Participant1, value: 1 * TOKEN_UNIT },

                            { from: tier1Participant2, value: 0.5 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 10 * TOKEN_UNIT },

                            { from: tier2Participant1, value: 100 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 0.01 * TOKEN_UNIT },

                            { from: tier1Participant3, value: 2.5 * TOKEN_UNIT },

                            { from: tier1Participant2, value: 0.01 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 1200 * TOKEN_UNIT },

                            { from: tier1Participant1,  value: 0.01 * TOKEN_UNIT }
                        ],
                        // Another Tier 1 + Tier 2 participants:
                        [
                            { from: tier1Participant1, value: 5 * TOKEN_UNIT },

                            { from: tier1Participant2, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 2 * TOKEN_UNIT },

                            { from: tier2Participant2, value: 1000 * TOKEN_UNIT },

                            { from: tier1Participant3, value: 1.3 * TOKEN_UNIT },

                            { from: tier1Participant2, value: 0.01 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 100 * TOKEN_UNIT },

                            { from: tier1Participant1, value: 0.01 * TOKEN_UNIT }
                        ],
                        // Participation cap should be reached by the middle of this transaction list, and then we raise
                        // it and continue the remaining transactions:
                        [
                            { from: tier1Participant1, value: 11 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 12 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 13 * TOKEN_UNIT },

                            { from: tier2Participant1, value: 21 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 211 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 22 * TOKEN_UNIT },

                            { from: tier1Participant1, value: 5000 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1000000 * TOKEN_UNIT }, // 1M

                            { hardParticipationCap: TIER_2_CAP_BIGNUMBER }, // Practically infinity

                            { from: tier1Participant1, value: 10000 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 121 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1000000 * TOKEN_UNIT }, // 1M
                            { from: tier1Participant3, value: 131 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 5000000 * TOKEN_UNIT }, // 5M
                            { from: tier1Participant2, value: 1212 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 8000000 * TOKEN_UNIT } // 8M
                        ],
                        // Another similar test to above, just with different transactions.
                        [
                            { from: tier2Participant1, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 1000 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 10000 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 100 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 0.1 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 0.01 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 10 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 1000000 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1000 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 999 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 9999 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 99 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 10 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 10 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 100000 * TOKEN_UNIT },

                            { hardParticipationCap: TIER_2_CAP_BIGNUMBER },

                            { from: tier2Participant1, value: 1000000 * TOKEN_UNIT }, // 1M
                            { from: tier1Participant2, value: 121 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 5000000 * TOKEN_UNIT }, // 5M
                            { from: tier1Participant3, value: 131 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 8000000 * TOKEN_UNIT }, // 50M
                            { from: tier1Participant1, value: 10000 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 1212 * TOKEN_UNIT }
                        ],
                        // Test starting with hard cap at the lowest value possible: 1,
                        // then rising to 5K.
                        [
                            { hardParticipationCap: new BigNumber(1) },

                            { from: tier2Participant1, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 1000 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 10000 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 100 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 0.1 * TOKEN_UNIT },
                            { from: tier1Participant1, value: 0.01 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 10 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 1000000 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1000 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 999 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 9999 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 99 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 10 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 10 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 1 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 100 * TOKEN_UNIT },
                            { from: tier1Participant3, value: 100000 * TOKEN_UNIT },

                            { hardParticipationCap: new BigNumber(5).mul(1000) }, // 5K

                            { from: tier2Participant1, value: 1000000 * TOKEN_UNIT }, // 1M
                            { from: tier1Participant2, value: 121 * TOKEN_UNIT },
                            { from: tier2Participant1, value: 5000000 * TOKEN_UNIT }, // 5M
                            { from: tier1Participant3, value: 131 * TOKEN_UNIT },
                            { from: tier2Participant2, value: 8000000 * TOKEN_UNIT }, // 50M
                            { from: tier1Participant1, value: 10000 * TOKEN_UNIT },
                            { from: tier1Participant2, value: 1212 * TOKEN_UNIT }
                        ],
                    ].forEach((transactions) => {
                        context(`${JSON.stringify(transactions).slice(0, 200)}...`, async function() {
                            // These are long tests, so we need to disable timeouts.
                            this.timeout(0);

                            beforeEach(async () => {
                                await addPresaleTokenGrants(sale);
                            })

                            it('should execute sale orders', async () => {
                                await verifyTransactions(sale, fundRecipient, method, transactions);
                            });
                        });
                    });
                });
            });
        });
    }

    // Generate tests for create() - Create and sell tokens to the caller.
    generateTokenTests('using create()', async (sale, value, from) => {
        let account = from || accounts[0];
        return sale.create(account, {value: value, from: account});
    });

    // Generate tests for fallback method - Should be same as create().
    generateTokenTests('using fallback function', async (sale, value, from) => {
        if (from) {
            return sale.sendTransaction({value: value, from: from});
        }

        return sale.send(value);
    });

    describe('transfer ownership', async () => {
        let sale;
        let token;
        let trustee;
        let start;
        let startFrom = 1000;
        let end;
        let fundRecipient = accounts[8];

        beforeEach(async () => {
            start = now + startFrom;
            sale = await KinTokenSaleMock.new(fundRecipient, start);
            end = (await sale.endTime()).toNumber();
            token = KinToken.at(await sale.kin());
        });

        // Kin token contract ownership transfer tests.
        let testTransferAndAcceptTokenOwnership = async () => {
            let owner = accounts[0];
            let newOwner = accounts[1];
            let notOwner = accounts[8];

            describe('Kin token contract ownership transfer', async () => {
                describe('request', async () => {
                    it('should allow contract owner to request transfer', async () => {
                        assert.equal(await token.owner(), sale.address);

                        await sale.requestKinTokenOwnershipTransfer(newOwner, {from: owner});
                    });

                    it('should not allow non-owner to request transfer', async () => {
                        await expectRevert(sale.requestKinTokenOwnershipTransfer(newOwner, {from: notOwner}));
                    });
                });

                describe('accept', async () => {
                    it('should not allow owner to accept', async () => {
                        await expectRevert(token.acceptOwnership({from: owner}));
                    });

                    it('should not allow new owner to accept without request', async () => {
                        await expectRevert(token.acceptOwnership({from: newOwner}));
                    });
                });

                describe('request and accept', async () => {
                    it('should transfer ownership to new owner', async () => {
                        // Test original owner is still owner before and after ownership REQUEST (not accepted yet!).
                        assert.equal(await token.owner(), sale.address);
                        await sale.requestKinTokenOwnershipTransfer(newOwner, {from: owner});
                        assert.equal(await token.owner(), sale.address);

                        // Test ownership has been transferred after acceptance.
                        await token.acceptOwnership({from: newOwner});
                        assert.equal(await token.owner(), newOwner);

                        // Original owner should not be able to request ownership after acceptance (he's not the owner
                        // anymore).
                        await expectRevert(sale.requestKinTokenOwnershipTransfer(newOwner, {from: owner}));
                    });

                    it('should be able to claim ownership back', async () => {
                        // Transfer ownership to another account.
                        assert.equal(await token.owner(), sale.address);
                        await sale.requestKinTokenOwnershipTransfer(newOwner, {from: owner});
                        await token.acceptOwnership({from: newOwner});
                        assert.equal(await token.owner(), newOwner);

                        // Test transfer ownership back to original account.
                        await token.requestOwnershipTransfer(sale.address, {from: newOwner});
                        assert.equal(await token.owner(), newOwner);

                        await sale.acceptKinTokenOwnership({from: owner});
                        assert.equal(await token.owner(), sale.address);
                    });
                });
            });
        };

        // Vesting trustee contract ownership transfer tests.
        let testTransferAndAcceptVestingTrusteeOwnership = async () => {
            let owner = accounts[0];
            let newOwner = accounts[1];
            let notOwner = accounts[8];

            describe('Vesting Trustee contract ownership transfer', async () => {
                describe('request', async () => {
                    it('should allow for contract owner', async () => {
                        assert.equal(await trustee.owner(), sale.address);

                        await sale.requestVestingTrusteeOwnershipTransfer(newOwner, {from: owner});
                    });

                    it('should not allow for non-contract owner', async () => {
                        await expectRevert(sale.requestVestingTrusteeOwnershipTransfer(newOwner, {from: notOwner}));
                    });
                });

                describe('accept', async () => {
                    it('should not allow owner to accept', async () => {
                        await expectRevert(sale.acceptVestingTrusteeOwnership({from: notOwner}));
                    });

                    it('should not allow new owner to accept without request', async () => {
                        await expectRevert(sale.acceptVestingTrusteeOwnership({from: notOwner}));
                    });
                });

                describe('request and accept', async () => {
                    it('should transfer ownership to new owner', async () => {
                        // Test original owner is still owner before and
                        // after ownership REQUEST (not accepted yet!).
                        assert.equal(await token.owner(), sale.address);
                        await sale.requestVestingTrusteeOwnershipTransfer(newOwner, {from: owner});
                        assert.equal(await trustee.owner(), sale.address);

                        // Test ownership has been transferred after acceptance.
                        await trustee.acceptOwnership({from: newOwner});
                        assert.equal(await trustee.owner(), newOwner);

                        // Original owner should not be able to request
                        // ownership after acceptance (he's not the owner anymore).
                        await expectRevert(sale.requestVestingTrusteeOwnershipTransfer(newOwner, {from: owner}));
                    });

                    it('should be able to claim ownership back', async () => {
                        // Transfer ownership to another account.
                        assert.equal(await trustee.owner(), sale.address);
                        await sale.requestVestingTrusteeOwnershipTransfer(newOwner, {from: owner});
                        await trustee.acceptOwnership({from: newOwner});
                        assert.equal(await trustee.owner(), newOwner);

                        // Test transfer ownership back to original account.
                        await trustee.requestOwnershipTransfer(sale.address, {from: newOwner});
                        assert.equal(await trustee.owner(), newOwner);

                        await sale.acceptVestingTrusteeOwnership({from: owner});
                        assert.equal(await trustee.owner(), sale.address);
                    });
                });
            });
        };

        context('during the sale', async () => {
            beforeEach(async () => {
                await increaseTime(start - now + ((end - start) / 2));

                assert.isAbove(now, start);
                assert.isBelow(now, end);
            });

            testTransferAndAcceptTokenOwnership();
        });

        context('after the sale', async () => {
            context('reached token cap', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(MAX_TOKENS_SOLD.toNumber());
                    await grantTokens(sale, KIN_TOKEN_GRANTS);
                    await sale.finalize();

                    trustee = VestingTrustee.at(await sale.trustee());
                });

                testTransferAndAcceptTokenOwnership();
                testTransferAndAcceptVestingTrusteeOwnership();
            });

            context('after the ending time', async () => {
                beforeEach(async () => {
                    await increaseTime(end - now + 1);
                    assert.isAbove(now, end);

                    await grantTokens(sale, KIN_TOKEN_GRANTS);
                    await sale.finalize();

                    trustee = VestingTrustee.at(await sale.trustee());
                });

                testTransferAndAcceptTokenOwnership();
                testTransferAndAcceptVestingTrusteeOwnership();
            });
        });
    });

    const longTests = process.env['LONG_TESTS'];
    (longTests ? describe : describe.skip)('long token sale scenarios', async function() {
        // These are very long tests, so we need to  disable timeouts.
        this.timeout(0);

        let sale;
        let token;
        let fundRecipient = accounts[0];
        let tier1Participants;
        let tier2Participants;
        let start;
        let startFrom = 1000;
        let end;

        // Center index in accounts array.
        const centerIndex = Math.floor(accounts.length / 2);

        // Setup a standard sale just like previous tests, with a single tier 2 participant
        // and move time to be during the sale.
        beforeEach(async () => {
            start = now + startFrom;
            sale = await KinTokenSaleMock.new(fundRecipient, start);
            end = (await sale.endTime()).toNumber();
            token = KinToken.at(await sale.kin());

            // We'll be testing transactions from all these accounts in the following tests.
            // We require at least 50 (ignoring first owner account).
            assert.isAtLeast(accounts.length, 51);

            // We're generating transactions for many accounts and also skipping the first owner account.
            // We split these accounts to two tiers, thus in order for them to be equal
            // length we need an odd (accounts.length) value
            assert.equal(accounts.length % 2, 1);

            await increaseTime(start - now + 1);
            assert.isAtLeast(now, start);
            assert.isBelow(now, end);
        });

        let create = async (sale, value, from) => {
            let account = from || accounts[0];
            return sale.create(account, {value: value, from: account});
        };

        const WHITELIST_SIZE = 50000;

        // NOTE (accounts.length - 1) because we're skipping first owner account.
        context(`${WHITELIST_SIZE + accounts.length - 1} registered participants`, async () => {
            const BATCH_SIZE = 200;

            // Whitelist participants along with random addresses:

            beforeEach(async () => {
                // Add presale grants.
                await addPresaleTokenGrants(sale);

                // Assign random addresses (as noise) to tier 1.
                for (let i = 0; i < WHITELIST_SIZE / BATCH_SIZE; ++i) {
                    console.log(`\tWhitelisting [${i * BATCH_SIZE} - ${(i + 1) * BATCH_SIZE}] non-existing participants...`);

                    const addresses = Array.from(Array(BATCH_SIZE), (_, x) => {
                        return '0x'.padEnd(42, x + i * BATCH_SIZE)
                    });

                    await sale.setTier1Participants(addresses);
                }

                // Assign 50% of participants to tier 1 and the other to tier 2.
                //
                // NOTE skipping owner account.
                tier1Participants = accounts.slice(1, centerIndex + 1);
                tier2Participants = accounts.slice(centerIndex + 1, accounts.length);

                console.log(`\tWhitelisting ${tier1Participants.length} tier 1 participants...`);
                await sale.setTier1Participants(tier1Participants);

                console.log(`\tWhitelisting ${tier2Participants.length} tier 2 participants...`);
                await sale.setTier2Participants(tier2Participants);
            });

            it('should be able to participate', async () => {
                // Generate transactions, and mix tier 1 and tier 2 transactions together.
                let transactions = [];
                for (let i = 0; i < centerIndex; ++i) {
                    // NOTE value is (i+1) such that first member will send 1 ETH (0 ETH will fail).
                    transactions.push({from: tier1Participants[i], value: (i + 1) * TOKEN_UNIT});
                    transactions.push({from: tier2Participants[i], value: (i + 1) * 10 * TOKEN_UNIT});
                }

                await verifyTransactions(sale, fundRecipient, create, transactions);
            });

            // This test generates very small and very large transactions. During the sale,
            // the hard cap is lifted to infinity, and then we test the very large
            // transactions are succeeding, and the sale is finalized.
            //
            // We're trying to create "chaotic" behaviour by mixing small and large transactions together.
            it('should be able to participate in various amounts with changing sale cap', async () => {
                // Generate transactions, and mix tier 1 and tier 2 transactions together.
                let transactions = [];
                let liftHardCapIndex = 75;
                for (let j = 0; j < 50; ++j) {
                    // Lift hard cap to infinity during the sale.
                    if (j === 40) {
                        console.log(`\tGenerating hard participation cap change...`);
                        transactions.push({ hardParticipationCap: TIER_2_CAP_BIGNUMBER });
                    }

                    console.log(`\tGenerating ${tier1Participants.length} transactions...`);
                    for (let i = 0; i < centerIndex; ++i) {
                        // NOTE value is (i+1) such that first member will send 1 ETH (0 ETH will fail).

                        // Tier 1 participants send a negligble amount of ETH (0.01-0.25 ETH).
                        transactions.push({from: tier1Participants[i], value: (i + 1) * 0.01 * TOKEN_UNIT});

                        // Tier 2 participants start with sending 1-25 ETH every iteration,
                        // Then after the hard cap has been lifted, send 500-12500 ETH.
                        let tier2Value = j < liftHardCapIndex ? 1 : 500;
                        transactions.push({from: tier2Participants[i], value: (i + 1) * tier2Value * TOKEN_UNIT});
                    }
                }

                await verifyTransactions(sale, fundRecipient, create, transactions);
            });
        });
    });
});
