// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize storage if needed
    await StorageUtils.init();

    // DOM Elements
    const views = {
        folders: document.getElementById('view-folders'),
        clips: document.getElementById('view-clips')
    };
    const containers = {
        folders: document.getElementById('folder-list'),
        clips: document.getElementById('clip-list')
    };
    const labels = {
        folderName: document.getElementById('current-folder-name')
    };
    const buttons = {
        back: document.getElementById('back-to-folders'),
        createFolder: document.getElementById('save-folder'),
        cancelFolder: document.getElementById('cancel-folder'),
        saveCurrent: document.getElementById('save-current-video')
    };
    const inputs = {
        folderName: document.getElementById('folder-name-input'),
        search: document.getElementById('search-input')
    };

    // --- Search Logic ---
    inputs.search.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();

        // Filter elements based on active view
        const isFoldersView = views.folders.classList.contains('active');
        const container = isFoldersView ? containers.folders : containers.clips;
        const selector = isFoldersView ? '.folder-card:not(.add-folder-card)' : '.clip-card';
        const textSelector = isFoldersView ? '.folder-name' : '.clip-title';

        const items = container.querySelectorAll(selector);
        items.forEach(item => {
            const text = item.querySelector(textSelector).textContent.toLowerCase();
            if (text.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
    const modals = {
        folder: document.getElementById('modal-folder'),
        select: document.getElementById('modal-select-folder')
    };

    // --- Save Current Video Logic ---
    buttons.saveCurrent.addEventListener('click', async () => {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes('youtube.com/watch')) {
            alert('Please open a YouTube video first.');
            return;
        }

        // Send message to content script
        try {
            chrome.tabs.sendMessage(tab.id, { action: 'getVideoDetails' }, async (response) => {
                if (chrome.runtime.lastError) {
                    alert('Please refresh the YouTube page to enable TubeMark.');
                    return;
                }
                if (response && response.error) {
                    alert(response.error);
                } else if (response) {
                    // Show Folder Selection Modal
                    openSelectFolderModal(response);
                }
            });
        } catch (e) {
            console.error(e);
        }
    });

    let contextClipData = null; // Store clip data while selecting folder

    async function openSelectFolderModal(clipData) {
        contextClipData = clipData;
        const folders = await StorageUtils.getFolders();
        const listContainer = document.getElementById('folder-selection-list');
        listContainer.innerHTML = '';

        folders.forEach((folder, index) => {
            const div = document.createElement('div');
            div.className = 'folder-option';
            if (index === 0) div.classList.add('selected'); // Default select first

            div.innerHTML = `
                <input type="radio" name="folder-select" id="f-${folder.id}" value="${folder.id}" ${index === 0 ? 'checked' : ''}>
                <label for="f-${folder.id}">${folder.name}</label>
            `;

            div.addEventListener('click', () => {
                // Handle visual selection class
                document.querySelectorAll('.folder-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                div.querySelector('input').checked = true;
            });

            listContainer.appendChild(div);
        });

        modals.select.classList.add('open');
    }

    document.getElementById('cancel-select').addEventListener('click', () => {
        modals.select.classList.remove('open');
        contextClipData = null;
    });

    document.getElementById('confirm-save').addEventListener('click', async () => {
        if (!contextClipData) return;

        const selectedRadio = document.querySelector('input[name="folder-select"]:checked');
        if (selectedRadio) {
            const folderId = selectedRadio.value;
            await StorageUtils.addClip({ ...contextClipData, folderId });

            modals.select.classList.remove('open');
            contextClipData = null;

            // Visual Feedback on Save Button
            const btnText = buttons.saveCurrent.textContent;
            buttons.saveCurrent.textContent = 'Saved!';
            buttons.saveCurrent.style.background = '#2ba640';
            setTimeout(() => {
                buttons.saveCurrent.textContent = btnText;
                buttons.saveCurrent.style.background = '';
            }, 2000);

            // If we are currently viewing that folder, refresh
            if (currentFolderId === folderId) {
                renderClips();
            }
        }
    });

    let currentFolderId = null;

    // --- Navigation ---
    function switchView(viewName) {
        Object.values(views).forEach(el => el.classList.remove('active'));
        views[viewName].classList.add('active');
    }

    buttons.back.addEventListener('click', () => {
        currentFolderId = null;
        switchView('folders');
        renderFolders();
    });

    // --- Renderers ---
    async function renderFolders() {
        const folders = await StorageUtils.getFolders();
        containers.folders.innerHTML = '';

        // "Add Folder" Card
        const addCard = document.createElement('div');
        addCard.className = 'folder-card add-folder-card';
        addCard.innerHTML = `
            <div class="folder-icon">+</div>
            <div class="folder-name">New Folder</div>
        `;
        addCard.addEventListener('click', openFolderModal);
        containers.folders.appendChild(addCard);

        // Actual Folders
        folders.forEach(folder => {
            const card = document.createElement('div');
            card.className = 'folder-card';

            // Delete Action (stop propagation)
            const deleteBtn = document.createElement('div');

            card.innerHTML = `
                <div class="folder-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                </div>
                <div class="folder-name">${folder.name}</div>
            `;

            card.addEventListener('click', () => openFolder(folder));

            // Context menu or long press for delete? Let's use right click for now or add a small delete icon
            // For simplicity in this UI, let's append a delete button if it's not default
            if (folder.id !== 'default') {
                // Optional: Add delete capability
            }

            containers.folders.appendChild(card);
        });
    }

    async function openFolder(folder) {
        currentFolderId = folder.id;
        labels.folderName.textContent = folder.name;
        await renderClips();
        switchView('clips');
    }

    async function renderClips() {
        if (!currentFolderId) return;
        const clips = await StorageUtils.getClips(currentFolderId);
        containers.clips.innerHTML = '';

        if (clips.length === 0) {
            containers.clips.innerHTML = '<div style="text-align:center; color:#888; padding: 20px;">No clips yet.</div>';
            return;
        }

        clips.sort((a, b) => b.createdAt - a.createdAt).forEach(clip => {
            const card = document.createElement('div');
            card.className = 'clip-card';

            card.innerHTML = `
                <img class="clip-thumb" src="${clip.thumbnail}" alt="thumb">
                <div class="clip-info">
                    <div class="clip-title" title="${clip.title}">${clip.title}</div>
                    <div class="clip-actions">
                        <button class="icon-btn delete-btn" title="Delete">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </div>
            `;

            // Thumbnail click -> Open Video
            const thumb = card.querySelector('.clip-thumb');
            const title = card.querySelector('.clip-title');
            const openLink = () => chrome.tabs.create({ url: clip.url });
            thumb.addEventListener('click', openLink);
            title.addEventListener('click', openLink);

            // Edit click
            const editBtn = document.createElement('button');
            editBtn.className = 'icon-btn';
            editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
            editBtn.title = 'Edit Title';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openInputModal('Edit Title', clip.title, async (newTitle) => {
                    await StorageUtils.updateClip(clip.id, { title: newTitle });
                    renderClips();
                });
            });

            // Delete click
            card.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Delete this clip?')) {
                    await StorageUtils.deleteClip(clip.id);
                    renderClips();
                }
            });

            // Insert edit button before delete button
            card.querySelector('.clip-actions').insertBefore(editBtn, card.querySelector('.delete-btn'));

            containers.clips.appendChild(card);
        });
    }

    // --- Modal Logic ---
    function openFolderModal() {
        modals.folder.classList.add('open');
        inputs.folderName.focus();
    }

    function closeFolderModal() {
        modals.folder.classList.remove('open');
        inputs.folderName.value = '';
    }

    buttons.cancelFolder.addEventListener('click', closeFolderModal);

    buttons.createFolder.addEventListener('click', async () => {
        const name = inputs.folderName.value.trim();
        if (name) {
            await StorageUtils.addFolder(name);
            renderFolders();
            closeFolderModal();
        }
    });

    // Initial Render
    renderFolders();
});
