// 图片快捷下载器 + 按钮快捷键 - Content Script (重构版)
// 实现功能:
// 1. D键 - 快捷下载图片
// 2. 空格键 - 点击"跳过"按钮
// 3. S键 - 点击"提交并继续标注"按钮
// 4. A键 - 上传图片
// 5. W键 - 智能图片对比
// 6. 其他快捷键功能

console.log('=== AnnotateFlow Assistant v2.0 (重构版) 开始加载 ===');

// 全局状态管理
let isInitialized = false;
let currentPageUrl = '';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeScript);

// 如果页面已经加载完成，直接初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScript);
} else {
    initializeScript();
}

async function initializeScript() {
    if (isInitialized) {
        console.log('脚本已初始化，跳过重复初始化');
        return;
    }

    console.log('开始初始化 AnnotateFlow Assistant...');
    
    try {
        // 检查Chrome扩展API是否可用
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.error('Chrome扩展API不可用，插件可能未正确加载');
            showNotification('插件未正确加载，请刷新页面或重新安装插件', 5000);
            return;
        }

        // 初始化各个模块
        await initializeModules();
        
        // 设置页面监听
        setupPageListeners();
        
        // 检测页面变化
        checkPageChange();
        
        isInitialized = true;
        console.log('✅ AnnotateFlow Assistant 初始化完成');
        showNotification('AnnotateFlow Assistant 已加载完成', 2000);
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('插件初始化失败: ' + error.message, 5000);
    }
}

// 初始化各个模块
async function initializeModules() {
    console.log('开始初始化模块...');
    
    // 等待模块加载完成
    await waitForModules();
    
    // 初始化 KeyboardManager
    if (typeof initializeKeyboardManager === 'function') {
        initializeKeyboardManager();
        console.log('✅ KeyboardManager 已初始化');
    } else {
        console.warn('⚠️ KeyboardManager 模块不可用，使用兼容模式');
        if (typeof handleKeydownFallback === 'function') {
            document.addEventListener('keydown', handleKeydownFallback);
        } else {
            setupFallbackMode();
        }
    }
    
    // 初始化 ImageHelper
    if (typeof initializeImageHelper === 'function') {
        initializeImageHelper();
        console.log('✅ ImageHelper 已初始化');
    } else {
        console.warn('⚠️ ImageHelper 模块不可用');
    }
    
    // 初始化 UIHelper
    if (typeof initializeUIHelper === 'function') {
        initializeUIHelper();
        console.log('✅ UIHelper 已初始化');
    } else {
        console.warn('⚠️ UIHelper 模块不可用');
    }
    
    // 初始化 OriginalImageDetector
    if (typeof initializeOriginalImageDetector === 'function') {
        initializeOriginalImageDetector();
        console.log('✅ OriginalImageDetector 已初始化');
    } else {
        console.warn('⚠️ OriginalImageDetector 模块不可用');
    }
    
    // 初始化 SmartComparisonManager
    if (typeof initializeSmartComparisonManager === 'function') {
        initializeSmartComparisonManager();
        console.log('✅ SmartComparisonManager 已初始化');
    } else {
        console.warn('⚠️ SmartComparisonManager 模块不可用');
    }
    
    // 初始化 RunningHubManager
    if (window.RunningHubManager) {
        window.runningHubManager = new window.RunningHubManager();
        console.log('✅ RunningHubManager 已初始化');
    } else {
        console.warn('⚠️ RunningHubManager 模块不可用');
    }
    
    // 初始化 StateManager
    if (window.StateManager) {
        window.stateManager = window.getStateManager();
        if (window.stateManager && !window.stateManager.isInitialized()) {
            window.stateManager.initialize();
            console.log('✅ StateManager 已初始化');
        }
    } else {
        console.warn('⚠️ StateManager 模块不可用');
    }
}

// 等待模块加载完成
async function waitForModules() {
    const maxWaitTime = 5000; // 最大等待5秒
    const checkInterval = 100; // 每100ms检查一次
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
        // 检查关键模块是否已加载
        const modulesLoaded = [
            typeof initializeKeyboardManager === 'function',
            typeof initializeImageHelper === 'function',
            typeof initializeOriginalImageDetector === 'function'
        ];
        
        if (modulesLoaded.some(loaded => loaded)) {
            console.log('模块加载检查完成');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
    }
    
    console.warn('模块加载超时，继续使用可用的模块');
}

// 设置页面监听器（委托给StateManager）
function setupPageListeners() {
    if (typeof window.setupPageListenersFromStateManager === 'function') {
        // 使用StateManager的setupPageListeners
        window.setupPageListenersFromStateManager();
    } else {
        // 兼容模式：基础监听器设置
        console.warn('⚠️ StateManager不可用，使用基础页面监听');
        
        // 监听页面卸载
        window.addEventListener('beforeunload', () => {
            if (typeof window.cleanupFromStateManager === 'function') {
                window.cleanupFromStateManager();
            } else {
                isInitialized = false;
            }
        });
    }
}

// 检查页面变化（委托给StateManager）
function checkPageChange() {
    // 检查StateManager是否可用且有不同的checkPageChange函数
    if (window.stateManager && typeof window.stateManager.checkPageChange === 'function') {
        // 使用StateManager实例的方法
        window.stateManager.checkPageChange();
    } else if (typeof window.checkPageChangeFromStateManager === 'function') {
        // 使用StateManager导出的函数（避免命名冲突）
        window.checkPageChangeFromStateManager();
    } else {
        // 兼容模式：简单的URL检查
        const newUrl = window.location.href;
        if (currentPageUrl && currentPageUrl !== newUrl) {
            console.log('检测到页面跳转（兼容模式）');
            currentPageUrl = newUrl;
            
            if (typeof showNotification === 'function') {
                showNotification('页面切换，正在重新检测原图...', 2000);
            }
        }
        currentPageUrl = newUrl;
    }
}

// 兼容模式处理（当模块不可用时的后备方案）
function setupFallbackMode() {
    console.warn('⚠️ 使用兼容模式，部分模块不可用');
    
    // 设置兼容模式的键盘处理
    if (typeof handleKeydownFallback === 'function') {
        document.addEventListener('keydown', handleKeydownFallback);
        console.log('✅ 兼容模式键盘处理已启用');
    }
    
    // 设置基础的图片监听
    if (typeof observeImageChanges === 'function') {
        observeImageChanges();
        console.log('✅ 兼容模式图片监听已启用');
    }
}

// 导出主要函数供其他模块使用
window.AnnotateFlowAssistant = {
    isInitialized: () => isInitialized,
    showNotification: typeof showNotification === 'function' ? showNotification : null,
    cleanup: typeof cleanup === 'function' ? cleanup : (() => { isInitialized = false; })
};

console.log('✅ AnnotateFlow Assistant Content Script 加载完成');