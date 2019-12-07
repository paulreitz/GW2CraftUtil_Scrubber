import Startup from './app/Startup';

console.log(`Running scraper for setting: ${process.argv[2]}...`);

const startup = new Startup(process.argv[2]);
startup.startScraping();

