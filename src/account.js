/* account.js */
import { Client, Account } from "appwrite";

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1') // Your API Endpoint
    .setProject("66bdd9ef0022a854dccc"); // Your project ID

const account = new Account(client);

const result = await account.get();

console.log(result);