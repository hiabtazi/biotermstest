const sdk = require('node-appwrite');

const client = new sdk.Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1') // Your API Endpoint
    .setProject("66bdd9ef0022a854dccc") // Your project ID
    .setKey('AIzaSyAHAj-yv-OvCBOfuKjHOFRUfOlKGJHLwAo'); // Your secret API key

const users = new sdk.Users(client);

const result = await users.list(
    [], // queries (optional)
    '<SEARCH>' // search (optional)
);