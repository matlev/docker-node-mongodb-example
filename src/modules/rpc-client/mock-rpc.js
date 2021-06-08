const fs = require('fs');
// Insert imaginary imports here

/**
 * A pretend client that might have similar functionality to the real deal
 */
let client;

/**
 * "Create" an imaginary RPC client
 * @returns A promise resolving to a connected RPC client
 */
async function init() {
    client = {
        host: 'the server to call',
        port: 9000,
        on: async (status, callback) => {
            if (callback !== undefined) {
                callback();
            } else {
                return new Promise((accept, reject) => {
                    // Do some magical work getting the server schema.
                    // Since this is imaginary we're going to pretend it can't fail.
                    err = null;
                    if (err) return reject(err);
                    accept();
                });
            }
        },
    };

    // We don't care about the reject clause because it's not a real promise
    return new Promise((accept, reject) => {
        client.on('ready', () => {
            accept();
        });
    });
}

/**
 * Mock an RPC call to listsinceblock.
 * 
 * For the purpose of the quiz the method "receives the response" in the following way:
 *   If blockhash is null we return transactions-1.  
 *   If blockhash is not-null we return transactions-2.  
 * The purpose of this is to simulate using the lastblock value from our first reponse
 * to start our next call (and so on and so forth).  
 * 
 * @param {String} blockhash Optional, to determine where your list generates from
 * @returns Promise containing the "response" from the "rpc call".
 */
async function listSinceBlock(blockhash) {
    let filePath = blockhash
        ? "/app/src/resources/transactions-2.json"
        : "/app/src/resources/transactions-1.json";

    return new Promise((accept, reject) => {
        try {
            // Skip existsSync to avoid a very rare race condition.  If the file
            // doesn't exist we'll catch the exception anyway.
            const buffer = fs.readFileSync(filePath);
            response = JSON.parse(buffer);
            accept(response);
        } catch (e) {
            reject(e);
        }  
    });
}

module.exports = {
    init,
    listSinceBlock,
}