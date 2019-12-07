export const tryParseItem = (item, replace = false) => {
    let returnItem = undefined;
        try {
            let base = JSON.stringify(item);
            if (replace) {
                base = base.replace(/'/g, '&lsquo;');
            }
            returnItem = `'${base}'`;
        }
        catch(e) {
            returnItem = null;
        }
        return returnItem;
}