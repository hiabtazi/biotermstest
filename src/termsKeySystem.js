class TermsKeySystem {
    constructor(databases, account, databaseId) {
        this.databases = databases;
        this.account = account;
        this.databaseId = databaseId;
        this.userKeys = 0;
        this.keyDocId = null;
        this.unlockedConcepts = new Set();
        this.adSystem = new AdSystem();
    }

    // Initialisation du système pour un nouvel utilisateur
    async initializeUserTerms(userId) {
        try {
            // Vérifier si l'utilisateur a déjà des clés
            const existingKeys = await this.databases.listDocuments(
                this.databaseId,
                userKeysCollectionId,
                [Query.equal('userId', userId)]
            );

            if (existingKeys.documents.length === 0) {
                // Créer un nouveau document pour les clés avec 5 clés gratuites
                const response = await this.databases.createDocument(
                    this.databaseId,
                    userKeysCollectionId,
                    ID.unique(),
                    {
                        userId: userId,
                        keys: 5, // Clés gratuites initiales
                        updatedAt: new Date().toISOString()
                    }
                );
                this.userKeys = 5;
                this.keyDocId = response.$id;
            } else {
                this.userKeys = existingKeys.documents[0].keys;
                this.keyDocId = existingKeys.documents[0].$id;
            }
            
            // Mettre à jour l'affichage des clés
            this.updateKeyDisplay();
            return this.userKeys;
        } catch (error) {
            console.error("Erreur d'initialisation des termes:", error);
            throw error;
        }
    }

    // Charger l'état des termes pour un utilisateur
    async loadUserTerms(userId) {
        try {
            // Charger les concepts déverrouillés
            const unlockedDocs = await this.databases.listDocuments(
                this.databaseId,
                userConceptsCollectionId,
                [
                    Query.equal('userId', userId),
                    Query.equal('isLocked', false)
                ]
            );

            this.unlockedConcepts.clear();
            unlockedDocs.documents.forEach(doc => {
                this.unlockedConcepts.add(doc.conceptId);
            });

            // Charger les clés de l'utilisateur
            const keysDocs = await this.databases.listDocuments(
                this.databaseId,
                userKeysCollectionId,
                [Query.equal('userId', userId)]
            );

            if (keysDocs.documents.length > 0) {
                this.userKeys = keysDocs.documents[0].keys;
                this.keyDocId = keysDocs.documents[0].$id;
                this.updateKeyDisplay();
            }

            return {
                unlockedConcepts: Array.from(this.unlockedConcepts),
                remainingKeys: this.userKeys
            };
        } catch (error) {
            console.error('Erreur de chargement des termes:', error);
            throw error;
        }
    }

    // Déverrouiller un terme
    async unlockTerm(userId, conceptId) {
        try {
            // Vérifier si déjà déverrouillé
            if (this.unlockedConcepts.has(conceptId)) {
                return true;
            }

            // Vérifier les clés disponibles
            if (this.userKeys < 1) {
                const watchedAd = await this.adSystem.showAd();
                if (!watchedAd) return false;
                await this.updateUserKeys(userId, 5, 'Ad reward');
            }

            // Créer le document de déverrouillage
            await this.databases.createDocument(
                this.databaseId,
                userConceptsCollectionId,
                ID.unique(),
                {
                    userId: userId,
                    conceptId: conceptId,
                    isLocked: false,
                    unlockedAt: new Date().toISOString()
                }
            );

            // Déduire une clé
            await this.updateUserKeys(userId, -1, `Unlock term: ${conceptId}`);
            
            this.unlockedConcepts.add(conceptId);
            return true;
        } catch (error) {
            console.error('Erreur de déverrouillage:', error);
            throw error;
        }
    }

    // Mise à jour des clés utilisateur
    async updateUserKeys(userId, change, reason) {
        try {
            const newKeyCount = this.userKeys + change;
            await this.databases.updateDocument(
                this.databaseId,
                userKeysCollectionId,
                this.keyDocId,
                {
                    keys: newKeyCount,
                    updatedAt: new Date().toISOString(),
                    lastTransaction: {
                        change: change,
                        reason: reason,
                        timestamp: new Date().toISOString()
                    }
                }
            );
            this.userKeys = newKeyCount;
            this.updateKeyDisplay();
            return true;
        } catch (error) {
            console.error('Erreur de mise à jour des clés:', error);
            throw error;
        }
    }

    // Vérifier si un terme est déverrouillé
    isTermUnlocked(conceptId) {
        return this.unlockedConcepts.has(conceptId);
    }

    // Mettre à jour l'affichage du compteur de clés
    updateKeyDisplay() {
        const keyCounter = document.querySelector('.key-counter');
        if (keyCounter) {
            keyCounter.innerHTML = `
                <i class="fal fa-key"></i>
                <span class="count-badge">${this.userKeys}</span>
            `;
        }
    }
}

// Système de publicité
class AdSystem {
    constructor() {
        this.isAdPlaying = false;
        this.rewardAmount = 5;
    }

    async showAd() {
        if (this.isAdPlaying) return false;
        
        try {
            this.isAdPlaying = true;
            const modal = this.createAdModal();
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.isAdPlaying = false;
                    document.body.removeChild(modal);
                    resolve(true);
                }, 5000);
            });
        } catch (error) {
            this.isAdPlaying = false;
            console.error('Erreur de publicité:', error);
            return false;
        }
    }

    createAdModal() {
        const modal = document.createElement('div');
        modal.className = 'ad-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Regardez une publicité</h2>
                <div class="progress-bar"></div>
                <p>Vous recevrez ${this.rewardAmount} clés après le visionnage.</p>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
}

// Export des classes
export { TermsKeySystem, AdSystem };