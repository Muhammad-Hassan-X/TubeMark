// content.js

(function () {
    console.log('TubeMark: Content script loaded');

    // Wait for the player and controls to be ready
    const observer = new MutationObserver((mutations) => {
        // We look for the controls section where we want to inject our button
        // Usually .ytp-right-controls or top level actions
        // Let's inject into the 'actions' row below the video (Like/Share/Download area)
        // Selector for actions: #top-level-buttons-computed

        const actionsContainer = document.querySelector('#top-level-buttons-computed');
        if (actionsContainer && !document.querySelector('.tm-save-btn')) {
            injectButton(actionsContainer);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function injectButton(container) {
        console.log('TubeMark: Injecting button');
        const btn = document.createElement('button');
        btn.className = 'tm-save-btn';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
            </svg>
            <span>Save</span>
        `;

        // Find insert position - maybe before the "Clip" or "Save" (playlist) button? 
        // Just appending is often easiest for layout
        container.appendChild(btn);

        btn.addEventListener('click', handleSave);
    }

    async function handleSave() {
        const video = document.querySelector('video');
        if (!video) return;

        const currentTime = Math.floor(video.currentTime);
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) return;

        const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer'); // This selector changes often, might need fallback
        const title = titleElement ? titleElement.textContent.trim() : document.title.replace(' - YouTube', '');

        const clip = {
            videoId: videoId,
            title: title + ` @ ${formatTime(currentTime)}`,
            url: `https://www.youtube.com/watch?v=${videoId}&t=${currentTime}`,
            timestamp: currentTime,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            folderId: 'default' // Default to uncategorized
        };

        try {
            // Check if StorageUtils is available
            if (typeof window.StorageUtils !== 'undefined') {
                await window.StorageUtils.init(); // Ensure defaults exist
                await window.StorageUtils.addClip(clip);
                showToast(`Saved to Uncategorized: ${formatTime(currentTime)}`);
            } else {
                console.error('StorageUtils not found');
            }
        } catch (err) {
            console.error('TubeMark Save Error:', err);
        }
    }

    function formatTime(seconds) {
        const date = new Date(0);
        date.setSeconds(seconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    }

    function showToast(message) {
        let toast = document.querySelector('.tm-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'tm-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Listen for messages from Popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getVideoDetails') {
            const video = document.querySelector('video');
            if (!video) {
                sendResponse({ error: 'No video found' });
                return;
            }

            const currentTime = Math.floor(video.currentTime);
            const videoId = new URLSearchParams(window.location.search).get('v');
            const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer');
            const title = titleElement ? titleElement.textContent.trim() : document.title.replace(' - YouTube', '');

            sendResponse({
                videoId,
                title: title + ` @ ${formatTime(currentTime)}`,
                url: `https://www.youtube.com/watch?v=${videoId}&t=${currentTime}`,
                timestamp: currentTime,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            });
        }
        return true;
    });

})();
