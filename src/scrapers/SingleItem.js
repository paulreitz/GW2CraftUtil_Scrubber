import request from 'request';
import sql from 'mssql';
import dbConfig from '../utils/dbConfig';
import { buildItemQueryString } from '../utils/queryStrings';

class SingleItem {
    itemID = 0;
    retry = 0;
    maxRetries = 5;
    retryTimeMs = 500;

    constructor(id) {
        this.itemID = id;
    }

    fetchItem() {
        request(`https://api.guildwars2.com/v2/items/${this.itemID}`, (error, __response, body) => {
            if (error) {
                if (this.retry < this.maxRetries) {
                    setTimeout(() => {
                        console.log(`Attempting to fetch item ${this.itemID} from API - attempt #${this.retry + 1}.`);
                        this.retry++;
                        this.fetchItem();
                    }, this.retry * this.retryTimeMs);
                }
                else {
                    console.log('ERROR: could not fetch item from API - ', error);
                }
            }
            else {
                console.log(`Successfully fetched item ${this.itemID} from API`);
                const item = JSON.parse(body);
                this.retry = 0;
                this.storeItem(item);
            }
        });
    }

    storeItem(item) {
        return new Promise((resolve, reject) => {
            const queryString = buildItemQueryString(item);
            sql.connect(dbConfig, (err) => {
                if (err) {
                    if (this.retry < this.maxRetries) {
                        setTimeout(() => {
                            console.log(`Attempt #${this.retry + 1} to reconnect to the database`);
                            this.retry++;
                            this.storeItem(item);
                        }, this.retry * this.maxRetries);
                    }
                    else {
                        console.log(`Could not connect to database after ${this.maxRetries} retries - for item ${this.itemID}.`);
                        reject(err);
                    }
                }
                else {
                    const req = new sql.Request();
                    req.query(queryString)
                    .then(() => {
                        console.log(`Item ID ${this.itemID} successfully stored.`);
                        resolve();
                        process.exit(0);
                    })
                    .catch((error) => {
                        if (this.retry < this.maxRetries) {
                            setTimeout(() => {
                                console.log(`Attempt #${this.retry + 1} to save item id ${this.item} to the database.`);
                                this.retry++;
                                this.storeItem(item);
                            }, this.retry * this.retryTimeMs);
                            reject(error); // For testing only
                        }
                        else {
                            console.log(`Could not save item ${this.itemID} to database`);
                            console.log(error);
                            console.log(queryString);
                            reject(error);
                        }
                    })
                }
            });
        });
    }
}

export default SingleItem;