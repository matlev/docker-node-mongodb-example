const mongo = require('../../src/modules/mongo-db/mongo');

const mockData = [{"address":"mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp","category":"receive","amount":8,"confirmations":1,"txid":"146df95d04dc205f10cbb07d4a55d0ed924056a6a4c8873823fd09811b76387e","vout":32,},{"address":"mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n","category":"receive","amount":7.71,"confirmations":6,"txid":"5a798928969f3a7be6b85cecbd35cdcc78a0291c8dd0471b66dfbad4459a3366","vout":49}];

describe('test setting up and tearing down mongodb', () => {
    test('sets up a mongodb client', async () => {
        return expect(mongo.init()).resolves.toBeUndefined();
    });

    test('tears down mongodb connection', async () => {
        return expect(mongo.shutDown()).resolves.toBeUndefined();
    });
});

describe('test db operations', () => {
    beforeAll(() => {
        return mongo.init();
    });

    afterAll(() => {
        mongo.shutDown();
    });

    test('inserts data into the database', async () => {
        const queryParams = ['txid', 'vout'];
        return expect(mongo.upsertMany(queryParams, mockData)).resolves.toBeDefined();
    });

    test('gets records back that match the address and are valid', async () => {
        const result = await mongo.aggregateValidDepositsForAddressesIn(['mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n']);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('_id', 'mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n');
    });

    test('does not get a record back when the adress has no valid deposits', async () => {
        const result = await mongo.aggregateValidDepositsForAddressesIn(['mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp']);
        expect(result).toHaveLength(0);
    });

    test('gets records back that do not match the address and are valid', async () => {
        const result = await mongo.aggregateValidDepositsForAddressesNotIn(['mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp']);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('_id', 0);
    });

    test('gets the max valid deposit', async () => {
        const result = await mongo.getMaxValidDeposit();
        expect(result).toHaveProperty('amount', 7.71);
    });

    test('gets the min valid deposit', async () => {
        const result = await mongo.getMinValidDeposit();
        expect(result).toHaveProperty('amount', 7.71);
    });
});
