jest.mock('request');
jest.mock('mssql');
import request from 'request';
import sql from 'mssql';
import SingleItem from '../../src/scrapers/SingleItem';
import { mockItem } from '../fixtures/mockItems';

jest.useFakeTimers();
const mockId = 1337;

test('should setup item id in constructor', () => {
    const single = new SingleItem(mockId);
    expect(single.itemID).toBe(mockId);
});

test('should call storeItem after successfully fetching the item from the API', () => {
    request.mockImplementation((__url, callback) => {
        const body = JSON.stringify({valid: 'JSON'});
        callback(null, {}, body);
    });
    const single = new SingleItem(mockId);
    single.storeItem = jest.fn((__item) => {
        return Promise.resolve();
    });
    single.fetchItem();
    expect(single.storeItem).toHaveBeenCalled();
    expect(single.retry).toBe(0);
});

test('should retry fetching item from the API on failure', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const single = new SingleItem(mockId);
    single.retry = single.maxRetries - 1;

    const fetchItem = single.fetchItem.bind(single);
    let run = true;
    single.fetchItem = jest.fn(() => {
        if (run) {
            run = false;
            fetchItem();
        }
    });
    const expectedCalls = single.fetchItem.mock.calls.length + 2;
    single.fetchItem();
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
    expect(single.fetchItem.mock.calls.length).toBe(expectedCalls);
});

test('should exit when failing to fetch the item from the API after maxTries', () => {
    request.mockImplementation((__url, callback) => {
        callback('error');
    });
    const single = new SingleItem(mockId);
    single.retry = single.maxRetries;
    const fetchItem = single.fetchItem.bind(single);
    let run = true;
    single.fetchItem = jest.fn(() => {
        if (run) {
            run = false;
            fetchItem();
        }
    });
    const expectedCalls = single.fetchItem.mock.calls.length + 1;
    single.fetchItem();
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
    expect(single.fetchItem.mock.calls.length).toBe(expectedCalls);
});

test('should exit after succesfully storing the item to the database', (done) => {
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
    const single = new SingleItem();
    single.storeItem(mockId)
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

test('should retry if failed to connect to databse', () => {
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
    const single = new SingleItem(mockId);
    const storeItem = single.storeItem.bind(single);
    let run = true;
    single.storeItem = jest.fn((item) => {
        if (run) { 
            run = false;
            return storeItem(item);
        }
        return Promise.resolve();
    });
    single.retry = single.maxRetries - 1;
    single.storeItem(mockItem);
    jest.runAllTimers();
    expect(single.retry).toBe(single.maxRetries);
});

test('should exit after failing to connect to the database after max tries', (done) => {
    sql.connect.mockImplementation((__config, callback) => {
        callback('error');
    });
    const single = new SingleItem(mockId);
    single.retry = single.maxRetries;
    single.storeItem(mockItem).catch(() => {
        expect(single.retry).toBe(single.maxRetries);
        done();
    })
});

test('should retry after failing to store item to the database', (done) => {
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
    const single = new SingleItem(mockId);
    single.retry = single.maxRetries - 1;

    // run storeItem once
    const storeItem = single.storeItem.bind(single);
    let run = true;
    single.storeItem = jest.fn((recipe) => {
        if (run) {
            run = false;
            return storeItem(recipe);
        }
        else {
            return Promise.reject();
        }
    });
    single.storeItem(mockItem).catch(() => {
        jest.runAllTimers();
        expect(single.retry).toBe(single.maxRetries);
        done();
    });
});

test('should exit if failing to save item to database after max tries', (done) => {
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
    const single = new SingleItem(mockId);
    single.retry = single.maxRetries;
    const storeItem = single.storeItem.bind(single);
    single.storeItem = jest.fn((item) => {
        return storeItem(item);
    });
    const expectedCalls = single.storeItem.mock.calls.length + 1;
    single.storeItem(mockItem).catch(() => {
        expect(single.retry).toBe(single.maxRetries);
        expect(single.storeItem.mock.calls.length).toBe(expectedCalls);
        done();
    });
})