import Startup from './app/Startup';

console.log(`Running scraper for setting: ${process.argv[2]}...`);

const startup = new Startup(process.argv[2], process.argv[3], process.argv[4]);
startup.startScraping();

