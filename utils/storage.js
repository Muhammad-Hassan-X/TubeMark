/**
 * storage.js
 * Handles interactions with chrome.storage.local
 */

const Storage = {
    async get(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    },

    async set(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                resolve();
            });
        });
    },

    async init() {
        // Initialize default folders if not present
        const folders = await this.get('folders');
        if (!folders) {
            await this.set('folders', [
                { id: 'default', name: 'Uncategorized', createdAt: Date.now() }
            ]);
        }
    },

    async addClip(clip) {
        const folders = await this.get('folders') || [];
        const clips = await this.get('clips') || [];
        
        // Ensure clip has necessary fields
        const newClip = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...clip
        };

        clips.push(newClip);
        await this.set('clips', clips);
        return newClip;
    },

    async getClips(folderId = null) {
        const clips = await this.get('clips') || [];
        if (folderId) {
            return clips.filter(c => c.folderId === folderId);
        }
        return clips;
    },

    async deleteClip(clipId) {
        let clips = await this.get('clips') || [];
        clips = clips.filter(c => c.id !== clipId);
        await this.set('clips', clips);
    },

    async updateClip(clipId, updates) {
        let clips = await this.get('clips') || [];
        const index = clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
            clips[index] = { ...clips[index], ...updates };
            await this.set('clips', clips);
        }
    },

    async addFolder(name) {
        const folders = await this.get('folders') || [];
        const newFolder = {
            id: crypto.randomUUID(),
            name,
            createdAt: Date.now()
        };
        folders.push(newFolder);
        await this.set('folders', folders);
        return newFolder;
    },

    async getFolders() {
        return await this.get('folders') || [];
    },

    async deleteFolder(folderId) {
        if (folderId === 'default') return; // Prevent deleting default
        let folders = await this.get('folders') || [];
        folders = folders.filter(f => f.id !== folderId);
        await this.set('folders', folders);
        
        // Move clips to default or delete? Let's move to default for safety
        let clips = await this.get('clips') || [];
        clips = clips.map(c => {
            if (c.folderId === folderId) {
                return { ...c, folderId: 'default' };
            }
            return c;
        });
        await this.set('clips', clips);
    }
};

// Export for ES modules or attach to window for global
if (typeof window !== 'undefined') {
    window.StorageUtils = Storage;
}
