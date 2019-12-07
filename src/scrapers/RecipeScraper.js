import request from 'request';
import sql from 'mssql';
import { tryParseItem } from '../utils/parser';
import dbConfig from '../utils/dbConfig';

class RecipeScraper {
    current = 0;
    count = 0;
    recipes = [];
    parseRetry = 1;
    startRetry = 1;
    getRetry = 0;
    storeRetry = 0;
    maxRetries = 5;
    failedRecipes = [];
    retryTimeMs = 500;

    startScrape() {
        request('https://api.guildwars2.com/v2/recipes', (error, __response, body) => {
            if (error) {
                console.log('error getting recipes: ', error);
                if (this.getRetry < this.maxRetries) {
                    setTimeout(() => {
                        this.getRetry++;
                        this.startScrape();
                    }, this.retryTimeMs * this.getRetry);
                }
                else {
                    console.log(`Error getting recipe indeces after ${this.maxRetries} attempts.`);
                }
            }
            else {
                try {
                    this.recipes = JSON.parse(body);
                    this.current = 0;
                    this.count = this.recipes.length;
                    this.getRetry = 0;
                    this.nextRecipe();
                }
                catch(e) {
                    console.log('Error parsing recipe IDs, ', e);
                    if (this.getRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.getRetry++;
                            this.startScrape();
                        }, this.retryTimeMs * this.getRetry);
                    }
                    else {
                        console.log(`Failed to parse recipe indeces after ${this.maxRetries} attempts.`);
                    }
                }
            }
        });
    }

    nextRecipe() {
        if (this.current < this.count) {
            request(`https://api.guildwars2.com/v2/recipes/${this.recipes[this.current]}`, (error, response, body) => {
                if (error) {
                    console.log('error getting recipe: ', error);
                    if (this.getRetry < this.maxRetries) {
                        setTimeout(() => {
                            this.getRetry++;
                            this.nextRecipe();
                        }, this.retryTimeMs * this.getRetry);
                    }
                    else {
                        console.log(`Failed to get recipe ${this.recipes[this.current]} after ${this.maxRetries} attempts.`);
                        this.getRetry = 0;
                        this.failedRecipes.push(this.recipes[this.current]);
                        this.current++;
                        this.nextRecipe();
                    }
                }
                else {
                    const recipe = JSON.parse(body);
                    this.storeRecipe(recipe);
                }
            });
        }
        else {
            console.log('Scraping complete');
        }
    }

    buildQuieryString(body) {
        const id = body.id;
        const type = body.type;
        const outputItemId = body.output_item_id;
        const outputItemCount = body.output_item_count;
        const minRating = body.min_rating;
        const timeToCraftMs = body.time_to_craft_ms;
        const disciplines = tryParseItem(body.disciplines);
        const flags = tryParseItem(body.flags);
        const ingredients = tryParseItem(body.ingredients);
        const chatLink = body.chat_link;
        return `UpdateOrInsertRecipe @id=${id}, @type='${type}', @output_item_id=${outputItemId}, @output_item_count=${outputItemCount}, @min_rating=${minRating}, @time_to_craft_ms=${timeToCraftMs}, @disciplines=${disciplines}, @flags=${flags}, @ingredients=${ingredients}, @chat_link='${chatLink}'`;
    }

    /*
        CREATE PROCEDURE UpdateOrInsertRecipe (
            @id INT,
            @type NVARCHAR(50),
            @output_item_id INT,
            @output_item_count SMALLINT,
            @min_rating SMALLINT,
            @time_to_craft_ms SMALLINT,
            @disciplines TEXT,
            @flags TEXT,
            @ingredients TEXT,
            @chat_link NVARCHAR(50)
        )
        AS BEGIN
        update Recipes SET 
            Recipes.type=@type, 
            Recipes.output_item_id=@output_item_id,
            Recipes.output_item_count=@output_item_count,
            Recipes.min_rating=@min_rating,
            Recipes.time_to_craft_ms=@time_to_craft_ms,
            Recipes.disciplines=@disciplines,
            Recipes.flags=@flags,
            Recipes.ingredients=@ingredients,
            Recipes.chat_link=@chat_link 
            WHERE id=@id

        IF @@ROWCOUNT = 0
            INSERT INTO Recipes (
                id, 
                type,
                output_item_id,
                output_item_count,
                min_rating,
                time_to_craft_ms,
                disciplines,
                flags,
                ingredients,
                chat_link
                ) 
            VALUES (
            @id, 
            @type,
            @output_item_id,
            @output_item_count,
            @min_rating,
            @time_to_craft_ms,
            @disciplines,
            @flags,
            @ingredients,
            @chat_link
            )
        END
    */
    storeRecipe(body) {
        console.log('running storeRecipe...');
        const queryString = this.buildQuieryString(body);
        sql.connect(dbConfig, (err) => {
            if (err) {
                console.log('error', err);
                if (this.storeRetry < this.maxRetries) {
                    setTimeout(() => {
                        this.storeRetry++;
                        this.nextRecipe();
                    }, this.retryTimeMs * this.storeRetry);
                }
                else {
                    this.failedRecipes.push(this.recipes[this.current]);
                    this.storeRetry = 0;
                    this.current++;
                    this.nextRecipe();
                }
            }
            else {
                const req = new sql.Request();
                req.query(queryString).then(() => {
                    console.log(`saved recipe ${body.id}.`);
                    this.current++;
                    this.nextRecipe();
                }).catch((error) => {
                    console.log('Error Storing: ', error);
                    console.log(`${this.storeRetry} < ${this.maxRetries}?`);
                    if (this.storeRetry < this.maxRetries) {
                        // CODE COVERAGE NOTE: This test is currently disabled, as there's a timing issue with the promise/setTimeOut - working on it.
                        console.log('set timeout...');
                        setTimeout(() => {
                            this.storeRetry++;
                            this.nextRecipe();
                        }, this.retryTimeMs * this.storeRetry);
                    }
                    else {
                        this.failedRecipes.push(this.recipes[this.current]);
                        this.storeRetry = 0;
                        this.current++;
                        this.nextRecipe();
                    }
                })
            }
        })
    }
}

export default RecipeScraper;
