 // roleAuth.js
import { Client, Databases, Query, ID, Account } from "appwrite";

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject("66bdd9ef0022a854dccc");

export class RoleAuth {
    constructor() {
        this.databases = new Databases(client);
        this.account = new Account(client); // مهم
        this.termsDatabaseId = '66bddcb3002ce9c16742';
        this.rolesCollectionId = '678ab074003692c16eb3';
    }

    async getUserRole(userId) {
        try {
            const response = await this.databases.listDocuments(
                this.termsDatabaseId,
                this.rolesCollectionId,
                [Query.equal('userId', userId)]
            );

            if (response.documents.length > 0) {
                // إذا وجدنا دورًا، تحقق مما إذا كان الاسم والإيميل موجودين
                // إذا لم يكونا موجودين، حاول تحديثهما (اختياري ومتقدم قليلاً)
                const userRoleDoc = response.documents[0];
                if (!userRoleDoc.nom || !userRoleDoc.email) {
                    console.log(`Role found for ${userId}, but name/email might be missing. Attempting to update.`);
                    try {
                        const currentUserForUpdate = await this.account.get();
                        if (currentUserForUpdate.$id === userId && (currentUserForUpdate.name || currentUserForUpdate.email)) {
                            await this.databases.updateDocument(
                                this.termsDatabaseId,
                                this.rolesCollectionId,
                                userRoleDoc.$id,
                                {
                                    nom: userRoleDoc.nom || currentUserForUpdate.name || '',
                                    email: userRoleDoc.email || currentUserForUpdate.email || ''
                                }
                            );
                            console.log(`Updated name/email in role for ${userId}`);
                        }
                    } catch (updateError) {
                        console.error(`Failed to update name/email in role for ${userId}:`, updateError);
                    }
                }
                return userRoleDoc.role;
            }

            // المستخدم ليس له دور، سنقوم بإنشائه
            let userEmail = '';
            let userName = '';
            try {
                const currentUser = await this.account.get();
                if (currentUser.$id === userId) {
                    userEmail = currentUser.email;
                    userName = currentUser.name; // هذا هو الاسم من Auth
                }
            } catch (accError) {
                console.error(`Could not fetch current user details (for userId: ${userId}) to populate role:`, accError);
            }
            await this.createUserRole(userId, 'user', userEmail, userName);
            return 'user';
        } catch (error) {
            console.error(`Error fetching/creating user role for userId ${userId}:`, error);
            return 'user';
        }
    }

    async createUserRole(userId, role = 'user', email = '', nom = '') {
        try {
            // تحقق مما إذا كان الدور موجودًا بالفعل قبل محاولة الإنشاء
            const existingRoles = await this.databases.listDocuments(
                this.termsDatabaseId,
                this.rolesCollectionId,
                [Query.equal('userId', userId)]
            );
            if (existingRoles.documents.length > 0) {
                console.log(`Role already exists for ${userId}. Skipping creation.`);
                // يمكنك هنا تحديث الدور إذا لزم الأمر بدلاً من تخطي الإنشاء
                // await this.databases.updateDocument(...)
                return;
            }

            await this.databases.createDocument(
                this.termsDatabaseId,
                this.rolesCollectionId,
                ID.unique(),
                {
                    userId: userId,
                    role: role,
                    email: email,
                    nom: nom, // الاسم من Auth سيتم تخزينه هنا
                    createdAt: new Date().toISOString()
                }
            );
            console.log(`User role created for ${userId} with email: ${email}, nom: ${nom}`);
        } catch (error) {
            console.error('Error creating user role:', error);
        }
    }

    async isAdmin(userId) {
        const role = await this.getUserRole(userId);
        return role === 'admin';
    }

    // دالة getPermissionsForRole يمكن أن تبقى كما هي إذا كنت تستخدمها
    getPermissionsForRole(isAdmin) {
        if (isAdmin) {
            return {
                terms: { create: true, read: true, update: true, delete: true },
                users: { create: true, read: true, update: true, delete: true }
            };
        }
        return {
            terms: { create: false, read: true, update: false, delete: false },
            users: { create: false, read: false, update: false, delete: false }
        };
    }
}

// قم بتصدير الكلاس كـ default export إذا كان هذا هو الملف الوحيد الذي يصدر شيئًا
// أو يمكنك تصديره كـ named export إذا كان لديك exports أخرى
export default RoleAuth;