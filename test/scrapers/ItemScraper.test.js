jest.mock('request');
jest.mock('mssql');
import request from 'request';
import sql from 'mssql';
import ItemScraper from '../../src/scrapers/ItemScraper';
import { mockRecipeSet } from '../fixtures/mockRecipes';
import { mockItem, mockItemNoName, mockItemNoDefaultSkin, mockItemNoDetails } from '../fixtures/mockItems';

jest.useFakeTimers();

test('should add item id to the ItemIDs array if it does not already exist', () => {
    const scraper = new ItemScraper();
    scraper.itemIDs = [24,46,56];
    scraper.addItem(57);
    expect(scraper.itemIDs.length).toBe(4);
});

test('should not add item id to the itemIDs array if it already exists', () => {
    const scraper = new ItemScraper();
    scraper.itemIDs = [24,46,56];
    scraper.addItem(24);
    expect(scraper.itemIDs.length).toBe(3);
});

test('should get recipes from DB and set the itemIDs array', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.resolve({
                    recordset: mockRecipeSet
                });
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.nextItem = jest.fn(() => {
        expect(scraper.nextItem).toHaveBeenCalled();
        expect(scraper.itemIDs.length).toBe(20);
        done();
    });
    scraper.getItemIDs();
});

test('should retry if failed to connect to DB while retrieving item IDs', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const calls = sql.Request.mock.calls.length;
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                // reject, since this should never be called during this test
                return Promise.reject();
            })
        };
    });
    const scraper = new ItemScraper();
    const getItemIDs = scraper.getItemIDs.bind(scraper);
    let run = true;
    // Run once to prevent else clause from being run in this test.
    scraper.getItemIDs = jest.fn(() => {
        if (run) {
            run = false;
            getItemIDs();
        }
    })
    scraper.nextItem = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.getItemIDs();
    jest.runAllTimers();
    expect(sql.Request.mock.calls.length).toBe(calls);
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should fail and exit if cannot connect to DB after max retries', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const calls = sql.Request.mock.calls.length;
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                // reject, since this should never be called during this test
                return Promise.reject();
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.nextItem = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries;
    scraper.getItemIDs();
    jest.runAllTimers();
    expect(sql.Request.mock.calls.length).toBe(calls);
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should retry if the recipe query fails', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('nope');
            })
        };
    });
    const scraper = new ItemScraper();
    const getItemIDs = scraper.getItemIDs.bind(scraper);
    let run = true;
    scraper.getItemIDs = jest.fn(() => {
        if (run) {
            run = false;
            return getItemIDs();
        }
        else {
            return Promise.resolve();
        }
    });
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.getItemIDs().catch(() => {
        jest.runAllTimers();
        expect(scraper.getRetry).toBe(scraper.maxRetries);
        done();
    });
});

test('should reject if failing to get IDs after maxTries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('not this time');
            })
        };
    });
    const scraper = new ItemScraper();
    const getItemIDs = scraper.getItemIDs.bind(scraper);
    let run = true;
    scraper.getItemIDs = jest.fn(() => {
        if (run) {
            run = false;
            return getItemIDs();
        }
        else {
            return Promise.resolve();
        }
    });
    scraper.getRetry = scraper.maxRetries;
    scraper.getItemIDs().catch(() => {
        jest.runAllTimers();
        expect(scraper.getRetry).toBe(scraper.maxRetries);
        done();
    });
});

test('should call storeItem if item data was successfully retrieved from the API', () => {
    request.mockImplementation((__url, callback) => {
        callback(null, {}, '{\"test\": \"data\"}');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    scraper.itemIDs = [1337];
    scraper.nextItem();
    expect(scraper.storeItem).toHaveBeenCalled();
});

test('should retry if failed to get item from API', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.failedItems = [];
    scraper.current = 0;
    scraper.count = 1;
    scraper.itemIDs = [1337];

    // Only call nextItem once
    const nextItem = scraper.nextItem.bind(scraper);
    let run = true;
    scraper.nextItem = jest.fn(() => {
        if (run) {
            run = false;
            nextItem();
        }
    });
    scraper.nextItem();
    jest.runAllTimers();
    expect(scraper.getRetry).toBe(scraper.maxRetries);
    expect(scraper.failedItems.length).toBe(0);
});

test('should continue to the next item if failed to retrieve item from API after max tries', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });

    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries;
    scraper.failedItems = [];
    scraper.current = 0;
    scraper.count = 1;
    scraper.itemIDs = [1337];

    // only call nextItem once
    const nextItem = scraper.nextItem.bind(scraper);
    let run = true;
    scraper.nextItem = jest.fn(() => {
        if (run) {
            run = false;
            nextItem();
        }
    });
    scraper.nextItem();
    expect(scraper.getRetry).toBe(0);
    expect(scraper.current).toBe(1);
    expect(scraper.failedItems.length).toBe(1);
    expect(scraper.failedItems[0]).toBe(1337);
});

test('should retry if invalid data recieved from the API', () => {
    request.mockImplementation((__url, callback) => {
        callback(null, {}, 'invalid JSON}}}');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.itemIDs = [1337];

    // call nextItem once
    const nextItem = scraper.nextItem.bind(scraper);
    let run = true;
    scraper.nextItem = jest.fn(() => {
        if (run) {
            run = false;
            nextItem();
        }
    });
    scraper.nextItem();
    jest.runAllTimers();
    expect(scraper.storeItem).not.toHaveBeenCalled();
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should move to the next item if failed to parse item after max tries', () => {
    request.mockImplementation((__rul, callback) => {
        callback(null, {}, 'invalid JSON}}}');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    scraper.getRetry = scraper.maxRetries;
    scraper.itemIDs = [1337]
    scraper.failedItems = [];

    // call nextItem once
    const nextItem = scraper.nextItem.bind(scraper);
    let run = true;
    scraper.nextItem = jest.fn(() => {
        if (run) {
            run = false;
            nextItem();
        }
    });
    scraper.nextItem();
    expect(scraper.getRetry).toBe(0);
    expect(scraper.current).toBe(1);
    expect(scraper.failedItems.length).toBe(1);
    expect(scraper.failedItems[0]).toBe(1337);
});

test('should not call storeItem if there was an error fetching the item from the API', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    const expectedCalls = request.mock.calls.length + 1;
    scraper.nextItem();
    expect(request.mock.calls.length).toBe(expectedCalls);
    expect(scraper.storeItem).not.toHaveBeenCalled();
});

test('should not store item if API returns \'no such id\'', () => {
    request.mockImplementation((url, callback) => {
        if (url.endsWith('1')) {
            callback(null, {}, { text: 'no such id' });
        }
        else {
            callback('error');
        }
        
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 2;
    scraper.itemIDs = [1,2];
    const expectedCalls = request.mock.calls.length + 2;
    scraper.nextItem();
    expect(request.mock.calls.length).toBe(expectedCalls);
    expect(scraper.storeItem).not.toHaveBeenCalled();
});

test('should not run nextItem if there are no more items in the array', () => {
    request.mockImplementation((__url, callback) => {
        callback(null, {}, { valid: 'data' });
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 1;
    scraper.count = 1;
    const expectedCalls = request.mock.calls.length;
    scraper.nextItem();
    expect(request.mock.calls.length).toBe(expectedCalls);
    expect(scraper.storeItem).not.toHaveBeenCalled();
});

test('should return the correct query string', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const scraper = new ItemScraper();
    const queryString = scraper.buildQueryString(mockItem);
    expect(queryString).toBe(expectedString);
});

test('should return query string with empty string for name if name does not exist', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const scraper = new ItemScraper();
    const queryString = scraper.buildQueryString(mockItemNoName);
    expect(queryString).toBe(expectedString);
});

test('should return query string with default_skin set to 0 if default_skin does not exist', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=0, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const scraper = new ItemScraper();
    const queryString = scraper.buildQueryString(mockItemNoDefaultSkin);
    expect(queryString).toBe(expectedString);
});

test('should return query string with empty object for details if no details provided', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{}\'';
    const scraper = new ItemScraper();
    const queryString = scraper.buildQueryString(mockItemNoDetails);
    expect(queryString).toBe(expectedString);
});

test('should correctly store an item to the database', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.resolve();
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.nextItem = jest.fn(() => {
        expect(scraper.nextItem).toHaveBeenCalled();
        expect(scraper.current).toBe(1);
        done();
    });
    scraper.current = 0;
    scraper.storeItem(mockItem);
});

test('should retry saving item to DB if connection failed', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject();
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.storeRetry = scraper.maxRetries - 1;
    // mock nextItem in case something goes wrong with the test.
    scraper.nextItem = jest.fn(() => {});

    // run storeItem once
    const storeItem = scraper.storeItem.bind(scraper);
    let run = true;
    scraper.storeItem = jest.fn((item) => {
        if (run) {
            run = false;
            storeItem(item);
        }
    })
    const expectedCalls = sql.Request.mock.calls.length;
    scraper.storeItem(mockItem);
    jest.runAllTimers();
    expect(sql.Request.mock.calls.length).toBe(expectedCalls);
    expect(scraper.storeRetry).toBe(scraper.maxRetries);
});

test('should continue to next item if the connection fails after max tries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    sql.Request.mockImplementation(() => {
        return { 
            query: jest.fn(() => {
                return Promise.reject('error');
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.storeRetry = scraper.maxRetries;
    scraper.itemIDs = [1337];
    scraper.failedItems = [];
    scraper.current = 0;
    scraper.count = 1;
    scraper.nextItem = jest.fn(() => {
        expect(scraper.storeRetry).toBe(0);
        expect(scraper.current).toBe(1);
        expect(scraper.failedItems.length).toBe(1);
        expect(scraper.failedItems[0]).toBe(1337);
        done();
    });
    scraper.storeItem(mockItem);
})

test('should retry if the item fails to save to the DB', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('error');
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.storeRetry = 0;
    scraper.current = 0;
    scraper.storeRetry = scraper.maxRetries - 1;
    scraper.nextItem = jest.fn(() => {});

    // call storeItem once 
    const storeItem = scraper.storeItem.bind(scraper);
    let run = true;
    scraper.storeItem = jest.fn((item) => {
        if (run) {
            run = false;
            return storeItem(item);
        }
        else {
            return Promise.reject('nope');
        }
    })
    scraper.storeItem(mockItem).catch(() => {
        jest.runAllTimers();
        expect(scraper.storeRetry).toBe(scraper.maxRetries);
        done();
    });
});

test('should move to next item if an item fails to save with the max tries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('error');
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.current = 0;
    scraper.storeRetry = scraper.maxRetries;
    scraper.nextItem = jest.fn(() => {
        expect(scraper.current).toBe(1);
        expect(scraper.storeRetry).toBe(0);
        done();
    });
    scraper.storeItem(mockItem);
})