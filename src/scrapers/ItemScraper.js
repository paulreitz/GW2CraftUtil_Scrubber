import request from 'request';
import sql from 'mssql';
import dbConfig from '../utils/dbConfig';
import { buildItemQueryString } from '../utils/queryStrings';

class ItemScraper {
    items = [];
    current = 0;
    count = 0;
    itemIDs = [];
    storeRetry = 0;
    getRetry = 0;
    maxRetries = 5;
    retryTimeMs = 500;
    failedItems = [];

    addItem(id) {
        const index = this.itemIDs.indexOf(id);
        if (index === -1) {
            this.itemIDs.push(id);
        }
    }

    getItemIDs() {
        return new Promise((resolve, reject) => {
            sql.connect(dbConfig, (err) => {
                if (err) {
                    if (this.getRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.getRetry++;
                            this.getItemIDs();
                        }, this.getRetry * this.retryTimeMs);
                    }
                    else {
                        console.log('Error: Could not retrieve recipes from DB: ', err);
                        reject(err);
                    }
                    return;
                }

                const req = new sql.Request();
                req.query('SELECT * FROM Recipes ORDER BY id')
                .then((set) => {
                    set.recordset.forEach((recipe) => {
                        this.addItem(recipe.output_item_id);
                        const ingredients = JSON.parse(recipe.ingredients);
                        ingredients.forEach((ingredient) => {
                            this.addItem(ingredient.item_id);
                        });
                    });
                    this.count = this.itemIDs.length;
                    this.current = 0;
                    this.getRetry = 0;
                    this.nextItem();
                    resolve();
                })
                .catch((error) => {
                    if (this.getRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.getRetry++;
                            this.getItemIDs();
                        }, this.getRetry * this.retryTimeMs);
                        reject('retry'); // Less than ideal, this Promise only exists for testing, so breaking the promise chain has no effect on the product.
                    }
                    else {
                        console.log('Error: Could not retrieve recipes from DB: ', error);
                        reject(error);
                    }
                    console.log('Error getting recipes ', error);
                })
            });
        });
    }

    nextItem() {
        if (this.current < this.count) {
            console.log('getting item by id: ', this.itemIDs[this.current]);
            request(`https://api.guildwars2.com/v2/items/${this.itemIDs[this.current]}`, (error, response, body) => {
                if (error) {
                    if (this.getRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.getRetry++;
                            this.nextItem();
                        }, this.getRetry * this.retryTimeMs);
                    }
                    else {
                        console.log('could not fetch item', this.itemIDs[this.current]);
                        this.failedItems.push(this.itemIDs[this.current]);
                        this.getRetry = 0;
                        this.current++;
                        this.nextItem();
                    }
                }
                else if (body.text && body.text === 'no such id') {
                    console.log('No item for the given id: ', this.itemIDs[this.current]);
                    this.current++
                    this.storeRetry = 0;
                    this.failedItems.push(this.itemIDs[this.current]);
                    this.nextItem();
                }
                else {
                    try {
                        const item = JSON.parse(body);
                        this.storeRetry = 0;
                        this.storeItem(item);
                    }
                    catch(e) {
                        if (this.getRetry < this.maxRetries) {
                            setTimeout(() => {
                                this.getRetry++;
                                this.nextItem();
                            }, this.getRetry * this.maxRetries);
                        }
                        else {
                            console.log('could not parse body: ', e);
                            this.getRetry = 0;
                            this.failedItems.push(this.itemIDs[this.current]);
                            this.current++;
                            this.nextItem();
                        }
                    }
                }
            })
        }
        else {
            console.log('Scraping of items complete');
            console.log(this.failedItems);
        }
    }

    /*
    CREATE PROCEDURE UpdateOrInsertItem (
        @id INT,
        @name TEXT,
        @type NVARCHAR(50),
        @rating SMALLINT,
        @rarity NVARCHAR(50),
        @vendor_value INT,
        @default_skin INT,
        @game_types TEXT,
        @flags TEXT,
        @restrictions TEXT,
        @chat_link NVARCHAR(50),
        @icon TEXT,
        @details TEXT
    )
    AS BEGIN
    UPDATE Items SET 
        Items.id=@id,
        Items.name=@name,
        Items.type=@type,
        Items.rating=@rating,
        Items.rarity=@rarity,
        Items.vendor_value=@vendor_value,
        Items.default_skin=@default_skin,
        Items.game_types=@game_types,
        Items.flags=@flags,
        Items.restrictions=@restrictions,
        Items.chat_link=@chat_link,
        Items.icon=@icon,
        Items.details=@details
        WHERE id=@id

    IF @@ROWCOUNT = 0
        INSERT INTO Items (
            id,
            name,
            type,
            rating,
            rarity,
            vendor_value,
            default_skin,
            game_types,
            flags,
            restrictions,
            chat_link,
            icon,
            details
        ) VALUES (
            @id,
            @name,
            @type,
            @rating,
            @rarity,
            @vendor_value,
            @default_skin,
            @game_types,
            @flags,
            @restrictions,
            @chat_link,
            @icon,
            @details
        )
    END
    */
    storeItem(item) {
        return new Promise((resolve, reject) => {
            console.log('running storeItem for ', this.itemIDs[this.current]);
            const queryString = buildItemQueryString(item);
            sql.connect(dbConfig, (err) => {
                if (err) {
                    if (this.storeRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.storeRetry++;
                            this.storeItem(item);
                        }, this.storeRetry * this.maxRetries);
                    }
                    else {
                        console.log('error: ', err);
                        this.storeRetry = 0;
                        this.failedItems.push(this.itemIDs[this.current]);
                        this.current++;
                        this.nextItem();
                        reject(err);
                    }
                    
                }
                else {
                    const req = new sql.Request();
                    req.query(queryString).then(() => {
                        this.current++;
                        this.storeRetry = 0;
                        this.nextItem();
                        resolve();
                    }).catch((error) => {
                        console.log('Error writing item: ', error);
                        if (this.storeRetry < this.maxRetries) {
                            setTimeout(() => {
                                this.storeRetry++;
                                this.nextItem();
                            }, this.storeRetry * this.maxRetries);
                            reject('doing retry');
                        }
                        else {
                            this.storeRetry = 0;
                            this.failedItems.push(this.itemIDs[this.current]);
                            this.current++
                            this.nextItem();
                            reject(error);
                        }
                    })
                }
            })
        });
    } // end function
}

export default ItemScraper;