/*  bookmarks.js */ 
import { Client, Databases, Account, Query } from "appwrite";
import { ID } from "appwrite";

const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("66bdd9ef0022a854dccc");

const databases = new Databases(client);
const account = new Account(client);

const bookmarksDatabaseId = "66bddcb3002ce9c16742";
const bookmarksCollectionId = "67607e0c0013805dde72";

let currentPage = 1;
const itemsPerPage = 10;
let bookmarkedTerms = [];
let lastRemovedBookmark = null;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        await checkAuthentication();
        await loadBookmarks(); // التحميل الأولي
        handleLayoutChange();
        subscribeToAppwriteBookmarkChanges(); // <--- أضف استدعاء الدالة هنا
    } catch (error) {
        console.error('Error initializing bookmarks:', error);
    }


     const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcons();


    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', () => {
            window.location.href = 'app.html';
        });
    });


    
    document.addEventListener('DOMContentLoaded', () => {
        const bookmarkBtn = document.querySelector('.bookmark-btn');
        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', handleBookmark);
        }
    
        const logoutButtons = document.querySelectorAll('.logout-button');
        logoutButtons.forEach(btn => {
            btn.addEventListener('click', handleLogout);
        });
    });

    function handleBookmark() {
        const term = document.getElementById('modalTerm').textContent;
        const definition = document.getElementById('modalDefinition').textContent;
        toggleFavorite(term, definition);
        
        // Immediate visual feedback
        const icon = this.querySelector('i');
        icon.className = favorites[term] 
            ? 'fa-light fa-bookmark-slash' 
            : 'fa-light fa-bookmark';
    }
});

function createNotification(message, undoCallback) {
    // إزالة أي إشعار قديم قبل عرض الجديد
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    // إضافة كلاس 'info' لتطبيق الستايل الأزرق
    notification.className = 'notification info'; 
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-info-circle"></i>
        </div>
        <div class="notification-content">
            <span class="message">${message}</span>
            <button class="undo-button">Annuler</button>
        </div>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.undo-button').addEventListener('click', () => {
        if (typeof undoCallback === 'function') {
            undoCallback();
        }
        notification.remove();
    });

    // زيادة وقت الظهور إلى 7 ثواني (7000 ميلي ثانية)
    setTimeout(() => {
        // التحقق مرة أخرى من وجود الإشعار قبل محاولة إزالته
        if (notification && notification.parentNode) {
            notification.remove();
        }
    }, 7000); // <-- تم تغيير الوقت هنا
}

// This is the existing removeBookmark function modified to include the new functionality
async function removeBookmark(bookmarkId) {
    try {
        const bookmarkToRemove = bookmarkedTerms.find(b => b.$id === bookmarkId);
        if (!bookmarkToRemove) return;

        // الحذف من قاعدة البيانات
        await databases.deleteDocument(
            bookmarksDatabaseId,
            bookmarksCollectionId,
            bookmarkId
        );

        // تحديث القائمة المحلية
        bookmarkedTerms = bookmarkedTerms.filter(b => b.$id !== bookmarkId);
        
        // إرسال إشعار التحديث
        localStorage.setItem('bookmarksUpdated', Date.now());
        displayBookmarks();

        // عرض إشعار التراجع
        createNotification(
            `Le terme ${bookmarkToRemove.term} a été supprimé`,
            async () => await restoreBookmark(bookmarkToRemove)
        );
    } catch (error) {
        console.error('Le signet a été ajouté :', error);
    }
}

async function restoreBookmark(bookmark) {
    try {
        const user = await account.get();
        const restored = await databases.createDocument(
            bookmarksDatabaseId,
            bookmarksCollectionId,
            ID.unique(),
            {
                userId: user.$id,
                term: bookmark.term,
                definition: bookmark.definition
            }
        );

        bookmarkedTerms.push(restored);
        localStorage.setItem('bookmarksUpdated', Date.now());
        displayBookmarks();
    } catch (error) {
        console.error('Erreur lors de la restauration:', error);
    }
}

async function checkAuthentication() {
    try {
        await account.get();
        return true;
    } catch (error) {
        window.location.href = 'login.html';
        return false;
    }
}

async function loadBookmarks() {
    try {
        const user = await account.get(); // Get current logged-in user
        const response = await databases.listDocuments(
            bookmarksDatabaseId,
            bookmarksCollectionId,
            [
                Query.equal('userId', user.$id) // Filter documents by current user's ID
            ]
        );

        bookmarkedTerms = response.documents;
        displayBookmarks();
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        if (error.code === 401) {
            // User is not authenticated
            window.location.href = 'login.html';
        }
    }
}

function displayBookmarks() {
    const isMobile = window.innerWidth <= 768;
    const listElement = isMobile ? 
        document.getElementById('mobileBookmarksList') : 
        document.getElementById('desktopBookmarksList');

    if (!listElement) return;

    listElement.innerHTML = '';

    if (bookmarkedTerms.length === 0) {
        listElement.innerHTML = '<li>Aucun favori trouvé.</li>';
        return;
    }

    if (isMobile) {
        displayMobileBookmarks(listElement);
    } else {
        displayDesktopBookmarks(listElement);
    }
}

function displayMobileBookmarks(listElement) {
    bookmarkedTerms.forEach(bookmark => {
        const li = createBookmarkListItem(bookmark);
        listElement.appendChild(li);
    });
}

function displayDesktopBookmarks(listElement) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageBookmarks = bookmarkedTerms.slice(startIndex, endIndex);

    pageBookmarks.forEach(bookmark => {
        const li = createBookmarkListItem(bookmark);
        listElement.appendChild(li);
    });

    if (bookmarkedTerms.length > itemsPerPage) {
        createPagination();
    }
}

function createBookmarkListItem(bookmark) {
    const li = document.createElement('li');
    
    // Texte du terme
    const termText = document.createElement('span');
    termText.className = 'term-text';
    termText.textContent = bookmark.term;

    // Icône de suppression
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fa-light fa-bookmark-slash';

    // Ajout des éléments
    li.appendChild(termText);
    li.appendChild(deleteIcon);

    // Gestion du clic
    li.addEventListener('click', (e) => {
        if (!e.target.classList.contains('fa-bookmark-slash')) {
            // Vérifier si on est dans le layout mobile ou desktop
            const isMobileList = e.currentTarget.closest('#mobileBookmarksList');
            
            if (isMobileList) {
                // Afficher la modal pour mobile
                showConceptModal(bookmark.term, bookmark.definition);
            } else {
                // Afficher dans le content pour desktop
                displayDefinitionInContent(bookmark.term, bookmark.definition);
            }
        }
    });

    deleteIcon.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeBookmark(bookmark.$id);
    });

    return li;
}

function showConceptModal(term, definition) {
    const modal = document.getElementById('conceptModal');
    if (!modal) return;

    // تعبئة المحتوى
    modal.querySelector('#modalTerm').textContent = term;
    modal.querySelector('#modalDefinition').textContent = definition;

    // ربط الأحداث للأزرار (يتم ربطها كل مرة لضمان عدم وجود مستمعين قدامى)
    modal.querySelector('.close-btn').onclick = closeModal;
    modal.querySelector('.dark-mode-toggle').onclick = () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        updateThemeIcons();
    };
    modal.querySelector('.font-increase').onclick = () => changeFontSize(1);
    modal.querySelector('.font-decrease').onclick = () => changeFontSize(-1);
    
    updateThemeIcons(); // تحديث الأيقونة عند الفتح
    modal.style.display = 'flex'; // إظهار المودال
}

function displayDefinitionInContent(term, definition) {
    const contentArea = document.querySelector('.desktop-layout .content');
    if (!contentArea) return;

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

    // ربط الأحداث للأزرار الجديدة
    contentArea.querySelector('#closeDefinitionBtnDesktop').onclick = () => {
        contentArea.innerHTML = ''; // إفراغ المحتوى عند الإغلاق
    };
    contentArea.querySelector('.dark-mode-toggle').onclick = () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        updateThemeIcons();
    };
    contentArea.querySelector('.font-increase').onclick = () => changeFontSize(1);
    contentArea.querySelector('.font-decrease').onclick = () => changeFontSize(-1);
    
    updateThemeIcons(); // تحديث الأيقونة عند العرض
}

function createPagination() {
    const totalPages = Math.ceil(bookmarkedTerms.length / itemsPerPage);
    let paginationContainer = document.querySelector('.pagination');

    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination';
        document.querySelector('.sidebar').appendChild(paginationContainer);
    } else {
        paginationContainer.innerHTML = '';
    }

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fa-light fa-chevron-left"></i>';
    prevButton.addEventListener('click', () => changePage(currentPage - 1));
    paginationContainer.appendChild(prevButton);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = currentPage === i ? 'active' : '';
        pageButton.addEventListener('click', () => changePage(i));
        paginationContainer.appendChild(pageButton);
    }

    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fa-light fa-chevron-right"></i>';
    nextButton.addEventListener('click', () => changePage(currentPage + 1));
    paginationContainer.appendChild(nextButton);
}

function changePage(newPage) {
    const totalPages = Math.ceil(bookmarkedTerms.length / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayBookmarks();
    }
}

function handleLayoutChange() {
    const mobileLayout = document.querySelector('.mobile-layout');
    const desktopLayout = document.querySelector('.desktop-layout');
    
    if (!mobileLayout || !desktopLayout) return;

    const isMobile = window.innerWidth <= 768;
    mobileLayout.style.display = isMobile ? 'block' : 'none';
    desktopLayout.style.display = isMobile ? 'none' : 'block';

    displayBookmarks();
}

function subscribeToAppwriteBookmarkChanges() {
    client.subscribe(`databases.${bookmarksDatabaseId}.collections.${bookmarksCollectionId}.documents`, (response) => {
        const eventType = response.events[0].split('.')[4];
        const payload = response.payload;

        console.log(`bookmarks.html (bookmarks.js): Realtime event for bookmarks collection - Type: ${eventType}, Term: ${payload.term || 'N/A'}`);

        if (eventType === 'create' || eventType === 'delete') {
            // عندما يتم إضافة إشارة مرجعية من app.html (create)
            // أو عندما يتم حذف إشارة مرجعية من هنا أو من app.html (delete)
            // أعد تحميل قائمة الإشارات المرجعية لهذه الصفحة
            loadBookmarks().then(() => {
                console.log('bookmarks.html (bookmarks.js): Bookmarks reloaded and UI updated after realtime event.');
            }).catch(error => {
                console.error('bookmarks.html (bookmarks.js): Error reloading bookmarks after realtime event:', error);
            });
        }
    });
}

// --- دوال مساعدة جديدة ---

// دالة لتحديث أيقونة الشمس/القمر
function updateThemeIcons() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const themeIcons = document.querySelectorAll('.dark-mode-toggle i');
    themeIcons.forEach(icon => {
        icon.className = isDarkMode ? 'fa-light fa-sun' : 'fa-light fa-moon';
    });
}

// دالة لتغيير حجم الخط
// الكود الجديد والمصحح
function changeFontSize(direction) {
    const MIN_FONT_SIZE = 14;
    const MAX_FONT_SIZE = 24;
    const STEP = 1;
    let targetElement = null;

    // تحديد أي تخطيط نشط حالياً (موبايل أو ديسكتوب)
    const isMobileLayoutVisible = document.querySelector('.mobile-layout').style.display !== 'none';

    if (isMobileLayoutVisible) {
        // في الموبايل، الهدف هو نص التعريف داخل المودال
        targetElement = document.querySelector('#modalDefinition');
    } else {
        // في الديسكتوب، الهدف هو نص التعريف داخل .content
        targetElement = document.querySelector('.desktop-layout .definition-text');
    }
    
    // إذا لم يتم العثور على عنصر، لا تفعل شيئًا
    if (!targetElement) return;

    // الحصول على حجم الخط الحالي وتطبيق التغيير
    const currentSize = parseFloat(window.getComputedStyle(targetElement).getPropertyValue('font-size'));
    let newSize = currentSize + (direction * STEP);
    newSize = Math.max(MIN_FONT_SIZE, Math.min(newSize, MAX_FONT_SIZE)); // تحديد الحجم ضمن الحدود
    
    targetElement.style.fontSize = `${newSize}px`;
}

// دالة لإغلاق المودال
function closeModal() {
    const modal = document.getElementById('conceptModal');
    if (modal) {
        modal.style.display = 'none';
    }
}