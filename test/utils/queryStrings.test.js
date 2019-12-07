import { buildItemQueryString, buildRecipeQuieryString } from '../../src/utils/queryStrings';
import { mockItem, mockItemNoName, mockItemNoDefaultSkin, mockItemNoDetails } from '../fixtures/mockItems';
import { mockRecipe } from '../fixtures/mockRecipes';

test('should return the correct query string', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const queryString = buildItemQueryString(mockItem);
    expect(queryString).toBe(expectedString);
});

test('should return query string with empty string for name if name does not exist', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const queryString = buildItemQueryString(mockItemNoName);
    expect(queryString).toBe(expectedString);
});

test('should return query string with default_skin set to 0 if default_skin does not exist', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=0, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{\"some\":\"detals\",\"with\":\"single &lsquo; quote\"}\'';
    const queryString = buildItemQueryString(mockItemNoDefaultSkin);
    expect(queryString).toBe(expectedString);
});

test('should return query string with empty object for details if no details provided', () => {
    const expectedString = 'UpdateOrInsertItem @id=88, @name=\'Carrion Seer Coat of the Centaur\', @type=\'Armor\', @rating=71, @rarity=\'Exotic\', @vendor_value=354, @default_skin=9, @game_types=\'[\"Activity\",\"Wvw\",\"Dungeon\",\"Pve\"]\', @flags=\'[\"SoulBindOnUse\"]\', @restrictions=\'[]\', @chat_link=\'[&AgFYAAAA]\', @icon=\'https://render.guildwars2.com/file/FB0AA64F98303AE5112408EF3DC8C7307EA118F8/61011.png\', @details=\'{}\'';
    const queryString = buildItemQueryString(mockItemNoDetails);
    expect(queryString).toBe(expectedString);
});

test('should build correct query string', () => {
    const result = buildRecipeQuieryString(mockRecipe);
    const expectedResult = 'UpdateOrInsertRecipe @id=48, @type=\'Insignia\', @output_item_id=19799, @output_item_count=1, @min_rating=50, @time_to_craft_ms=1000, @disciplines=\'[\"Leatherworker\",\"Armorsmith\",\"Tailor\"]\', @flags=\'[\"AutoLearned\"]\', @ingredients=\'[{\"item_id\":71307,\"count\":1},{\"item_id\":24290,\"count\":8}]\', @chat_link=\'[&CTAAAAA=]\'';
    expect(result).toBe(expectedResult);
});