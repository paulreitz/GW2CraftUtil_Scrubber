import RecipeScraper from '../scrapers/RecipeScraper';
import ItemScraper from '../scrapers/ItemScraper';

export default class Startup {
    scraper = undefined;
    constructor(scraper) {
        this.scraper = scraper;
    }

    startScraping() {
        switch (this.scraper) {
            case 'recipe':
                const recipeScraper = new RecipeScraper();
                recipeScraper.startScrape();
                break;
            case 'item':
                const itemScraper = new ItemScraper();
                itemScraper.getItemIDs();
                break;
            default:
                console.log('Please run with either \'recipe\' or \'item\' as the first argument');
        }
    }
}