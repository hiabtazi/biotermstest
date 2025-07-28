const themeUtils = {
    toggleDarkMode: function() {
        document.body.classList.toggle('dark-mode');
        this.updateDarkModeButton();
        this.updateColors();
        this.toggleLogo();
    },

    updateDarkModeButton: function() {
        const darkModeButtons = document.querySelectorAll('.dark-mode-toggle');
        darkModeButtons.forEach(button => {
            if (document.body.classList.contains('dark-mode')) {
                button.innerHTML = '<i class="fa-light fa-sun-bright"></i>';
                button.title = "Passer en mode clair";
            } else {
                button.innerHTML = '<i class="fa-light fa-moon"></i>';
                button.title = "Passer en mode sombre";
            }
        });
    },

    updateColors: function() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        document.documentElement.style.setProperty('--background-color', isDarkMode ? '#333333' : '#ffffff');
        document.documentElement.style.setProperty('--text-color', isDarkMode ? '#ffffff' : '#333333');
    },

    toggleLogo: function() {
        const lightModeLogo = document.querySelector('.light-mode-logo');
        const darkModeLogo = document.querySelector('.dark-mode-logo');
        if (document.body.classList.contains('dark-mode')) {
            lightModeLogo.style.display = 'none';
            darkModeLogo.style.display = 'block';
        } else {
            lightModeLogo.style.display = 'block';
            darkModeLogo.style.display = 'none';
        }
    },

    changeFontSize: function(change) {
        const content = document.querySelector('.favorite-modal-content p');
        if (content) {
            let currentSize = parseInt(window.getComputedStyle(content).fontSize);
            content.style.fontSize = (currentSize + change) + 'px';
        }
    }
};

// Exportez l'objet themeUtils pour qu'il soit accessible dans d'autres fichiers
export default themeUtils;