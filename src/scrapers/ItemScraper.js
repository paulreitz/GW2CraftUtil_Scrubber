import request from 'request';
import sql from 'mssql';
import { tryParseItem } from '../utils/parser';
import dbConfig from '../utils/dbConfig';

class ItemScraper {
    items = [];
    current = 0;
    count = 0;
    itemIDs = [];
    storeRetry = 0;
    getRetry = 0;
    maxRetries = 5;
    retryTimeMs = 500;

    addItem(id) {
        const index = this.itemIDs.indexOf(id);
        if (index === -1) {
            this.itemIDs.push(id);
        }
    }

    getItemIDs() {
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
                this.nextItem();
            })
            .catch((error) => {
                if (this.getRetry < this.maxRetries) {
                    setTimeout(() => {
                        this.getRetry++;
                        this.getItemIDs();
                    }, this.getRetry * this.retryTimeMs);
                }
                else {
                    console.log('Error: Could not retrieve recipes from DB: ', error);
                }
                console.log('Error getting recipes ', error);
            })
        });
    }

    nextItem() {
        if (this.current < this.count) {
            console.log('getting item by id: ', this.itemIDs[this.current]);
            request(`https://api.guildwars2.com/v2/items/${this.itemIDs[this.current]}`, (error, response, body) => {
                if (error) {
                    console.log('could not fetch item', this.itemIDs[this.current]);
                }
                else if (body.text && body.text === 'no such id') {
                    console.log('No item for the given id: ', this.itemIDs[this.current]);
                    this.current++
                    this.storeRetry = 0;
                    this.nextItem();
                }
                else {
                    try {
                        const item = JSON.parse(body);
                        this.storeItem(item);
                    }
                    catch(e) {
                        console.log('could not parse body: ', e);
                    }
                }
            })
        }
        else {
            console.log('Scraping of items complete');
        }
    }

    buildQueryString(body) {
        const id = body.id;
        const name = `'${(body.name || '').replace(/'/g, '&lsquo;')}'`;
        const type = `'${body.type}'`;
        const rating = body.level; // converting to different column name as 'level' has some other meaning in sql server
        const rarity = `'${body.rarity}'`;
        const vendorValue = body.vendor_value;
        const defaultSkin = (body.default_skin || 0);
        const gameTypes = tryParseItem(body.game_types);
        const flags = tryParseItem(body.flags);
        const restrictions = tryParseItem(body.restrictions);
        const chatLink = `'${body.chat_link}'`;
        const icon = `'${body.icon}'`;
        const details = body.details ? tryParseItem(body.details, true) : '\'{}\'';
        return `UpdateOrInsertItem @id=${id}, @name=${name}, @type=${type}, @rating=${rating}, @rarity=${rarity}, @vendor_value=${vendorValue}, @default_skin=${defaultSkin}, @game_types=${gameTypes}, @flags=${flags}, @restrictions=${restrictions}, @chat_link=${chatLink}, @icon=${icon}, @details=${details}`
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
        console.log('running storeItem for ', this.itemIDs[this.current]);
        const queryString = this.buildQueryString(item);
        sql.connect(dbConfig, (err) => {
            if (err) {
                console.log('error: ', err);
            }
            else {
                const req = new sql.Request();
                req.query(queryString).then(() => {
                    this.current++;
                    this.storeRetry = 0;
                    this.nextItem();
                }).catch((error) => {
                    console.log('Error writing item: ', error);
                    if (this.storeRetry < this.maxRetries) {
                        this.storeRetry++;
                        this.nextItem();
                    }
                    else {
                        this.storeRetry = 0;
                        this.current++
                        this.nextItem();
                    }
                })
            }
        })
    }
}

export default ItemScraper;