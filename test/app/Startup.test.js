import RecipeScraper from '../../src/scrapers/RecipeScraper';
import ItemScraper from '../../src/scrapers/ItemScraper';
import Startup from '../../src/app/Startup';
jest.mock('../../src/scrapers/ItemScraper.js');
jest.mock('../../src/scrapers/RecipeScraper.js');


beforeEach(() => {
    RecipeScraper.mockClear();
    ItemScraper.mockClear();
});

it('should initialize a recipe scraper when the argument is "recipe"', () => {
    const startup = new Startup('recipe');
    startup.startScraping();
    expect(RecipeScraper).toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
});

it('should initialize an item scraper when the argument is "item"', () => {
    ItemScraper.prototype.getItemIDs = jest.fn(() => {});
    const startup = new Startup('item');
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).toHaveBeenCalled();
});

it('should do nothing if the argument is invalid', () => {
    const startup = new Startup('foobar');
    startup.startScraping();
    expect(RecipeScraper).not.toHaveBeenCalled();
    expect(ItemScraper).not.toHaveBeenCalled();
})