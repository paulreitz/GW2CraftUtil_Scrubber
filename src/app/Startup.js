import RecipeScraper from '../scrapers/RecipeScraper';
import ItemScraper from '../scrapers/ItemScraper';
import SingleRecipe from '../scrapers/SingleRecipe';

export default class Startup {
    scraper = undefined;
    action = undefined;
    id = undefined;
    constructor(scraper, action, id) {
        this.scraper = scraper;
        this.action = action;
        console.log(this.action);
        this.id = id;
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
            case 'single': 
                if (!this.id) {
                    console.log('Please specify an ID for retrieving a single item or recipe');
                    return;
                }
                switch (this.action) {
                    case 'recipe':
                        const singleRecipe = new SingleRecipe(this.id);
                        singleRecipe.fetchRecipe();
                        break;
                    case 'item':
                        console.log('single item here');
                        break;
                    default:
                        console.log('For single entry, please specify \'recipe\' or \'item\'.');
                }
                break;
            default:
                console.log('Please run with either \'recipe\' or \'item\' as the first argument');
        }
    }
}