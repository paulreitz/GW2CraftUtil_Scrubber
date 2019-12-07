import { mockRecipe } from '../fixtures/mockRecipes';
import { tryParseItem } from '../../src/utils/parser';

test('should return a valid json string when tryParseItem is passed an object', () => {
    const testJson = { foo: 'foo', bar: 'bar' };
    const expectedResult = '\'{"foo":"foo","bar":"bar"}\'';
    const result = tryParseItem(testJson);
    expect(result).toBe(expectedResult);
});

test('should return a valid json string when tryParseItem is passed an array', () => {
    const testJson = ['this', 'that', 'the other'];
    const expectedResult = '\'["this","that","the other"]\'';
    const result = tryParseItem(testJson);
    expect(result).toBe(expectedResult);
});

test('should return null when tryParseItem is passed an invalid object', () => {
    const invalidObject = { otherData: 123 };
    invalidObject.mySelf = invalidObject;
    const result = tryParseItem(invalidObject);
    expect(result).toBeNull();
});

test('should replace single quotes with HTML code', () => {
    const testObject = {
        foo: 'bar\'baz'
    };
    const result = tryParseItem(testObject, true);
    const expectedResult = '\'{\"foo\":"bar&lsquo;baz\"}\'';
    expect(result).toBe(expectedResult);
})