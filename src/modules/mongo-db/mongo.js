const waitPort = require('wait-port');
const {MongoClient} = require('mongodb');

// Preferrably these would instead come from the docker secrets
// available in the Swarm orchestration, as environment secrets
// make savvy developers very sad.
const {
    MONGODB_HOST: HOST,
    MONGODB_ADMINUSERNAME: USERNAME,
    MONGODB_ADMINPASSWORD: PASSWORD,
    MONGODB_PORT: PORT,
} = process.env;

// Ideally loaded in from some kind of schema file, and dbCollection
// wouldn't be hard-coded like this because we could query multiple collections.
const dbName = 'deposit';
const dbCollection = 'transaction';

let con;

/**
 * Connect to MongoDB
 * 
 * @returns Promise for app initialization
 */
async function init() {
    // Let the database container start up before creating a connection
    await waitPort({host: HOST, port: 27017});
    
    const url = process.env.NODE_ENV === 'test' 
    ? process.env.MONGO_URL
    : `mongodb://${USERNAME}:${PASSWORD}@${HOST}:${PORT}`;
    
    con = new MongoClient(url, { useUnifiedTopology: true });

    return new Promise((accept, reject) => {
        con.connect((err, res) => {
            if (err) return reject(err);
            else accept();
        });
    });
}

/**
 * Upsert multiple documents into the database
 * 
 * @param {Array} queryParams Key list of search criteria for updating. Each key MUST exist as a property in documents.
 * @param {Array} documents An array of documents to insert
 * @returns Promise containing response from MongoDB
 */
async function upsertMany(queryParams, documents) {
    return new Promise((accept, reject) => {
        const bulk = con.db(dbName).collection(dbCollection).initializeOrderedBulkOp();

        documents.forEach(doc => {
            // Converts ['a', 'b'] into { a: doc.a, b: doc.b }
            const query = queryParams.reduce((acc, cur) => (acc[cur] = doc[cur], acc), {});
            bulk.find(query).upsert().updateOne({ $set: doc });
        });

        bulk.execute((err, res) => {
            if (err) return reject(err);
            accept(res);
        });
    });
}

/**
 * Aggregate all valid deposits for the given addresses
 * 
 * A valid deposit is defined as having 6 or more confirmations, 
 * is non-zero, and belongs to the "receive" or "generate" categories.
 * 
 * @param {Array} addresses List of addresses to lookup deposits for
 * @returns The count and sum of valid deposits belonging to the given addresses
 */
async function aggregateValidDepositsForAddressesIn(addresses) {
    return new Promise((accept, reject) => {
        con.db(dbName).collection(dbCollection).aggregate([
            { $match: {
                confirmations: { $gte: 6 },
                amount: { $gt: 0 },
                $or: [{ category: 'receive' }, { category: 'generate' }],
                address: { $in: addresses },
            }},
            { $group: {
                _id: "$address",
                count: { $sum: 1 },
                sum: { $sum: "$amount" },
            }},
        ]).toArray((err, res) => {
            if (err) return reject(err);
            accept(res);
        });
    });
}

/**
 * Aggregate all valid deposits NOT in the given addresses
 * 
 * A valid deposit is defined as having 6 or more confirmations, 
 * is non-zero, and belongs to the "receive" or "generate" categories.
 * 
 * @param {Array} addresses List of addresses to exclude deposits for
 * @returns The count and sum of valid deposits NOT in the given addresses
 */
async function aggregateValidDepositsForAddressesNotIn(addresses) {
    return new Promise((accept, reject) => {
        con.db(dbName).collection(dbCollection).aggregate([
            { $match: {
                confirmations: { $gte: 6 },
                amount: { $gt: 0 },
                $or: [{ category: 'receive' }, { category: 'generate' }],
                address: { $nin: addresses },
            }},
            { $group: {
                _id: 0,
                count: { $sum: 1 },
                sum: { $sum: "$amount" },
            }},
        ]).toArray((err, res) => {
            if (err) return reject(err);
            accept(res);
        });
    });
}

/**
 * Find the current valid maximum deposit
 * @returns The max valid deposit so far
 */
async function getMaxValidDeposit() {
    return new Promise((accept, reject) => {
        con.db(dbName).collection(dbCollection).findOne(
            {
                confirmations: { $gte: 6 },
                amount: { $gt: 0 },
                $or: [{ category: 'receive' }, { category: 'generate' }],
            }, 
            {
                sort: { amount: -1 },
                projection: {_id: 0, amount: 1},
            }, (err, res) => {
                if (err) return reject(err);
                accept(res);
        });
    });
}

/**
 * Find the current valid minimum deposit
 * @returns The min valid deposit so far
 */
async function getMinValidDeposit() {
    return new Promise((accept, reject) => {
        con.db(dbName).collection(dbCollection).findOne(
            {
                confirmations: { $gte: 6 },
                amount: { $gt: 0 },
                $or: [{ category: 'receive' }, { category: 'generate' }],
            }, 
            {
                sort: { amount: +1 },
                projection: {_id: 0, amount: 1},
            }, (err, res) => {
                if (err) return reject(err);
                accept(res);
        });
    });
}

/**
 * Close the connection to the db
 * 
 * @returns Promise 
 */
async function shutDown() {
    return new Promise((accept, reject) => {
        con.close((err, res) => {
            if (err) reject(err);
            else accept();
        });
    });
}

module.exports = {
    init,
    upsertMany,
    aggregateValidDepositsForAddressesIn,
    aggregateValidDepositsForAddressesNotIn,
    getMaxValidDeposit,
    getMinValidDeposit,
    shutDown,
};