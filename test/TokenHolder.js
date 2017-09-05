import expectRevert from './helpers/expectRevert';

const TokenHolder = artifacts.require('../contracts/TokenHolder.sol');
const BasicTokenMock = artifacts.require('./helpers/BasicTokenMock.sol');

contract('TokenHolder', (accounts) => {
    let token;
    let tokenHolder;

    beforeEach(async () => {
        token = await BasicTokenMock.new();
        tokenHolder = await TokenHolder.new();
    });

    describe('transfer ERC20 tokens', async () => {
        let value = 5000;

        beforeEach(async () => {
            // Assign funds to some account and transfer it to token holder.
            await token.assign(accounts[0], value);
            await token.transfer(tokenHolder.address, value);

            assert.equal((await token.balanceOf(tokenHolder.address)).toNumber(), value);
        });

        it('should not allow to be called by a non-owner', async () => {
            let notOwner = accounts[5];
            await expectRevert(tokenHolder.transferAnyERC20Token(token.address, value, {from: notOwner}));
        });

        it('should transfer any ERC20 tokens back to the owner', async () => {
            // Transfer ERC20 tokens in chunks and verify that the balances stay correct.
            let balanceOfOwner = (await token.balanceOf(accounts[0])).toNumber();
            let balanceOfToken = (await token.balanceOf(tokenHolder.address)).toNumber();
            assert.equal(balanceOfOwner, 0);
            assert.equal(balanceOfToken, value);

            // Transfer 5 ERC20 tokens to some other account.
            let value2 = 5;
            await tokenHolder.transferAnyERC20Token(token.address, value2);
            let balanceOfOwner2 = (await token.balanceOf(accounts[0])).toNumber();
            let balanceOfToken2 = (await token.balanceOf(tokenHolder.address)).toNumber();
            assert.equal(balanceOfOwner2, value2);
            assert.equal(balanceOfToken2, value - value2);

            // Transfer the remaining ERC20 tokens to some other account.
            await tokenHolder.transferAnyERC20Token(token.address, value - value2);
            let balanceOfOwner3 = (await token.balanceOf(accounts[0])).toNumber();
            let balanceOfToken3 = (await token.balanceOf(tokenHolder.address)).toNumber();
            assert.equal(balanceOfOwner3, value);
            assert.equal(balanceOfToken3, 0);
        });
    });
});
