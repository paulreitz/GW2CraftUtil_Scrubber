const request = require.requireActual('request');

export default (url, callback) => {
    console.log('this is a mock', jest);
    callback(null, {}, '[1,2,3]');
}