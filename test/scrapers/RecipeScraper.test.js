jest.mock('request');
jest.mock('mssql');
import request from 'request';
import sql from 'mssql';
import RecipeScraper from '../../src/scrapers/RecipeScraper';
import { mockRecipe } from '../fixtures/mockRecipes';

jest.useFakeTimers();
afterEach(() => jest.resetModules());

test('should set recipes if valid data is returned from the API call', ()=> {
    request.mockImplementation((_url, callback) => {
        callback(null, {}, '[1,2,3]');
    });
    let scraper = new RecipeScraper();
    scraper.nextRecipe = jest.fn(() => {});
    scraper.startScrape();
    expect(scraper.nextRecipe).toHaveBeenCalled();
});

test('should retry if initial call fails', () => {
    request.mockImplementation((_url, callback) => {
        callback('error');
    });
    let scraper = new RecipeScraper();
    scraper.nextRecipe = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.startScrape();
    jest.runAllTimers();
    expect(scraper.nextRecipe).not.toHaveBeenCalled();
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should retry if initial call returns invalid JSON', () => {
    request.mockImplementation((_url, callback) => {
        callback(null, {}, 'invalid JSON}}}');
    });
    let scraper = new RecipeScraper();
    scraper.nextRecipe = jest.fn(() => {});
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.startScrape();
    jest.runAllTimers();
    expect(scraper.nextRecipe).not.toHaveBeenCalled();
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should call storeRecipe when successfully getting a recipe from the server', () => {
    request.mockImplementation((url, callback) => {
        callback(null, {}, '{\"valid\": \"JSON\"}');
    });
    let scraper = new RecipeScraper();
    scraper.storeRecipe = jest.fn(() => {});
    scraper.current = 0;
    scraper.count = 1;
    scraper.nextRecipe();
    expect(scraper.storeRecipe).toHaveBeenCalled();
    expect(scraper.storeRecipe).toHaveBeenCalledWith({valid: 'JSON'});
});

test('should retry if the API returned an error', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    let scraper = new RecipeScraper();
    scraper.storeRecipe = jest.fn(() => {});
    const nextRecipe = scraper.nextRecipe.bind(scraper);
    let run = true;
    // This test should only run nextRecipe once to test the retry.
    // This prevents the fail over from being called, which is tested in the 
    // next test case. (One thing per test).
    scraper.nextRecipe = jest.fn(() => {
        if (run) {
            run = false;
            nextRecipe();
        }
    });
    scraper.current = 0;
    scraper.count = 1;
    scraper.getRetry = scraper.maxRetries - 1;
    scraper.nextRecipe();
    jest.runAllTimers();
    expect(scraper.storeRecipe).not.toHaveBeenCalled();
    expect(scraper.getRetry).toBe(scraper.maxRetries);
});

test('should move to the next recipe if the current recipe fails the max times', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const scraper = new RecipeScraper();
    const mockId = 102;
    scraper.recipes = [mockId];
    scraper.getRetry = scraper.maxRetries;
    scraper.current = 0;
    scraper.count = 1;
    scraper.storeRecipe = jest.fn(() => {
        console.log('got here for some reason');
    });
    scraper.nextRecipe();
    expect(scraper.getRetry).toBe(0);
    expect(scraper.failedRecipes.length).toBe(1);
    expect(scraper.failedRecipes[0]).toBe(mockId);
    expect(scraper.current).toBe(1);
});

test('should not call storeRecipe if there are no more IDs in the array', () => {
    const calls = request.mock.calls.length;
    request.mockImplementation((url, callback) => {
        callback(null, {}, '{\"valid\": \"JSON\"}');
    });
    let scraper = new RecipeScraper();
    scraper.storeRecipe = jest.fn(() => {});
    scraper.current = 1;
    scraper.count = 1;
    scraper.nextRecipe();
    expect(scraper.storeRecipe).not.toHaveBeenCalled();
    expect(request.mock.calls.length).toBe(calls);
});

test('should build correct query string', () => {
    const scraper = new RecipeScraper();
    const result = scraper.buildQuieryString(mockRecipe);
    const expectedResult = 'UpdateOrInsertRecipe @id=48, @type=\'Insignia\', @output_item_id=19799, @output_item_count=1, @min_rating=50, @time_to_craft_ms=1000, @disciplines=\'[\"Leatherworker\",\"Armorsmith\",\"Tailor\"]\', @flags=\'[\"AutoLearned\"]\', @ingredients=\'[{\"item_id\":71307,\"count\":1},{\"item_id\":24290,\"count\":8}]\', @chat_link=\'[&CTAAAAA=]\'';
    expect(result).toBe(expectedResult);
});

test('should send query string when successfully connected to database', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.resolve();
            })
        }
    })
    const scraper = new RecipeScraper();
    scraper.nextRecipe = jest.fn(() => {
        expect(scraper.nextRecipe).toHaveBeenCalled();
        done();
    });
    scraper.storeRecipe(mockRecipe);
});

test('should retry if the connection to the DB fails', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const calls = sql.Request.mock.calls.length;
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject();
            })
        };
    });
    const scraper = new RecipeScraper();
    
    // Mock nextRecipe just in case something goes wrong and it actually gets called.
    // nextRecipe should never be called in this test case, but mock it just in case.
    scraper.nextRecipe = jest.fn(() => {});
    scraper.storeRetry = scraper.maxRetries - 1;
    scraper.storeRecipe(mockRecipe);
    jest.runAllTimers();
    expect(sql.Request.mock.calls.length).toBe(calls);
    expect(scraper.storeRetry).toBe(scraper.maxRetries);
});

test('should move to next recipe if max retries is reached connecting to the DB', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const calls = sql.Request.mock.calls.length;
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject();
            })
        };
    });
    const scraper = new RecipeScraper();
    scraper.storeRetry = scraper.maxRetries;
    scraper.current = 0;
    scraper.nextRecipe = jest.fn(() => {
        expect(sql.Request.mock.calls.length).toBe(calls);
        expect(scraper.current).toBe(1);
        expect(scraper.storeRetry).toBe(0);
        done();
    });
    scraper.storeRecipe(mockRecipe);
});

test('should retry if the query fails', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    const expectedCalls = sql.Request.mock.calls.length + 1;
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('because reasons');
            })
        };
    });
    let scraper = new RecipeScraper();
    scraper.nextRecipe = jest.fn(() => {});
    scraper.storeRetry = scraper.maxRetries - 1;
    scraper.storeRecipe(mockRecipe).catch(() => {
        jest.runAllTimers();
        expect(scraper.nextRecipe).toHaveBeenCalled();
        expect(sql.Request.mock.calls.length).toBe(expectedCalls);
        expect(scraper.storeRetry).toBe(scraper.maxRetries);
        done();
    });
});

test('should continue to the next recipe if the query fails max times', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('just because');
            })
        };
    });
    let scraper = new RecipeScraper();
    scraper.storeRetry = scraper.maxRetries;
    scraper.current = 0;
    scraper.recipes = [mockRecipe.id];
    scraper.nextRecipe = jest.fn(() => {
        expect(scraper.storeRetry).toBe(0);
        expect(scraper.current).toBe(1);
        expect(scraper.failedRecipes.length).toBe(1);
        expect(scraper.failedRecipes[0]).toBe(mockRecipe.id);
        done();
    });
    scraper.storeRecipe(mockRecipe);
});