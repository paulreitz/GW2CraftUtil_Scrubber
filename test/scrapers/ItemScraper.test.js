jest.mock('request');
jest.mock('mssql');
import request from 'request';
import sql from 'mssql';
import ItemScraper from '../../src/scrapers/ItemScraper';
import { mockRecipeSet } from '../fixtures/mockRecipes';
import { mockItem, mockItemNoName, mockItemNoDefaultSkin } from '../fixtures/mockItems';

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

test('should exit if failed to connect to DB while retrieving item IDs', () => {
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
    scraper.getItemIDs();
    expect(sql.Request.mock.calls.length).toBe(calls);
});

test('should not add any items or set any items if the query fails', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('I don\'t feel like it today');
            })
        };
    });
    const scraper = new ItemScraper();
    scraper.nextItem = jest.fn(() => {});
    scraper.getItemIDs();
    expect(scraper.count).toBe(0);
    expect(scraper.nextItem).not.toHaveBeenCalled();
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

test('should not call storeItem if invalid data recieved from the API', () => {
    request.mockImplementation((__url, callback) => {
        callback(null, {}, 'invalid JSON}}}');
    });
    const scraper = new ItemScraper();
    scraper.storeItem = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    scraper.itemIDs = [1337];
    scraper.nextItem();
    expect(scraper.storeItem).not.toHaveBeenCalled();
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

test('should not save item to DB if connection failed', () => {
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
    // mock nextItem in case something goes wrong with the test.
    scraper.nextItem = jest.fn(() => {});
    const expectedCalls = sql.Request.mock.calls.length;
    scraper.storeItem(mockItem);
    expect(sql.Request.mock.calls.length).toBe(expectedCalls);
});

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
    scraper.nextItem = jest.fn(() => {
        expect(scraper.storeRetry).toBe(1);
        expect(scraper.current).toBe(0);
        done();
    });
    scraper.storeItem(mockItem);
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
    scraper.storeRetry = scraper.retryMax;
    scraper.nextItem = jest.fn(() => {
        expect(scraper.current).toBe(1);
        expect(scraper.storeRetry).toBe(0);
        done();
    });
    scraper.storeItem(mockItem);
})