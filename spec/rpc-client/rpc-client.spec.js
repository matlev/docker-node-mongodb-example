const rpcClient = require('../../src/modules/rpc-client/mock-rpc');

describe('setting up and running a mock rpc client', () => {
    test('initializes the rpc client', () => {
        return expect(rpcClient.init()).resolves.toBeUndefined();
    }); 

    test('gets a "response" from listsinceblock', async () => {
        const response_one = await rpcClient.listSinceBlock();
        const response_two = await rpcClient.listSinceBlock('foo');

        expect(response_one).toBeDefined();
        expect(response_two).toBeDefined();
        expect(response_one).not.toEqual(response_two);
    });
});