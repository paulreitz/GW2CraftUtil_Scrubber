import request from 'request';
import sql from 'mssql';
import dbConfig from '../utils/dbConfig';
import { buildRecipeQuieryString } from '../utils/queryStrings';

class SingleRecipe {
    recipeID = 0;
    retry = 0;
    maxRetries = 5;
    retryTimeMs = 500;

    constructor(id) {
        console.log('start single recipe...');
        this.recipeID = id;
    }

    fetchRecipe() {
        request(`https://api.guildwars2.com/v2/recipes/${this.recipeID}`, (error, __response, body) => {
            if (error) {
                if (this.retry < this.maxRetries) {
                    setTimeout(() => {
                        console.log(`Attempt to fetch ${this.recipeID} from API - attempt #${this.retry + 1}`);
                        this.retry++;
                        this.fetchRecipe();
                    }, this.retry * this.retryTimeMs);
                }
                else {
                    console.log('ERROR: could not fetch from API - ', error);
                }
            }
            else {
                console.log(`Successfull fetched recipe ${this.id} from API`);
                const recipe = JSON.parse(body);
                this.retry = 0;
                this.storeRecipe(recipe);
            }
        });
    }

    storeRecipe(recipe) {
        return new Promise((resolve, reject) => {
            const queryString = buildRecipeQuieryString(recipe);
            sql.connect(dbConfig, (err) => {
                if (err) {
                    if (this.retry < this.maxRetries) {
                        setTimeout(() => {
                            console.log(`Attempt #${this.retry + 1} to reconnect to the database`);
                            this.retry++;
                            this.storeRecipe(recipe);
                        }, this.retry * this.retryTimeMs);
                    }
                    else {
                        console.log(`Could not connect to database after ${this.maxRetries} retries - for recipe ${this.recipeID}`);
                        reject(err);
                    }
                }
                else {
                    const req = new sql.Request();
                    req.query(queryString)
                    .then(() => {
                        console.log(`Recipe ID ${this.recipeID} successfully stored`);
                        resolve();
                        process.exit(0);
                    })
                    .catch((error) => {
                        if (this.retry < this.maxRetries) {
                            setTimeout(() => {
                                console.log(`Attemt #${this.retry + 1} to save recipe id ${this.recipeID} to the databse`);
                                this.retry++;
                                this.storeRecipe(recipe);
                            }, this.retry * this.retryTimeMs);
                            reject(error); // Reject here for testing - the only reason this promise exists in the first place.
                        }
                        else {
                            console.log(`Could not save reciep ${this.recipeID} to database`);
                            console.log(error);
                            console.log(queryString);
                            reject(error);
                        }
                    })
                }
            })
        });
    }
}

export default SingleRecipe;