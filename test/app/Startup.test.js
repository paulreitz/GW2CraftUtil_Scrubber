import RecipeScraper from '../../src/scrapers/RecipeScraper';
import ItemScraper from '../../src/scrapers/ItemScraper';
import SingleRecipe from '../../src/scrapers/SingleRecipe';
import SingleItem from '../../src/scrapers/SingleItem';
import Startup from '../../src/app/Startup';
jest.mock('../../src/scrapers/ItemScraper.js');
jest.mock('../../src/scrapers/RecipeScraper.js');
jest.mock('../../src/scrapers/SingleRecipe.js');
jest.mock('../../src/scrapers/SingleItem.js');


beforeEach(() => {
    RecipeScraper.mockClear();
    ItemScraper.mockClear();
    SingleRecipe.mockClear();
    SingleItem.mockClear();
});

test('should initialize a recipe scraper when the argument is "recipe"', () => {
    const startup = new Startup('recipe');
    startup.startScraping();
    expect(RecipeScraper).toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});

test('should initialize an item scraper when the argument is "item"', () => {
    ItemScraper.prototype.getItemIDs = jest.fn(() => {});
    const startup = new Startup('item');
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});

test('should do nothing if the argument is invalid', () => {
    const startup = new Startup('foobar');
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});

test('should do nothing if "single" is passed without an id', () => {
    const startup = new Startup('single', 'recipe');
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});

test('should run a single recipe when "single" and "recipe" are passed in with an id', () => {
    const startup = new Startup('single', 'recipe', 1337);
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});

test('should run a single item when "single" and "item" are passed in with an id', () => {
    const startup = new Startup('single', 'item', 1336);
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).toHaveBeenCalled();
});

test('should do nothing if "single" is passed in with an invalid option', () => {
    const startup = new Startup('single', 'foobar', 1335);
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
    expect(SingleRecipe).not.toHaveBeenCalled();
    expect(SingleItem).not.toHaveBeenCalled();
});