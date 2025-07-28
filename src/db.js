/* db.js */
import { Client, Account } from 'appwrite'; 

const client = new Client()
    .setEndpoint('https://api.bioterms.space/v1') 
    .setProject("66bdd9ef0022a854dccc"); 

const account = new Account(client);

document.getElementById('googleLogin').addEventListener('click', () => {
    account.createOAuth2Session('google', window.location.href, window.location.href);
});

// Vérifier si l'utilisateur est déjà connecté
function checkAuth() {
    return account.get().then(
        response => {
            console.log('Utilisateur connecté:', response);
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            return response;
        },
        error => {
            console.error('Utilisateur non connecté:', error);
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'none';
            return null;
        }
    );
}

// Vérifier l'authentification au chargement de la page
checkAuth();

// Exporter la fonction checkAuth pour pouvoir l'utiliser dans d'autres fichiers si nécessaire
export { checkAuth };