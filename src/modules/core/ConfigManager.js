/**
 * 配置管理器
 * 保持原有的配置加载逻辑完全不变
 */
window.ConfigManager = class ConfigManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * 加载音效设置 - 原逻辑保持不变
     */
    async loadSoundSettings() {
        try {
            const result = await chrome.storage.sync.get(['soundEnabled']);
            const soundEnabled = result.soundEnabled !== undefined ? result.soundEnabled : true;
            this.stateManager.set('soundEnabled', soundEnabled);
            console.log('音效设置已加载:', soundEnabled);
        } catch (error) {
            console.warn('加载音效设置失败:', error);
            this.stateManager.set('soundEnabled', true); // 默认启用
        }
    }

    /**
     * 保存音效设置
     */
    async saveSoundSettings(enabled) {
        try {
            await chrome.storage.sync.set({ soundEnabled: enabled });
            this.stateManager.set('soundEnabled', enabled);
            console.log('音效设置已保存:', enabled);
        } catch (error) {
            console.warn('保存音效设置失败:', error);
        }
    }

    /**
     * 加载F1设置 - 原逻辑保持不变
     */
    async loadF1Settings() {
        try {
            const result = await chrome.storage.sync.get(['f1Interval', 'f1MaxRuns']);
            
            const f1Interval = result.f1Interval !== undefined ? result.f1Interval : 800;
            const f1MaxRuns = result.f1MaxRuns !== undefined ? result.f1MaxRuns : 0;
            
            this.stateManager.set('f1Interval', f1Interval);
            this.stateManager.set('f1MaxRuns', f1MaxRuns);
            
            console.log('F1设置已加载:', { f1Interval, f1MaxRuns });
        } catch (error) {
            console.warn('加载F1设置失败:', error);
            // 设置默认值
            this.stateManager.set('f1Interval', 800);
            this.stateManager.set('f1MaxRuns', 0);
        }
    }

    /**
     * 保存F1设置
     */
    async saveF1Settings(interval, maxRuns) {
        try {
            await chrome.storage.sync.set({ 
                f1Interval: interval, 
                f1MaxRuns: maxRuns 
            });
            this.stateManager.set('f1Interval', interval);
            this.stateManager.set('f1MaxRuns', maxRuns);
            console.log('F1设置已保存:', { interval, maxRuns });
        } catch (error) {
            console.warn('保存F1设置失败:', error);
        }
    }

    /**
     * 加载自动对比设置 - 原逻辑保持不变
     */
    async loadAutoCompareSettings() {
        try {
            const result = await chrome.storage.sync.get(['autoCompareEnabled']);
            const autoCompareEnabled = result.autoCompareEnabled !== undefined ? result.autoCompareEnabled : true;
            this.stateManager.set('autoCompareEnabled', autoCompareEnabled);
            console.log('自动对比设置已加载:', autoCompareEnabled);
        } catch (error) {
            console.warn('加载自动对比设置失败:', error);
            this.stateManager.set('autoCompareEnabled', true); // 默认启用
        }
    }

    /**
     * 保存自动对比设置
     */
    async saveAutoCompareSettings(enabled) {
        try {
            await chrome.storage.sync.set({ autoCompareEnabled: enabled });
            this.stateManager.set('autoCompareEnabled', enabled);
            console.log('自动对比设置已保存:', enabled);
        } catch (error) {
            console.warn('保存自动对比设置失败:', error);
        }
    }

    /**
     * 加载所有设置
     */
    async loadAllSettings() {
        await Promise.all([
            this.loadSoundSettings(),
            this.loadF1Settings(),
            this.loadAutoCompareSettings()
        ]);
        console.log('所有设置已加载完成');
    }

    /**
     * 重置所有设置为默认值
     */
    async resetAllSettings() {
        try {
            await chrome.storage.sync.clear();
            
            // 设置默认值
            this.stateManager.set('soundEnabled', true);
            this.stateManager.set('f1Interval', 800);
            this.stateManager.set('f1MaxRuns', 0);
            this.stateManager.set('autoCompareEnabled', true);
            
            console.log('所有设置已重置为默认值');
        } catch (error) {
            console.warn('重置设置失败:', error);
        }
    }

    /**
     * 获取当前所有设置
     */
    getCurrentSettings() {
        return {
            soundEnabled: this.stateManager.get('soundEnabled'),
            f1Interval: this.stateManager.get('f1Interval'),
            f1MaxRuns: this.stateManager.get('f1MaxRuns'),
            autoCompareEnabled: this.stateManager.get('autoCompareEnabled')
        };
    }
}