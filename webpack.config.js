const path = require('path');

module.exports = {
    target: 'node',
    entry: './src/app.js',
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'scraper.js'
    },
    module: {
        rules: [
            {
                loader: 'babel-loader',
                test: /\.js$/,
                exclude: /node_modules/
            }
        ]
    }
};