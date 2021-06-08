const mongoService = require('./modules/mongo-db/mongo');
const rpcService = require('./modules/rpc-client/mock-rpc');

// This should be stored in data instead, but for this quiz we'll just hard code it
const KNOWN_ADDRESSES = {
    'mvd6qFeVkqH6MNAS2Y2cLifbdaX5XUkbZJ': 'Wesley Crusher',
    'mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp': 'Leonard McCoy',
    'mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n': 'Jonathan Archer',
    '2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo': 'Jadzia Dax',
    'mutrAf4usv3HKNdpLwVD4ow2oLArL6Rez8': 'Montgomery Scott',
    'miTHhiX3iFhVnAEecLjybxvV5g8mKYTtnM': 'James T. Kirk',
    'mvcyJMiAcSXKAEsQxbW9TYZ369rsMG6rVV': 'Spock'
};

commence();

async function commence() {
    let calculationResult;

    try {
        await Promise.all([mongoService.init(), rpcService.init()]);
        await collectTransactions();
        calculationResult = await calculateDeposits();
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
       
    reportCalculationResults(calculationResult);
} 

/**
 * Request block transactions.
 * 
 * For the purposes of this test we only want to "run" this twice, so we track
 * if it's our first run or not.  If it is, run again.  If not, then just return.
 * Normally, maybe we'd run this in an event listener-emitter cycle, or a cron, 
 * or some asynchronus worker that can continuously stream in data for us and feed
 * it to the database.
 * 
 * @param {String} blockhash Optional, lastblock value from listsinceblock RPC response
 */
async function collectTransactions(blockhash) {
    let firstRun = blockhash ? false : true;
    let response;

    try {
        response = await getListSinceBlock(blockhash);
    } catch (err) {
        console.log(err);
    }
    
    if (firstRun) return collectTransactions(response);
}

/**
 * Call listsinceblock and save the result.
 * 
 * @param {String} blockhash Optional, lastblock value from listsinceblock RPC response
 * @returns The lastblock value returned from listsinceblock
 */
async function getListSinceBlock(blockhash) {
    let rpcResponse = new Object();
    const keys = ['txid', 'vout'];
    try {
        rpcResponse = await rpcService.listSinceBlock(blockhash);
        mongoResponse = await mongoService.upsertMany(keys, rpcResponse.transactions);
    } catch (err) {
        console.log(err);
    }
    
    return rpcResponse.lastblock;
}

/**
 * Build an object organized with data for the purposes of this quiz
 * 
 * @returns {Object} Aggregated data from listsinceblock results
 */
async function calculateDeposits() {
    let data = {
        referencedDeposits: {},
        unreferencedDeposits: {},
        min: 0,
        max: 0,
    };

    let addresses = [];
    for (let address in KNOWN_ADDRESSES) {
        addresses.push(address);
    }

    try {
        data.referencedDeposits = await mongoService.aggregateValidDepositsForAddressesIn(addresses);
        data.unreferencedDeposits = await mongoService.aggregateValidDepositsForAddressesNotIn(addresses);
        data.max = await mongoService.getMaxValidDeposit();
        data.min = await mongoService.getMinValidDeposit();
    } catch (err) {
        console.log(err);
    }

    return data;
}

/**
 * Report the results per test instructions.
 * 
 * It happens that all addresses given have non-zero valid transactions,
 * and no instruction was given for if there happened to be no recorded
 * deposits for a known account.  Therefore, no extra checks are done to
 * output the following in the event of no available data:
 *     "Deposited for ACCOUNT_NAME: count=0 sum=0.00000000"
 * The following code would instead skip any users who didn't appear.
 * 
 * @param {Object} calculationResult The aggregated results from calculateDeposits()
 */
function reportCalculationResults(calculationResult) {
    // Known address output
    for (let address in KNOWN_ADDRESSES) {
        const data = calculationResult.referencedDeposits.find(depositData => {
            return depositData._id === address;
        });
        if (data) {
            console.log(`Deposited for ${KNOWN_ADDRESSES[address]}: count=${data.count} sum=${parseFloat(data.sum).toFixed(8)}`);
        }
    }

    console.log(`Deposited without reference: count=${calculationResult.unreferencedDeposits[0].count} sum=${parseFloat(calculationResult.unreferencedDeposits[0].sum).toFixed(8)}`);
    console.log(`Smallest valid deposit: ${parseFloat(calculationResult.min.amount).toFixed(8)}`);
    console.log(`Largest valid deposit: ${parseFloat(calculationResult.max.amount).toFixed(8)}`);
}

// DB-cleanup convenience to prevent orphaned connections
const gracefulShutdown = () => {
    mongoService.shutDown()
        .catch(() => {})
        .then(() => process.exit());
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown);