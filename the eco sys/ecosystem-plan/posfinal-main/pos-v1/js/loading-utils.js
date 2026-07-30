// ===================================
// LOADING UTILITIES
// ===================================

function updateLoadingText(message, detail = '') {
    const loadingText = document.getElementById('loading-text');
    const loadingDetail = document.getElementById('loading-detail');
    
    if (loadingText) {
        loadingText.textContent = message;
    }
    
    if (loadingDetail) {
        loadingDetail.textContent = detail;
    }
    
    console.log(`📢 ${message}${detail ? ' - ' + detail : ''}`);
}

function showLoadingProgress(current, total, message) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    updateLoadingText(message, `${percent}% (${current}/${total})`);
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showLoading(message = 'Loading...') {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
        updateLoadingText(message);
    }
}
