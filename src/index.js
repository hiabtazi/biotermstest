const sdk = require('node-appwrite'); 

// Initialiser le client SDK Appwrite
const client = new sdk.Client();

client
    .setEndpoint('https://api.bioterms.space/v1') // Votre endpoint Appwrite
    .setProject("66bdd9ef0022a854dccc") // Votre ID de projet
    .setKey('standard_eefecb284392e59c94f534299f96f87dfb280caf1b62cf6fc9c2b64b6ef1b1ab489c30531e0213279f17d2c5b525058e53a25313635bb7169bb479c3bc63f248095c665e095ee264077fff9cf27b9693d3207a67e9ee48ac3d8560bdadd9bd59f45c103fc7669040cc7c70122d4be3eec5853a7278843edcf9d3ca2db97c3fb4'); // Votre clé API

// Initialiser le service de base de données
const database = new sdk.Database(client);

// Fonction principale
module.exports = async function (req, res) {
    try {
        // Créer une nouvelle collection
        const collection = await database.createCollection(
            'userCollection',
            ['*'], // Permissions de lecture
            ['*'] // Permissions d'écriture
        );

        // Ajouter des attributs à la collection
        await database.createStringAttribute(collection.$id, 'name', 255, true);
        await database.createEmailAttribute(collection.$id, 'email', true);
        await database.createStringAttribute(collection.$id, 'role', 50, false);

        // Répondre avec succès
        res.send({
            success: true,
            message: 'User collection created successfully',
        });
    } catch (error) {
        // Gérer les erreurs
        console.error(error);
        res.send({
            success: false,
            message: error.message,
        });
    }
};