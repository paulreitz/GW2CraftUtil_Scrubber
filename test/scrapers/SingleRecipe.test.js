jest.mock('request');
jest.mock('mssql');
import request from 'request';
import sql from 'mssql';
import SingleRecipe from '../../src/scrapers/SingleRecipe';
import { mockRecipe } from '../fixtures/mockRecipes';

jest.useFakeTimers();
const mockId = 1337;

test('should setup recipe id in costructor', () => {
    const single = new SingleRecipe(mockId);
    expect(single.recipeID).toBe(mockId);
});

test('should store the recipe when after succesfully fetching the recipe from the API', () => {
    request.mockImplementation((__url, callback) => {
        const body = JSON.stringify({valid: 'JSON'});
        callback(null, {}, body);
    });
    const single = new SingleRecipe(mockId);
    single.storeRecipe = jest.fn((__recipe) => {
        return Promise.resolve();
    });
    single.fetchRecipe();
    expect(single.storeRecipe).toHaveBeenCalled();
    expect(single.retry).toBe(0);
});

test('should retry fetching recipe from the API on failure', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const single = new SingleRecipe(mockId);
    single.retry = single.maxRetries - 1;
    // call fetchRecipe once
    const fetchRecipe = single.fetchRecipe.bind(single);
    let run = true;
    single.fetchRecipe = jest.fn(() => {
        if (run) {
            run = false;
            fetchRecipe();
        }
    });
    const expectedCalls = single.fetchRecipe.mock.calls.length + 2;
    single.fetchRecipe();
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
    expect(single.fetchRecipe.mock.calls.length).toBe(expectedCalls);
});

test('Should exit when failing to fetch recipe from API after maxTries', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const single = new SingleRecipe(mockId);
    single.retry = single.maxRetries;
    // call fetchRecipe once
    const fetchRecipe = single.fetchRecipe.bind(single);
    let run = true;
    single.fetchRecipe = jest.fn(() => {
        if (run) {
            run = false;
            fetchRecipe();
        }
    });
    const expectedCalls = single.fetchRecipe.mock.calls.length + 1;
    single.fetchRecipe();
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
    expect(single.fetchRecipe.mock.calls.length).toBe(expectedCalls);
});

test('should exit after succesfully storing the recipe to the database', (done) => {
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
    const originalExit = process.exit;
    process.exit = jest.fn(() => {});
    const single = new SingleRecipe();
    single.storeRecipe(mockId)
    .then(() => {
        expect(true).toBe(true); // If we're here, the test passed.
        expect(process.exit).toHaveBeenCalled();
        process.exit = originalExit;
        done();
    })
    .catch(() => {
        expect(true).toBe(false); // If we're here, the test failed.
        process.exit = originalExit;
        done();
    });
});

test('should retry if failed to connect to database', () => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('should not reach this function');
            })
        };
    });
    const single = new SingleRecipe(mockId);
    // run storeRecipe once
    const storeRecipe = single.storeRecipe.bind(single);
    let run = true;
    single.storeRecipe = jest.fn((recipe) => {
        if (run) {
            run = false;
            return storeRecipe(recipe);
        }
        return Promise.resolve();
    })
    single.retry = single.maxRetries - 1;
    single.storeRecipe(mockRecipe);
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
});

test('should exit after failing to connect to the database after max tries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const single = new SingleRecipe(mockId);
    single.retry = single.maxRetries;
    single.storeRecipe(mockRecipe).catch(() => {
        expect(single.retry).toBe(single.maxRetries);
        done();
    });
});

test('should retry after failing to store recipe to the database', (done) => {
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
    const single = new SingleRecipe(mockId);
    single.retry = single.maxRetries - 1;

    // run storeRecipe once
    const storeRecipe = single.storeRecipe.bind(single);
    let run = true;
    single.storeRecipe = jest.fn((recipe) => {
        if (run) {
            run = false;
            return storeRecipe(recipe);
        }
        else {
            return Promise.reject();
        }
    });
    single.storeRecipe(mockRecipe).catch(() => {
        jest.runAllTimers();
        expect(single.retry).toBe(single.maxRetries);
        done();
    });
});

test('should exit if failing to save recipe to database after max tries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback();
    });
    sql.Request.mockImplementation(() => {
        return {
            query: jest.fn(() => {
                return Promise.reject('fail out');
            })
        };
    });
    const single = new SingleRecipe(mockId);
    single.retry = single.maxRetries;
    const storeRecipe = single.storeRecipe.bind(single);
    single.storeRecipe = jest.fn((recipe) => {
        return storeRecipe(recipe);
    });
    const expectedCalls = single.storeRecipe.mock.calls.length + 1;
    single.storeRecipe(mockRecipe).catch(() => {
        expect(single.retry).toBe(single.maxRetries);
        expect(single.storeRecipe.mock.calls.length).toBe(expectedCalls);
        done();
    });
});