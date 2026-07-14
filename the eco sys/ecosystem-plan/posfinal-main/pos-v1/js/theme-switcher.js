/**
 * Theme Switcher for Ayn Beirut POS
 * Allows users to switch between Dark, Light, and Moderate (Colorful) themes
 */

// Available themes
const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
    MODERATE: 'moderate'
};

// Initialize theme from localStorage or default to dark
function initTheme() {
    const savedTheme = localStorage.getItem('ayn-pos-theme') || THEMES.DARK;
    setTheme(savedTheme);
    
    // Update active button in dropdown
    const buttons = document.querySelectorAll('.theme-dropdown-item[data-theme]');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === savedTheme) {
            btn.classList.add('active');
        }
    });
}

// Apply theme
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ayn-pos-theme', theme);
    console.log(`✨ Theme changed to: ${theme}`);
}

// Set up event listeners (works even if DOM already loaded)
function initializeThemeSwitcher() {
    // Initialize theme
    initTheme();
    
    // Add click handlers to theme dropdown items
    const themeButtons = document.querySelectorAll('.theme-dropdown-item[data-theme]');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = btn.dataset.theme;
            
            // Apply theme
            setTheme(theme);
            
            // Update active state
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Close dropdown
            const dropdown = document.getElementById('theme-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            
            // Show notification
            if (typeof showNotification === 'function') {
                const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);
                showNotification(`✨ Theme changed to ${themeName}`);
            }
        });
    });
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeSwitcher);
} else {
    initializeThemeSwitcher();
}

// Also apply theme immediately (before DOMContentLoaded)
const savedTheme = localStorage.getItem('ayn-pos-theme') || THEMES.DARK;
document.documentElement.setAttribute('data-theme', savedTheme);
