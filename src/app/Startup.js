import RecipeScraper from '../scrapers/RecipeScraper';
import ItemScraper from '../scrapers/ItemScraper';

export default class Startup {
    scraper = undefined;
    constructor(scraper) {
        this.scraper = scraper;
    }

    startScraping() {
        if (this.scraper === 'recipe') {
            const recipeScraper = new RecipeScraper();
            recipeScraper.startScrape();
        }
        else if (this.scraper === 'item') {
            const itemScraper = new ItemScraper();
            itemScraper.getItemIDs();
        }
        else {
            console.log('Please run with either \'recipe\' or \'item\' as the first argument');
        }
    }
}