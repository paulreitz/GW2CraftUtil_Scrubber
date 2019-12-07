import { tryParseItem } from '../utils/parser';

export const buildItemQueryString = (body) => {
    const id = body.id;
    const name = `'${(body.name || '').replace(/'/g, '&lsquo;')}'`;
    const type = `'${body.type}'`;
    const rating = body.level; // converting to different column name as 'level' has some other meaning in sql server
    const rarity = `'${body.rarity}'`;
    const vendorValue = body.vendor_value;
    const defaultSkin = (body.default_skin || 0);
    const gameTypes = tryParseItem(body.game_types);
    const flags = tryParseItem(body.flags);
    const restrictions = tryParseItem(body.restrictions);
    const chatLink = `'${body.chat_link}'`;
    const icon = `'${body.icon}'`;
    const details = body.details ? tryParseItem(body.details, true) : '\'{}\'';
    return `UpdateOrInsertItem @id=${id}, @name=${name}, @type=${type}, @rating=${rating}, @rarity=${rarity}, @vendor_value=${vendorValue}, @default_skin=${defaultSkin}, @game_types=${gameTypes}, @flags=${flags}, @restrictions=${restrictions}, @chat_link=${chatLink}, @icon=${icon}, @details=${details}`
}

export const buildRecipeQuieryString = (body) => {
    const id = body.id;
    const type = body.type;
    const outputItemId = body.output_item_id;
    const outputItemCount = body.output_item_count;
    const minRating = body.min_rating;
    const timeToCraftMs = body.time_to_craft_ms;
    const disciplines = tryParseItem(body.disciplines);
    const flags = tryParseItem(body.flags);
    const ingredients = tryParseItem(body.ingredients);
    const chatLink = body.chat_link;
    return `UpdateOrInsertRecipe @id=${id}, @type='${type}', @output_item_id=${outputItemId}, @output_item_count=${outputItemCount}, @min_rating=${minRating}, @time_to_craft_ms=${timeToCraftMs}, @disciplines=${disciplines}, @flags=${flags}, @ingredients=${ingredients}, @chat_link='${chatLink}'`;
}