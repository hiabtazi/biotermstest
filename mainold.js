/* main.js */
import { Client, Databases, Query, Account, ID, Storage } from "appwrite"; 
import themeUtils from './themeUtils.js'; 
import { RoleAuth } from './roleAuth.js'; 
 
const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("66bdd9ef0022a854dccc");

const DATABASE_ID = "66bddcb3002ce9c16742";
const termsDatabaseId = "66bddcb3002ce9c16742";
const termsCollectionId = "66bddd03002e43f7d4f1"; // هذا هو التصحيح
const bookmarksDatabaseId = "66bddcb3002ce9c16742";
const bookmarksCollectionId = "67607e0c0013805dde72";
const userConceptsCollectionId = "676dbc8e00107e180a0c";
const userKeysCollectionId = "676dbd9b001599cb2b51";
const NOTIFICATIONS_COLLECTION_ID = "67df6419001cc71ede1b";
const BUCKET_ID = "673f0e8f0031d1df2e9b";
 
let favorites = {};
let allDefinitions = []; // سيحتوي على جميع المصطلحات غير المفلترة
let currentFilteredDefinitions = []; // المصطلحات المعروضة حاليًا بعد الفلترة/البحث
let currentPage = 1;
const itemsPerPage = 10; // للـ pagination في وضع سطح المكتب
let userKeys = 0;
let unlockedConcepts = new Set();
let keyDocId = null;
let activeLetterFilter = null; // الحرف النشط للفلترة
let currentSearchTerm = ''; // مصطلح البحث النشط
let debounceCheckTimer;
// let realtimeUnsubscribe = null; // إذا كنت ستستخدمه لإلغاء الاشتراك لاحقًا
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const roleAuth = new RoleAuth(account, databases);


 
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

 async function fetchAllDocuments(databaseId, collectionId, queries = []) {
        const limit = 100; // Appwrite limit is 100
        let offset = 0;
        let results = [];
        let fetchedDocuments;
    
        try {
            do {
                const currentQueries = [...queries, Query.limit(limit), Query.offset(offset)];
                const response = await databases.listDocuments(databaseId, collectionId, currentQueries);
                fetchedDocuments = response.documents;
                results = results.concat(fetchedDocuments);
                offset += limit;
            } while (fetchedDocuments.length === limit);
    
            console.log(`Fetched ${results.length} documents from ${collectionId}`);
            return results;
        } catch (error) {
            console.error(`Error fetching all documents from ${collectionId}:`, error);
            throw error; // أعد رمي الخطأ ليتم التعامل معه في مكان آخر
        }
    }

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-icon'); // تعديل بسيط هنا

    if (!toast || !toastMessage || !toastIcon) {
        console.error("Toast elements not found!");
        return;
    }

    toastMessage.textContent = message;
    const typeConfig = {
        success: { icon: 'fa-check-circle', color: '#28a745' }, // FontAwesome 5 classes
        error: { icon: 'fa-times-circle', color: '#dc3545' },
        info: { icon: 'fa-info-circle', color: '#007bff' }
    };

    toast.style.backgroundColor = typeConfig[type] ? typeConfig[type].color : typeConfig['info'].color;
    toastIcon.className = `toast-icon fa-light ${typeConfig[type] ? typeConfig[type].icon : typeConfig['info'].icon}`;

    toast.style.display = 'flex';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}



async function updateUserIcon() {
      try {
         const user = await account.get();
          const userInfoLinks = document.querySelectorAll('a#userInfoLink');
 
         if (userInfoLinks.length === 0) {
             console.error("CRITICAL: No 'a#userInfoLink' elements found in app.html DOM!");
             return;
         }

         userInfoLinks.forEach(async (linkElement, index) => {
 
             const oldIcon = linkElement.querySelector('i.fa-light.fa-user');
             if (oldIcon) {
                  oldIcon.remove();
             }
             const oldImg = linkElement.querySelector('img.user-profile-avatar');
             if (oldImg) {
                  oldImg.remove();
             }

             if (user.prefs && user.prefs.profilePictureId) {
                 const pictureId = user.prefs.profilePictureId;
                  try {
                     const fileViewResult = await storage.getFileView(BUCKET_ID, pictureId);
 
                     //  **** التغيير الرئيسي هنا ****
                     //  storage.getFileView() تُرجع كائن URL. للحصول على السلسلة النصية للرابط:
                     const profileImageUrl = fileViewResult.toString(); // أو fileViewResult.href إذا كان يعمل بشكل موثوق

                     if (profileImageUrl) { // تحقق بسيط من أن الرابط ليس فارغًا
 
                         const profileImg = document.createElement('img');
                         profileImg.src = profileImageUrl;
                         profileImg.classList.add('user-profile-avatar');
                         profileImg.style.width = '24px';
                         profileImg.style.height = '24px';
                         profileImg.style.borderRadius = '50%';
                         profileImg.style.objectFit = 'cover';
                         profileImg.alt = "User Avatar";

                         profileImg.onload = () => {
                          };
                         profileImg.onerror = (e) => {
                             console.error(`ERROR: Failed to load image for linkElement ${index}. URL: ${profileImageUrl}`, "Event details:", e);
                             if (profileImg.parentNode === linkElement) {
                                 profileImg.remove();
                             }
                             const defaultIconFallback = document.createElement('i');
                             defaultIconFallback.className = 'fa-light fa-user';
                             linkElement.appendChild(defaultIconFallback);
                         };

                         linkElement.appendChild(profileImg);
 
                     } else {
                         console.error(`Profile image URL is empty or invalid after storage.getFileView for pictureId: ${pictureId} (linkElement ${index}).`);
                          const defaultIcon = document.createElement('i');
                         defaultIcon.className = 'fa-light fa-user';
                         linkElement.appendChild(defaultIcon);
                     }
                 } catch (storageError) {
                     console.error(`Storage error fetching profile image (ID: ${pictureId}) for linkElement ${index}:`, storageError);
                      const defaultIcon = document.createElement('i');
                     defaultIcon.className = 'fa-light fa-user';
                     linkElement.appendChild(defaultIcon);
                 }
             } else {
                  const defaultIcon = document.createElement('i');
                 defaultIcon.className = 'fa-light fa-user';
                 linkElement.appendChild(defaultIcon);
             }
         });

     } catch (error) {
         console.error('General error in updateUserIcon (user might not be logged in or other issue):', error);
         const userInfoLinks = document.querySelectorAll('a#userInfoLink');
         userInfoLinks.forEach(linkElement => {
             const oldIcon = linkElement.querySelector('i.fa-light.fa-user');
             if (oldIcon) oldIcon.remove();
             const oldImg = linkElement.querySelector('img.user-profile-avatar');
             if (oldImg) oldImg.remove();
             const defaultIcon = document.createElement('i');
             defaultIcon.className = 'fa-light fa-user';
             linkElement.appendChild(defaultIcon);
         });
      }
 }

// اجعل الدالة متاحة للنافذة التي فتحت هذه الصفحة (user-info.html)
window.triggerUserIconUpdate = async () => {
    console.log("triggerUserIconUpdate called from external window (user-info.html)");
    await updateUserIcon();
};



async function updateRoleBasedUI() {
    try {
        const user = await account.get();
        const role = await roleAuth.getUserRole(user.$id); // افترض أن roleAuth.getUserRole تعمل بشكل صحيح
        const isAdmin = role === 'admin';

        const desktopAdminIcon = document.querySelector('.desktop-layout .admin-icon-container');
        const desktopUserIcon = document.querySelector('.desktop-layout .user-icon-container');
        const mobileAdminIcon = document.querySelector('.mobile-layout .admin-icon-container');
        const mobileUserIcon = document.querySelector('.mobile-layout .user-icon-container');

        [desktopAdminIcon, desktopUserIcon, mobileAdminIcon, mobileUserIcon].forEach(icon => {
            if (icon) icon.style.display = 'none';
        });

        if (isAdmin) {
            if (desktopAdminIcon) {
                desktopAdminIcon.style.display = 'block';
                desktopAdminIcon.onclick = () => window.location.href = 'dashboard.html';
            }
            if (mobileAdminIcon) {
                mobileAdminIcon.style.display = 'block';
                mobileAdminIcon.onclick = () => window.location.href = 'dashboard.html';
            }
        } else {
            if (desktopUserIcon) {
                desktopUserIcon.style.display = 'block';
                desktopUserIcon.onclick = () => window.location.href = 'add-concept.html';
            }
            if (mobileUserIcon) {
                mobileUserIcon.style.display = 'block';
                mobileUserIcon.onclick = () => window.location.href = 'add-concept.html';
            }
        }
    } catch (error) {
        console.error('Error updating role-based UI:', error);
    }
}

async function handleLogout() {
    try {
        if (!navigator.onLine) {
            showToast('لا يوجد اتصال بالإنترنت', 'error');
            return;
        }
        await account.deleteSession('current');
        window.location.href = 'login.html'; // أو المسار الصحيح لصفحة تسجيل الدخول
    } catch (error) {
        console.error('خطأ أثناء تسجيل الخروج:', error);
        showToast('حدث خطأ أثناء تسجيل الخروج. الرجاء إعادة المحاولة', 'error');
        // محاولة تسجيل الخروج مرة أخرى كحل احتياطي
        try {
            await account.deleteSession('current');
            window.location.href = 'login.html';
        } catch (fallbackError) {
            console.error('فشل تسجيل الخروج الاحتياطي:', fallbackError);
        }
    }
}
function updateKeyCounter(count) {
    const countBadges = document.querySelectorAll('.count-badge');
    countBadges.forEach(badge => {
        badge.textContent = count.toString();
    });
}

async function initializeUserKeys(userId) {
    try {
        const existingKeys = await databases.listDocuments(termsDatabaseId, userKeysCollectionId, [Query.equal('userId', userId)]);
        if (existingKeys.documents.length === 0) {
            const response = await databases.createDocument(
                termsDatabaseId, userKeysCollectionId, ID.unique(),
                { userId: userId, keys: 5, updatedAt: new Date().toISOString() }
            );
            userKeys = 5;
            keyDocId = response.$id;
        } else {
            userKeys = existingKeys.documents[0].keys;
            keyDocId = existingKeys.documents[0].$id;
        }
        updateKeyCounter(userKeys);
    } catch (error) {
        console.error("Erreur lors de l'initialisation des clés:", error);
    }
}

async function loadUserTerms(userId) {
    try {
        const unlockedDocs = await databases.listDocuments(termsDatabaseId, userConceptsCollectionId, [
            Query.equal('userId', userId),
            Query.equal('isLocked', false)
        ]);
        unlockedConcepts.clear();
        unlockedDocs.documents.forEach(doc => unlockedConcepts.add(doc.conceptId));
    } catch (error) {
        console.error('Erreur lors du chargement des termes déverrouillés:', error);
    }
}

function isTermUnlocked(conceptId) {
    return unlockedConcepts.has(conceptId);
}

async function unlockTerm(userId, conceptId) {
    try {
        if (userKeys <= 0) {
            showAdModal(); // تأكد من تعريف showAdModal
            return false;
        }
        if (unlockedConcepts.has(conceptId)) return true;

        await databases.createDocument(
            termsDatabaseId, userConceptsCollectionId, ID.unique(),
            { userId: userId, conceptId: conceptId, isLocked: false }
        );

        if (keyDocId) {
            await databases.updateDocument(
                termsDatabaseId, userKeysCollectionId, keyDocId,
                { keys: userKeys - 1, updatedAt: new Date().toISOString() }
            );
            userKeys--;
            updateKeyCounter(userKeys);
        }
        unlockedConcepts.add(conceptId);
        // بعد الفتح، أعد عرض القائمة لتحديث الأيقونات
        displayCurrentDefinitions();
        return true;
    } catch (error) {
        console.error('Erreur lors du déverrouillage du terme:', error);
        showToast('خطأ أثناء فتح المصطلح', 'error');
        return false;
    }
}

function showAdModal() {
    // ... (الكود الخاص بـ showAdModal كما هو لديك)
    // تأكد من أن updateUserKeys معرفة وتعمل بشكل صحيح
    console.log("Show Ad Modal triggered"); // للتأكد من استدعائها
}

async function updateUserKeys(userId, additionalKeys) {
    // ... (الكود الخاص بـ updateUserKeys كما هو لديك)
    try {
        const newKeyCount = userKeys + additionalKeys;
        await databases.updateDocument(
            termsDatabaseId, userKeysCollectionId, keyDocId,
            { keys: newKeyCount, updatedAt: new Date().toISOString() }
        );
        userKeys = newKeyCount;
        updateKeyCounter(userKeys);
        return true;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des clés:', error);
        throw error;
    }
}


// ===========================================
//  BOOKMARKS (FAVORITES)
// ===========================================
async function loadFavorites() {
    try {
        const user = await account.get();
        const response = await databases.listDocuments(bookmarksDatabaseId, bookmarksCollectionId, [
            Query.equal('userId', user.$id),
        ]);
        favorites = {}; // إعادة تعيين المفضلة
        response.documents.forEach(doc => {
            favorites[doc.term] = doc;
        });
        // لا تحتاج لاستدعاء updateFavoriteIcons هنا، سيتم تحديثها عند عرض القائمة
    } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error);
    }
}

async function toggleFavorite(term, definition) {
    try {
        const user = await account.get();
        const userId = user.$id;

        const existingBookmark = await databases.listDocuments(
            bookmarksDatabaseId, bookmarksCollectionId,
            [Query.equal('userId', userId), Query.equal('term', term)]
        );

        if (existingBookmark.documents.length > 0) {
            await databases.deleteDocument(bookmarksDatabaseId, bookmarksCollectionId, existingBookmark.documents[0].$id);
            delete favorites[term];
            showToast('تمت إزالة المصطلح من المفضلة', 'info');
        } else {
            const newBookmark = await databases.createDocument(
                bookmarksDatabaseId, bookmarksCollectionId, ID.unique(),
                { userId: userId, term: term, definition: definition }
            );
            favorites[term] = newBookmark;
            showToast('تمت إضافة المصطلح إلى المفضلة', 'success');
        }
        // أعد عرض القائمة لتحديث أيقونات المفضلة
        displayCurrentDefinitions();
        localStorage.setItem('bookmarksUpdated', Date.now().toString()); // للإشعارات بين الصفحات
    } catch (error) {
        console.error('Erreur dans la gestion des signets :', error);
        showToast('خطأ في تحديث المفضلة', 'error');
    }
}

// ===========================================
//  NOTIFICATIONS
// ===========================================
function debounceCheckUnreadNotifications(delay = 500) {
    clearTimeout(debounceCheckTimer);
    debounceCheckTimer = setTimeout(checkUnreadNotifications, delay);
}

// main.js

// ... (الكود ديالك اللي قبل) ...

async function checkUnreadNotifications() {
    const notificationBadges = document.querySelectorAll('.notification-dot'); // هادو هوما البلايص فين غيبان الرقم

    try {
        const user = await account.get(); // كنتأكدو المستخدم مسجل الدخول
        // كنجيبو العدد الإجمالي ديال الإشعارات اللي ما تقراوش
        const response = await databases.listDocuments(
            DATABASE_ID, // الأيدي ديال قاعدة البيانات ديالك
            NOTIFICATIONS_COLLECTION_ID, // الأيدي ديال الكوليكشن ديال الإشعارات
            [
                Query.equal('user_id', user.$id), // ديال هاد المستخدم
                Query.equal('is_read', false)    // اللي مازال ما تقراوش
                // ماغاديش نديرو Query.limit(1) هنا، بغينا العدد كامل
            ]
        );

        const unreadCount = response.total; // هذا هو العدد ديال الإشعارات

        notificationBadges.forEach(badge => { // لكل بلاصة ديال الرقم
            if (unreadCount > 0) { // إيلا كانو إشعارات
                // كنبينو العدد، أو '9+' إيلا كان العدد كتر من 9
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
                badge.style.display = 'flex'; // كنبينوه (استعمل 'flex' إيلا كنتي دايرها فالـ CSS باش الرقم يجي فالوسط)
                                              // أو 'inline-block' / 'block' على حساب الستايل ديالك
            } else {
                badge.style.display = 'none'; // كنخبيوه إيلا ماكانوش إشعارات
            }
        });
    } catch (error) {
        // كنخبيو الأرقام إيلا وقع شي مشكل أو المستخدم ما مسجلش الدخول
        notificationBadges.forEach(badge => {
            badge.style.display = 'none';
        });
        if (error.code !== 401 && error.code !== 403) { // كنتجاهلو أخطاء المصادقة
            console.error('Error checking notifications:', error);
        }
    }
}
 
function isConceptNew(approvedAt) {
    if (!approvedAt) return false;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const approvedDate = new Date(approvedAt);
    return (Date.now() - approvedDate.getTime()) < twentyFourHours;
}

// Inside createDefinitionListItem in main.js
// استبدل الدالة القديمة بهذه النسخة الجديدة والمبسطة
function createDefinitionListItem(def) {
    // 1. إنشاء العنصر الأساسي للقائمة (<li>)
    const li = document.createElement('li');
    li.dataset.conceptId = def.$id; // تخزين ID المصطلح كـ data-attribute للوصول إليه لاحقًا

    // 2. التحقق مما إذا كان المصطلح مفتوحًا (unlocked) للمستخدم الحالي
    const isUnlocked = isTermUnlocked(def.$id);

    // 3. إنشاء عنصر <span> لعرض نص المصطلح
    const termText = document.createElement('span');
    termText.className = 'term-text';
    termText.textContent = def.term;

    // 4. التحقق مما إذا كان المصطلح جديدًا (أُضيف خلال آخر 24 ساعة)
    if (isConceptNew(def.approvedAt)) {
        const newIcon = document.createElement('i');
        newIcon.className = 'fa-light fa-star new-icon'; // أيقونة نجمة للمصطلحات الجديدة
        newIcon.title = "Nouveau terme"; // نص يظهر عند التحويم
        termText.prepend(newIcon); // إضافة الأيقونة قبل نص المصطلح
    }

    // 5. إنشاء حاوية <div> لتجميع الأيقونات على اليمين
    const iconsContainer = document.createElement('div');
    iconsContainer.className = 'icons-container';

    // 6. إضافة منطق النقر على عنصر القائمة بأكمله
    li.addEventListener('click', async (event) => {
        // نتجاهل النقرات على الأيقونات نفسها لأن لها أحداث خاصة بها
        if (event.target.tagName === 'I') {
            return;
        }

        if (isUnlocked) {
            // إذا كان المصطلح مفتوحًا، اعرض التعريف مباشرة
            if (window.innerWidth <= 768) {
                showConceptModal(def.term, def.definition);
            } else {
                displayDefinitionInContent(def.term, def.definition);
            }
        } else {
            // إذا كان المصطلح مقفلاً، حاول فتحه
            try {
                const user = await account.get();
                const unlockedSuccessfully = await unlockTerm(user.$id, def.$id);
                if (unlockedSuccessfully) {
                    // إذا تم الفتح بنجاح، أعد بناء هذا العنصر ليعكس الحالة الجديدة
                    // هذا أسهل من تبديل الأيقونات والأحداث يدويًا
                    const newLi = createDefinitionListItem(def);
                    li.parentNode.replaceChild(newLi, li);
                    
                    // ثم اعرض التعريف
                    if (window.innerWidth <= 768) {
                        showConceptModal(def.term, def.definition);
                    } else {
                        displayDefinitionInContent(def.term, def.definition);
                    }
                }
            } catch (error) {
                console.error('Error unlocking term:', error);
                showToast("حدث خطأ أثناء محاولة فتح المصطلح", "error");
            }
        }
    });

    // 7. تحديد الأيقونة التي يجب عرضها (قفل أو مفضلة)
    if (isUnlocked) {
        // --- حالة المصطلح المفتوح: نعرض أيقونة المفضلة (Bookmark) ---
        const bookmarkIcon = document.createElement('i');
        // تحديد شكل الأيقونة بناءً على ما إذا كان المصطلح في المفضلة أم لا
        bookmarkIcon.className = favorites[def.term] 
            ? 'fa-light fa-bookmark-slash'  // في المفضلة (أيقونة الإزالة)
            : 'fa-light fa-bookmark';      // ليس في المفضلة (أيقونة الإضافة)
        bookmarkIcon.classList.add('bookmark-icon');
        bookmarkIcon.title = "Ajouter/Retirer des favoris";

        // إضافة حدث النقر على أيقونة المفضلة
        bookmarkIcon.addEventListener('click', async (event) => {
            event.stopPropagation(); // منع تفعيل حدث النقر على الـ <li>
            await toggleFavorite(def.term, def.definition);
            // تحديث شكل الأيقونة فورًا بعد التغيير
            bookmarkIcon.className = favorites[def.term] 
                ? 'fa-light fa-bookmark-slash' 
                : 'fa-light fa-bookmark';
            bookmarkIcon.classList.add('bookmark-icon');
        });

        iconsContainer.appendChild(bookmarkIcon);

    } else {
        // --- حالة المصطلح المقفول: نعرض أيقونة القفل ---
        const lockIcon = document.createElement('i');
        lockIcon.className = 'fa-light fa-lock-keyhole';
        lockIcon.classList.add('lock-icon');
        lockIcon.title = `Déverrouiller ce terme (coûte 1 clé)`;

        // إضافة حدث النقر على أيقونة القفل
        lockIcon.addEventListener('click', (event) => {
            event.stopPropagation(); // منع تفعيل حدث النقر على الـ <li>
            // تفعيل نفس المنطق الذي يحدث عند النقر على العنصر المقفول
            li.click();
        });

        iconsContainer.appendChild(lockIcon);
    }

    // 8. تجميع كل الأجزاء معًا: إضافة النص وحاوية الأيقونات إلى عنصر <li>
    li.appendChild(termText);
    li.appendChild(iconsContainer);

    // 9. إرجاع عنصر <li> المكتمل
    return li;
}


function displayMobileDefinitions(definitionsToDisplay) {
    const mobileList = document.getElementById('mobileDefinitionsList');
    if (!mobileList) return;
    mobileList.innerHTML = '';
    if (definitionsToDisplay.length === 0) {
        mobileList.innerHTML = '<li class="no-results"> Il n’y a aucun terme correspondant à votre recherche.</li>';
        return;
    }
    definitionsToDisplay.forEach(def => mobileList.appendChild(createDefinitionListItem(def)));
}

function displayDesktopDefinitions(definitionsToDisplay, page) {
    const desktopList = document.getElementById('definitionsList');
    if (!desktopList) return;
    desktopList.innerHTML = '';

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedDefinitions = definitionsToDisplay.slice(startIndex, endIndex);

    if (paginatedDefinitions.length === 0 && definitionsToDisplay.length > 0 && page > 1) {
        currentPage = 1;
        displayDesktopDefinitions(definitionsToDisplay, 1);
        return;
    }
    if (paginatedDefinitions.length === 0) {
        desktopList.innerHTML = '<li class="no-results"> Il n’y a aucun terme correspondant à votre recherche.</li>';
    } else {
        paginatedDefinitions.forEach(def => desktopList.appendChild(createDefinitionListItem(def)));
    }
    createPagination(definitionsToDisplay.length, page);
}

function displayCurrentDefinitions() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        displayMobileDefinitions(currentFilteredDefinitions);
    } else {
        displayDesktopDefinitions(currentFilteredDefinitions, currentPage);
    }
}

// ===========================================
//  MODAL AND CONTENT DISPLAY
// ===========================================
function changeFontSize(direction) {
    // --- حدود حجم الخط (يمكنك تغيير هذه القيم) ---
    const MIN_FONT_SIZE = 14; // أصغر حجم خط مسموح به بالبكسل
    const MAX_FONT_SIZE = 24; // أكبر حجم خط مسموح به بالبكسل
    const STEP = 1; // مقدار التغيير في كل ضغطة بالبكسل

    // تحديد العنصر الذي سيتم تغيير حجم خطه (إما في نسخة الديسكتوب أو الموبايل)
    const definitionTextDesktop = document.querySelector('.desktop-layout .content .definition-text');
    const definitionTextMobile = document.getElementById('modalDefinition');
    
    let targetElement = null;
    // نتحقق أي العنصرين ظاهر حالياً
    if (definitionTextDesktop && definitionTextDesktop.offsetParent !== null) {
        targetElement = definitionTextDesktop;
    } else if (definitionTextMobile && definitionTextMobile.offsetParent !== null) {
        targetElement = definitionTextMobile;
    }

    if (!targetElement) return; // إذا لم يتم العثور على عنصر، لا تفعل شيئًا

    // الحصول على حجم الخط الحالي وتحويله إلى رقم
    const currentSize = parseFloat(window.getComputedStyle(targetElement, null).getPropertyValue('font-size'));

    // حساب الحجم الجديد
    let newSize = currentSize + (direction * STEP);

    // التحقق من الحدود
    if (newSize < MIN_FONT_SIZE) {
        newSize = MIN_FONT_SIZE;
        showToast("Vous avez atteint la taille de police minimale", "info");

    }
    if (newSize > MAX_FONT_SIZE) {
        newSize = MAX_FONT_SIZE;
        showToast("Vous avez atteint la taille de police maximale", "info");

    }

    // تطبيق الحجم الجديد
    targetElement.style.fontSize = `${newSize}px`;
}


function showConceptModal(term, definition) {
    const modal = document.getElementById('conceptModal');
    const modalTerm = document.getElementById('modalTerm');
    const modalDefinition = document.getElementById('modalDefinition');

    if (!modal || !modalTerm || !modalDefinition) {
        console.error('عناصر الـ Modal غير موجودة في الـ DOM');
        return;
    }

    // 1. تعبئة المحتوى (المصطلح والتعريف)
    modalTerm.textContent = term;
    modalDefinition.textContent = definition;

    // 2. إظهار البطاقة عن طريق تغيير خاصية display من 'none' إلى 'block' أو 'flex'
    // في حالتك، البطاقة نفسها هي الـ modal، لذا نغير display لها
    modal.style.display = 'flex'; // أو 'block' حسب تصميمك

    // إظهار طبقة التعتيم (اختياري إذا كنت تريدها)
    const overlay = document.querySelector('.mobile-modal-overlay');
    if(overlay) overlay.style.display = 'block';

    // 3. ربط أحداث أزرار التحكم (مثل زر الإغلاق)
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        // نستخدم once: true لضمان أن الحدث يضاف مرة واحدة فقط لكل مرة تفتح فيها البطاقة
        closeBtn.addEventListener('click', closeModal, { once: true });
    }
     // يمكنك إضافة حدث للنقر على طبقة التعتيم لإغلاق البطاقة
    if (overlay) {
        overlay.addEventListener('click', closeModal, { once: true });
    }
}

// *** هذه الدالة مسؤولة عن إخفاء الـ Modal ***
function closeModal() {
    const modal = document.getElementById('conceptModal');
    if (modal) {
        modal.style.display = 'none'; // إخفاء البطاقة
    }
    const overlay = document.querySelector('.mobile-modal-overlay');
    if(overlay) {
        overlay.style.display = 'none'; // إخفاء طبقة التعتيم
    }
}



function displayDefinitionInContent(term, definition) {
    const contentArea = document.querySelector('.desktop-layout .content');
    if (!contentArea) return;
    
    // مسح المحتوى القديم وإضافة الجديد
    contentArea.innerHTML = `
        <div class="term-container">
            <h2 class="term-title">${term}</h2>
        </div>
        <div class="definition-container">
            <p class="definition-text">${definition}</p>
        </div>
        <div class="definition-buttons">
            <span id="closeDefinitionBtnDesktop" class="definition-btn" title="إغلاق"><i class="fa-light fa-circle-xmark"></i></span>
            <span class="definition-btn dark-mode-toggle" title="الوضع الداكن/الفاتح"><i class="fa-light fa-moon"></i></span>
            <span class="definition-btn font-increase" title="تكبير الخط">A<sup>+</sup></span>
            <span class="definition-btn font-decrease" title="تصغير الخط">A<sup>-</sup></span>
        </div>
    `;

    // --- ربط دوال الأزرار الجديدة في نسخة سطح المكتب ---
    const closeBtnDesktop = document.getElementById('closeDefinitionBtnDesktop');
    if (closeBtnDesktop) {
        closeBtnDesktop.addEventListener('click', () => {
            contentArea.innerHTML = ''; // مسح المحتوى عند الإغلاق
        });
    }

    const darkModeToggleDesktop = contentArea.querySelector('.dark-mode-toggle');
    if (darkModeToggleDesktop) {
darkModeToggleDesktop.addEventListener('click', () => {
         themeUtils.toggleDarkMode();
         updateThemeIcons();
    });        // تحديث أيقونة القمر/الشمس بناءً على الوضع الحالي
        const icon = darkModeToggleDesktop.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    const fontIncreaseDesktop = contentArea.querySelector('.font-increase');
    if (fontIncreaseDesktop) {
        fontIncreaseDesktop.addEventListener('click', () => changeFontSize(1));
    }

    const fontDecreaseDesktop = contentArea.querySelector('.font-decrease');
    if (fontDecreaseDesktop) {
        fontDecreaseDesktop.addEventListener('click', () => changeFontSize(-1));
    }
}

// ===========================================
//  PAGINATION
// ===========================================
function createPagination(totalItems, currentPageNum) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let paginationContainer = document.querySelector('.pagination-container .pagination'); // استهداف أدق

    // إزالة الترقيم القديم إذا كان موجودًا داخل pagination-container
    const existingPagination = document.querySelector('.pagination-container .pagination');
    if (existingPagination) {
        existingPagination.remove();
    }

    if (totalPages <= 1) return;

    paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';

    const paginationHost = document.querySelector('.pagination-container');
    if (!paginationHost) {
        console.warn("Pagination container (.pagination-container) not found.");
        return;
    }
    paginationHost.appendChild(paginationContainer);


    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fa-light fa-chevron-left"></i>';
    prevButton.disabled = currentPageNum === 1;
    prevButton.addEventListener('click', () => changePage(currentPageNum - 1));
    paginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = currentPageNum === i ? 'active' : '';
        pageButton.addEventListener('click', () => changePage(i));
        paginationContainer.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fa-light fa-chevron-right"></i>';
    nextButton.disabled = currentPageNum === totalPages;
    nextButton.addEventListener('click', () => changePage(currentPageNum + 1));
    paginationContainer.appendChild(nextButton);
}

function changePage(newPage) {
    const totalItems = currentFilteredDefinitions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayDesktopDefinitions(currentFilteredDefinitions, currentPage);
    }
}

// ===========================================
//  ALPHABETICAL INDEX & SEARCH
// ===========================================
async function fetchAndDisplayDefinitions(queriesToExecute = []) {
    try {
        // دائمًا أضف ترتيبًا لضمان نتائج متسقة ما لم يكن هناك بحث (البحث له ترتيبه الخاص)
        let baseQueries = [];
        // لا نضيف Query.orderAsc("term") إذا كان هناك Query.search
        // لأن Appwrite Search لها خوارزمية ترتيب خاصة بها للصلة (relevance)
        // إذا أردت ترتيبًا محددًا بعد البحث، قد تحتاج لمعالجته بعد الجلب أو استكشاف خيارات ترتيب البحث في Appwrite
        if (!queriesToExecute.some(q => q.method === 'search')) {
            //baseQueries.push(Query.orderAsc("term"));
        }


        const finalQueries = [...baseQueries, ...queriesToExecute];

        const fetchedDefinitions = await fetchAllDocuments(termsDatabaseId, termsCollectionId, finalQueries);

        currentFilteredDefinitions = [...fetchedDefinitions]; // لا حاجة لـ .sort() هنا إذا كان Appwrite يرتب أو البحث يرتب

        // تحديث allDefinitions فقط عندما لا يكون هناك أي فلاتر على الإطلاق (لا حرف ولا بحث)
        // هذا يعني أن fetchedDefinitions هي القائمة الكاملة
        if (queriesToExecute.length === 0 && !activeLetterFilter && !currentSearchTerm) {
            allDefinitions = [...currentFilteredDefinitions]; // هنا نقوم بالفرز إذا أردنا
            // allDefinitions.sort((a, b) => a.term.localeCompare(b.term));
        } else if (queriesToExecute.length === 0 && activeLetterFilter && !currentSearchTerm) {
            // حالة خاصة: إذا كان هناك فلتر حرف فقط، يمكننا تحديث allDefinitions بالنتائج المفلترة بالحرف
            // هذا اختياري ويعتمد على كيف تريد أن تعمل allDefinitions
            // allDefinitions = [...currentFilteredDefinitions];
        }


        currentPage = 1; // إعادة التعيين عند كل فلترة/بحث جديد
        displayCurrentDefinitions(); // هذه الدالة تعرض currentFilteredDefinitions
    } catch (error) {
        console.error('Error in fetchAndDisplayDefinitions:', error);
        showToast('حدث خطأ أثناء تحميل المصطلحات.', 'error');
        currentFilteredDefinitions = [];
        displayCurrentDefinitions(); // اعرض قائمة فارغة أو رسالة خطأ
    }
}


function initializeAlphabetIndex() {
    const alphabetIndexContainers = document.querySelectorAll('.alphabet-index');
    
    alphabetIndexContainers.forEach(container => {
        container.innerHTML = ''; // مسح المحتوى القديم
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(char => {
            const letterElement = document.createElement('a');
            letterElement.textContent = char;
            letterElement.href = '#'; // لمنع تحديث الصفحة
            letterElement.classList.add('alphabet-letter'); // كلاس للتنسيق

            // إضافة event listener للنقر على الحرف
            letterElement.addEventListener('click', (e) => {
                e.preventDefault();
                handleAlphabetClick(char); // استدعاء الدالة الجديدة
            });
            container.appendChild(letterElement);
        });
    });
}

async function handleAlphabetClick(clickedLetter) {
    const upperCaseClickedLetter = clickedLetter.toUpperCase();

    // إذا تم النقر على الحرف النشط مرة أخرى، قم بإلغاء الفلتر
    if (activeLetterFilter === upperCaseClickedLetter) {
        activeLetterFilter = null; 
    } else {
        // وإلا، قم بتعيين الحرف الجديد كفلتر نشط
        activeLetterFilter = upperCaseClickedLetter;
    }

    // تحديث الواجهة لإظهار الحرف النشط
    updateActiveLetterUI();

    // قم بتطبيق الفلاتر وأعد جلب البيانات
    await applyFiltersAndSearch();
}

function updateActiveLetterUI() {
    const alphabetButtons = document.querySelectorAll('.alphabet-index a');
    alphabetButtons.forEach(btn => {
        if (btn.textContent.toUpperCase() === activeLetterFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}



// main.js
async function applyFiltersAndSearch() {
    let queries = [];

    // 1. أضف فلتر الحرف الأبجدي إذا كان نشطًا
    if (activeLetterFilter) {
        // هذا يتطلب وجود حقل "groupe" في قاعدة البيانات
        queries.push(Query.equal("groupe", activeLetterFilter));
    }

    // 2. أضف فلتر البحث النصي إذا كان المستخدم يكتب في شريط البحث
    if (currentSearchTerm) {
        queries.push(Query.search("term", currentSearchTerm));
    }

    // استدعاء الدالة لجلب البيانات المفلترة وعرضها
    await fetchAndDisplayDefinitions(queries);
}



// احذف الدالة القديمة بالكامل والصق هذه مكانها
async function fetchAndDisplayConceptFromHash(conceptId) {
    // إذا لم يكن هناك ID، اخرج فوراً
    if (!conceptId) {
        return;
    }

    const isMobile = window.innerWidth <= 768;

    // === هذا هو السطر الأهم ===
    // إذا كان المستخدم على الموبايل، لا تفعل أي شيء واخرج من الدالة.
    if (isMobile) {
        return;
    }
    
    // الكود التالي سيعمل فقط على نسخة سطح المكتب (Desktop)
    const contentArea = document.querySelector('.desktop-layout .content');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<p class="placeholder-text">Chargement du concept...</p>';

    try {
        const concept = await databases.getDocument(
            termsDatabaseId,
            termsCollectionId,
            conceptId
        );

        const termName = concept.term || 'Concept sans titre';
        const termDefinition = concept.definition || 'Aucune définition disponible.';

        displayDefinitionInContent(termName, termDefinition);

    } catch (error) {
        console.error(`Erreur lors du chargement du concept (ID: ${conceptId}) depuis le hash:`, error);
        contentArea.innerHTML = `<p class="error-text">Erreur: Impossible de charger le concept demandé.</p>`;
    }
}

/**
 * يعالج التغييرات في جزء الـ hash من الرابط.
 * إذا كان الـ hash يطابق نمط `#concept-CONCEPT_ID`, فإنه يستدعي `fetchAndDisplayConceptFromHash`.
 */
function handleHashChange() {
    const hash = window.location.hash;
/*     console.log("Hash changed or page loaded with hash:", hash);
 */    if (hash.startsWith('#concept-')) {
        const conceptId = hash.substring('#concept-'.length);
        if (conceptId) {
            fetchAndDisplayConceptFromHash(conceptId);
        } else {
            // Handle case where hash is '#concept-' but no ID (optional, or clear content)
            const desktopContentArea = document.querySelector('.desktop-layout .content');
            if (desktopContentArea && !desktopContentArea.querySelector('.term-title')) {
             }
        }
    } else {
        // No concept-related hash. Set the default placeholder for desktop view.
        const desktopContentArea = document.querySelector('.desktop-layout .content');
        if (desktopContentArea) { // Ensure it exists
            // Set placeholder if no concept (identified by .term-title) is currently displayed
            // and also not showing an error message from fetchAndDisplayConceptFromHash
            if (!desktopContentArea.querySelector('.term-title') && !desktopContentArea.querySelector('.error-text')) {
             }
        }
    }
}


// معالج فلتر الحروف الأبجدية
async function handleLetterFilter(clickedLetter) {
    const upperCaseClickedLetter = clickedLetter.toUpperCase();
    const alphabetButtons = document.querySelectorAll('.alphabet-index a.alphabet-letter');

    if (activeLetterFilter === upperCaseClickedLetter) {
        activeLetterFilter = null; // إلغاء الفلتر
        alphabetButtons.forEach(btn => btn.classList.remove('active'));
    } else {
        activeLetterFilter = upperCaseClickedLetter;
        alphabetButtons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toUpperCase() === activeLetterFilter);
        });
    }
    // بعد تحديث activeLetterFilter، أعد تطبيق الفلاتر (بما في ذلك البحث إذا كان نشطًا)
    await applyFiltersAndSearch();
}

async function handleSearch(event) {
    currentSearchTerm = event.target.value.toLowerCase().trim();
    await applyFiltersAndSearch();
}




function handleLayoutChange() {
    const mobileLayout = document.querySelector('.mobile-layout');
    const desktopLayout = document.querySelector('.desktop-layout');
    if (!mobileLayout || !desktopLayout) return;

    const isMobile = window.innerWidth <= 768;
    
    mobileLayout.style.display = isMobile ? 'block' : 'none';
    desktopLayout.style.display = isMobile ? 'none' : 'block';

    // ---  المنطق المدمج لضبط أبعاد الموبايل ---
    if (isMobile) {
        const header = document.querySelector('.mobile-layout .mobile-header');
        const searchSection = document.querySelector('.mobile-layout .mobile-search-section');
        const termsContainer = document.querySelector('.mobile-layout .mobile-terms-container');
        const tabBar = document.querySelector('.mobile-layout .mobile-tab-bar');

        if (header && searchSection && termsContainer && tabBar) {
            const topOffset = header.offsetHeight + searchSection.offsetHeight;
            const tabBarHeight = tabBar.offsetHeight;

            termsContainer.style.position = 'fixed';
            termsContainer.style.top = `${topOffset}px`;
            termsContainer.style.bottom = `${tabBarHeight}px`;
            termsContainer.style.overflowY = 'auto';
            termsContainer.style.width = '100%';
            termsContainer.style.left = '0';
        }
    } else {
        const termsContainer = document.querySelector('.mobile-layout .mobile-terms-container');
        if (termsContainer) {
            termsContainer.style.position = '';
            termsContainer.style.top = '';
            termsContainer.style.bottom = '';
            termsContainer.style.overflowY = '';
        }
    }
    // --- نهاية المنطق المدمج ---

    if (currentFilteredDefinitions) {
        displayCurrentDefinitions();
    }
}



const subscribeToRealtime = () => {
    client.subscribe(`databases.${termsDatabaseId}.collections.${userConceptsCollectionId}.documents`, (response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create') ||
            response.events.includes('databases.*.collections.*.documents.*.update') ||
            response.events.includes('databases.*.collections.*.documents.*.delete')) {
            // أعد تحميل حالة المصطلحات المفتوحة وأعد العرض
            account.get().then(user => { // تأكد من أن المستخدم لا يزال مسجلاً
                loadUserTerms(user.$id).then(() => {
                    displayCurrentDefinitions();
                });
            }).catch(() => { /* المستخدم غير مسجل */ });
        }
    });

   client.subscribe(`databases.${bookmarksDatabaseId}.collections.${bookmarksCollectionId}.documents`, (response) => {
    const eventType = response.events[0].split('.')[4]; // 'create' or 'delete'
    const payload = response.payload; // يحتوي على بيانات الوثيقة التي تم إنشاؤها/حذفها

/*     console.log(`app.html (main.js): Realtime event for bookmarks collection - Type: ${eventType}, Term: ${payload.term || 'N/A'}`);
 */
    // نهتم فقط بأحداث الإنشاء والحذف
    if (eventType === 'create' || eventType === 'delete') {
        // 1. أعد تحميل قائمة المفضلة بالكامل من قاعدة البيانات
        //    loadFavorites() يجب أن تحدث الكائن العام 'favorites'
        loadFavorites().then(() => {
            // 2. أعد عرض قائمة المصطلحات الحالية
            //    displayCurrentDefinitions() ستستخدم الكائن 'favorites' المحدث
            //    لإنشاء عناصر القائمة وتعيين الأيقونات الصحيحة
            displayCurrentDefinitions();
            console.log('app.html (main.js): Bookmarks reloaded and UI updated after realtime event.');
        }).catch(error => {
            console.error('app.html (main.js): Error reloading favorites after realtime event:', error);
        });
    }
});

    client.subscribe(`databases.${DATABASE_ID}.collections.${NOTIFICATIONS_COLLECTION_ID}.documents`, () => {
        debounceCheckUnreadNotifications();
    });

    // للاستماع لتغييرات جلسة المستخدم (تسجيل الخروج من تبويب آخر)
    client.subscribe('account', (response) => {
        if (response.events.includes('users.*.sessions.*.delete')) {
            // إذا تم حذف الجلسة الحالية
            account.get().catch(() => { // إذا لم يعد بالإمكان الحصول على المستخدم
                showToast('تم تسجيل خروجك.', 'info');
                setTimeout(() => window.location.href = 'login.html', 2000);
            });
        }
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    // استدعاء دالة واحدة فقط مسؤولة عن كلشي
    await initializeUserSession(); 
    
    // من بعد ما ينجح التحقق، كمل تهيئة باقي الأمور
    
    // تهيئة عناصر الواجهة التفاعلية
    initializeAlphabetIndex();
    setupSearchIconToggle('mobileSearchBar', 'mobileSearchIcon');
    setupSearchIconToggle('desktopSearchBar', 'desktopSearchIcon');

    const mobileSearchInput = document.getElementById('mobileSearchBar');
    const desktopSearchInput = document.getElementById('desktopSearchBar');

    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    if (desktopSearchInput) {
        desktopSearchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    const logoutBtnDesktop = document.getElementById('logoutButtonDesktop');
    const logoutBtnMobile = document.getElementById('logoutButtonMobile');
    if (logoutBtnDesktop) logoutBtnDesktop.addEventListener('click', handleLogout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', handleLogout);

    // مستمعو الأحداث للمودال وأزرار التحكم في المظهر
    const modalCloseButton = document.querySelector('#conceptModal .close-btn');
    if (modalCloseButton) modalCloseButton.addEventListener('click', closeModal);

    const darkModeToggles = document.querySelectorAll('.dark-mode-toggle');
    darkModeToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            themeUtils.toggleDarkMode();
            updateThemeIcons();
        });
    });
    
    const fontIncreaseButtons = document.querySelectorAll('.font-increase');
    fontIncreaseButtons.forEach(btn => btn.addEventListener('click', () => changeFontSize(1)));

    const fontDecreaseButtons = document.querySelectorAll('.font-decrease');
    fontDecreaseButtons.forEach(btn => btn.addEventListener('click', () => changeFontSize(-1)));

    // معالجة تخطيط الواجهة والاشتراكات في الوقت الحقيقي
    handleLayoutChange();
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('hashchange', handleHashChange);
    
    subscribeToRealtime();
});


// ⭐⭐⭐ الخطوة 3: تأكد أن دالة initializeUserSession هي هادي بالضبط ⭐⭐⭐

async function initializeUserSession() { 
    try {
        const user = await account.get(); // جرب تجيب المستخدم
        
        if (user.emailVerification) {
            // الحالة 1: المستخدم مسجل ومؤكد (الحالة ديالك دابا)
            console.log("Session valid and user is verified. Loading app...");
            
            // تهيئة بيانات التطبيق
            await Promise.all([
                initializeUserKeys(user.$id),
                loadUserTerms(user.$id),
                loadFavorites()
            ]);
            
            updateUserIcon();
            updateRoleBasedUI();
            checkUnreadNotifications();
            await fetchAndDisplayDefinitions(); // استدعاء أولي للمصطلحات

        } else {
            // الحالة 2: المستخدم مسجل ولكن غير مؤكد
            console.log("User logged in but NOT verified. Redirecting to verification page.");
            await account.createEmailToken(user.$id, user.email);
            localStorage.setItem('userIdForVerification', user.$id);
            localStorage.setItem('emailForVerification', user.email);
            window.location.replace('verify.html'); 
        }
        
    } catch (error) {
        // الحالة 3: لا يوجد مستخدم مسجل أصلاً
        console.log("No active session found. Redirecting to login page.");
        window.location.replace('login.html'); // رجعو لصفحة تسجيل الدخول
    }
}




function setupSearchIconToggle(inputId, iconId) {
    const inputElement = document.getElementById(inputId);
    const iconElement = document.getElementById(iconId);

    if (!inputElement || !iconElement) {
        // console.warn(`Search input or icon not found for: ${inputId}, ${iconId}`);
        return;
    }

    const updateIcon = () => {
        if (inputElement.value.length > 0) {
            iconElement.classList.remove('fa-magnifying-glass');
            iconElement.classList.add('fa-xmark');
            iconElement.style.pointerEvents = 'auto'; // لجعل الأيقونة قابلة للنقر
            iconElement.style.cursor = 'pointer';
        } else {
            iconElement.classList.remove('fa-xmark');
            iconElement.classList.add('fa-magnifying-glass');
            iconElement.style.pointerEvents = 'none'; // السلوك الافتراضي من CSS .search-icon
            iconElement.style.cursor = 'default';
        }
    };

    inputElement.addEventListener('input', () => {
        updateIcon();
        // ملاحظة: دالة handleSearch الحالية (التي تستخدم debounce) ستُستدعى بسبب حدث 'input'
    });

    iconElement.addEventListener('click', () => {
        if (iconElement.classList.contains('fa-xmark')) {
            inputElement.value = ''; // مسح محتوى حقل البحث
            updateIcon(); // تحديث الأيقونة فوراً
            // إطلاق حدث 'input' يدوياً لتحديث نتائج البحث (لتشغيل handleSearch)
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // تحديث حالة الأيقونة عند تحميل الصفحة في حال كان الحقل يحتوي على قيمة مسبقاً
    updateIcon();
}


// دالة لتحديث أيقونات الشمس والقمر في كل مكان
function updateThemeIcons() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const themeIcons = document.querySelectorAll('.dark-mode-toggle i');

    themeIcons.forEach(icon => {
        if (isDarkMode) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });
}