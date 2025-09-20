// 图片快捷下载器 + 按钮快捷键 - Content Script
// 实现功能:
// 1. D键 - 快捷下载图片
// 2. 空格键 - 点击"跳过"按钮
// 3. S键 - 点击"提交并继续标注"按钮

// === 模块兼容层 ===
// 访问常量的便捷方式，向后兼容
const CONSTANTS = window.AuxisConstants || {};

// 确保模块兼容性
if (typeof window.getImageHelper === 'undefined' && typeof window.initializeImageHelper === 'undefined') {
    // 如果模块未加载，动态加载ImageHelper模块
    const imageHelperScript = document.createElement('script');
    imageHelperScript.src = chrome.runtime.getURL('src/modules/ui/ImageHelper.js');
    imageHelperScript.onload = function() {
        console.log('ImageHelper 模块加载成功');
    };
    imageHelperScript.onerror = function() {
        console.error('ImageHelper 模块加载失败');
    };
    document.head.appendChild(imageHelperScript);
}

if (typeof window.getUIHelper === 'undefined' && typeof window.initializeUIHelper === 'undefined') {
    // 如果模块未加载，动态加载UIHelper模块
    const uiHelperScript = document.createElement('script');
    uiHelperScript.src = chrome.runtime.getURL('src/modules/ui/UIHelper.js');
    uiHelperScript.onload = function() {
        console.log('UIHelper 模块加载成功');
    };
    uiHelperScript.onerror = function() {
        console.error('UIHelper 模块加载失败');
    };
    document.head.appendChild(uiHelperScript);
}

if (typeof window.getComparisonUIManager === 'undefined' && typeof window.initializeComparisonUIManager === 'undefined') {
    // 如果模块未加载，动态加载ComparisonUIManager模块
    const comparisonUIManagerScript = document.createElement('script');
    comparisonUIManagerScript.src = chrome.runtime.getURL('src/modules/ui/ComparisonUIManager.js');
    comparisonUIManagerScript.onload = function() {
        console.log('ComparisonUIManager 模块加载成功');
    };
    comparisonUIManagerScript.onerror = function() {
        console.error('ComparisonUIManager 模块加载失败');
    };
    document.head.appendChild(comparisonUIManagerScript);
}

if (typeof window.getSmartComparisonManager === 'undefined' && typeof window.initializeSmartComparisonManager === 'undefined') {
    // 如果模块未加载，动态加载SmartComparisonManager模块
    const smartComparisonManagerScript = document.createElement('script');
    smartComparisonManagerScript.src = chrome.runtime.getURL('src/modules/core/SmartComparisonManager.js');
    smartComparisonManagerScript.onload = function() {
        console.log('SmartComparisonManager 模块加载成功');
    };
    smartComparisonManagerScript.onerror = function() {
        console.error('SmartComparisonManager 模块加载失败');
    };
    document.head.appendChild(smartComparisonManagerScript);
}

// 检查模块是否可用的便捷函数
function isModuleAvailable(moduleName) {
    switch(moduleName) {
        case 'KeyboardManager':
            return typeof window.initializeKeyboardManager === 'function';
        case 'DownloadManager':
            return typeof window.initializeDownloadManager === 'function';
        case 'ImageHelper':
            return typeof window.initializeImageHelper === 'function';
        case 'UIHelper':
            return typeof window.initializeUIHelper === 'function';
        case 'ComparisonUIManager':
            return typeof window.initializeComparisonUIManager === 'function';
        case 'SmartComparisonManager':
            return typeof window.initializeSmartComparisonManager === 'function';
        default:
            return false;
    }
}

// === 模块兼容层结束 ===

// 全局变量
let notificationAudio = null;
let soundEnabled = true; // 音效开关状态
let autoCompareEnabled = true; // 自动对比开关状态
let originalImage = null; // 存储原图引用用于对比（在单个页面生命周期内不可变更）
let originalImageLocked = false; // 原图锁定状态，防止在同一页面被覆盖
let currentPageUrl = ''; // 记录当前页面URL，用于检测页面跳转
let pendingComparisonTimeouts = []; // 记录待执行的对比任务
let shouldAutoCompare = false; // 标记是否应该自动触发对比（只有上传图片时为true）
let uploadedImage = null; // 存储上传图片引用
let comparisonModal = null; // 图片对比弹窗元素
let isComparisonModalOpen = false; // 对比页面开启状态
let debugMode = false; // 调试模式开关（默认关闭）
let debugPanel = null; // 调试面板元素
let debugLogs = []; // 调试日志数组

// 初始化 RunningHub Manager（在 debugLogs 定义之后）
let runningHubManager = null;
if (window.RunningHubManager) {
    runningHubManager = new window.RunningHubManager();
    debugLog('RunningHub Manager 已设置完成');
}

// 初始化 StateManager（在其他管理器之后）
let stateManager = null;
if (window.StateManager) {
    stateManager = window.getStateManager();
    // 延迟初始化，确保所有依赖都已加载
    setTimeout(() => {
        if (stateManager && !stateManager.isInitialized()) {
            try {
                stateManager.initialize();
                debugLog('StateManager 已初始化完成');

                // 启动状态同步检查
                if (window.checkPageChangeAndReset) {
                    window.checkPageChangeAndReset();
                }
            } catch (error) {
                debugLog('StateManager 初始化失败:', error);
            }
        }
    }, 100);
}

// F1 连续无效化相关
let f1AutoInvalidating = false;
let f1IntervalMs = 800; // 可调整的执行间隔（毫秒）
let f1MaxRuns = 0; // 最大连续执行次数，0表示无限制
let f1TimerId = null;
let f1RunCount = 0;
// COS图片拦截相关变量
let capturedOriginalImage = null; // 捕获的原图URL
let capturedModifiedImage = null; // 捕获的修改图URL
let cosImageCache = new Map(); // COS图片缓存
let capturedImageRequests = new Map(); // 存储捕获的图片请求
let originalImageFromNetwork = null; // 从网络请求中获取的原图
// 兼容性变量（逐步清理中）
let serverReturnedModifiedImage = null;
let userUploadedImage = null;
// RunningHub结果缓存相关
let cachedRunningHubResults = null; // 缓存的RunningHub结果
let currentPageTaskInfo = null; // 当前页面的任务信息
let lastSuccessfulTaskId = null; // 最后成功的任务ID 
// 通用：隐藏取消按钮
function hideRhCancelBtn() {
    try {
        const btn = document.querySelector('#rh-cancel-btn');
        if (btn) btn.style.display = 'none';
    } catch (_) {}
}

function showRhCancelBtn() {
    try {
        const btn = document.querySelector('#rh-cancel-btn');
        if (btn) {
            btn.style.display = '';
            btn.disabled = false;
            btn.textContent = '取消任务';
            btn.style.opacity = '1';
        }
    } catch (_) {}
}

// 检查并关闭模态框的辅助函数
function checkAndCloseModalIfOpen(keyName) {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        console.log(`[${keyName.toUpperCase()}键] 检测到尺寸检查模态框已打开，先关闭模态框`);
        modal.remove();
        return true; // 返回true表示关闭了模态框
    }
    return false; // 返回false表示没有模态框需要关闭
}

// 确保模态框被关闭的函数
function ensureModalClosed() {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        modal.remove();
        console.log('[模态框管理] 强制关闭尺寸检查模态框');
    }
}

function checkAndCloseModalIfOpen(currentKey) {
    // 如果尺寸检查模态框打开，且不是ESC键和R键，先关闭模态框
    if (isDimensionCheckModalOpen && currentKey !== 'escape' && currentKey !== 'r') {
        debugLog('检测到模态框打开，先关闭模态框', { key: currentKey });
        closeDimensionCheckModal();
        showNotification('模态框已关闭，请重新按键执行操作', 1500);
        return true; // 返回true表示已关闭模态框
    }
    return false; // 返回false表示没有模态框需要关闭
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeScript);

// 如果页面已经加载完成，直接初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScript);
} else {
    initializeScript();
}

function initializeScript() {
    console.log('=== AnnotateFlow Assistant v2.0 已加载 ===');
    console.log('专为腾讯QLabel标注平台设计');
    console.log('支持功能: D键下载图片, 空格键跳过, S键提交标注, A键上传图片, F键查看历史, W键智能图片对比, Z键调试模式, I键检查文件输入, B键重新检测原图, N键重新检测原图, P键/F2键智能尺寸检查, R键手动检查尺寸是否为8的倍数');
    console.log('🎯 原图检测: 只支持JPEG格式的COS原图 (.jpg/.jpeg)');
    console.log('Chrome对象:', typeof chrome);
    console.log('Chrome.runtime:', typeof chrome?.runtime);
    console.log('扩展ID:', chrome?.runtime?.id);
    
    // 检测页面是否发生变化（用于重置原图锁定）
    checkPageChange();
    
    // 检查Chrome扩展API是否可用
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome扩展API不可用，插件可能未正确加载');
        console.error('Chrome:', chrome);
        console.error('Chrome.runtime:', chrome?.runtime);
        setTimeout(() => {
            showNotification('插件未正确加载，请刷新页面或重新安装插件', 5000);
        }, 1000);
        return;
    }
    
    // 加载音效设置
    loadSoundSettings();
    
    // 加载F1设置
    loadF1Settings();
    
    // 加载自动对比设置
    loadAutoCompareSettings();
    
    // 初始化音效
    initializeAudio();
    
    // 添加键盘事件监听器
    // 初始化 KeyboardManager
    if (typeof initializeKeyboardManager === 'function') {
        initializeKeyboardManager();
    } else {
        // 回退到兼容模式
        document.addEventListener('keydown', handleKeydown);
    }
    
    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.soundEnabled) {
                soundEnabled = changes.soundEnabled.newValue;
                console.log('音效设置已更新:', soundEnabled);
            }
            if (changes.f1Interval) {
                f1IntervalMs = changes.f1Interval.newValue;
                console.log('F1间隔设置已更新:', f1IntervalMs);
            }
            if (changes.f1MaxRuns) {
                f1MaxRuns = changes.f1MaxRuns.newValue;
                console.log('F1最大执行次数设置已更新:', f1MaxRuns);
            }
            if (changes.autoCompareEnabled) {
                autoCompareEnabled = changes.autoCompareEnabled.newValue;
                console.log('自动对比设置已更新:', autoCompareEnabled);
            }
        }
    });
    
    // 初始化 ImageHelper
    if (typeof initializeImageHelper === 'function') {
        initializeImageHelper();
        // 为所有图片添加鼠标事件监听器
        if (typeof getImageHelper === 'function') {
            const imageHelper = getImageHelper();
            imageHelper.addImageEventListeners();
        }
        // 使用 MutationObserver 监听动态添加的图片
        observeImageChanges();
    } else {
        console.warn('ImageHelper 模块不可用，图片交互功能可能受限');
        observeImageChanges();
    }
    
    // 初始化图片上传监听
    initializeUploadMonitoring();
    
    // 添加图片加载监听器
    addImageLoadListeners();
    
    // 初始化DOM内容变化监听（用于检测页面内容更新）
    initializeDOMContentObserver();
    
    // 立即开始检测原图
    debugLog('页面加载完成，开始检测原图');
    recordOriginalImages();
    
    // 初始化调试功能（默认关闭）
    if (debugMode) {
        initializeDebugPanel();
    }

    // 初始化COS图片拦截监听
    initializeCOSImageListener();
    
    console.log('AnnotateFlow Assistant 初始化完成，调试模式:', debugMode ? '已启用' : '已禁用');
}

// 检查页面是否发生变化，如果是新页面则重置原图锁定
function checkPageChange() {
    const newUrl = window.location.href;

    // 添加URL变化的详细日志
    if (currentPageUrl) {
        debugLog('🔍 URL检查', {
            currentPageUrl: currentPageUrl.substring(0, 100) + '...',
            newUrl: newUrl.substring(0, 100) + '...',
            areEqual: currentPageUrl === newUrl,
            lengthCheck: {
                currentLength: currentPageUrl.length,
                newLength: newUrl.length
            }
        });
    }

    if (currentPageUrl && currentPageUrl !== newUrl) {
        debugLog('⚠️ 检测到页面跳转，使用StateManager重置状态', {
            oldUrl: currentPageUrl.substring(0, 100) + '...',
            newUrl: newUrl.substring(0, 100) + '...',
            urlChanged: true,
            urlDifference: {
                oldLength: currentPageUrl.length,
                newLength: newUrl.length
            }
        });

        // 使用 StateManager 清理页面状态
        if (window.clearPageState) {
            window.clearPageState();
        } else {
            // 回退到手动重置（兼容模式）
            originalImageLocked = false;
            originalImage = null;
            shouldAutoCompare = false;

            // 取消所有待执行的对比任务
            debugLog('取消待执行的对比任务', { count: pendingComparisonTimeouts.length });
            pendingComparisonTimeouts.forEach(timeoutId => {
                clearTimeout(timeoutId);
            });
            pendingComparisonTimeouts = [];
        }
        
        // 关闭已存在的对比弹窗
        if (comparisonModal && comparisonModal.parentNode) {
            debugLog('关闭已存在的对比弹窗');
            comparisonModal.parentNode.removeChild(comparisonModal);
            comparisonModal = null;
        }
        
        // 清空上传的对比图，避免内存泄漏和页面间的状态污染
        uploadedImage = null;
        isComparisonModalOpen = false;

        // 清除RunningHub结果缓存
        debugLog('清除RunningHub结果缓存');
        cachedRunningHubResults = null;
        currentPageTaskInfo = null;
        lastSuccessfulTaskId = null;
        
        debugLog('页面跳转重置状态', {
            'originalImageLocked': originalImageLocked,
            'originalImage': originalImage ? '有' : '无',
            'uploadedImage': '已清空',
            'canceledTimeouts': pendingComparisonTimeouts.length
        });
        
        showNotification('页面切换，正在重新检测原图...', 2000);
        
        // 立即开始检测原图
        recordOriginalImages();
        
        // 延迟多次重试检测原图，因为新页面内容可能需要时间加载
        const retryIntervals = [500, 1000, 2000, 3000, 5000];
        retryIntervals.forEach((delay, index) => {
            const retryTimeoutId = setTimeout(() => {
                debugLog(`页面跳转后第${index + 1}次尝试检测原图 (延迟${delay}ms)`);
                if (!originalImageLocked) { // 只有在还没检测到原图时才继续尝试
                    recordOriginalImages();
                }
                
                // 从待执行列表中移除
                const timeoutIndex = pendingComparisonTimeouts.indexOf(retryTimeoutId);
                if (timeoutIndex > -1) {
                    pendingComparisonTimeouts.splice(timeoutIndex, 1);
                }
            }, delay);
            
            // 将重试任务也加入管理队列
            pendingComparisonTimeouts.push(retryTimeoutId);
        });
    }
    
    currentPageUrl = newUrl;
    debugLog('当前页面URL已更新', currentPageUrl.substring(0, 100) + '...');
    
    // 监听后续的URL变化
    if (!window._pageChangeObserverStarted) {
        window._pageChangeObserverStarted = true;
        
        // 使用pushstate/popstate监听单页应用的路由变化
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(() => checkPageChange(), 100);
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(() => checkPageChange(), 100);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(() => checkPageChange(), 100);
        });
        
        // 更频繁地检查URL变化（每200ms一次，持续10秒，然后降低频率）
        let checkCount = 0;
        const fastCheckInterval = setInterval(() => {
            if (window.location.href !== currentPageUrl) {
                checkPageChange();
            }
            checkCount++;
            // 10秒后改为每秒检查一次
            if (checkCount >= 50) { // 50 * 200ms = 10秒
                clearInterval(fastCheckInterval);
                // 改为每秒检查一次
                setInterval(() => {
                    if (window.location.href !== currentPageUrl) {
                        checkPageChange();
                    }
                }, 1000);
            }
        }, 200);
        
        debugLog('页面变化监听已启动（快速检测模式）');
    }
}

// 关闭图片对比弹窗
function closeComparisonModal() {
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
        comparisonModal = null;
        isComparisonModalOpen = false;
        debugLog('对比弹窗已关闭，状态已更新');
        
        // 移除ESC键监听器（如果存在）
        if (typeof window.currentHandleEscKey === 'function') {
            document.removeEventListener('keydown', window.currentHandleEscKey);
            window.currentHandleEscKey = null;
        }
    }
    
    // 清理右侧工具栏 - 更新选择器以匹配当前的right值
    const toolbar = document.querySelector('div[style*="position: fixed"][style*="right: 5px"]');
    if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
        debugLog('右侧工具栏已清理');
    }
    
    // 备用清理方法：通过其他特征查找工具栏
    const toolbars = document.querySelectorAll('div[style*="position: fixed"][style*="transform: translateY(-50%)"][style*="width: 80px"]');
    toolbars.forEach(tb => {
        if (tb && tb.parentNode) {
            tb.parentNode.removeChild(tb);
            debugLog('通过备用方法清理了工具栏');
        }
    });
}

// 处理键盘事件
// handleKeydown 函数已移动到 src/modules/KeyboardManager.js
// 检查目标元素是否是输入框
// isInInputField 函数已移动到 src/modules/KeyboardManager.js
// 获取要下载的图片
// getImageToDownload 函数已移动到 src/modules/ui/ImageHelper.js

// 为所有图片添加事件监听器
// addImageEventListeners 函数已移动到 src/modules/ui/ImageHelper.js

// 为单个图片添加事件监听器
// addImageListeners 函数已移动到 src/modules/ui/ImageHelper.js

// 高亮显示图片
// highlightImage 函数已移动到 src/modules/ui/ImageHelper.js

// 选择图片
// selectImage 函数已移动到 src/modules/ui/ImageHelper.js

// 监听动态添加的图片
function observeImageChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是图片
                    if (node.tagName === 'IMG') {
                        addImageListeners(node);
                    }
                    // 检查新添加的元素内部是否有图片
                    const images = node.querySelectorAll && node.querySelectorAll('img');
                    if (images) {
                        images.forEach(img => addImageListeners(img));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 下载图片
// downloadImage 函数已移动到 src/modules/DownloadManager.js
// 添加下载视觉效果
// addDownloadEffect 函数已移动到 src/modules/DownloadManager.js
// 显示通知
function showNotification(message, duration = 3000) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 自动移除通知
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// 根据文本内容查找按钮
// findButtonByText 函数已移动到 src/modules/ui/UIHelper.js

// 点击按钮并显示反馈
// clickButton 函数已移动到 src/modules/ui/UIHelper.js

// 在执行可能触发确认弹窗的操作后，尝试自动点击“确定/确认/OK”按钮
function autoConfirmModalAfterAction() {
    try {
        // 等待短时间让弹窗渲染
        const tryClick = () => {
            // 1) 优先使用提供的 XPath 精确定位
            const confirmXPath = '/html/body/div[1]/div/div[2]/div/div[2]/div/div/div[3]/p/button[2]/span';
            try {
                const node = document.evaluate(confirmXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (node) {
                    const button = node.closest('button') || node.parentElement;
                    if (button) {
                        button.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }
            } catch (e) {
                // 忽略 XPath 执行错误，继续尝试其它方式
            }

            // 常见弹窗容器选择器（尽量宽松，避免依赖具体站点UI库）
            const modalSelectors = [
                '.modal', '.ant-modal', '.ant-modal-root', '.ant-modal-confirm', '.dialog', '.el-message-box', '.el-dialog', '[role="dialog"]', '.q-dialog', '.t-dialog'
            ];
            const confirmTextOptions = ['确定', '确认', 'OK', 'Ok', 'ok', 'Yes'];
            const primaryButtonSelectors = [
                'button.ant-btn-primary', 'button.el-button--primary', 'button.primary', 'button[type="submit"]', '.btn-primary', '.primary'
            ];

            // 先在可能的弹窗内找“确定/确认/OK”按钮
            for (const modalSel of modalSelectors) {
                const modal = document.querySelector(modalSel);
                if (!modal || modal.getAttribute('aria-hidden') === 'true' || modal.style.display === 'none') continue;

                // 1) 文本匹配
                const buttons = modal.querySelectorAll('button, [role="button"], .btn, .button, a');
                for (const btn of buttons) {
                    const text = (btn.textContent || btn.innerText || '').trim();
                    if (confirmTextOptions.some(t => text === t || text.toLowerCase() === t.toLowerCase())) {
                        btn.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }

                // 2) 主按钮样式选择器
                for (const sel of primaryButtonSelectors) {
                    const primaryBtn = modal.querySelector(sel);
                    if (primaryBtn) {
                        primaryBtn.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }
            }

            // 若未匹配到，尝试全局查找“确定/确认/OK”按钮（兜底）
            const globalConfirm = findButtonByText(confirmTextOptions);
            if (globalConfirm) {
                globalConfirm.click();
                showNotification('已自动确认弹窗');
                return;
            }
        };

        // 多次尝试，覆盖弹窗渲染延迟的情况
        const attempts = [120, 260, 500, 800];
        attempts.forEach(delay => setTimeout(tryClick, delay));
    } catch (e) {
        console.error('自动确认弹窗失败:', e);
    }
}

// 为按钮添加点击视觉效果
// addButtonClickEffect 函数已移动到 src/modules/ui/UIHelper.js

// 清理函数
function cleanup() {
    debugLog('执行清理函数');

    document.removeEventListener('keydown', handleKeydown);
    // 移除所有图片的事件监听器和样式
    document.querySelectorAll('img').forEach(img => {
        img.style.outline = '';
        img.style.boxShadow = '';
    });
    // 清理图片对比弹窗
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
        comparisonModal = null;
    }
    // 清理右侧工具栏 - 更新选择器以匹配当前的right值
    const toolbar = document.querySelector('div[style*="position: fixed"][style*="right: 5px"]');
    if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
    }
    
    // 备用清理方法：通过其他特征查找工具栏
    const toolbars = document.querySelectorAll('div[style*="position: fixed"][style*="transform: translateY(-50%)"][style*="width: 80px"]');
    toolbars.forEach(tb => {
        if (tb && tb.parentNode) {
            tb.parentNode.removeChild(tb);
        }
    });
    // 重置对比页面状态
    isComparisonModalOpen = false;
    // 清理调试面板
    if (debugPanel && debugPanel.parentNode) {
        debugPanel.parentNode.removeChild(debugPanel);
        debugPanel = null;
    }
    // 清理图片引用
    originalImage = null;
    originalImageLocked = false; // 重置锁定状态
    uploadedImage = null;
    shouldAutoCompare = false; // 重置自动对比标记
    
    // 取消所有待执行的对比任务
    debugLog('清理时取消待执行的对比任务', { count: pendingComparisonTimeouts.length });
    pendingComparisonTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    pendingComparisonTimeouts = [];
    
    // 清理调试日志
    debugLogs = [];

    // 清理RunningHub缓存
    debugLog('清理时清除RunningHub缓存');
    clearRunningHubCache();
}

// 初始化音效
function initializeAudio() {
    debugLog('初始化音效系统');
    try {
        // 获取扩展中音效文件的URL
        const audioUrl = chrome.runtime.getURL('notification.mp3');
        notificationAudio = new Audio(audioUrl);

        // 设置音效属性
        notificationAudio.volume = 0.6; // 设置音量为60%
        notificationAudio.preload = 'auto'; // 预加载音效

        // 测试音频文件是否存在
        notificationAudio.addEventListener('error', (e) => {
            console.warn('音效文件加载失败，可能文件不存在:', e);
            notificationAudio = null; // 清除引用
        });

        console.log('音效初始化完成:', audioUrl);
    } catch (error) {
        console.warn('音效初始化失败，音效功能将不可用:', error);
        notificationAudio = null;
    }
}

// 加载音效设置
function loadSoundSettings() {
    try {
        chrome.storage.sync.get({ soundEnabled: true }, (items) => {
            soundEnabled = items.soundEnabled;
            console.log('音效设置已加载:', soundEnabled);
        });
    } catch (error) {
        console.error('加载音效设置失败:', error);
        soundEnabled = true; // 默认开启
    }
}

// 加载F1设置
function loadF1Settings() {
    try {
        chrome.storage.sync.get({ f1Interval: 800, f1MaxRuns: 0 }, (items) => {
            f1IntervalMs = items.f1Interval;
            f1MaxRuns = items.f1MaxRuns;
            console.log('F1设置已加载:', { f1IntervalMs, f1MaxRuns });
        });
    } catch (error) {
        console.error('加载F1设置失败:', error);
        f1IntervalMs = 800; // 默认间隔
        f1MaxRuns = 0; // 默认无限制
    }
}

// 加载自动对比设置
function loadAutoCompareSettings() {
    try {
        chrome.storage.sync.get({ autoCompareEnabled: true }, (items) => {
            autoCompareEnabled = items.autoCompareEnabled;
            console.log('自动对比设置已加载:', autoCompareEnabled);
        });
    } catch (error) {
        console.error('加载自动对比设置失败:', error);
        autoCompareEnabled = true; // 默认开启
    }
}

// 播放通知音效
function playNotificationSound() {
    try {
        // 检查音效是否开启
        if (!soundEnabled) {
            console.log('音效已关闭，跳过播放');
            return;
        }
        
        if (notificationAudio) {
            // 重置音频到开始位置
            notificationAudio.currentTime = 0;
            // 播放音效
            notificationAudio.play().catch(error => {
                console.error('播放音效失败:', error);
            });
        }
    } catch (error) {
        console.error('播放音效时发生错误:', error);
    }
}

// 根据文本内容查找链接
// findLinkByText 函数已移动到 src/modules/ui/UIHelper.js

// 点击链接并显示反馈
// clickLink 函数已移动到 src/modules/ui/UIHelper.js

// 为链接添加点击视觉效果
// addLinkClickEffect 函数已移动到 src/modules/ui/UIHelper.js

// 显示图片尺寸提示框
// showImageDimensions 函数已移动到 src/modules/ui/ImageHelper.js

// 隐藏图片尺寸提示框
// hideImageDimensions 函数已移动到 src/modules/ui/ImageHelper.js

// 创建尺寸提示框元素
// createDimensionTooltip 函数已移动到 src/modules/ui/ImageHelper.js

// 更新提示框位置
// updateTooltipPosition 函数已移动到 src/modules/ui/ImageHelper.js

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

// 处理图片上传
function handleImageUpload(file, inputElement) {
    debugLog('开始处理图片上传', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hasInputElement: !!inputElement
    });
    
    // 创建FileReader读取上传的图片
    const reader = new FileReader();
    reader.onload = (e) => {
        debugLog('FileReader读取完成');
        
        uploadedImage = {
            src: e.target.result,
            name: file.name,
            size: file.size,
            type: file.type,
            element: inputElement
        };
        
        // 设置自动对比标记，表明这是用户主动上传的图片
        shouldAutoCompare = true;
        
        // 在上传图片时执行B键逻辑，重新检测原图，防止找不到原图
        debugLog('上传图片时自动重新检测原图（执行B键逻辑）');
        originalImageLocked = false;
        originalImage = null;
        recordOriginalImages();
        
        showNotification(`图片上传完成: ${file.name}`, 2000);
        
        // 更新调试面板信息
        if (debugMode && debugPanel) {
            updateDebugInfo();
        }
        
        // 等待一段时间后进行对比（给页面时间处理上传）
        debugLog('设置延迟对比任务');
        const timeoutId = setTimeout(() => {
            debugLog('延迟执行图片对比', {
                currentUrl: window.location.href.substring(0, 50) + '...',
                hasOriginal: !!originalImage,
                hasUploaded: !!uploadedImage,
                shouldAutoCompare: shouldAutoCompare
            });
            
            // 从待执行列表中移除
            const index = pendingComparisonTimeouts.indexOf(timeoutId);
            if (index > -1) {
                pendingComparisonTimeouts.splice(index, 1);
            }
            
            // 只有在应该自动对比且开关开启时才执行（即用户刚上传了图片）
            if (shouldAutoCompare && autoCompareEnabled) {
                debugLog('用户上传图片触发的自动对比');
                shouldAutoCompare = false; // 重置标记，避免重复触发
                performImageComparison();
            } else if (shouldAutoCompare && !autoCompareEnabled) {
                debugLog('跳过自动对比 - 自动对比功能已关闭');
                shouldAutoCompare = false; // 重置标记
            } else {
                debugLog('跳过自动对比 - 非用户上传触发');
            }
        }, 1000);
        
        // 记录待执行的任务
        pendingComparisonTimeouts.push(timeoutId);
        debugLog('已添加延迟对比任务', { 
            timeoutId: timeoutId,
            totalPending: pendingComparisonTimeouts.length 
        });
    };
    
    reader.onerror = (error) => {
        debugLog('FileReader读取失败', error);
        showNotification('图片读取失败', 2000);
    };
    
    debugLog('开始FileReader.readAsDataURL');
    reader.readAsDataURL(file);
}

// 记录页面原始图片 - 增强后端图片检测
function recordOriginalImages() {
    debugLog('开始记录页面原始图片');
    
    // 只保留两种获取方式：
    // 1. 精确的DOM选择器（最高优先级）
    const preciseSelectorCandidates = [
        'div[data-v-92a52416].safe-image img[data-v-92a52416][src]',
        'div.safe-image img[data-v-92a52416][src]',
        'img[data-v-92a52416][src].img',
        'img[data-v-92a52416][src]',
        'div.safe-image img[src]',
        '.image-item img[src]'
    ];
    
    // 2. COS原图选择器（只检测JPEG格式的COS图片）
    const cosImageSelectors = [
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpeg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpeg"]',
        'img[src*="/target/"][src*=".jpg"]',
        'img[src*="/target/"][src*=".jpeg"]',
        'img[src*="/target/dataset/"][src*=".jpg"]',
        'img[src*="/target/dataset/"][src*=".jpeg"]',
        'img[src*="dataset/"][src*=".jpg"]',
        'img[src*="dataset/"][src*=".jpeg"]'
    ];
    
    // 合并选择器，精确DOM选择器优先
    const selectorCandidates = [
        ...preciseSelectorCandidates,
        ...cosImageSelectors
    ];
    
    let targetImages = [];
    let usedSelector = '';
    
    // 按优先级尝试每个选择器
    for (const selector of selectorCandidates) {
        targetImages = document.querySelectorAll(selector);
        if (targetImages.length > 0) {
            usedSelector = selector;
            debugLog('使用选择器找到原图', {
                selector: selector,
                found: targetImages.length
            });
            break;
        }
    }
    
    // 如果所有特定选择器都没找到，使用更宽泛的查找
    if (targetImages.length === 0) {
        debugLog('所有特定选择器未找到图片，尝试查找所有带data-v属性的图片');
        
        // 查找所有带 data-v- 开头属性的JPEG图片
        const allImages = document.querySelectorAll('img[src]');
        const dataVImages = Array.from(allImages).filter(img => {
            const hasDataV = Array.from(img.attributes).some(attr => 
                attr.name.startsWith('data-v-')
            );
            const isJpeg = isJpegImage(img.src);
            return hasDataV && isJpeg;
        });
        
        debugLog('找到带data-v属性的JPEG图片', dataVImages.length);
        targetImages = dataVImages;
        usedSelector = '带data-v属性的JPEG图片';
        
        if (targetImages.length === 0) {
            debugLog('仍未找到，使用所有JPEG图片作为备选');
            const jpegImages = Array.from(allImages).filter(img => isJpegImage(img.src));
            targetImages = jpegImages;
            usedSelector = '所有JPEG图片';
            debugLog('找到JPEG图片数量', jpegImages.length);
        }
    }
    
    debugLog('最终图片候选数量', {
        count: targetImages.length,
        selector: usedSelector
    });
    
    if (targetImages.length === 0) {
        debugLog('页面中无符合条件的图片元素');
        // 延迟重试，可能图片还在动态加载
        setTimeout(() => {
            debugLog('延迟重试检测原图');
            recordOriginalImages();
        }, 2000);
        return;
    }
    
    // 详细检查每个候选图片
    Array.from(targetImages).forEach((img, index) => {
        const parentDiv = img.closest('div[data-v-92a52416], div.safe-image, div.image-item');
        debugLog(`检查候选图片 #${index}`, {
            src: img.src ? img.src.substring(0, 100) + '...' : '无src',
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            width: img.width,
            height: img.height,
            complete: img.complete,
            className: img.className,
            id: img.id || '无ID',
            dataset: Object.keys(img.dataset).map(key => `${key}=${img.dataset[key]}`).join(', ') || '无data属性',
            hasDataV92a52416: img.hasAttribute('data-v-92a52416'),
            parentDivClasses: parentDiv ? parentDiv.className : '无父容器',
            parentDivDataAttrs: parentDiv ? Object.keys(parentDiv.dataset).join(', ') : '无父容器data属性'
        });
    });
    
    let mainImage = null;
    
    // 方法1：优先选择最精确选择器找到的已加载JPEG图片
    const exactSelector = 'div[data-v-92a52416].safe-image img[data-v-92a52416][src]';
    const exactImages = document.querySelectorAll(exactSelector);
    if (exactImages.length > 0) {
        mainImage = Array.from(exactImages).find(img => {
            const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            const isJpeg = isJpegImage(img.src);
            if (isLoaded && isJpeg) {
                debugLog('找到精确选择器且已加载的JPEG原图', {
                    src: img.src.substring(0, 50) + '...',
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    selector: exactSelector
                });
            }
            return isLoaded && isJpeg;
        });
        
        // 如果没有已加载的JPEG，选择第一个JPEG
        if (!mainImage) {
            mainImage = Array.from(exactImages).find(img => isJpegImage(img.src));
            if (mainImage) {
                debugLog('选择精确选择器的第一个JPEG图片（可能未完全加载）', {
                    src: mainImage.src ? mainImage.src.substring(0, 50) + '...' : '无src',
                    complete: mainImage.complete
                });
            } else {
                debugLog('精确选择器未找到JPEG格式图片');
            }
        }
    }
    
    // 方法2：如果精确选择器没找到，从候选图片中选择（只选择JPEG格式）
    if (!mainImage && targetImages.length > 0) {
        // 优先选择已加载且在safe-image容器中的JPEG图片
        mainImage = Array.from(targetImages).find(img => {
            const isInSafeImage = img.closest('.safe-image') !== null;
            const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            const isJpeg = isJpegImage(img.src);
            return isInSafeImage && isLoaded && isJpeg;
        });
        
        if (mainImage) {
            debugLog('找到safe-image容器中的已加载JPEG图片');
        } else {
            // 选择第一个已加载的JPEG图片
            mainImage = Array.from(targetImages).find(img => {
                const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
                const isJpeg = isJpegImage(img.src);
                return isLoaded && isJpeg;
            });
            
            if (mainImage) {
                debugLog('找到已加载的候选JPEG图片');
            } else {
                // 选择第一个JPEG候选图片
                mainImage = Array.from(targetImages).find(img => isJpegImage(img.src));
                if (mainImage) {
                    debugLog('选择第一个JPEG候选图片（可能未加载）');
                } else {
                    debugLog('未找到任何JPEG格式的候选图片');
                }
            }
        }
    }
    
    if (mainImage) {
        debugLog('最终选定的原图', {
            src: mainImage.src ? mainImage.src.substring(0, 100) + '...' : '无src',
            complete: mainImage.complete,
            naturalWidth: mainImage.naturalWidth,
            naturalHeight: mainImage.naturalHeight,
            hasDataV: mainImage.hasAttribute('data-v-92a52416'),
            className: mainImage.className,
            parentContainer: mainImage.closest('.safe-image, .image-item') ? '在安全图片容器中' : '不在特定容器中',
            usedSelector: usedSelector
        });
        
        // 如果图片还没完全加载，等待加载完成
        if (!mainImage.complete || mainImage.naturalWidth === 0) {
            debugLog('选中的原图还没完全加载，等待加载完成');
            
            const handleLoad = () => {
                debugLog('原图加载完成，记录原图信息');
                recordImageAsOriginal(mainImage);
                mainImage.removeEventListener('load', handleLoad);
            };
            
            const handleError = () => {
                debugLog('原图加载失败，尝试记录当前状态');
                recordImageAsOriginal(mainImage);
                mainImage.removeEventListener('error', handleError);
            };
            
            mainImage.addEventListener('load', handleLoad);
            mainImage.addEventListener('error', handleError);
            
            // 也立即记录当前状态，以防万一
            recordImageAsOriginal(mainImage);
        } else {
            recordImageAsOriginal(mainImage);
        }
    } else {
        debugLog('未找到任何可用的原图');
        
        // 延迟重试，可能图片还在动态加载
        setTimeout(() => {
            debugLog('延迟3秒后重试检测原图');
            recordOriginalImages();
        }, 3000);
    }
}

// 检查图片是否为JPEG格式
function isJpegImage(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 检查文件扩展名
    const hasJpegExt = /\.(jpe?g)(\?|$)/i.test(url);
    
    // 检查URL中是否包含JPEG关键词
    const hasJpegKeyword = lowerUrl.includes('jpeg') || lowerUrl.includes('jpg');
    
    const result = hasJpegExt || hasJpegKeyword;
    
    if (!result) {
        debugLog('非JPEG格式图片', {
            url: url.substring(0, 100) + '...',
            hasJpegExt,
            hasJpegKeyword
        });
    }
    
    return result;
}

// 从URL中提取文件名
// extractFileNameFromUrl 函数已移动到 src/modules/DownloadManager.js
/**
 * 原有严格版本：仅允许 JPEG
 */
function recordImageAsOriginal(img) {
    // 如果原图已经被锁定，不允许在同一页面内更改
    if (originalImageLocked && originalImage) {
        debugLog('原图已在当前页面锁定，跳过更新', {
            existingOriginal: originalImage.src.substring(0, 50) + '...',
            attemptedNew: img.src ? img.src.substring(0, 50) + '...' : '无src',
            currentPage: currentPageUrl.substring(0, 50) + '...'
        });
        return;
    }
    
    // 验证图片格式：只接受JPEG格式的原图
    if (!img.src || !isJpegImage(img.src)) {
        debugLog('跳过非JPEG格式的图片', {
            src: img.src ? img.src.substring(0, 100) + '...' : '无src',
            reason: '不是JPEG格式'
        });
        return;
    }

    setOriginalImageCommon(img);
}

/**
 * 宽松版本：允许常见位图格式（用于 D 键下载后“标记为原图”的需求）
 */
function recordImageAsOriginalFlexible(img) {
    // 如果原图已经被锁定，不允许在同一页面内更改
    if (originalImageLocked && originalImage) {
        debugLog('原图已在当前页面锁定（宽松模式跳过）');
        return;
    }

    if (!img || !img.src) {
        debugLog('宽松模式：无有效图片可标记为原图');
        return;
    }
    const url = img.src.toLowerCase();
    const isRaster =
        /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|#|$)/i.test(url) ||
        url.startsWith('data:image/') ||
        url.startsWith('blob:');

    if (!isRaster) {
        debugLog('宽松模式：非位图格式，跳过标记', url.substring(0, 100) + '...');
        return;
    }

    setOriginalImageCommon(img);
}

/**
 * 设置 originalImage 的公共实现
 */
function setOriginalImageCommon(img) {
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;

    originalImage = {
        src: img.src,
        width: width,
        height: height,
        name: extractFileNameFromUrl(img.src),
        element: img
    };

    // 锁定原图，防止在当前页面内被覆盖
    originalImageLocked = true;

    debugLog('成功记录原图并锁定到当前页面（通用）', {
        src: originalImage.src.substring(0, 50) + '...',
        width: originalImage.width,
        height: originalImage.height,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        locked: originalImageLocked,
        currentPage: currentPageUrl.substring(0, 50) + '...'
    });

    console.log('记录原图:', originalImage.src);
    showNotification(`已锁定原图: ${width}×${height}`, 2000);
}

// 强化的网络请求拦截和原图资源捕获系统

function observeNetworkUploads() {
    debugLog('启动强化的网络请求拦截系统');
    
    // 拦截 fetch 请求
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const request = args[0];
        const url = typeof request === 'string' ? request : request.url;
        
        debugLog('拦截到fetch请求', { url: url.substring(0, 100) + '...' });
        
        return originalFetch.apply(this, args).then(response => {
            handleNetworkResponse(url, response, 'fetch');
            return response;
        }).catch(error => {
            debugLog('fetch请求错误', { url: url.substring(0, 50) + '...', error: error.message });
            throw error;
        });
    };
    
    // 拦截 XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._interceptedUrl = url;
        this._interceptedMethod = method;
        debugLog('拦截到XMLHttpRequest.open', { 
            method, 
            url: url ? url.substring(0, 100) + '...' : 'unknown' 
        });
        
        return originalXHROpen.call(this, method, url, async, user, password);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        const url = xhr._interceptedUrl;
        const method = xhr._interceptedMethod;
        
        // 监听加载完成事件
        xhr.addEventListener('load', function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                handleNetworkResponse(url, xhr, 'xhr');
            }
        });
        
        debugLog('拦截到XMLHttpRequest.send', { 
            method, 
            url: url ? url.substring(0, 100) + '...' : 'unknown',
            hasData: !!data
        });
        
        return originalXHRSend.call(this, data);
    };
    
    // 新增：拦截Image对象的src设置
    interceptImageObjectCreation();
    
    // 新增：监听资源加载事件
    observeResourceLoading();
    
    // 新增：从浏览器缓存获取图片
    // getCachedImages(); // 函数未定义，暂时注释掉

    // 新增：启动竞速模式原图获取
    startParallelImageAcquisition();
}

// 处理网络响应，捕获图片资源 - 增强后端检测
function handleNetworkResponse(url, response, type) {
    if (!url) return;
    
    // 更全面的图片请求检测
    const isImageByUrl = isImageUrl(url);
    const isImageByHeaders = hasImageHeaders(response);
    const isImageBySize = response && response.size && response.size > 1024; // 至少1KB
    
    // 检查响应状态
    const isSuccessResponse = !response.status || 
                             (response.status >= 200 && response.status < 300);
    
    // 后端API图片特征检测
    const lowerUrl = url.toLowerCase();
    const isPotentialBackendImage = (
        lowerUrl.includes('/api/') ||
        lowerUrl.includes('/upload/') ||
        lowerUrl.includes('/media/') ||
        lowerUrl.includes('/file/') ||
        lowerUrl.includes('/attachment/') ||
        lowerUrl.includes('/resource/')
    ) && isSuccessResponse;
    
    const isImageRequest = isImageByUrl || isImageByHeaders || 
                          (isPotentialBackendImage && isImageBySize);
    
    if (isImageRequest) {
        debugLog('检测到图片请求', { 
            url: url.substring(0, 100) + '...',
            type: type,
            status: response.status || 'unknown',
            detectionMethod: {
                byUrl: isImageByUrl,
                byHeaders: isImageByHeaders,
                byBackendPattern: isPotentialBackendImage,
                bySize: isImageBySize
            }
        });
        
        // 检查是否是服务器返回的修改图
        const isServerModifiedImage = isServerModifiedImageUrl(url);
        
        // 存储图片请求信息
        const imageInfo = {
            url: url,
            timestamp: Date.now(),
            type: type,
            response: response,
            isOriginalCandidate: isOriginalImageCandidate(url),
            isServerModifiedImage: isServerModifiedImage
        };

        capturedImageRequests.set(url, imageInfo);

        // COS原图优先处理
        const isCOSOriginal = isCOSOriginalImage(url);
        
        // 如果这可能是原图，尝试使用它
        if ((imageInfo.isOriginalCandidate || isCOSOriginal) && (!originalImage || !originalImageLocked)) {
            debugLog('发现原图候选网络请求', {
                url: url.substring(0, 100) + '...',
                isCOSOriginal,
                isGeneralCandidate: imageInfo.isOriginalCandidate
            });
            
            // 已移除：返修模式专用日志
            // if (isRevisionMode) { ... }
            
            processNetworkOriginalImage(imageInfo);
        }
        
        // 检查是否是上传相关的请求
        if (url.includes('upload') || url.includes('image')) {
            debugLog('检测到可能的图片上传请求');
            setTimeout(() => {
                checkForNewImages();
            }, 2000);
        }
    }
}

// 判断URL是否是图片 - 增强后端检测
function isImageUrl(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 图片文件扩展名（只支持JPEG格式的原图）
    const imageExtensions = ['.jpg', '.jpeg'];
    const hasImageExt = imageExtensions.some(ext => lowerUrl.includes(ext));
    
    // 后端API图片路径关键词
    const backendImagePaths = [
        '/api/image', '/api/upload', '/api/file', '/api/media',
        '/upload/image', '/media/image', '/file/image',
        '/attachment/', '/resource/image', '/assets/image',
        '/static/image', '/public/image', '/storage/image'
    ];
    
    // 图片相关关键词（只保留JPEG相关）
    const imageKeywords = [
        'image', 'img', 'picture', 'photo', 'pic', 'jpeg', 'jpg',
        'upload', 'media', 'attachment', 'file'
    ];
    
    // Content-Type检查（对于动态生成的图片URL）
    const mightBeImageApi = /\/(image|img|picture|photo|media|upload|file)[\/\?]/.test(lowerUrl);
    
    // 检查是否有后端图片路径
    const hasBackendImagePath = backendImagePaths.some(path => lowerUrl.includes(path));
    
    // 检查是否包含图片关键词
    const hasImageKeyword = imageKeywords.some(keyword => lowerUrl.includes(keyword));
    
    // 检查是否是Base64图片
    const isBase64Image = lowerUrl.startsWith('data:image/');
    
    // 检查是否是Blob URL
    const isBlobUrl = lowerUrl.startsWith('blob:');
    
    const result = hasImageExt || 
                   hasBackendImagePath || 
                   mightBeImageApi || 
                   hasImageKeyword || 
                   isBase64Image || 
                   isBlobUrl;
    
    if (result && !hasImageExt) {
        debugLog('检测到非扩展名图片URL', {
            url: url.substring(0, 100) + '...',
            hasBackendImagePath,
            mightBeImageApi,
            hasImageKeyword,
            isBase64Image,
            isBlobUrl
        });
    }
    
    return result;
}

// 检查响应头是否表明这是图片 - 增强后端响应检测
function hasImageHeaders(response) {
    try {
        if (!response) return false;
        
        let contentType = '';
        let contentDisposition = '';
        
        // 处理不同类型的响应对象
        if (response.headers && typeof response.headers.get === 'function') {
            // Fetch Response对象
            contentType = response.headers.get('content-type') || '';
            contentDisposition = response.headers.get('content-disposition') || '';
        } else if (response.getResponseHeader) {
            // XMLHttpRequest对象
            contentType = response.getResponseHeader('content-type') || '';
            contentDisposition = response.getResponseHeader('content-disposition') || '';
        } else if (typeof response === 'object' && response.status) {
            // 自定义响应对象
            contentType = response.contentType || '';
        }
        
        const lowerContentType = contentType.toLowerCase();
        const lowerDisposition = contentDisposition.toLowerCase();
        
        // 检查Content-Type
        const hasImageContentType = lowerContentType.startsWith('image/') ||
                                   lowerContentType.includes('jpeg');
        
        // 检查Content-Disposition中的文件名（只支持JPEG格式）
        const hasImageFilename = /\.(jpe?g)[";\s]/i.test(lowerDisposition);
        
        // 检查是否是二进制内容
        const isBinaryContent = lowerContentType.includes('application/octet-stream') ||
                               lowerContentType.includes('binary');
        
        const result = hasImageContentType || hasImageFilename || 
                      (isBinaryContent && lowerDisposition.includes('image'));
        
        if (result) {
            debugLog('检测到图片响应头', {
                contentType: contentType.substring(0, 50),
                contentDisposition: contentDisposition.substring(0, 50),
                hasImageContentType,
                hasImageFilename,
                isBinaryContent
            });
        }
        
        return result;
        
    } catch (error) {
        debugLog('检查响应头失败', error.message);
        return false;
    }
}

// 判断是否是原图候选 - 增强后端链接检测
// 判断是否是服务器返回的修改图 - 增强后端检测
function isServerModifiedImageUrl(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // COS域名修改图特征
    const hasModifiedImageName = lowerUrl.includes('%e5%89%af%e6%9c%ac.jpg') || // URL编码的'副本.jpg'
                                lowerUrl.includes('副本.jpg') || 
                                lowerUrl.includes('copy.jpg') ||
                                lowerUrl.includes('_copy.') ||
                                lowerUrl.includes('_modified.') ||
                                lowerUrl.includes('_edit.');
    
    const isFromCOSDomain = lowerUrl.includes('cos.ap-guangzhou.myqcloud.com');
    const hasTaskDetailPath = lowerUrl.includes('attachment/task-detail');
    
    // 通用后端修改图特征
    const backendModifiedIndicators = [
        '/modified/', '/edited/', '/processed/', '/converted/',
        '/thumbnail/', '/resized/', '/compressed/', '/optimized/',
        'modified_', 'edited_', 'processed_', 'converted_',
        'thumb_', 'small_', 'medium_', 'compressed_'
    ];
    
    // API路径中的修改图指示器
    const apiModifiedPaths = [
        '/api/image/modify', '/api/image/edit', '/api/image/process',
        '/api/media/transform', '/api/file/convert', '/api/upload/process'
    ];
    
    // 查询参数中的修改指示器
    const modifyParams = [
        'action=modify', 'action=edit', 'action=process',
        'type=modified', 'type=processed', 'mode=edit',
        'transform=', 'resize=', 'compress=', 'optimize='
    ];
    
    // 检查通用后端修改图特征
    const hasBackendModifiedPath = backendModifiedIndicators.some(indicator => 
        lowerUrl.includes(indicator)
    );
    
    const hasApiModifiedPath = apiModifiedPaths.some(path => 
        lowerUrl.includes(path)
    );
    
    const hasModifyParams = modifyParams.some(param => 
        lowerUrl.includes(param)
    );
    
    // COS特定检测
    const isCOSServerModified = hasModifiedImageName && isFromCOSDomain && hasTaskDetailPath;
    
    // 通用后端修改图检测
    const isGeneralServerModified = hasBackendModifiedPath || hasApiModifiedPath || hasModifyParams;
    
    const isServerModified = isCOSServerModified || isGeneralServerModified;
    
    if (isServerModified) {
        debugLog('识别到服务器修改图URL特征', {
            url: url.substring(0, 100) + '...',
            isCOSServerModified,
            isGeneralServerModified,
            hasBackendModifiedPath,
            hasApiModifiedPath,
            hasModifyParams,
            // COS特定
            hasModifiedImageName,
            isFromCOSDomain,
            hasTaskDetailPath
        });
    }
    
    return isServerModified;
}

// 处理从网络请求中获取的原图
async function processNetworkOriginalImage(imageInfo) {
    try {
        debugLog('处理网络原图候选', {
            url: imageInfo.url.substring(0, 50) + '...',
            timestamp: imageInfo.timestamp
        });
        
        // 创建Image对象来获取实际尺寸
        const img = new Image();
        
        img.onload = () => {
            debugLog('网络原图加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                url: imageInfo.url.substring(0, 50) + '...'
            });
            
            // 已移除：返修模式专用日志
            // if (isRevisionMode) { ... }
            
            // 如果这个图片比当前原图更合适，更新原图
            if (!originalImage || 
                (!originalImageLocked && 
                 img.naturalWidth * img.naturalHeight > 
                 (originalImage.width || 0) * (originalImage.height || 0))) {
                
                originalImageFromNetwork = {
                    src: imageInfo.url,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    name: extractFileNameFromUrl(imageInfo.url),
                    element: img,
                    fromNetwork: true,
                    captureTime: imageInfo.timestamp
                };
                
                // 更新全局原图引用
                originalImage = originalImageFromNetwork;
                originalImageLocked = true;
                
                debugLog('通过网络请求更新了原图', {
                    src: originalImage.src.substring(0, 50) + '...',
                    width: originalImage.width,
                    height: originalImage.height,
                    fromNetwork: true
                });
                
                // 已移除：返修模式专用日志
                // if (isRevisionMode) { ... }
                
                showNotification(`从网络请求获取原图: ${originalImage.width}×${originalImage.height}`, 2000);
            }
        };
        
        img.onerror = () => {
            debugLog('网络原图加载失败', imageInfo.url.substring(0, 50) + '...');
        };
        
        // 设置跨域属性并加载图片
        img.crossOrigin = 'anonymous';
        img.src = imageInfo.url;
        
    } catch (error) {
        debugLog('处理网络原图时出错', error.message);
    }
}

// 处理服务器返回的修改图
async function processServerModifiedImage(imageInfo) {
    try {
        debugLog('处理服务器修改图', {
            url: imageInfo.url.substring(0, 50) + '...',
            timestamp: imageInfo.timestamp,
            // 已移除：模式相关日志
        });
        
        // 已移除：返修模式专用日志和处理逻辑
        // revisionLog('检测到服务器修改图网络请求', { ... });
        // if (!isRevisionMode) { ... }
        
        // 创建Image对象来获取实际尺寸
        const img = new Image();
        
        img.onload = () => {
            debugLog('服务器修改图加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                url: imageInfo.url.substring(0, 50) + '...'
            });
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
            
            // 存储服务器修改图信息
            serverReturnedModifiedImage = {
                src: imageInfo.url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(imageInfo.url),
                element: img,
                fromServer: true,
                captureTime: imageInfo.timestamp
            };
            
            debugLog('已存储服务器修改图', {
                src: serverReturnedModifiedImage.src.substring(0, 50) + '...',
                width: serverReturnedModifiedImage.width,
                height: serverReturnedModifiedImage.height,
                fromServer: true
            });
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
            
            showNotification(`检测到服务器修改图: ${serverReturnedModifiedImage.width}×${serverReturnedModifiedImage.height}`, 2000);
            
            // 在调试面板中显示信息
            if (debugMode && debugPanel) {
                updateDebugInfo();
            }
        };
        
        img.onerror = () => {
            debugLog('服务器修改图加载失败', imageInfo.url.substring(0, 50) + '...');
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
        };
        
        // 设置跨域属性并加载图片
        img.crossOrigin = 'anonymous';
        img.src = imageInfo.url;
        
    } catch (error) {
        debugLog('处理服务器修改图时出错', error.message);
    }
}

// 拦截Image对象的创建和src设置
function interceptImageObjectCreation() {
    debugLog('启动Image对象拦截');
    
    // 拦截Image构造函数
    const originalImage = window.Image;
    window.Image = function(...args) {
        const img = new originalImage(...args);
        
        // 重写src属性的setter
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                                     Object.getOwnPropertyDescriptor(img, 'src') ||
                                     { set: function(value) { this.setAttribute('src', value); }, configurable: true };
        
        if (originalSrcDescriptor.configurable !== false) {
            Object.defineProperty(img, 'src', {
                get: originalSrcDescriptor.get,
                set: function(value) {
                    debugLog('拦截到Image.src设置', value ? value.substring(0, 100) + '...' : 'empty');
                    
                    // 如果这可能是原图，记录它
                    if (value && isOriginalImageCandidate(value)) {
                        const imageInfo = {
                            url: value,
                            timestamp: Date.now(),
                            type: 'image-object',
                            isOriginalCandidate: true
                        };
                        capturedImageRequests.set(value, imageInfo);
                        
                        if (!originalImage || !originalImageLocked) {
                            processNetworkOriginalImage(imageInfo);
                        }
                    }
                    
                    return originalSrcDescriptor.set.call(this, value);
                },
                configurable: true
            });
        }
        
        return img;
    };
    
    // 保持原始构造函数的属性
    Object.setPrototypeOf(window.Image, originalImage);
    Object.setPrototypeOf(window.Image.prototype, originalImage.prototype);
}

// 监听资源加载事件
function observeResourceLoading() {
    debugLog('启动资源加载监听');
    
    // 监听所有资源的加载事件
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.initiatorType === 'img' || entry.name.match(/\.(jpg|jpeg)(\?|$)/i)) {
                debugLog('性能API检测到图片资源', {
                    name: entry.name.substring(0, 100) + '...',
                    size: entry.transferSize,
                    duration: entry.duration
                });
                
                // 如果这是原图候选，处理它
                if (isOriginalImageCandidate(entry.name)) {
                    const imageInfo = {
                        url: entry.name,
                        timestamp: Date.now(),
                        type: 'performance-api',
                        size: entry.transferSize,
                        isOriginalCandidate: true
                    };
                    
                    capturedImageRequests.set(entry.name, imageInfo);
                    
                    if (!originalImage || !originalImageLocked) {
                        processNetworkOriginalImage(imageInfo);
                    }
                }
            }
        }
    });
    
    try {
        observer.observe({ entryTypes: ['resource'] });
        debugLog('性能API资源监听已启动');
    } catch (error) {
        debugLog('性能API不可用', error.message);
    }
    
    // 监听网络面板的请求（如果可能）
    if (window.chrome && window.chrome.devtools) {
        debugLog('尝试启动开发者工具网络监听');
        // 注意：这在普通页面中不可用，只在devtools扩展中可用
    }
}

// 检查页面是否有新图片
function checkForNewImages() {
    const currentImages = document.querySelectorAll('img');
    const newImages = Array.from(currentImages).filter(img => {
        return !img._recorded && img.naturalWidth > 100 && img.naturalHeight > 100;
    });
    
    if (newImages.length > 0) {
        console.log('发现新图片:', newImages.length, '张');
        newImages.forEach(img => {
            img._recorded = true;
            // 注意：不在这里自动触发对比，对比只应该在用户上传图片时触发
            debugLog('标记新图片为已记录', {
                src: img.src ? img.src.substring(0, 50) + '...' : '无src',
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        });
    }
}

// 执行图片对比
function performImageComparison(newImage = null) {
    debugLog('开始执行图片对比', {
        hasOriginalImage: !!originalImage,
        hasUploadedImage: !!uploadedImage,
        hasNewImage: !!newImage,
        originalImageLocked: originalImageLocked,
        shouldAutoCompare: shouldAutoCompare,
        // 已移除：模式相关状态
        hasServerReturnedModifiedImage: !!serverReturnedModifiedImage
    });
    
    // 已移除：返修模式专用日志
    // 已移除：revisionLog调用
    
    // 如果没有原图，先尝试快速检测一次
    if (!originalImage) {
        debugLog('对比时未找到原图，尝试快速重新检测');
        recordOriginalImages();
        
        // 如果快速检测失败，提示用户按B键
        if (!originalImage) {
            debugLog('快速检测失败');
            showNotification('未找到原图，请按B键重新检测后再试', 3000);
            return;
        }
    }
    
    // 根据当前模式确定修改图来源
    let modifiedImage = null;
    let imageSource = '';
    
    if (uploadedImage) {
        // 优先使用用户上传的图片
        modifiedImage = uploadedImage;
        imageSource = '用户上传';
        debugLog('使用用户上传的修改图');
        
        // 已移除：返修模式专用日志
        // 已移除：revisionLog调用
    // 已移除：返修模式服务器修改图处理逻辑
    // } else if (isRevisionMode && serverReturnedModifiedImage) { ... }
    } else {
        // 没有可用的修改图
        debugLog('图片对比失败 - 缺少修改图', { 
            originalImage: originalImage ? '有' : '无', 
            uploadedImage: uploadedImage ? '有' : '无'
        });
        
        showNotification('请先上传图片再进行对比', 2000);
        return;
    }
    
    debugLog('图片对比条件满足，创建对比界面', {
        originalSrc: originalImage.src ? originalImage.src.substring(0, 50) + '...' : '无src',
        modifiedSrc: modifiedImage.src ? modifiedImage.src.substring(0, 50) + '...' : '无src',
        imageSource: imageSource,
        // 已移除：模式相关状态
    });
    
    // 已移除：返修模式专用日志
    // 已移除：revisionLog调用
    
    showNotification(`正在对比图片... (${imageSource})`, 1500);
    
    // 验证参数并创建对比界面
    debugLog('准备创建对比界面', {
        originalImage: originalImage ? {
            src: originalImage.src ? originalImage.src.substring(0, 50) + '...' : '无src',
            width: originalImage.width,
            height: originalImage.height,
            name: originalImage.name
        } : '无originalImage',
        modifiedImage: modifiedImage ? {
            src: modifiedImage.src ? modifiedImage.src.substring(0, 50) + '...' : '无src',
            width: modifiedImage.width,
            height: modifiedImage.height,
            name: modifiedImage.name
        } : '无modifiedImage'
    });
    
    if (!originalImage) {
        debugLog('原图为空，无法创建对比界面');
        showNotification('❌ 原图不可用，无法进行对比', 3000);
        return;
    }
    
    if (!modifiedImage) {
        debugLog('修改图为空，无法创建对比界面');
        showNotification('❌ 修改图不可用，无法进行对比', 3000);
        return;
    }
    
    // 创建对比界面
    createComparisonModal(originalImage, modifiedImage, newImage);
}

// 创建图片对比弹窗
function createComparisonModal(original, uploaded, newImage) {
    // 移除已存在的对比弹窗
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
    }
    
    // 创建弹窗容器
    comparisonModal = document.createElement('div');
    comparisonModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(5px);
    `;
    
    // 创建顶部工具栏（移动到右侧）
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        position: fixed;
        top: 50%;
        right: 5px;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 16px 12px;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(15px);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        z-index: 1000000;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        max-height: 85vh;
        overflow-y: auto;
        width: 80px;
        box-sizing: border-box;
    `;
    
    // 创建标题
    const title = document.createElement('div');
    title.textContent = '对比';
    title.style.cssText = `
        margin: 0;
        color: rgba(255, 255, 255, 0.95);
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
        line-height: 1.2;
        letter-spacing: 1px;
        padding: 8px 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        width: 100%;
        box-sizing: border-box;
    `;
    
    // 创建对比模式切换按钮组
    const modeButtons = document.createElement('div');
    modeButtons.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
        width: 100%;
        padding: 8px 0;
    `;
    
    // 当前对比模式
    let currentMode = 'side-by-side';
    
    // 创建模式按钮
    const createModeButton = (mode, text, icon) => {
        const button = document.createElement('button');
        
        // 创建按钮内容容器
        const buttonContent = document.createElement('div');
        buttonContent.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        `;
        
        const iconElement = document.createElement('div');
        iconElement.textContent = icon;
        iconElement.style.cssText = `
            font-size: 16px;
            line-height: 1;
        `;
        
        const textElement = document.createElement('div');
        textElement.textContent = text;
        textElement.style.cssText = `
            font-size: 9px;
            line-height: 1;
            font-weight: 500;
            white-space: nowrap;
        `;
        
        buttonContent.appendChild(iconElement);
        buttonContent.appendChild(textElement);
        button.appendChild(buttonContent);
        
        button.style.cssText = `
            padding: 8px 6px;
            background: ${mode === currentMode ? 'rgba(33, 150, 243, 0.9)' : 'rgba(255, 255, 255, 0.15)'};
            color: white;
            border: 1px solid ${mode === currentMode ? 'rgba(33, 150, 243, 0.6)' : 'rgba(255, 255, 255, 0.25)'};
            border-radius: 12px;
            cursor: pointer;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            width: 100%;
            box-sizing: border-box;
            min-height: 50px;
        `;
        
        button.addEventListener('mouseenter', () => {
            if (mode !== currentMode) {
                button.style.background = 'rgba(255, 255, 255, 0.25)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                button.style.transform = 'scale(1.02)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (mode !== currentMode) {
                button.style.background = 'rgba(255, 255, 255, 0.15)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                button.style.transform = 'scale(1)';
            }
        });
        
        button.addEventListener('click', () => {
            currentMode = mode;
            updateModeButtons();
            switchComparisonMode(mode);
        });
        
        return button;
    };
    
    const sideBySideBtn = createModeButton('side-by-side', '并排对比', '📊');
    const sliderBtn = createModeButton('slider', '滑动对比', '🔄');
    const blinkBtn = createModeButton('blink', '闪烁对比', '⚡');
    
    const updateModeButtons = () => {
        [sideBySideBtn, sliderBtn, blinkBtn].forEach(btn => {
            const textContent = btn.querySelector('div:last-child').textContent;
            const mode = textContent.includes('并排') ? 'side-by-side' : 
                        textContent.includes('滑动') ? 'slider' : 'blink';
            
            if (mode === currentMode) {
                btn.style.background = 'rgba(33, 150, 243, 0.9)';
                btn.style.borderColor = 'rgba(33, 150, 243, 0.6)';
                btn.style.transform = 'scale(1)';
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.15)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                btn.style.transform = 'scale(1)';
            }
        });
    };
    
    // 创建尺寸信息显示区域
    const dimensionsDisplay = document.createElement('div');
    dimensionsDisplay.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 8px 6px;
        margin: 8px 0;
        color: rgba(255, 255, 255, 0.9);
        font-size: 9px;
        line-height: 1.2;
        text-align: center;
        width: 100%;
        box-sizing: border-box;
    `;
    
    // 获取并设置尺寸信息
    const updateToolbarDimensions = () => {
        const origDimensions = (original && original.width && original.height) 
            ? `${original.width}×${original.height}` 
            : '加载中';
        const upDimensions = (uploaded && uploaded.width && uploaded.height) 
            ? `${uploaded.width}×${uploaded.height}` 
            : '加载中';
        
        // 判断尺寸关系
        let sizeStatus = '';
        if (original && uploaded && original.width && original.height && uploaded.width && uploaded.height) {
            if (original.width === uploaded.width && original.height === uploaded.height) {
                sizeStatus = '🟢';
            } else if (uploaded.width * uploaded.height > original.width * original.height) {
                sizeStatus = '🔴';
            } else {
                sizeStatus = '🟡';
            }
        }
        
        dimensionsDisplay.innerHTML = `
            <div style="margin-bottom: 2px;">📎 ${origDimensions}</div>
            <div style="margin-bottom: 2px;">🔄 ${upDimensions}</div>
            <div style="font-size: 8px; opacity: 0.8;">${sizeStatus}</div>
        `;
    };
    
    updateToolbarDimensions();
    
    // 创建关闭按钮
    const closeButton = document.createElement('button');
    
    const closeContent = document.createElement('div');
    closeContent.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    `;
    
    const closeIcon = document.createElement('div');
    closeIcon.textContent = '✖️';
    closeIcon.style.cssText = `
        font-size: 14px;
        line-height: 1;
    `;
    
    const closeText = document.createElement('div');
    closeText.textContent = '关闭';
    closeText.style.cssText = `
        font-size: 9px;
        line-height: 1;
        font-weight: 500;
    `;
    
    closeContent.appendChild(closeIcon);
    closeContent.appendChild(closeText);
    closeButton.appendChild(closeContent);
    
    closeButton.style.cssText = `
        padding: 8px 6px;
        background: rgba(244, 67, 54, 0.85);
        color: white;
        border: 1px solid rgba(244, 67, 54, 0.6);
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        width: 100%;
        box-sizing: border-box;
        margin-top: 8px;
        min-height: 45px;
    `;
    
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = 'rgba(244, 67, 54, 1)';
        closeButton.style.borderColor = 'rgba(244, 67, 54, 0.8)';
        closeButton.style.transform = 'scale(1.05)';
        closeButton.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.4)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = 'rgba(244, 67, 54, 0.85)';
        closeButton.style.borderColor = 'rgba(244, 67, 54, 0.6)';
        closeButton.style.transform = 'scale(1)';
        closeButton.style.boxShadow = 'none';
    });
    
    closeButton.addEventListener('click', () => {
        closeComparisonModal();
    });
    
    // 组装工具栏（纵向排列）
    toolbar.appendChild(title);
    toolbar.appendChild(modeButtons);
    toolbar.appendChild(dimensionsDisplay);
    toolbar.appendChild(closeButton);
    
    modeButtons.appendChild(sideBySideBtn);
    modeButtons.appendChild(sliderBtn);
    modeButtons.appendChild(blinkBtn);
    
    // 创建主要对比区域容器
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        overflow: hidden;
        width: 100%;
        height: 100%;
    `;
    
    // 创建图片对比区域
    const comparisonArea = document.createElement('div');
    comparisonArea.id = 'comparison-area';
    comparisonArea.style.cssText = `
        position: relative;
        width: calc(100% - 95px);
        height: 100%;
        max-width: 1400px;
        max-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        overflow: hidden;
        margin-right: 5px;
    `;
    
    // 验证参数并创建图片区域
    debugLog('创建对比弹窗参数验证', {
        original: original ? {
            src: original.src ? original.src.substring(0, 50) + '...' : '无src',
            width: original.width,
            height: original.height,
            name: original.name
        } : '无original',
        uploaded: uploaded ? {
            src: uploaded.src ? uploaded.src.substring(0, 50) + '...' : '无src',
            width: uploaded.width,
            height: uploaded.height,
            name: uploaded.name
        } : '无uploaded'
    });
    
    // 创建简化的图片元素
    const createSimpleImage = (src, alt) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        return img;
    };
    
    // 创建原图和对比图
    const originalImg = createSimpleImage(original ? original.src : '', '原图');
    const uploadedImg = createSimpleImage(uploaded ? uploaded.src : '', '对比图');
    
    // 模式切换函数
    const switchComparisonMode = (mode) => {
        // 清空对比区域
        comparisonArea.innerHTML = '';
        
        if (mode === 'side-by-side') {
            // 并排对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                padding: 15px;
                margin-right: 5px;
            `;
            
            const leftContainer = document.createElement('div');
            leftContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                height: 100%;
            `;
            
            const rightContainer = document.createElement('div');
            rightContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                height: 100%;
            `;
            
            const leftLabel = document.createElement('div');
            leftLabel.style.cssText = `
                color: white;
                font-size: 14px;
                margin-bottom: 10px;
                font-weight: 500;
                text-align: center;
                line-height: 1.3;
            `;
            
            const rightLabel = document.createElement('div');
            rightLabel.style.cssText = `
                color: white;
                font-size: 14px;
                margin-bottom: 10px;
                font-weight: 500;
                text-align: center;
                line-height: 1.3;
            `;
            
            // 获取图片尺寸并设置标签内容
            const getImageDimensions = (img, imageInfo, defaultName) => {
                if (imageInfo && imageInfo.width && imageInfo.height) {
                    return `${defaultName}\n${imageInfo.width} × ${imageInfo.height}px`;
                } else if (img && img.complete && img.naturalWidth > 0) {
                    return `${defaultName}\n${img.naturalWidth} × ${img.naturalHeight}px`;
                } else {
                    return `${defaultName}\n加载中...`;
                }
            };
            
            // 设置标签内容，包含尺寸信息
            leftLabel.innerHTML = getImageDimensions(originalImg, original, '原图').replace('\n', '<br>');
            rightLabel.innerHTML = getImageDimensions(uploadedImg, uploaded, '对比图').replace('\n', '<br>');
            
            // 克隆图片并添加加载事件监听器以更新尺寸信息
            const originalImgClone = originalImg.cloneNode();
            const uploadedImgClone = uploadedImg.cloneNode();
            
            // 为原图添加加载完成事件
            originalImgClone.addEventListener('load', () => {
                if (originalImgClone.naturalWidth > 0 && originalImgClone.naturalHeight > 0) {
                    leftLabel.innerHTML = `原图<br>${originalImgClone.naturalWidth} × ${originalImgClone.naturalHeight}px`;
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            // 为对比图添加加载完成事件
            uploadedImgClone.addEventListener('load', () => {
                if (uploadedImgClone.naturalWidth > 0 && uploadedImgClone.naturalHeight > 0) {
                    rightLabel.innerHTML = `对比图<br>${uploadedImgClone.naturalWidth} × ${uploadedImgClone.naturalHeight}px`;
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            leftContainer.appendChild(leftLabel);
            leftContainer.appendChild(originalImgClone);
            rightContainer.appendChild(rightLabel);
            rightContainer.appendChild(uploadedImgClone);
            
            // 将右侧容器添加到左侧位置，左侧容器添加到右侧位置
            comparisonArea.appendChild(rightContainer);
            comparisonArea.appendChild(leftContainer);
            
        } else if (mode === 'slider') {
            // 滑动对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                overflow: hidden;
                margin-right: 5px;
            `;
            
            const sliderContainer = document.createElement('div');
            sliderContainer.style.cssText = `
                position: relative;
                width: 90%;
                height: 90%;
                overflow: hidden;
                border-radius: 8px;
            `;
            
            // 创建尺寸信息显示区域
            const dimensionsInfo = document.createElement('div');
            dimensionsInfo.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 15;
                line-height: 1.3;
                backdrop-filter: blur(5px);
            `;
            
            // 获取并显示尺寸信息
            const updateDimensionsInfo = () => {
                const origDimensions = (original && original.width && original.height) 
                    ? `${original.width} × ${original.height}px` 
                    : '加载中...';
                const upDimensions = (uploaded && uploaded.width && uploaded.height) 
                    ? `${uploaded.width} × ${uploaded.height}px` 
                    : '加载中...';
                
                dimensionsInfo.innerHTML = `
                    <div>📎 原图: ${origDimensions}</div>
                    <div>🔄 对比: ${upDimensions}</div>
                `;
            };
            
            updateDimensionsInfo();
            
            const baseImg = originalImg.cloneNode();
            baseImg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: contain;
            `;
            
            // 为原图添加加载事件监听器
            baseImg.addEventListener('load', () => {
                if (baseImg.naturalWidth > 0 && baseImg.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            const overlayImg = uploadedImg.cloneNode();
            overlayImg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: contain;
                clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
            `;
            
            // 为对比图添加加载事件监听器
            overlayImg.addEventListener('load', () => {
                if (overlayImg.naturalWidth > 0 && overlayImg.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            const slider = document.createElement('div');
            slider.style.cssText = `
                position: absolute;
                top: 0;
                left: 50%;
                width: 4px;
                height: 100%;
                background: #2196F3;
                cursor: ew-resize;
                z-index: 10;
                transform: translateX(-50%);
                box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
            `;
            
            const sliderHandle = document.createElement('div');
            sliderHandle.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                background: #2196F3;
                border: 2px solid white;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                cursor: ew-resize;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            `;
            
            slider.appendChild(sliderHandle);
            
            let isDragging = false;
            
            const updateSlider = (x) => {
                const rect = sliderContainer.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
                slider.style.left = percentage + '%';
                overlayImg.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
            };
            
            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateSlider(e.clientX);
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            sliderContainer.appendChild(baseImg);
            sliderContainer.appendChild(overlayImg);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(dimensionsInfo);
            comparisonArea.appendChild(sliderContainer);
            
        } else if (mode === 'blink') {
            // 闪烁对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                margin-right: 5px;
            `;
            
            const blinkContainer = document.createElement('div');
            blinkContainer.style.cssText = `
                position: relative;
                width: 90%;
                height: 90%;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            
            // 创建尺寸信息显示区域
            const dimensionsInfo = document.createElement('div');
            dimensionsInfo.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 15;
                line-height: 1.3;
                backdrop-filter: blur(5px);
            `;
            
            // 获取并显示尺寸信息
            const updateDimensionsInfo = () => {
                const origDimensions = (original && original.width && original.height) 
                    ? `${original.width} × ${original.height}px` 
                    : '加载中...';
                const upDimensions = (uploaded && uploaded.width && uploaded.height) 
                    ? `${uploaded.width} × ${uploaded.height}px` 
                    : '加载中...';
                
                dimensionsInfo.innerHTML = `
                    <div>📎 原图: ${origDimensions}</div>
                    <div>🔄 对比: ${upDimensions}</div>
                `;
            };
            
            updateDimensionsInfo();
            
            const img1 = originalImg.cloneNode();
            const img2 = uploadedImg.cloneNode();
            
            img1.style.cssText = `
                position: absolute;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                transition: opacity 0.1s ease;
            `;
            
            img2.style.cssText = `
                position: absolute;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                opacity: 0;
                transition: opacity 0.1s ease;
            `;
            
            // 为图片添加加载事件监听器
            img1.addEventListener('load', () => {
                if (img1.naturalWidth > 0 && img1.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            img2.addEventListener('load', () => {
                if (img2.naturalWidth > 0 && img2.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            let isShowingSecond = false;
            const blinkInterval = setInterval(() => {
                if (isShowingSecond) {
                    img1.style.opacity = '1';
                    img2.style.opacity = '0';
                } else {
                    img1.style.opacity = '0';
                    img2.style.opacity = '1';
                }
                isShowingSecond = !isShowingSecond;
            }, 800);
            
            // 保存interval以便清理
            comparisonArea.blinkInterval = blinkInterval;
            
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                top: 20px;
                left: 20px;
                color: white;
                background: rgba(0, 0, 0, 0.7);
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                z-index: 10;
            `;
            indicator.textContent = '自动切换中...';
            
            blinkContainer.appendChild(img1);
            blinkContainer.appendChild(img2);
            blinkContainer.appendChild(indicator);
            blinkContainer.appendChild(dimensionsInfo);
            comparisonArea.appendChild(blinkContainer);
        }
    };
    
    // 初始化为并排对比模式
    switchComparisonMode('side-by-side');
    
    // 创建底部区域容器
    const footerArea = document.createElement('div');
    footerArea.style.cssText = `
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 15px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 8px;
        padding: 20px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    `;
    
    // 创建操作提示
    const hintText = document.createElement('div');
    hintText.innerHTML = `
        <span style="color: #666; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #e3f2fd; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #1976d2;">ESC</span>
            快速关闭
            <span style="color: #ddd; margin: 0 5px;">|</span>
            <span style="background: #f3e5f5; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #7b1fa2;">点击背景</span>
            关闭对话框
        </span>
    `;
    
    // 创建美化的关闭按钮
    const footerCloseButton = document.createElement('button');
    footerCloseButton.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">✖️</span>
            关闭对比
        </span>
    `;
    footerCloseButton.style.cssText = `
        padding: 12px 25px;
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        position: relative;
        overflow: hidden;
    `;
    
    // 按钮悬停效果
    footerCloseButton.addEventListener('mouseenter', () => {
        footerCloseButton.style.transform = 'translateY(-2px)';
        footerCloseButton.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
        footerCloseButton.style.background = 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)';
    });
    
    footerCloseButton.addEventListener('mouseleave', () => {
        footerCloseButton.style.transform = 'translateY(0)';
        footerCloseButton.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
        footerCloseButton.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
    });
    
    // 按钮点击效果
    footerCloseButton.addEventListener('mousedown', () => {
        footerCloseButton.style.transform = 'translateY(1px) scale(0.98)';
    });
    
    footerCloseButton.addEventListener('mouseup', () => {
        footerCloseButton.style.transform = 'translateY(-2px) scale(1)';
    });
    
    footerCloseButton.addEventListener('click', () => {
        closeComparisonModal();
    });
    
    // 添加模式切换按钮事件监听器
    // 按钮已在上面创建，直接获取引用
    
    const updateActiveButton = (activeBtn) => {
        [sideBySideBtn, sliderBtn, blinkBtn].forEach(btn => {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = 'rgba(255, 255, 255, 0.8)';
        });
        activeBtn.style.background = '#2196F3';
        activeBtn.style.color = 'white';
    };
    
    sideBySideBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('side-by-side');
        updateActiveButton(sideBySideBtn);
    });
    
    sliderBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('slider');
        updateActiveButton(sliderBtn);
    });
    
    blinkBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('blink');
        updateActiveButton(blinkBtn);
    });
    
    // 设置初始活动按钮
    updateActiveButton(sideBySideBtn);
    
    // 组装弹窗（不包含工具栏和底部提示）
    mainContainer.appendChild(comparisonArea);
    comparisonModal.appendChild(mainContainer);
    
    // 将工具栏添加到页面（独立定位）
    document.body.appendChild(toolbar);
    
    // 点击背景关闭
    comparisonModal.addEventListener('click', (e) => {
        if (e.target === comparisonModal) {
            closeComparisonModal();
        }
    });
    
    // 添加ESC键关闭功能
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && comparisonModal && comparisonModal.parentNode) {
            closeComparisonModal();
        }
    };
    // 保存到全局，方便清理
    window.currentHandleEscKey = handleEscKey;
    document.addEventListener('keydown', handleEscKey);
    
    // 添加到页面
    document.body.appendChild(comparisonModal);
    
    // 更新对比页面状态
    isComparisonModalOpen = true;
    debugLog('对比弹窗已打开，状态已更新');
    
    showNotification('图片对比界面已打开', 2000);
}

// 创建单个图片显示区域
function createImageArea(title, src, imageInfo) {
    debugLog('创建图片显示区域', {
        title: title,
        src: src ? src.substring(0, 50) + '...' : '无src',
        imageInfo: imageInfo ? {
            width: imageInfo.width,
            height: imageInfo.height,
            name: imageInfo.name
        } : '无imageInfo'
    });
    
    const area = document.createElement('div');
    area.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: transparent;
        padding: 10px;
    `;
    
    const titleElement = document.createElement('div');
    titleElement.textContent = title;
    titleElement.style.cssText = `
        color: white;
        font-size: 14px;
        margin-bottom: 10px;
        font-weight: 500;
        text-align: center;
    `;
    
    const img = document.createElement('img');
    
    // 添加错误处理
    img.onerror = function() {
        debugLog('图片加载失败', {
            src: src ? src.substring(0, 50) + '...' : '无src',
            title: title
        });
        
        // 显示错误信息
        const errorInfo = document.createElement('div');
        errorInfo.style.cssText = `
            color: #d32f2f;
            font-weight: bold;
            padding: 20px;
            background: #ffebee;
            border: 1px solid #ffcdd2;
            border-radius: 4px;
            margin: 10px 0;
        `;
        errorInfo.innerHTML = '❌ 图片加载失败<br/>请检查图片链接是否有效';
        
        // 替换图片元素
        img.style.display = 'none';
        area.appendChild(errorInfo);
    };
    
    // 设置图片源
    if (src) {
        img.src = src;
    } else {
        debugLog('图片源为空', { title: title });
        img.style.display = 'none';
        const noImageInfo = document.createElement('div');
        noImageInfo.style.cssText = `
            color: #f57c00;
            font-weight: bold;
            padding: 20px;
            background: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: 4px;
            margin: 10px 0;
        `;
        noImageInfo.innerHTML = '⚠️ 无图片源<br/>无法显示图片';
        area.appendChild(noImageInfo);
    }
    
    img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    const info = document.createElement('div');
    info.style.cssText = `
        margin-top: 10px;
        font-size: 12px;
        color: #666;
        font-family: Arial, sans-serif;
    `;
    
    // 显示图片信息（仅保留文件名和尺寸）
    let dimensions = '未知';
    let fileName = '未知';
    
    // 安全地获取图片信息
    if (imageInfo) {
        if (imageInfo.width && imageInfo.height) {
            dimensions = `${imageInfo.width} × ${imageInfo.height}px`;
        }
        if (imageInfo.name) {
            fileName = imageInfo.name;
        }
    }
    
    // 对于上传的图片，需要等待图片加载完成后获取真实尺寸
    if (src && src.startsWith('data:')) {
        // 这是base64图片（上传的图片），需要等待加载
        img.onload = () => {
            const realDimensions = `${img.naturalWidth} × ${img.naturalHeight}px`;
            const displayFileName = fileName !== '未知' ? fileName : '上传图片';
            
            info.innerHTML = `
                <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: ${realDimensions}</div>
                <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
            `;
        };
        
        // 初始显示
        const displayFileName = fileName !== '未知' ? fileName : '上传图片';
        info.innerHTML = `
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: 加载中...</div>
            <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
        `;
    } else {
        // 原图或其他图片，使用已有的尺寸信息
        const displayFileName = fileName !== '未知' ? fileName : '原图';
        
        info.innerHTML = `
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: ${dimensions}</div>
            <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
        `;
    }
    
    area.appendChild(titleElement);
    area.appendChild(img);
    area.appendChild(info);
    
    return area;
}

// 创建对比信息区域
function createComparisonInfo(original, uploaded) {
    const infoArea = document.createElement('div');
    infoArea.style.cssText = `
        background: #f0f7ff;
        border: 1px solid #b3d9ff;
        border-radius: 6px;
        padding: 15px;
        margin-top: 15px;
    `;
    
    const title = document.createElement('h4');
    title.textContent = '对比分析';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #1976d2;
        font-family: Arial, sans-serif;
    `;
    
    const details = document.createElement('div');
    details.style.cssText = `
        font-size: 13px;
        color: #555;
        line-height: 1.6;
        font-family: Arial, sans-serif;
    `;
    
    // 分析对比结果
    let comparison = '';
    
    if (original.width && original.height && uploaded.src) {
        // 通过创建临时图片获取上传图片尺寸
        const tempImg = new Image();
        tempImg.onload = () => {
            const widthDiff = tempImg.width - original.width;
            const heightDiff = tempImg.height - original.height;
            const widthRatio = ((tempImg.width / original.width) * 100).toFixed(1);
            const heightRatio = ((tempImg.height / original.height) * 100).toFixed(1);
            const aspectRatioOrig = (original.width / original.height).toFixed(3);
            const aspectRatioUploaded = (tempImg.width / tempImg.height).toFixed(3);
            
            // Calculate compression efficiency
            const origPixels = original.width * original.height;
            const uploadedPixels = tempImg.width * tempImg.height;
            const pixelRatio = ((uploadedPixels / origPixels) * 100).toFixed(1);
            
            const sizeStatus = widthDiff === 0 && heightDiff === 0 ? 
                '🟢 尺寸完全一致' : 
                widthDiff > 0 || heightDiff > 0 ? '🔴 大于原图' : '🟡 小于原图';
            
            comparison = `
                <div style="background: #f8f9ff; padding: 15px; border-radius: 6px;">
                    <h5 style="margin: 0 0 12px 0; color: #1976d2;">📊 尺寸对比分析</h5>
                    <div style="margin-bottom: 8px;"><strong>原图:</strong> ${original.width} × ${original.height}px</div>
                    <div style="margin-bottom: 8px;"><strong>上传图:</strong> ${tempImg.width} × ${tempImg.height}px</div>
                    <div style="margin-bottom: 8px;"><strong>尺寸差异:</strong> ${widthDiff > 0 ? '+' : ''}${widthDiff}px × ${heightDiff > 0 ? '+' : ''}${heightDiff}px</div>
                    <div style="margin-bottom: 12px;"><strong>缩放比例:</strong> ${widthRatio}% × ${heightRatio}%</div>
                    
                    <div style="background: ${widthDiff === 0 && heightDiff === 0 ? '#e8f5e8' : '#fff3e0'}; padding: 12px; border-radius: 6px; border-left: 4px solid ${widthDiff === 0 && heightDiff === 0 ? '#4caf50' : '#ff9800'};">
                        <div style="font-weight: bold; margin-bottom: 5px;">${sizeStatus}</div>
                        ${widthDiff === 0 && heightDiff === 0 ? 
                            '<div style="color: #2e7d32;">完美匹配！图片尺寸完全一致。</div>' :
                            `<div style="color: #f57c00;">检测到尺寸差异。建议将图片${widthDiff > 0 || heightDiff > 0 ? '缩小' : '放大'}以匹配原图。</div>`
                        }
                    </div>
                </div>
            `;
            
            details.innerHTML = comparison;
        };
        tempImg.src = uploaded.src;
    } else {
        details.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <div style="font-size: 18px; margin-bottom: 10px;">⏳</div>
                <div>正在分析图片信息...</div>
            </div>
        `;
    }
    
    infoArea.appendChild(title);
    infoArea.appendChild(details);
    
    return infoArea;
}

// ============== 调试功能 ==============

// 调试日志函数 - 支持新模块化架构
function debugLog(message, data = null) {
    // 使用新的 Logger 模块（如果可用）
    if (window.AuxisLogger) {
        window.AuxisLogger.debug(message, data);
    }

    // 保持原有的调试面板功能
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        time: timestamp,
        message: message,
        data: data
    };

    debugLogs.push(logEntry);

    // 限制日志数量
    if (debugLogs.length > 100) {
        debugLogs.shift();
    }

    // 输出到控制台（如果新模块不可用，保持原有格式）
    if (!window.AuxisLogger) {
        console.log(`[调试 ${timestamp}] ${message}`, data || '');
    }

    // 更新调试面板
    if (debugPanel && debugMode) {
        updateDebugPanel();
    }
}

// 初始化调试面板
function initializeDebugPanel() {
    debugLog('初始化调试面板');
    
    // 创建调试面板
    debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 350px;
        height: 200px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        z-index: 1000000;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 10px;
        overflow-y: auto;
        display: ${debugMode ? 'block' : 'none'};
    `;
    
    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
        color: #ffff00;
        font-weight: bold;
        margin-bottom: 8px;
        border-bottom: 1px solid #333;
        padding-bottom: 4px;
    `;
    header.textContent = '🔍 图片对比调试面板 [Z键切换]';
    
    // 创建日志区域
    const logArea = document.createElement('div');
    logArea.id = 'debug-log-area';
    logArea.style.cssText = `
        height: calc(100% - 30px);
        overflow-y: auto;
        line-height: 1.3;
    `;
    
    debugPanel.appendChild(header);
    debugPanel.appendChild(logArea);
    document.body.appendChild(debugPanel);
    
    // 添加状态信息
    debugLog('页面URL', window.location.href);
    debugLog('页面图片数量', document.querySelectorAll('img').length);
    debugLog('文件输入数量', document.querySelectorAll('input[type="file"]').length);
}

// 更新调试面板
function updateDebugPanel() {
    if (!debugPanel) return;
    
    const logArea = debugPanel.querySelector('#debug-log-area');
    if (!logArea) return;
    
    // 显示最新的20条日志
    const recentLogs = debugLogs.slice(-20);
    logArea.innerHTML = recentLogs.map(log => {
        const dataStr = log.data ? ` | ${JSON.stringify(log.data).substring(0, 50)}...` : '';
        return `<div style="margin-bottom: 2px;">
            <span style="color: #888;">[${log.time}]</span> 
            <span style="color: #00ff00;">${log.message}</span>
            <span style="color: #888; font-size: 10px;">${dataStr}</span>
        </div>`;
    }).join('');
    
    // 自动滚动到底部
    logArea.scrollTop = logArea.scrollHeight;
    
    // 更新调试信息
    updateDebugInfo();
}

// 更新调试信息显示
function updateDebugInfo() {
    if (!debugPanel || !debugMode) return;
    
    let infoArea = debugPanel.querySelector('#debug-info-area');
    if (!infoArea) {
        infoArea = document.createElement('div');
        infoArea.id = 'debug-info-area';
        infoArea.style.cssText = `
            background: rgba(20, 20, 20, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 8px;
            margin: 8px 0;
            font-size: 10px;
            line-height: 1.4;
        `;
        
        // 插入到日志区域之前
        const logArea = debugPanel.querySelector('#debug-log-area');
        debugPanel.insertBefore(infoArea, logArea);
    }
    
    // 构建调试信息
    let infoHtml = '<div style="color: #ffff00; font-weight: bold; margin-bottom: 4px;">📊 图片状态信息</div>';
    
    // 原图信息
    if (originalImage) {
        infoHtml += `<div style="color: #4ade80;">✓ 原图: ${originalImage.src ? originalImage.src.substring(0, 50) + '...' : '已检测'}</div>`;
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 原图: 未检测到</div>';
    }
    
    // 用户上传图片信息
    if (uploadedImage) {
        infoHtml += `<div style="color: #4ade80;">✓ 用户上传图: ${uploadedImage.name || '已上传'}</div>`;
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 用户上传图: 无</div>';
    }
    
    // 已移除：返修模式专用信息区域
    // if (isRevisionMode) { ... }
    
    // 对比状态
    const canCompare = originalImage && uploadedImage;
    if (canCompare) {
        infoHtml += '<div style="color: #4ade80;">✓ 对比状态: 可进行对比</div>';
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 对比状态: 条件不满足</div>';
    }
    
    infoArea.innerHTML = infoHtml;
}

// 切换调试模式
function toggleDebugMode() {
    debugMode = !debugMode;
    
    if (debugMode) {
        if (!debugPanel) {
            initializeDebugPanel();
        } else {
            debugPanel.style.display = 'block';
        }
        debugLog('调试模式已开启');
        showNotification('调试模式已开启 (Z键切换)', 2000);
    } else {
        if (debugPanel) {
            debugPanel.style.display = 'none';
        }
        console.log('调试模式已关闭');
        showNotification('调试模式已关闭 (Z键切换)', 2000);
    }
}

// 增强的图片上传监听和对比功能（带调试）
function initializeUploadMonitoring() {
    debugLog('开始初始化图片上传监听功能');
    
    try {
        // 监听文件输入元素的变化
        observeFileInputs();
        debugLog('文件输入监听已启动');
        
        // 监听网络请求中的图片上传
        observeNetworkUploads();
        debugLog('网络上传监听已启动');
        
        // 记录当前页面的原图
        recordOriginalImages();
        debugLog('原图记录完成');
        
        // 添加额外的上传检测方法
        addAlternativeUploadDetection();
        debugLog('替代上传检测已启动');
        
    } catch (error) {
        debugLog('初始化上传监听时发生错误', error.message);
        console.error('初始化上传监听失败:', error);
    }
}

// 增强的文件输入监听（带调试）
function observeFileInputs() {
    debugLog('开始监听文件输入元素');
    
    // 查找所有现有的文件输入元素
    const fileInputs = document.querySelectorAll('input[type="file"]');
    debugLog('发现文件输入元素', fileInputs.length);
    
    fileInputs.forEach((input, index) => {
        debugLog(`为文件输入元素 #${index} 添加监听器`, {
            id: input.id,
            name: input.name,
            accept: input.accept
        });
        addUploadListener(input);
    });
    
    // 使用 MutationObserver 监听动态添加的文件输入元素
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是文件输入
                    if (node.tagName === 'INPUT' && node.type === 'file') {
                        debugLog('发现新的文件输入元素', node);
                        addUploadListener(node);
                    }
                    // 检查新添加的元素内部是否有文件输入
                    const inputs = node.querySelectorAll && node.querySelectorAll('input[type="file"]');
                    if (inputs && inputs.length > 0) {
                        debugLog('在新元素中发现文件输入', inputs.length);
                        inputs.forEach(input => addUploadListener(input));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    debugLog('文件输入动态监听已启动');
}

// 增强的上传监听器（带调试）
function addUploadListener(input) {
    if (input._uploadListenerAdded) {
        debugLog('跳过重复添加监听器', input);
        return;
    }
    input._uploadListenerAdded = true;
    
    debugLog('为输入元素添加监听器', {
        tagName: input.tagName,
        type: input.type,
        id: input.id || '无ID',
        className: input.className || '无class',
        accept: input.accept || '无accept属性',
        multiple: input.multiple,
        name: input.name || '无name'
    });
    
    // 监听多个事件来捕获文件变化
    const events = ['change', 'input', 'blur'];
    
    events.forEach(eventType => {
        input.addEventListener(eventType, (event) => {
            debugLog(`检测到文件输入${eventType}事件`, {
                eventType: event.type,
                target: event.target,
                timeStamp: event.timeStamp
            });
            
            // 多种方式获取文件信息
            const files = event.target.files;
            const value = event.target.value;
            
            debugLog(`${eventType}事件的文件信息`, {
                'files对象': files,
                'files.length': files ? files.length : '无files属性',
                'input.value': value,
                'input.files': input.files,
                'input.files.length': input.files ? input.files.length : '无files属性'
            });
            
            // 如果files为空但value有值，尝试延迟获取
            if ((!files || files.length === 0) && value) {
                debugLog('files为空但value有值，尝试延迟获取', value);
                
                // 延迟多次尝试获取文件
                const delays = [0, 100, 300, 500, 1000];
                delays.forEach(delay => {
                    setTimeout(() => {
                        const retryFiles = input.files;
                        debugLog(`延迟${delay}ms后重新检查files`, {
                            'files.length': retryFiles ? retryFiles.length : '无files',
                            'input.value': input.value
                        });
                        
                        if (retryFiles && retryFiles.length > 0) {
                            debugLog(`延迟${delay}ms后成功获取到文件`);
                            handleFilesFound(retryFiles, input);
                        }
                    }, delay);
                });
            } else if (files && files.length > 0) {
                debugLog('直接获取到文件');
                handleFilesFound(files, input);
            } else {
                debugLog(`${eventType}事件：无文件数据`, {
                    hasFiles: !!files,
                    filesLength: files ? files.length : 'N/A',
                    hasValue: !!value,
                    valueContent: value ? value.substring(0, 100) : 'N/A'
                });
            }
        });
    });
    
    // 还可以监听其他事件
    input.addEventListener('focus', () => {
        debugLog('文件输入获得焦点');
    });
    
    input.addEventListener('click', () => {
        debugLog('文件输入被点击');
        
        // 在点击后也尝试获取现有文件
        setTimeout(() => {
            const currentFiles = input.files;
            debugLog('点击后检查现有文件', {
                'files.length': currentFiles ? currentFiles.length : '无files'
            });
        }, 100);
    });
    
    // 监听鼠标和键盘事件
    input.addEventListener('mouseup', () => {
        setTimeout(() => {
            debugLog('鼠标释放后检查文件', {
                'files.length': input.files ? input.files.length : '无files',
                'value': input.value
            });
        }, 50);
    });
    
    // 定期检查这个input是否有文件
    const checkInterval = setInterval(() => {
        if (input.files && input.files.length > 0) {
            debugLog('定期检查发现文件', {
                'files.length': input.files.length,
                timestamp: Date.now()
            });
            handleFilesFound(input.files, input);
            clearInterval(checkInterval);
        }
    }, 1000);
    
    // 5秒后停止定期检查
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 5000);
}

// 处理找到的文件
function handleFilesFound(files, input) {
    debugLog('开始处理找到的文件', {
        fileCount: files.length,
        files: Array.from(files).map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            lastModified: f.lastModified
        }))
    });
    
    if (files && files.length > 0) {
        const file = files[0];
        debugLog('处理第一个文件', {
            name: file.name,
            type: file.type,
            size: file.size,
            isImage: file.type.startsWith('image/')
        });
        
        if (file.type.startsWith('image/')) {
            debugLog('确认为图片文件，开始处理上传');
            handleImageUpload(file, input);
        } else {
            debugLog('非图片文件，跳过处理', file.type);
        }
    } else {
        debugLog('files数组为空或未定义');
    }
}

// 添加替代的上传检测方法
function addAlternativeUploadDetection() {
    debugLog('启动替代上传检测方法');
    
    // 方法1: 监听所有表单提交
    document.addEventListener('submit', (event) => {
        debugLog('检测到表单提交', event.target);
        const formData = new FormData(event.target);
        let hasImages = false;
        
        for (let [key, value] of formData.entries()) {
            if (value instanceof File && value.type.startsWith('image/')) {
                debugLog('表单中发现图片文件', { key, file: value.name });
                hasImages = true;
            }
        }
        
        if (hasImages) {
            debugLog('表单包含图片，延迟检查新图片');
            setTimeout(() => checkForNewImages(), 1000);
        }
    });
    
    // 方法2: 监听拖拽上传
    document.addEventListener('drop', (event) => {
        debugLog('检测到文件拖拽', event);
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (files && files.length > 0) {
            for (let file of files) {
                if (file.type.startsWith('image/')) {
                    debugLog('拖拽文件为图片', file.name);
                    handleImageUpload(file, null);
                    break;
                }
            }
        }
    });
    
    // 方法3: 定时检查页面图片变化
    setInterval(() => {
        const currentImageCount = document.querySelectorAll('img').length;
        if (currentImageCount !== (window._lastImageCount || 0)) {
            debugLog('图片数量发生变化', {
                before: window._lastImageCount || 0,
                after: currentImageCount
            });
            window._lastImageCount = currentImageCount;
            checkForNewImages();
        }
    }, 2000);
    
    // 方法4: 监听常见的第三方上传组件
    const commonUploadSelectors = [
        '.upload-area', '.upload-zone', '.file-upload', '.upload-container',
        '[class*="upload"]', '[class*="file"]', '[id*="upload"]', '[id*="file"]',
        'input[accept*="image"]', 'button[onclick*="upload"]', 'button[onclick*="file"]'
    ];
    
    commonUploadSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            debugLog(`发现可能的上传相关元素: ${selector}`, elements.length);
            elements.forEach((element, index) => {
                debugLog(`上传元素 #${index}`, {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    onclick: element.onclick ? element.onclick.toString().substring(0, 100) : '无'
                });
                
                // 为这些元素添加监听器
                element.addEventListener('click', () => {
                    debugLog(`上传相关元素被点击: ${selector}`);
                    setTimeout(() => {
                        // 检查是否有新的文件输入出现
                        const newInputs = document.querySelectorAll('input[type="file"]');
                        debugLog('点击后检查文件输入数量', newInputs.length);
                        newInputs.forEach(input => {
                            if (!input._uploadListenerAdded) {
                                addUploadListener(input);
                            }
                        });
                    }, 500);
                });
            });
        }
    });
    
    // 方法5: 监听DOM变化，特别关注新增的隐藏文件输入
    const uploadObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查隐藏的文件输入
                    const hiddenInputs = node.querySelectorAll ? node.querySelectorAll('input[type="file"][style*="display:none"], input[type="file"][style*="visibility:hidden"]') : [];
                    if (hiddenInputs.length > 0) {
                        debugLog('发现隐藏的文件输入', hiddenInputs.length);
                        hiddenInputs.forEach(input => addUploadListener(input));
                    }
                }
            });
        });
    });
    
    uploadObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    // 方法6: 检测可能的上传按钮文本
    const uploadButtonTexts = ['上传', '选择文件', '选择图片', 'upload', 'choose', 'select', '浏览', 'browse'];
    uploadButtonTexts.forEach(text => {
        const buttons = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => 
            el.textContent.toLowerCase().includes(text.toLowerCase())
        );
        if (buttons.length > 0) {
            debugLog(`发现可能的上传按钮 (${text})`, buttons.length);
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    debugLog(`可能的上传按钮被点击: ${text}`);
                    // 延迟检查文件输入变化
                    setTimeout(() => {
                        checkForFileInputChanges();
                    }, 300);
                });
            });
        }
    });
    
    // 方法7: 拦截XMLHttpRequest上传
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        debugLog('拦截到XMLHttpRequest', {
            url: this.responseURL || 'unknown',
            data: data ? (data.toString().substring(0, 100) + '...') : 'no data'
        });
        
        if (data instanceof FormData) {
            debugLog('检测到FormData上传');
            // 检查FormData中是否有文件
            try {
                for (let [key, value] of data.entries()) {
                    if (value instanceof File) {
                        debugLog('XMLHttpRequest中发现文件', {
                            key: key,
                            fileName: value.name,
                            fileType: value.type,
                            fileSize: value.size
                        });
                        
                        if (value.type.startsWith('image/')) {
                            debugLog('XMLHttpRequest上传的是图片文件');
                            handleImageUpload(value, null);
                        }
                    }
                }
            } catch (error) {
                debugLog('解析FormData时出错', error.message);
            }
        }
        
        return originalXHRSend.call(this, data);
    };
}

// 检查文件输入变化
function checkForFileInputChanges() {
    debugLog('检查文件输入变化');
    
    const allInputs = document.querySelectorAll('input[type="file"]');
    debugLog('当前文件输入总数', allInputs.length);
    
    allInputs.forEach((input, index) => {
        debugLog(`文件输入 #${index} 状态`, {
            hasFiles: input.files && input.files.length > 0,
            filesCount: input.files ? input.files.length : 0,
            value: input.value,
            id: input.id,
            name: input.name,
            style: input.style.cssText
        });
        
        if (input.files && input.files.length > 0) {
            debugLog(`文件输入 #${index} 有文件，开始处理`);
            handleFilesFound(input.files, input);
        }
    });
}

// 添加图片加载监听器
function addImageLoadListeners() {
    debugLog('添加图片加载监听器');
    
    // 为所有现有图片添加加载监听器
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
        debugLog(`为图片 #${index} 添加加载监听器`, {
            src: img.src ? img.src.substring(0, 50) + '...' : '无src',
            complete: img.complete
        });
        
        if (!img.complete) {
            img.addEventListener('load', () => {
                debugLog(`图片 #${index} 加载完成，检查是否需要更新原图`, {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
                
                // 如果还没有原图，或者原图未锁定且这个图片更大，考虑更新原图
                if (!originalImage || (!originalImageLocked && 
                    img.naturalWidth * img.naturalHeight > 
                    originalImage.width * originalImage.height
                )) {
                    debugLog('发现更合适的原图，更新原图记录');
                    recordImageAsOriginal(img);
                }
            });
            
            img.addEventListener('error', () => {
                debugLog(`图片 #${index} 加载失败`);
            });
        } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            // 图片已经加载完成，检查是否需要更新原图
            if (!originalImage || (!originalImageLocked && 
                img.naturalWidth * img.naturalHeight > 
                (originalImage.width || 0) * (originalImage.height || 0)
            )) {
                debugLog(`发现已加载的更合适图片 #${index}，更新原图记录`);
                recordImageAsOriginal(img);
            }
        }
    });
    
    // 监听新添加的图片
    const imageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'IMG') {
                        debugLog('检测到新添加的图片元素');
                        addSingleImageLoadListener(node);
                    }
                    
                    const newImages = node.querySelectorAll && node.querySelectorAll('img');
                    if (newImages && newImages.length > 0) {
                        debugLog('在新元素中发现图片', newImages.length);
                        newImages.forEach(img => addSingleImageLoadListener(img));
                    }
                }
            });
        });
    });
    
    imageObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 为单个图片添加加载监听器
function addSingleImageLoadListener(img) {
    debugLog('为新图片添加加载监听器', {
        src: img.src ? img.src.substring(0, 50) + '...' : '无src',
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
    });
    
    if (!img.complete && img.src) {
        img.addEventListener('load', () => {
            debugLog('新图片加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
            });
            
            // 检查是否需要更新原图
            if (!originalImage || (!originalImageLocked && 
                img.naturalWidth * img.naturalHeight > 
                originalImage.width * originalImage.height
            )) {
                debugLog('新图片更合适作为原图，更新记录');
                recordImageAsOriginal(img);
            }
        });
        
        img.addEventListener('error', () => {
            debugLog('新图片加载失败');
        });
    } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        // 图片已经加载完成
        if (!originalImage || (!originalImageLocked && 
            img.naturalWidth * img.naturalHeight > 
            (originalImage.width || 0) * (originalImage.height || 0)
        )) {
            debugLog('新图片已加载且更合适，更新原图记录');
            recordImageAsOriginal(img);
        }
    }
}

// 初始化DOM内容变化监听（用于检测页面内容更新）
function initializeDOMContentObserver() {
    debugLog('初始化DOM内容变化监听');
    
    // 监听页面主要内容区域的变化
    const contentObserver = new MutationObserver((mutations) => {
        let hasSignificantChange = false;
        let hasNewImages = false;
        
        mutations.forEach((mutation) => {
            // 检查是否有新的节点被添加
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否添加了包含原图的容器
                        if (node.classList && (
                            node.classList.contains('safe-image') ||
                            node.classList.contains('image-item') ||
                            node.hasAttribute('data-v-92a52416')
                        )) {
                            debugLog('检测到原图相关容器被添加', {
                                className: node.className,
                                hasDataV: node.hasAttribute('data-v-92a52416')
                            });
                            hasSignificantChange = true;
                        }
                        
                        // 检查是否添加了图片元素
                        if (node.tagName === 'IMG' || node.querySelectorAll('img').length > 0) {
                            debugLog('检测到新图片元素被添加');
                            hasNewImages = true;
                        }
                        
                        // 检查是否有原图相关的选择器
                        const targetElements = node.querySelectorAll && node.querySelectorAll([
                            'div[data-v-92a52416].safe-image',
                            'div.safe-image img[data-v-92a52416]',
                            '.image-item img',
                            'img[data-v-92a52416]'
                        ].join(','));
                        
                        if (targetElements && targetElements.length > 0) {
                            debugLog('检测到原图相关元素被添加', targetElements.length);
                            hasSignificantChange = true;
                        }
                    }
                });
            }
        });
        
        // 如果检测到重要变化且当前没有锁定的原图，尝试重新检测
        if ((hasSignificantChange || hasNewImages) && !originalImageLocked) {
            debugLog('DOM发生重要变化，尝试重新检测原图', {
                hasSignificantChange,
                hasNewImages,
                originalImageLocked
            });
            
            // 延迟一点时间再检测，确保DOM完全更新
            const domChangeTimeoutId = setTimeout(() => {
                if (!originalImageLocked) {
                    debugLog('延迟后执行原图检测');
                    recordOriginalImages();
                }
                
                // 从待执行列表中移除
                const index = pendingComparisonTimeouts.indexOf(domChangeTimeoutId);
                if (index > -1) {
                    pendingComparisonTimeouts.splice(index, 1);
                }
            }, 1000);
            
            pendingComparisonTimeouts.push(domChangeTimeoutId);
        }
    });
    
    // 开始观察document.body的变化
    contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false, // 不监听属性变化，避免过多触发
        attributeOldValue: false
    });

    debugLog('DOM内容变化监听已启动');
}

// COS原图URL专门检测函数
function isCOSOriginalImage(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 检查是否是腾讯COS域名
    const isCOSDomain = lowerUrl.includes('aidata-1258344706.cos.ap-guangzhou.myqcloud.com');
    
    if (!isCOSDomain) return false;
    
    // COS原图路径特征
    const cosOriginalPaths = [
        '/target/',
        '/target/dataset/',
        'dataset/'
    ];
    
    const hasCOSOriginalPath = cosOriginalPaths.some(path => lowerUrl.includes(path));
    
    // 检查文件扩展名（COS原图只有JPEG格式）
    const hasJpegExt = /\.(jpe?g)(\?|$)/i.test(url);
    
    // 检查URL参数（COS带签名参数）
    const hasSignParams = lowerUrl.includes('q-sign-algorithm') || 
                         lowerUrl.includes('?sign=') ||
                         lowerUrl.includes('&sign=');
    
    const result = hasCOSOriginalPath && hasJpegExt;
    
    if (result) {
        debugLog('识别为COS原图 (JPEG格式)', {
            url: url.substring(0, 100) + '...',
            hasCOSOriginalPath,
            hasJpegExt,
            hasSignParams
        });
    }
    
    return result;
}

// 增强版原图候选判断（支持更多模式）
function isOriginalImageCandidate(url) {
    if (!url) return false;
    
    const originalIndicators = [
        'original', 'source', 'master', 'raw', 'full', 'high', 'hd',
        '原图', '原始', '源图', 'src', 'origin', 'orig',
        'large', 'big', 'huge', 'xl', 'xxl', 'max',
        'quality', 'best', 'highest'
    ];
    
    const lowerUrl = url.toLowerCase();
    
    // 检查关键词指示器
    const hasKeyword = originalIndicators.some(indicator => 
        lowerUrl.includes(indicator.toLowerCase())
    );
    
    // 检查尺寸格式（如 1920x1080, 800x600 等）
    const hasDimensions = /\d{3,4}[x×]\d{3,4}/.test(url);
    
    // 检查文件大小指示器
    const hasSizeIndicator = /_(large|big|huge|xl|xxl|max|full)(\.|_)/.test(lowerUrl);
    
    // 检查质量指示器
    const hasQualityIndicator = /(high|hd|quality|best|q\d+)/.test(lowerUrl);
    
    // 检查是否是缩略图（如果是，则不是原图）
    const isThumbnail = /(thumb|thumbnail|small|mini|tiny|preview|_s\.|_m\.)/.test(lowerUrl);
    
    // 检查文件路径中的原图指示
    const hasOriginalPath = /(\/original\/|\/full\/|\/source\/|\/raw\/|\/hd\/)/.test(lowerUrl);
    
    const isCandidate = (hasKeyword || hasDimensions || hasSizeIndicator || 
                        hasQualityIndicator || hasOriginalPath) && !isThumbnail;
    
    if (isCandidate) {
        debugLog('识别为原图候选', {
            url: url.substring(0, 100) + '...',
            hasKeyword,
            hasDimensions,
            hasSizeIndicator,
            hasQualityIndicator,
            hasOriginalPath,
            isThumbnail
        });
    }
    
    return isCandidate;
}

// 简化：N键重新检测原图（只使用COS原图和精确DOM选择器）
// N键监听器已移动到 src/modules/KeyboardManager.js
// ============== 竞速模式原图获取系统 ==============

// 竞速模式：多种方法并行执行，采用第一个成功的结果
async function startParallelImageAcquisition() {
    if (originalImageLocked && originalImage) {
        debugLog('原图已锁定，跳过竞速获取');
        return;
    }
    
    debugLog('🏃 启动竞速模式原图获取');
    showNotification('正在多渠道获取原图...', 1000);
    
    const acquisitionPromises = [];
    const acquisitionTimeouts = [];
    
    // 方法1: DOM快速检测（最快）
    const domPromise = createTimedPromise(
        'DOM检测',
        () => fastDOMImageDetection(),
        100 // 100ms超时
    );
    acquisitionPromises.push(domPromise);
    
    // 方法2: 缓存Performance API（快）
    const performancePromise = createTimedPromise(
        'Performance API',
        () => quickPerformanceAPICheck(),
        300 // 300ms超时
    );
    acquisitionPromises.push(performancePromise);
    
    // 方法3: 已加载DOM图片（中等）
    const loadedImagesPromise = createTimedPromise(
        '已加载图片',
        () => quickLoadedImagesCheck(),
        500 // 500ms超时
    );
    acquisitionPromises.push(loadedImagesPromise);
    
    // 方法4: 网络请求历史（慢）
    const networkPromise = createTimedPromise(
        '网络请求',
        () => quickNetworkHistoryCheck(),
        1000 // 1s超时
    );
    acquisitionPromises.push(networkPromise);
    
    // 方法5: 延迟DOM重检（备选）
    const delayedDomPromise = createTimedPromise(
        '延迟DOM检测',
        () => new Promise(resolve => {
            setTimeout(() => {
                fastDOMImageDetection().then(resolve).catch(resolve);
            }, 1000);
        }),
        2000 // 2s超时
    );
    acquisitionPromises.push(delayedDomPromise);
    
    try {
        // Promise.allSettled 等待所有方法完成或超时
        const results = await Promise.allSettled(acquisitionPromises);
        
        debugLog('🏁 竞速获取完成', {
            总方法数: results.length,
            成功数: results.filter(r => r.status === 'fulfilled' && r.value).length,
            失败数: results.filter(r => r.status === 'rejected').length
        });
        
        // 分析结果，选择最佳原图
        const bestImage = selectBestImage(results);
        
        if (bestImage) {
            debugLog('🏆 竞速获取成功', {
                来源: bestImage.source,
                尺寸: `${bestImage.width}x${bestImage.height}`,
                URL: bestImage.src.substring(0, 50) + '...'
            });
            
            // 更新全局原图
            originalImage = bestImage;
            originalImageLocked = true;
            
            showNotification(`竞速获取原图成功 (${bestImage.source}): ${bestImage.width}×${bestImage.height}`, 2000);
        } else {
            debugLog('❌ 所有竞速方法都失败了');
            showNotification('未能获取到原图，请稍后再试', 2000);
        }
        
    } catch (error) {
        debugLog('竞速获取出错', error.message);
        showNotification('获取原图时出错', 2000);
    }
}

// 创建带超时的Promise
function createTimedPromise(name, promiseFactory, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            debugLog(`⏰ ${name} 超时 (${timeoutMs}ms)`);
            resolve(null); // 超时返回null而不是reject
        }, timeoutMs);
        
        Promise.resolve(promiseFactory())
            .then(result => {
                clearTimeout(timeoutId);
                debugLog(`✅ ${name} 完成`, result ? `${result.width}x${result.height}` : '无结果');
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                debugLog(`❌ ${name} 失败`, error.message);
                resolve(null); // 失败也返回null，不中断整体流程
            });
    });
}

// 快速DOM检测（优化版）
// 快速DOM检测（优化版）- 优先检测COS原图
async function fastDOMImageDetection() {
    const selectors = [
        'div[data-v-92a52416].safe-image img[data-v-92a52416][src]',
        'div.safe-image img[data-v-92a52416][src]',
        'img[data-v-92a52416][src].img',
        'img[data-v-92a52416][src]',
        'div.safe-image img[src]',
        '.image-item img[src]'
    ];
    
    // 首先专门查找COS原图
    const allImages = document.querySelectorAll('img[src]');
    for (const img of allImages) {
        if (img.complete && img.naturalWidth > 100 && img.naturalHeight > 100) {
            if (isCOSOriginalImage(img.src)) {
                return {
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    name: extractFileNameFromUrl(img.src),
                    element: img,
                    source: 'DOM-COS原图检测'
                };
            }
        }
    }
    
    // 然后使用常规选择器
    for (const selector of selectors) {
        const images = document.querySelectorAll(selector);
        for (const img of images) {
            if (img.complete && img.naturalWidth > 100 && img.naturalHeight > 100) {
                return {
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    name: extractFileNameFromUrl(img.src),
                    element: img,
                    source: 'DOM精确检测'
                };
            }
        }
    }
    return null;
}

// 快速Performance API检查
async function quickPerformanceAPICheck() {
    const entries = performance.getEntriesByType('resource');
    const imageEntries = entries
        .filter(entry => entry.initiatorType === 'img' || isImageUrl(entry.name))
        .filter(entry => isOriginalImageCandidate(entry.name))
        .sort((a, b) => b.transferSize - a.transferSize); // 按文件大小排序
    
    if (imageEntries.length > 0) {
        const entry = imageEntries[0];
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({
                src: entry.name,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(entry.name),
                element: img,
                source: 'Performance API'
            });
            img.onerror = () => resolve(null);
            img.src = entry.name;
        });
    }
    return null;
}

// 快速检查已加载的图片
async function quickLoadedImagesCheck() {
    const images = document.querySelectorAll('img[src]');
    const loadedImages = Array.from(images)
        .filter(img => img.complete && img.naturalWidth > 200 && img.naturalHeight > 200)
        .filter(img => isOriginalImageCandidate(img.src))
        .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
    
    if (loadedImages.length > 0) {
        const img = loadedImages[0];
        return {
            src: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            name: extractFileNameFromUrl(img.src),
            element: img,
            source: '已加载图片'
        };
    }
    return null;
}

// 快速网络请求历史检查
async function quickNetworkHistoryCheck() {
    if (capturedImageRequests.size === 0) return null;
    
    const candidates = Array.from(capturedImageRequests.values())
        .filter(req => req.isOriginalCandidate)
        .sort((a, b) => b.timestamp - a.timestamp); // 按时间排序，最新的优先
    
    if (candidates.length > 0) {
        const req = candidates[0];
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({
                src: req.url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(req.url),
                element: img,
                source: '网络请求历史'
            });
            img.onerror = () => resolve(null);
            img.src = req.url;
        });
    }
    return null;
}

// 选择最佳图片
function selectBestImage(results) {
    const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
    
    if (successfulResults.length === 0) return null;
    
    debugLog('竞速结果分析', {
        成功结果: successfulResults.map(img => ({
            来源: img.source,
            尺寸: `${img.width}x${img.height}`,
            像素总数: img.width * img.height
        }))
    });
    
    // 选择策略：
    // 1. 优先选择DOM精确检测的结果（最可靠）
    // 2. 其次选择像素最多的图片（质量最高）
    // 3. 最后选择最新的结果（时效性最好）
    
    const domResult = successfulResults.find(img => img.source.includes('DOM'));
    if (domResult) {
        debugLog('选择DOM检测结果');
        return domResult;
    }
    
    // 按像素总数排序
    const sortedBySize = successfulResults.sort((a, b) => 
        (b.width * b.height) - (a.width * a.height)
    );
    
    debugLog('选择最大尺寸结果', {
        选中: {
            来源: sortedBySize[0].source,
            尺寸: `${sortedBySize[0].width}x${sortedBySize[0].height}`
        }
    });
    
    return sortedBySize[0];
}

// 简化：P键强制重新检测原图（忽略锁定状态）
// P键监听器已移动到 src/modules/KeyboardManager.js
// 移除：R键相关逻辑（模式切换、资源提取测试）

// 删除T键测试功能，合并到W键
// T键: 手动测试智能对比 - 已删除，请使用W键

// 智能图片对比 - 包含回退逻辑
// 启动智能图片对比 (包含回退逻辑)
// triggerSmartComparisonWithFallback 函数已移动到 src/modules/core/SmartComparisonManager.js

// ============== COS图片拦截和智能对比系统 ==============

// 初始化COS图片监听器
function initializeCOSImageListener() {
    debugLog('初始化COS图片拦截监听器');
    
    // 监听来自background.js的COS图片拦截消息
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'COS_IMAGE_DETECTED') {
                handleCOSImageDetection(message.data);
            }
        });
        
        console.log('✅ COS图片拦截监听器已启动');
    } else {
        console.warn('⚠️ Chrome runtime不可用，无法监听COS图片');
    }
}

// 处理COS图片检测 - 简化版
function handleCOSImageDetection(data) {
    debugLog('COS图片检测', data);
    
    const { url, isOriginal, isModified, imageType, stage } = data;
    
    // 只处理请求完成阶段，避免重复处理
    if (stage !== 'completed') {
        return;
    }
    
    // 缓存图片信息
    cosImageCache.set(url, {
        ...data,
        timestamp: Date.now()
    });
    
    if (isOriginal) {
        console.log('📸 捕获到原图:', url);
        capturedOriginalImage = url;
        
        // 如果当前原图未锁定或为空，更新原图引用
        if (!originalImageLocked || !originalImage) {
            updateOriginalImageFromCOS(url);
        }
        
        debugLog('原图已捕获', { url, originalImageLocked });
    }
    
    if (isModified) {
        console.log('🔧 捕获到修改图:', url);
        capturedModifiedImage = url;
        
        debugLog('修改图已捕获', { url });
        
        // 如果用户正在对比模式，更新对比
        if (isComparisonModalOpen) {
            triggerSmartComparisonWithFallback();
        }
    }
    
    // 自动触发智能对比（如果需要且开关开启）
    if (shouldAutoCompare && autoCompareEnabled && capturedOriginalImage) {
        triggerSmartComparison();
    } else if (shouldAutoCompare && !autoCompareEnabled) {
        debugLog('跳过自动智能对比 - 自动对比功能已关闭');
        shouldAutoCompare = false; // 重置标记
    }
}

// 从COS更新原图引用 - 仅显示模式
async function updateOriginalImageFromCOS(imageUrl) {
    debugLog('从COS更新原图引用 (仅显示模式)', imageUrl);
    
    try {
        // 仅显示模式：直接创建img元素，无需代理
        const img = await createImageElementForDisplay(imageUrl);
        
        originalImage = img;
        originalImageLocked = true;
        debugLog('原图从COS加载成功 (仅显示)', {
            src: imageUrl,
            width: img.naturalWidth,
            height: img.naturalHeight
        });
        
        showNotification('✅ 原图已获取 (显示模式)', 2000);
        
    } catch (error) {
        debugLog('原图从COS加载失败', error);
        showNotification('❌ 原图加载失败: ' + error.message, 3000);
    }
}

// 使用CORS加载图片
function loadImageWithCORS(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            resolve(this);
        };
        
        img.onerror = function() {
            reject(new Error('CORS图片加载失败'));
        };
        
        // 设置较短的超时时间
        const timeout = setTimeout(() => {
            img.onload = img.onerror = null;
            reject(new Error('图片加载超时'));
        }, 5000);
        
        img.onload = function() {
            clearTimeout(timeout);
            resolve(this);
        };
        
        img.onerror = function() {
            clearTimeout(timeout);
            reject(new Error('CORS图片加载失败'));
        };
        
        img.src = imageUrl;
    });
}

// 通过background script代理获取图片
function fetchImageViaProxy(imageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime不可用'));
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'fetchCOSImage',
            url: imageUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || '代理获取失败'));
            }
        });
    });
}

// 从DataURL创建图片元素
function createImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            resolve(this);
        };
        
        img.onerror = function() {
            reject(new Error('DataURL图片创建失败'));
        };
        
        img.src = dataUrl;
    });
}

// 智能对比逻辑 - 简化版
function triggerSmartComparison() {
    debugLog('触发智能对比');
    
    if (!capturedOriginalImage) {
        debugLog('无原图，跳过智能对比');
        showNotification('⏳ 等待原图加载...', 2000);
        return;
    }
    
    let comparisonPair = null;
    
    // 优先使用服务器修改图进行对比
    if (capturedModifiedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: capturedModifiedImage, label: '修改图' },
            mode: '原图vs修改图对比'
        };
    } 
    // 如果没有修改图，使用用户上传的图片
    else if (uploadedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: uploadedImage.src, label: '上传图片' },
            mode: '原图vs上传图对比'
        };
    } 
    // 都没有则提示等待
    else {
        debugLog('等待对比图片');
        showNotification('⏳ 等待对比图片...', 2000);
        return;
    }
    
    debugLog('启动智能对比', comparisonPair.mode);
    showNotification(`🔍 启动${comparisonPair.mode}`, 1000);
    showSmartComparison(comparisonPair);
    shouldAutoCompare = false; // 重置自动对比标志
}

// 显示智能对比弹窗 - 仅显示模式（无跨域问题）
// showSmartComparison 函数已移动到 src/modules/core/SmartComparisonManager.js

// 为显示创建图片元素 - 无需跨域处理
// createImageElementForDisplay 函数已移动到 src/modules/core/SmartComparisonManager.js

// F2键功能：检查图片尺寸并显示标注界面
let dimensionCheckModal = null;
let isDimensionCheckModalOpen = false;
let lastDimensionCheckInfo = null; // 保存上次检查的图片信息，用于R键重新弹出

// F2键：智能尺寸检查 - 复用R键逻辑，如果不符合要求则自动跳过直到找到合适图片
async function checkImageDimensionsAndShowModal() {
    debugLog('F2键触发：智能尺寸检查');
    await autoSkipToValidImageWithRKeyLogic();
}

// 自动跳过到符合要求的图片，使用R键逻辑
async function autoSkipToValidImageWithRKeyLogic() {
    debugLog('开始智能跳过到符合要求的图片');
    
    let attempts = 0;
    const maxAttempts = 10; // 最多尝试10次
    
    while (attempts < maxAttempts) {
        attempts++;
        debugLog(`第${attempts}次尝试检查图片`);
        
        // 执行R键的逻辑：手动尺寸检查
        const checkResult = await manualDimensionCheck();
        
        if (checkResult === true) {
            // 找到符合要求的图片，R键逻辑已经显示了模态框
            debugLog('找到符合要求的图片，停止自动跳过');
            showNotification(`经过${attempts}次检查，找到符合要求的图片`, 2000);
            return;
        }
        
        // 图片不符合要求，执行跳过操作
        debugLog(`第${attempts}次图片不符合要求，执行跳过`);
        
        const skipButton = findButtonByText(['跳过', 'Skip', '下一个', 'Next', '继续', 'Continue']);
        if (skipButton) {
            clickButton(skipButton, '跳过');
            
            // 等待页面加载
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新检测原图
            originalImageLocked = false;
            originalImage = null;
            recordOriginalImages();
            
            // 等待原图检测完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!originalImage) {
                debugLog('跳过后未找到新的原图');
                showNotification('跳过后未找到新的原图，停止自动跳过', 2000);
                break;
            }
        } else {
            debugLog('未找到跳过按钮');
            showNotification('未找到跳过按钮，停止自动跳过', 2000);
            break;
        }
    }
    
    debugLog(`已尝试${attempts}次，未找到符合要求的图片`);
    showNotification(`已尝试${attempts}次，未找到符合要求的图片`, 3000);
}



// 自动提取页面指令文本
function extractInstructionText() {
    try {
        debugLog('开始提取页面指令文本');

        // 精确选择器：基于提供的示例
        const exactSelectors = [
            'div[data-v-2f9c5f73][name="instruction"]',
            'div[name="instruction"]',
            'div[data-v-2f9c5f73]'
        ];

        // 通用选择器：寻找可能包含指令的元素
        const generalSelectors = [
            '[name="instruction"]',
            '[class*="instruction"]',
            '[id*="instruction"]',
            'div[style*="font-size: 14px"]',
            '.instruction',
            '.task-instruction',
            '.prompt',
            '.description'
        ];

        // 合并所有选择器，精确选择器优先
        const allSelectors = [...exactSelectors, ...generalSelectors];

        let instructionText = '';

        // 按优先级尝试每个选择器
        for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            debugLog(`尝试选择器: ${selector}`, { found: elements.length });

            if (elements.length > 0) {
                for (const element of elements) {
                    const text = element.textContent?.trim() || element.innerText?.trim() || '';

                    // 检查文本是否像指令（长度合理且包含中文或英文描述）
                    if (text.length > 5 && text.length < 500) {
                        // 检查是否包含指令性文字
                        const instructionKeywords = [
                            '添加', '更换', '修改', '改变', '调整', '设置', '变成', '换成',
                            '背景', '妆容', '发型', '服装', '表情', '姿势', '颜色', '风格',
                            'add', 'change', 'modify', 'replace', 'adjust', 'set', 'make',
                            'background', 'makeup', 'hairstyle', 'clothing', 'expression'
                        ];

                        const containsInstruction = instructionKeywords.some(keyword =>
                            text.toLowerCase().includes(keyword.toLowerCase())
                        );

                        if (containsInstruction) {
                            instructionText = text;
                            debugLog('找到指令文本', {
                                selector: selector,
                                text: text.substring(0, 100) + '...',
                                element: element
                            });
                            break;
                        }
                    }
                }

                if (instructionText) break;
            }
        }

        // 如果精确方法没找到，尝试文本内容搜索
        if (!instructionText) {
            debugLog('精确选择器未找到，尝试文本内容搜索');

            const allDivs = document.querySelectorAll('div');
            for (const div of allDivs) {
                const text = div.textContent?.trim() || '';

                // 寻找包含"为她"、"将背景"等指令性开头的文本
                const instructionPatterns = [
                    /^为她.*[。！]$/, // 以"为她"开头的句子
                    /^将背景.*[。！]$/, // 以"将背景"开头的句子
                    /^添加.*[。！]$/, // 以"添加"开头的句子
                    /^修改.*[。！]$/, // 以"修改"开头的句子
                    /^换成.*[。！]$/, // 以"换成"开头的句子
                ];

                if (text.length > 10 && text.length < 300) {
                    const matchesPattern = instructionPatterns.some(pattern => pattern.test(text));
                    if (matchesPattern) {
                        instructionText = text;
                        debugLog('通过文本模式找到指令', {
                            text: text,
                            element: div
                        });
                        break;
                    }
                }
            }
        }

        if (instructionText) {
            debugLog('成功提取指令文本', {
                text: instructionText,
                length: instructionText.length
            });

            showNotification(`📝 已提取指令: ${instructionText.substring(0, 30)}...`, 2000);
            return instructionText;
        } else {
            debugLog('未找到指令文本');
            return '';
        }

    } catch (error) {
        debugLog('提取指令文本失败:', error);
        return '';
    }
}

// 显示尺寸检查模态框
function showDimensionCheckModal(imageInfo, isDimensionValid) {
    if (isDimensionCheckModalOpen) {
        return;
    }

    debugLog('显示尺寸检查模态框', { isDimensionValid });

    // 统一缓存检查逻辑：优先使用新模块，回退到全局变量
    let modalCachedResults = null;
    let modalTaskInfo = null;

    debugLog('🔍 模态框缓存检查开始', {
        hasRunningHubManager: !!runningHubManager,
        isManagerInitialized: runningHubManager ? runningHubManager.isInitialized() : false,
        globalCachedResults: !!cachedRunningHubResults,
        globalTaskInfo: !!currentPageTaskInfo,
        windowCachedResults: !!window.cachedRunningHubResults,
        windowTaskInfo: !!window.currentPageTaskInfo
    });

    if (runningHubManager && runningHubManager.isInitialized()) {
        const cacheManager = runningHubManager.getCacheManager();
        modalCachedResults = cacheManager.getCachedResults();
        modalTaskInfo = cacheManager.getCurrentTaskInfo();
        debugLog('📦 从新模块获取缓存', { hasCache: !!modalCachedResults, hasTaskInfo: !!modalTaskInfo });
    } else {
        modalCachedResults = window.cachedRunningHubResults;
        modalTaskInfo = window.currentPageTaskInfo;
        debugLog('📦 从全局变量获取缓存', {
            hasCache: !!modalCachedResults,
            hasTaskInfo: !!modalTaskInfo,
            cachedResultsType: typeof window.cachedRunningHubResults,
            taskInfoType: typeof window.currentPageTaskInfo
        });
    }

    // 创建模态框容器
    dimensionCheckModal = document.createElement('div');
    dimensionCheckModal.className = 'dimension-check-modal';
    dimensionCheckModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        animation: fadeIn 0.2s ease-out;
    `;
    
    // 创建模态框内容
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 16px;
        padding: 32px;
        max-width: 580px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8);
        position: relative;
        transform: scale(0.95);
        animation: modalSlideIn 0.3s ease-out forwards;
    `;
    
    const statusColor = isDimensionValid ? '#059669' : '#dc2626';
    const statusBgColor = isDimensionValid ? '#ecfdf5' : '#fef2f2';
    const statusIcon = isDimensionValid ? '✓' : '✗';
    const statusText = isDimensionValid ? '尺寸符合要求' : '尺寸不符合要求';
    
    modalContent.innerHTML = `
        <button id="dimensionCheckCloseBtn" style="
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            border: none;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: #6b7280;
            transition: all 0.2s ease;
        ">×</button>
        
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 20px;
                background: ${statusBgColor};
                border: 2px solid ${statusColor};
                border-radius: 50px;
                font-size: 16px;
                font-weight: 600;
                color: ${statusColor};
            ">
                <span style="font-size: 18px;">${statusIcon}</span>
                ${statusText}
            </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
            <img src="${imageInfo.src}" style="
                max-width: 100%; 
                max-height: 320px; 
                border-radius: 12px; 
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                border: 3px solid #ffffff;
            " />
        </div>
        
        <div style="
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
        ">
            <div style="display: flex; justify-content: space-around; margin-bottom: 16px;">
                <div style="text-align: center;">
                    <div style="color: #64748b; font-size: 13px; font-weight: 500; margin-bottom: 4px;">宽度</div>
                    <div style="
                        font-size: 24px; 
                        font-weight: 700; 
                        color: ${imageInfo.width % 8 === 0 ? '#059669' : '#dc2626'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    ">
                        ${imageInfo.width}px
                        <span style="font-size: 16px;">${imageInfo.width % 8 === 0 ? '✓' : '✗'}</span>
                    </div>
                </div>
                <div style="width: 1px; background: #e2e8f0; margin: 0 16px;"></div>
                <div style="text-align: center;">
                    <div style="color: #64748b; font-size: 13px; font-weight: 500; margin-bottom: 4px;">高度</div>
                    <div style="
                        font-size: 24px; 
                        font-weight: 700; 
                        color: ${imageInfo.height % 8 === 0 ? '#059669' : '#dc2626'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    ">
                        ${imageInfo.height}px
                        <span style="font-size: 16px;">${imageInfo.height % 8 === 0 ? '✓' : '✗'}</span>
                    </div>
                </div>
            </div>
            <div style="
                text-align: center;
                color: #64748b;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 8px;
            ">
                要求：长宽都必须是8的倍数
            </div>
        </div>
        
        ${isDimensionValid ? `
        <div style="margin-bottom: 24px;">
            <label style="
                display: block; 
                margin-bottom: 12px; 
                color: #374151; 
                font-weight: 600;
                font-size: 14px;
            ">修改需求</label>
            <textarea id="dimensionCheckTextarea" placeholder="请描述对图片的修改需求..." style="
                width: 100%;
                height: 90px;
                padding: 16px;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                box-sizing: border-box;
                background: #ffffff;
                transition: all 0.2s ease;
                outline: none;
            "></textarea>
        </div>
        ` : ''}
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
            ${isDimensionValid ? `
            <button id="dimensionCheckSubmitBtn" style="
                padding: 14px 28px;
                border: none;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border-radius: 12px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                min-width: 120px;
            ">提交需求</button>
            ` : ''}
        </div>
    `;
    
    // 添加CSS动画样式
    if (!document.querySelector('#dimension-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'dimension-modal-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                from { 
                    transform: scale(0.9) translateY(-20px);
                    opacity: 0;
                }
                to { 
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }
            }
            
            .dimension-check-modal button:hover {
                transform: translateY(-1px);
            }
            
            .dimension-check-modal textarea:focus {
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
            }
            
            .dimension-check-modal #dimensionCheckCloseBtn:hover {
                background: rgba(0, 0, 0, 0.15) !important;
            }
            
            .dimension-check-modal #dimensionCheckSubmitBtn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
            }
        `;
        document.head.appendChild(styles);
    }
    
    dimensionCheckModal.appendChild(modalContent);
    document.body.appendChild(dimensionCheckModal);
    isDimensionCheckModalOpen = true;

    // 先获取基础元素引用
    const closeBtn = modalContent.querySelector('#dimensionCheckCloseBtn');
    const submitBtn = modalContent.querySelector('#dimensionCheckSubmitBtn');
    const textarea = modalContent.querySelector('#dimensionCheckTextarea');

    // 创建唯一的事件处理器ID
    const modalId = Date.now();
    debugLog('创建模态框事件处理器', { modalId });

    // 绑定基础事件监听器（关闭功能）
    bindModalCloseEvents(modalId);

    // 绑定按钮事件
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDimensionCheckModal);
    }

    if (submitBtn) {
        const handleSubmit = () => {
            if (submitBtn.disabled) {
                debugLog('提交按钮已禁用，忽略点击');
                return;
            }

            const comment = textarea ? textarea.value.trim() : '';
            disableSubmitButton(submitBtn);
            submitDimensionCheck(comment);
        };

        submitBtn.addEventListener('click', handleSubmit);
    }

    // 自动提取并填入指令文本（仅当textarea为空且图片尺寸有效时）
    if (textarea && isDimensionValid && !textarea.value.trim()) {
        debugLog('尝试自动提取指令文本填入输入框');
        const instructionText = extractInstructionText();
        if (instructionText) {
            textarea.value = instructionText;
            debugLog('指令文本已自动填入输入框', {
                text: instructionText.substring(0, 50) + '...'
            });
            showNotification('已自动填入页面指令', 1500);

            // 添加高亮效果提示用户
            textarea.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
            textarea.style.border = '2px solid #f59e0b';

            // 3秒后恢复正常样式
            setTimeout(() => {
                textarea.style.background = '#ffffff';
                textarea.style.border = '2px solid #e2e8f0';
            }, 3000);
        }
    }

    // 检查是否有缓存需要恢复（在事件绑定后）
    if (modalCachedResults && modalTaskInfo) {
        debugLog('在事件绑定后恢复缓存结果', {
            taskId: modalTaskInfo.taskId,
            status: modalTaskInfo.status
        });

        // 恢复任务状态显示
        debugLog('🔄 [MODAL] 开始恢复任务状态显示', {
            taskId: modalTaskInfo.taskId,
            statusMessage: modalTaskInfo.statusMessage,
            status: modalTaskInfo.status
        });
        updateDimensionModalProgress(
            `🆔 任务ID: ${modalTaskInfo.taskId}\n${modalTaskInfo.statusMessage || '✅ 任务已完成'}`
        );

        // 恢复结果显示
        debugLog('🎨 [MODAL] 开始恢复结果显示', {
            hasResults: !!modalCachedResults,
            resultType: typeof modalCachedResults,
            globalResults: !!window.cachedRunningHubResults,
            taskInfo: !!modalTaskInfo
        });
        if (modalCachedResults) {
            renderRunningHubResultsInModal(modalCachedResults);
        } else {
            debugLog('❌ [MODAL] 没有缓存结果可以恢复');
        }

        // 恢复按钮状态
        debugLog('🔧 [MODAL] 开始恢复按钮状态', {
            hasButton: !!submitBtn,
            targetStatus: modalTaskInfo.status || 'success'
        });
        if (submitBtn) {
            enableSubmitButton(submitBtn, modalTaskInfo.status || 'success');
        }

        // 隐藏取消按钮
        hideRhCancelBtn();

        // 添加缓存相关UI
        addCacheIndicator();
        addClearCacheButton();

        debugLog('✅ [MODAL] 状态恢复完成', {
            taskId: modalTaskInfo ? modalTaskInfo.taskId : 'no-task-info',
            finalStatus: modalTaskInfo ? modalTaskInfo.status : 'unknown',
            notificationShown: true,
            timestamp: new Date().toISOString()
        });
        showNotification('已恢复上次的生成结果', 2000);
    }

    // 检查是否需要显示进行中状态（更精确的逻辑）
    const hasValidCache = modalCachedResults && modalTaskInfo;
    const isActuallyPolling = window._rhPollingActive && window._rhTaskIdForCancel && !window._rhCancelRequested;

    // 调试：详细检查轮询状态
    debugLog('模态框状态检查', {
        hasValidCache,
        'window._rhPollingActive': window._rhPollingActive,
        'window._rhTaskIdForCancel': window._rhTaskIdForCancel,
        'window._rhCancelRequested': window._rhCancelRequested,
        isActuallyPolling,
        'stateManager.isPollingActive': runningHubManager?.getStateManager()?.get('isPollingActive'),
        'cachedResults exists': !!cachedRunningHubResults,
        'currentTaskInfo exists': !!currentPageTaskInfo
    });

    if (!hasValidCache && isActuallyPolling) {
        debugLog('检测到正在进行的任务，显示进行中状态', {
            taskId: window._rhTaskIdForCancel,
            pollingActive: window._rhPollingActive,
            cancelRequested: window._rhCancelRequested
        });

        updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel}\n📊 状态: 正在执行中...`);
        showRhCancelBtn();

        // 设置提交按钮为进行中状态
        if (submitBtn) {
            disableSubmitButton(submitBtn);
        }
    } else if (hasValidCache) {
        debugLog('有缓存结果，确保轮询状态已重置', {
            taskId: modalTaskInfo ? modalTaskInfo.taskId : 'no-task-info',
            cacheStatus: modalTaskInfo ? modalTaskInfo.status : 'unknown'
        });

        // 有缓存就确保轮询状态被重置
        resetRunningHubPollingState();
    } else {
        debugLog('无缓存且非轮询状态，应显示初始状态');
    }

    // 按钮悬停效果
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#f3f4f6';
        closeBtn.style.borderColor = '#9ca3af';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'white';
        closeBtn.style.borderColor = '#d1d5db';
    });
    
    if (submitBtn) {
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.background = '#2563eb';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.background = '#3b82f6';
        });
    }
    
    debugLog('尺寸检查模态框已显示');
}

// 绑定模态框关闭事件
function bindModalCloseEvents(modalId) {
    if (!dimensionCheckModal) return;

    debugLog('绑定模态框关闭事件', { modalId });

    // ESC键关闭
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && isDimensionCheckModalOpen && dimensionCheckModal) {
            debugLog('ESC键触发关闭模态框', { modalId });
            e.preventDefault();
            e.stopPropagation();
            closeDimensionCheckModal();
        }
    };

    // 点击背景关闭
    const handleBackgroundClick = (e) => {
        if (e.target === dimensionCheckModal && isDimensionCheckModalOpen) {
            debugLog('背景点击触发关闭模态框', { modalId });
            e.preventDefault();
            e.stopPropagation();
            closeDimensionCheckModal();
        }
    };

    // 绑定事件
    document.addEventListener('keydown', handleEscKey, true); // 使用capture阶段
    dimensionCheckModal.addEventListener('click', handleBackgroundClick, true);

    // 保存事件处理函数以便清理
    dimensionCheckModal._handleEscKey = handleEscKey;
    dimensionCheckModal._handleBackgroundClick = handleBackgroundClick;
    dimensionCheckModal._modalId = modalId;

    debugLog('模态框关闭事件已绑定', { modalId });
}

// 禁用提交按钮
function disableSubmitButton(submitBtn) {
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.style.pointerEvents = 'none';

    // 更新按钮文本和图标
    submitBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span style="animation: spin 1s linear infinite;">⏳</span>
            处理中...
        </span>
    `;

    // 添加旋转动画
    if (!document.querySelector('#submit-button-styles')) {
        const styles = document.createElement('style');
        styles.id = 'submit-button-styles';
        styles.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styles);
    }

    debugLog('提交按钮已禁用');
}

// 启用提交按钮
function enableSubmitButton(submitBtn, status = 'ready') {
    debugLog('🔧 [BUTTON] 启用提交按钮', {
        buttonExists: !!submitBtn,
        status,
        currentDisabled: submitBtn ? submitBtn.disabled : 'no button',
        timestamp: new Date().toISOString()
    });

    if (!submitBtn) {
        debugLog('❌ [BUTTON] 无法启用按钮：按钮不存在');
        return;
    }

    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    submitBtn.style.pointerEvents = 'auto';

    // 根据状态设置不同的按钮文本和样式
    if (status === 'success') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>✅</span>
                任务已完成
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    } else if (status === 'failed') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🔄</span>
                重新提交
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
    } else if (status === 'canceled') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🔄</span>
                重新提交
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';

        // 为重新提交按钮添加事件监听器
        const handleResubmit = () => {
            if (submitBtn.disabled) {
                debugLog('提交按钮已禁用，忽略点击');
                return;
            }

            // 获取备注内容
            const modal = document.querySelector('.dimension-check-modal');
            const textarea = modal ? modal.querySelector('#dimensionCheckTextarea') : null;
            const comment = textarea ? textarea.value.trim() : '';

            // 禁用按钮并开始处理
            disableSubmitButton(submitBtn);
            submitDimensionCheck(comment);
        };

        // 添加事件监听器（避免重复添加）
        if (!submitBtn._resubmitHandler) {
            submitBtn._resubmitHandler = handleResubmit;
            submitBtn.addEventListener('click', handleResubmit);
        }
    } else {
        // ready状态 - 恢复原始样式
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🚀</span>
                提交需求
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }

    debugLog('✅ [BUTTON] 提交按钮已启用完成', {
        status,
        finalDisabled: submitBtn.disabled,
        finalOpacity: submitBtn.style.opacity,
        finalCursor: submitBtn.style.cursor,
        buttonText: submitBtn.textContent.trim(),
        timestamp: new Date().toISOString()
    });
}

// 缓存RunningHub结果
// RunningHub 函数已移动到 src/modules/RunningHubManager.js

// 在模态框中添加缓存指示器
function addCacheIndicator() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal) return;

    // 获取任务信息（简化逻辑，直接使用全局变量）
    let taskInfo = window.currentPageTaskInfo;

    if (!taskInfo) {
        debugLog('addCacheIndicator: 没有任务信息，跳过添加缓存指示器');
        return;
    }

    // 检查是否已存在缓存指示器
    let indicator = dimensionCheckModal.querySelector('#cache-indicator');
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.id = 'cache-indicator';
    indicator.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 6px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 1001;
    `;

    const timeAgo = Math.round((Date.now() - taskInfo.cachedAt) / 1000);
    indicator.innerHTML = `
        <span style="display: flex; align-items: center; gap: 4px;">
            <span>💾</span>
            <span>已缓存 ${timeAgo < 60 ? timeAgo + 's' : Math.round(timeAgo / 60) + 'm'}</span>
        </span>
    `;

    dimensionCheckModal.appendChild(indicator);
}

// 添加清除缓存按钮
function addClearCacheButton() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal) return;

    // 检查是否已存在清除按钮
    let clearBtn = dimensionCheckModal.querySelector('#clear-cache-btn');
    if (clearBtn) return;

    clearBtn = document.createElement('button');
    clearBtn.id = 'clear-cache-btn';
    clearBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 4px;">
            <span>🗑️</span>
            <span>清除缓存</span>
        </span>
    `;
    clearBtn.style.cssText = `
        position: absolute;
        top: 16px;
        right: 60px;
        background: rgba(251, 113, 133, 0.9);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 0.2s ease;
        z-index: 1001;
    `;

    clearBtn.addEventListener('mouseenter', () => {
        clearBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        clearBtn.style.transform = 'scale(1.05)';
    });

    clearBtn.addEventListener('mouseleave', () => {
        clearBtn.style.background = 'rgba(251, 113, 133, 0.9)';
        clearBtn.style.transform = 'scale(1)';
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除缓存的生成结果吗？\n清除后将无法再次查看之前的结果。')) {
            debugLog('用户手动清除缓存');
            clearRunningHubCache();

            // 移除结果显示区域
            const resultWrap = dimensionCheckModal.querySelector('#rh-result-wrap');
            if (resultWrap) {
                resultWrap.remove();
            }

            // 移除状态栏
            const statusBar = dimensionCheckModal.querySelector('#rh-status-bar');
            if (statusBar) {
                statusBar.remove();
            }

            // 移除缓存指示器和清除按钮
            const cacheIndicator = dimensionCheckModal.querySelector('#cache-indicator');
            if (cacheIndicator) {
                cacheIndicator.remove();
            }
            clearBtn.remove();

            // 重置提交按钮
            const submitBtn = dimensionCheckModal.querySelector('#dimensionCheckSubmitBtn');
            if (submitBtn) {
                enableSubmitButton(submitBtn, 'ready');
            }

            showNotification('缓存已清除，可以重新提交任务', 2000);
        }
    });

    dimensionCheckModal.appendChild(clearBtn);
}

// 关闭尺寸检查模态框
function closeDimensionCheckModal() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal) {
        debugLog('模态框已关闭或不存在，跳过关闭操作');
        return;
    }

    const modalId = dimensionCheckModal._modalId;
    debugLog('开始关闭尺寸检查模态框', {
        modalId,
        hasEscHandler: !!dimensionCheckModal._handleEscKey,
        hasBackgroundHandler: !!dimensionCheckModal._handleBackgroundClick
    });

    // 先设置状态为关闭，防止事件处理器继续触发
    isDimensionCheckModalOpen = false;

    // 移除ESC键监听器（使用capture参数匹配绑定时的参数）
    if (dimensionCheckModal._handleEscKey) {
        document.removeEventListener('keydown', dimensionCheckModal._handleEscKey, true);
        debugLog('ESC键监听器已移除（capture阶段）');
    }

    // 移除背景点击监听器（使用capture参数）
    if (dimensionCheckModal._handleBackgroundClick) {
        dimensionCheckModal.removeEventListener('click', dimensionCheckModal._handleBackgroundClick, true);
        debugLog('背景点击监听器已移除（capture阶段）');
    }

    // 移除模态框DOM元素
    if (dimensionCheckModal.parentNode) {
        dimensionCheckModal.parentNode.removeChild(dimensionCheckModal);
        debugLog('模态框DOM元素已移除');
    }

    // 完全重置状态
    dimensionCheckModal = null;

    debugLog('尺寸检查模态框已完全关闭并清理', { modalId });
}

// 提交尺寸检查结果
async function submitDimensionCheck(comment) {
    debugLog('提交尺寸检查结果', { comment });

    const submitBtn = document.querySelector('#dimensionCheckSubmitBtn');

    // 立即禁用按钮并显示进行中状态
    disableSubmitButton(submitBtn);

    // 清除之前的缓存和状态信息
    debugLog('重新提交时清除之前的缓存和状态');
    clearRunningHubCache();

    // 清除之前的轮询状态
    window._rhPollingActive = false;
    window._rhCancelRequested = false;
    window._rhTaskIdForCancel = null;
    window._rhApiKeyForCancel = null;

    // 隐藏取消按钮
    hideRhCancelBtn();

    // 清除之前的结果显示
    const resultWrap = dimensionCheckModal?.querySelector('#rh-result-wrap');
    if (resultWrap) {
        resultWrap.remove();
        debugLog('清除了之前的结果显示');
    }

    // 检查是否有原图
    if (!originalImage) {
        showNotification('未找到原图，无法上传', 3000);
        // 重新启用按钮
        enableSubmitButton(submitBtn, 'failed');
        return;
    }

    // 获取API Key
    let apiKey = localStorage.getItem('runninghub_api_key');
    if (!apiKey) {
        apiKey = prompt('请输入您的Running Hub API Key:');
        if (!apiKey) {
            showNotification('未提供API Key，取消上传', 2000);
            // 重新启用按钮
            enableSubmitButton(submitBtn, 'ready');
            return;
        }
        localStorage.setItem('runninghub_api_key', apiKey);
    }

    try {
        showNotification('正在上传图片到Running Hub...', 0);
        const imageFile = await convertImageToFile(originalImage);
        const uploadResult = await uploadToRunningHub(imageFile, apiKey, comment);

        // 新模块返回的是对象，不需要 JSON.parse
        if (uploadResult.success && uploadResult.fileName) {
            const imageFileName = uploadResult.fileName;
            showNotification(`图片上传成功！正在创建AI应用任务...`, 2000);
            debugLog('Running Hub图片上传成功:', uploadResult);

            // 图片上传成功后，调用AI应用API
            const taskResult = await createWorkflowTask(apiKey, comment || '1 girl in classroom', imageFileName);

            debugLog('createWorkflowTask 返回结果:', taskResult);

            // 新模块返回的是对象，不需要 JSON.parse
            if (taskResult.success && taskResult.taskId) {
                const taskId = taskResult.taskId;
                showNotification(`AI应用任务创建成功！\n任务ID: ${taskId}${comment ? '\n需求: ' + comment : ''}`, 5000);
                debugLog('AI应用任务创建成功:', taskResult);

                // 开始轮询并展示结果
                updateDimensionModalProgress(`任务已创建\n🆔 任务ID: ${taskId}\n📊 状态: 正在执行中...`);

                // 显示取消按钮
                showRhCancelBtn();

                try {
                    // 开始轮询
                    const pollResult = await pollRunningHubTaskStatus(apiKey, taskId, (tick) => {
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n📊 状态: ${tick.status || 'RUNNING'}${tick.msg ? ' (' + tick.msg + ')' : ''}\n🔄 第${tick.pollCount || 0}次查询 - ${Math.round((tick.elapsed || 0) / 1000)}秒`);
                    });

                    debugLog('轮询完成', pollResult);

                    // 处理轮询成功的结果
                    if (pollResult.final === 'SUCCESS') {
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n✅ 任务成功，正在获取结果...`);
                        try {
                            const outs = await fetchRunningHubTaskOutputs(apiKey, taskId);
                            debugLog('🔄 [POLL] 获取到任务输出，开始渲染', {
                                taskId,
                                outputs: outs,
                                outputsType: typeof outs,
                                outputsKeys: outs ? Object.keys(outs) : 'null'
                            });
                            renderRunningHubResultsInModal(outs);
                            debugLog('✅ [POLL] 结果渲染调用完成，更新进度显示', {
                                taskId,
                                totalTime: Math.round(pollResult.totalTime / 1000)
                            });
                            debugLog('📊 [POLL] 开始更新进度显示为任务完成', {
                                taskId,
                                totalTime: Math.round(pollResult.totalTime / 1000),
                                elapsed: Math.round(pollResult.elapsed / 1000),
                                rawTotalTime: pollResult.totalTime,
                                rawElapsed: pollResult.elapsed,
                                pollResult: pollResult
                            });
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n✅ 任务已完成 - 耗时${Math.round(pollResult.totalTime / 1000)}秒`);
                            debugLog('✅ [POLL] 进度显示更新完成', {
                                taskId,
                                message: `任务已完成 - 耗时${Math.round(pollResult.totalTime / 1000)}秒`
                            });

                            // 缓存成功的结果
                            debugLog('📝 准备缓存 RunningHub 结果', {
                                taskId,
                                hasOutputs: !!outs,
                                outputsKeys: outs ? Object.keys(outs) : 'null'
                            });
                            const cacheSuccess = cacheRunningHubResults(taskId, outs, {
                                status: 'success',
                                statusMessage: `✅ 任务已完成 - 耗时${Math.round(pollResult.totalTime / 1000)}秒`,
                                comment: comment,
                                completedAt: new Date().toISOString()
                            });

                            // 调试：检查缓存是否成功
                            debugLog('📝 缓存结果检查', {
                                cacheSuccess,
                                globalCachedResults: !!window.cachedRunningHubResults,
                                globalTaskInfo: !!window.currentPageTaskInfo
                            });
                            if (window.AuxisLogger) {
                                window.AuxisLogger.debug('任务完成，缓存结果', {
                                    cacheSuccess,
                                    hasCache: !!window.cachedRunningHubResults,
                                    hasTaskInfo: !!window.currentPageTaskInfo
                                });
                            }

                            // 任务成功完成，启用按钮为完成状态
                            debugLog('🎯 [POLL] 任务成功完成，启用按钮为完成状态', {
                                taskId,
                                buttonExists: !!submitBtn,
                                currentButtonState: submitBtn ? submitBtn.disabled : 'no button'
                            });
                            enableSubmitButton(submitBtn, 'success');

                            // 立即重置轮询状态，避免模态框状态检查误判
                            debugLog('🔄 [POLL] 任务成功完成，立即重置轮询状态');
                            resetRunningHubPollingState();
                        } catch (e) {
                            debugLog('获取输出失败:', e);
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n⚠️ 任务完成，但获取输出失败：${e.message}`);
                            // 获取输出失败，允许重新提交
                            enableSubmitButton(submitBtn, 'failed');
                        }
                    } else if (pollResult.final === 'FAILED') {
                        debugLog('任务失败', pollResult.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 任务失败 - ${pollResult.raw?.msg || '未知原因'}`);

                        // 如果有失败详情，显示给用户
                        if (pollResult.raw?.data?.failedReason) {
                            const failedReason = pollResult.raw.data.failedReason;
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 失败原因：${failedReason.exception_message || failedReason.exception_type || '系统错误'}`);
                        }
                        // 任务失败，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    } else if (pollResult.final === 'ERROR') {
                        debugLog('任务出错', pollResult.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 任务出错 - ${pollResult.raw?.msg || '系统错误'}`);
                        // 任务出错，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    } else if (pollResult.final === 'CANCELED') {
                        debugLog('任务已取消', pollResult.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n🚫 任务已取消`);
                        // 任务被取消，允许重新提交
                        enableSubmitButton(submitBtn, 'canceled');
                    } else {
                        debugLog('未知的最终状态', pollResult);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❓ 任务结束：${pollResult.final}`);
                        // 未知状态，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    }
                } catch (error) {
                    // 处理轮询过程中的错误
                    debugLog('轮询过程失败:', error);
                    updateDimensionModalProgress('轮询失败：' + error.message);
                    // 轮询失败，允许重新提交
                    enableSubmitButton(submitBtn, 'failed');
                } finally {
                    // 确保无论成功还是失败，都重置轮询状态
                    debugLog('轮询结束，执行最终状态重置');
                    hideRhCancelBtn();

                    if (window.runningHubManager && window.runningHubManager.isInitialized()) {
                        window.runningHubManager.getTaskManager().resetPollingState();
                        debugLog('RunningHub polling state has been reset.');
                    } else {
                        // 兼容模式：手动重置所有状态
                        window._rhPollingActive = false;
                        window._rhCancelRequested = false;
                        window._rhTaskIdForCancel = null;
                        window._rhApiKeyForCancel = null;
                        debugLog('Polling state reset via compatibility mode.');
                    }
                }
            } else {
                throw new Error('AI应用任务创建失败: ' + (taskResult.message || '未知错误'));
            }
        } else {
            throw new Error(uploadResult.message || '图片上传失败');
        }
    } catch (error) {
        debugLog('运行失败:', error);
        showNotification('运行失败: ' + error.message, 3000);
        // 运行失败，重新启用按钮
        enableSubmitButton(submitBtn, 'failed');
    }

    // 保留模态框查看结果
    // closeDimensionCheckModal();
}

// 辅助函数：重置RunningHub轮询状态
// resetRunningHubPollingState 函数已移动到 src/modules/RunningHubManager.js

// R键功能：手动触发图片尺寸检查
async function manualDimensionCheck() {
    debugLog('手动触发图片尺寸检查');

    // 确保 RunningHub Manager 已初始化
    if (runningHubManager && !runningHubManager.isInitialized()) {
        debugLog('等待 RunningHub Manager 初始化完成...');
        // 简单等待一下
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 检查缓存的两种方式：新模块和兼容模式
    let cachedResults = null;
    let taskInfo = null;

    debugLog('🔍 开始检查缓存状态', {
        hasRunningHubManager: !!runningHubManager,
        isManagerInitialized: runningHubManager ? runningHubManager.isInitialized() : false,
        globalCachedResults: !!window.cachedRunningHubResults,
        globalTaskInfo: !!window.currentPageTaskInfo
    });

    if (runningHubManager && runningHubManager.isInitialized()) {
        // 使用新模块
        const cacheManager = runningHubManager.getCacheManager();
        cachedResults = cacheManager.getCachedResults();
        taskInfo = cacheManager.getCurrentTaskInfo();
        debugLog('通过新模块检查缓存', { hasCache: !!cachedResults, taskInfo });
    } else {
        // 回退到兼容模式
        cachedResults = window.cachedRunningHubResults;
        taskInfo = window.currentPageTaskInfo;
        debugLog('通过兼容模式检查缓存', { hasCache: !!cachedResults, taskInfo });
    }

    // 检查是否有缓存的结果可以快速显示
    if (cachedResults && taskInfo) {
        debugLog('检测到缓存结果，询问用户是否查看', {
            taskId: taskInfo.taskId,
            cachedAt: new Date(taskInfo.cachedAt).toLocaleString(),
            status: taskInfo.status
        });

        // 如果缓存存在，说明任务已完成，确保轮询状态正确
        resetRunningHubPollingState();

        const timeAgo = Math.round((Date.now() - taskInfo.cachedAt) / 60000);
        const shouldViewCached = confirm(
            `检测到${timeAgo < 1 ? '刚才' : timeAgo + '分钟前'}的生成结果缓存\n` +
            `任务ID: ${taskInfo.taskId}\n` +
            `需求: ${taskInfo.comment || '无'}\n\n` +
            `是否查看缓存的结果？\n` +
            `点击"确定"查看缓存，点击"取消"重新检查图片`
        );

        if (shouldViewCached) {
            debugLog('🎯 [CACHE] 用户选择查看缓存结果，准备显示模态框', {
                taskId: taskInfo.taskId,
                hasOriginalImage: !!originalImage,
                modalWillShow: true
            });
            // 直接显示模态框，缓存会自动恢复
            const imageInfoForModal = {
                src: originalImage?.src || 'cached_result',
                width: originalImage?.width || 0,
                height: originalImage?.height || 0,
                name: originalImage?.name || '缓存结果'
            };
            debugLog('🎯 [CACHE] 调用showDimensionCheckModal显示缓存', {
                imageInfo: imageInfoForModal,
                isDimensionValid: true
            });
            showDimensionCheckModal(imageInfoForModal, true);
            showNotification('已显示缓存的生成结果', 2000);
            return true;
        } else {
            debugLog('用户选择重新检查，清除缓存');
            // 使用新模块或兼容方式清除缓存
            if (runningHubManager && runningHubManager.isInitialized()) {
                runningHubManager.getCacheManager().clear();
            } else {
                clearRunningHubCache();
            }
        }
    }

    try {
        // 获取当前原图
        if (!originalImage) {
            debugLog('未找到原图，尝试重新检测');
            recordOriginalImages();
            
            // 等待一下再检查
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!originalImage) {
                showNotification('❌ 未找到原图，请等待页面加载完成', 3000);
                return;
            }
        }
        
        // 创建新的Image对象来获取真实的图片尺寸
        const img = new Image();
        
        // 等待图片加载完成
        const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
        });
        
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('图片加载超时')), 5000);
        });
        
        img.src = originalImage.src;
        
        // 等待图片加载或超时
        const { width, height } = await Promise.race([loadPromise, timeoutPromise]);
        
        debugLog('手动检查图片尺寸', { width, height, src: originalImage.src });
        
        // 检查尺寸是否符合要求（长宽都是8的倍数）
        const isWidthValid = width % 8 === 0;
        const isHeightValid = height % 8 === 0;
        const isDimensionValid = isWidthValid && isHeightValid;
        
        debugLog('手动尺寸检查结果', {
            width,
            height,
            isWidthValid,
            isHeightValid,
            isDimensionValid
        });
        
        if (isDimensionValid) {
            // 尺寸符合要求，弹出模态框
            showNotification('✅ 图片尺寸符合要求，弹出模态框', 1500);
            
            // 保存检查信息
            lastDimensionCheckInfo = {
                imageInfo: {
                    src: originalImage.src,
                    width: width,
                    height: height,
                    name: originalImage.name || extractFileNameFromUrl(originalImage.src) || '原图'
                },
                isDimensionValid: true,
                width: width,
                height: height,
                timestamp: Date.now()
            };
            
            // 创建包含正确尺寸信息的图片对象
            const imageInfoForModal = {
                src: originalImage.src,
                width: width,
                height: height,
                name: originalImage.name || extractFileNameFromUrl(originalImage.src) || '原图'
            };
            
            // 显示模态框
            showDimensionCheckModal(imageInfoForModal, true);
            return true; // 返回true表示符合要求
            
        } else {
            // 尺寸不符合要求，系统提示
            const widthStatus = isWidthValid ? '✅' : '❌';
            const heightStatus = isHeightValid ? '✅' : '❌';
            
            showNotification(
                `❌ 图片尺寸不符合要求！\n` +
                `宽度: ${width}px ${widthStatus} (${isWidthValid ? '是' : '不是'}8的倍数)\n` +
                `高度: ${height}px ${heightStatus} (${isHeightValid ? '是' : '不是'}8的倍数)\n` +
                `要求: 长宽都必须是8的倍数`, 
                4000
            );
            
            debugLog('图片尺寸不符合要求', {
                width, height,
                widthRemainder: width % 8,
                heightRemainder: height % 8,
                isWidthValid, isHeightValid,
                src: originalImage.src
            });
            return false; // 返回false表示不符合要求
        }
        
    } catch (error) {
        debugLog('手动检查图片尺寸时出错', error);
        showNotification('❌ 检查图片尺寸时出错: ' + error.message, 3000);
        return false; // 出错时返回false
    }
}

// 验证图片并显示尺寸检查模态框
async function validateAndShowDimensionCheckModal(imageInfo, isDimensionValid) {
    debugLog('验证图片资源并显示模态框', {
        src: imageInfo.src ? imageInfo.src.substring(0, 50) + '...' : '无src'
    });
    
    try {
        // 创建一个新的图片对象来验证资源是否可用
        const testImg = new Image();
        
        // 设置超时时间
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('图片加载超时')), 5000);
        });
        
        // 图片加载Promise
        const loadPromise = new Promise((resolve, reject) => {
            testImg.onload = function() {
                debugLog('图片验证成功', {
                    naturalWidth: this.naturalWidth,
                    naturalHeight: this.naturalHeight,
                    expectedWidth: imageInfo.width,
                    expectedHeight: imageInfo.height
                });
                
                // 验证尺寸是否匹配
                if (this.naturalWidth === imageInfo.width && this.naturalHeight === imageInfo.height) {
                    resolve(true);
                } else {
                    debugLog('图片尺寸不匹配，可能是不同的图片', {
                        actual: `${this.naturalWidth}×${this.naturalHeight}`,
                        expected: `${imageInfo.width}×${imageInfo.height}`
                    });
                    resolve(false);
                }
            };
            
            testImg.onerror = function() {
                debugLog('图片加载失败');
                reject(new Error('图片加载失败'));
            };
        });
        
        // 开始加载图片
        testImg.src = imageInfo.src;
        
        // 等待加载完成或超时
        const isValid = await Promise.race([loadPromise, timeout]);
        
        if (isValid) {
            // 图片验证成功，显示模态框
            showDimensionCheckModal(imageInfo, isDimensionValid);
            showNotification('已重新弹出尺寸检查模态框', 1000);
        } else {
            // 图片尺寸不匹配，提示用户重新检查
            showNotification('保存的图片信息已过期，请重新按F2键检查', 3000);
            lastDimensionCheckInfo = null; // 清除无效信息
        }
        
    } catch (error) {
        debugLog('图片验证失败', error);
        
        // 图片加载失败，尝试使用当前原图
        if (originalImage && originalImage.src) {
            debugLog('图片验证失败，尝试使用当前原图');
            showNotification('原图片资源失效，使用当前原图重新检查...', 2000);
            
            // 重新执行F2键检查逻辑
            setTimeout(() => {
                checkImageDimensionsAndShowModal();
            }, 500);
        } else {
            showNotification('图片资源失效且未找到当前原图，请重新按F2键检查', 3000);
            lastDimensionCheckInfo = null; // 清除无效信息
        }
    }
}

// 将图片转换为文件对象 - 解决CORS问题版本
async function convertImageToFile(imageInfo) {
    debugLog('开始转换图片为文件', {
        type: typeof imageInfo,
        hasElement: !!(imageInfo && imageInfo.element),
        hasSrc: !!(imageInfo && imageInfo.src),
        isHTMLElement: imageInfo instanceof HTMLImageElement
    });

    try {
        const imageUrl = imageInfo.src || (imageInfo.element && imageInfo.element.src);
        if (!imageUrl) {
            throw new Error('无法获取图片URL');
        }

        debugLog('获取图片URL', imageUrl.substring(0, 100) + '...');

        // 检查是否是跨域图片
        const isCrossOrigin = !imageUrl.startsWith(window.location.origin) &&
                             !imageUrl.startsWith('data:') &&
                             !imageUrl.startsWith('blob:');

        if (isCrossOrigin) {
            debugLog('检测到跨域图片，使用background script代理获取');
            return await fetchImageViaBackgroundScript(imageUrl);
        } else {
            debugLog('同域图片，使用标准Canvas方法');
            return await convertViaCanvas(imageInfo);
        }

    } catch (error) {
        debugLog('convertImageToFile失败:', error);
        throw error;
    }
}

// 通过background script获取图片并转换为文件
async function fetchImageViaBackgroundScript(imageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime不可用'));
            return;
        }

        debugLog('向background script请求图片数据');

        chrome.runtime.sendMessage({
            action: 'fetchCOSImage',
            url: imageUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                debugLog('background script通信失败:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (response && response.success) {
                debugLog('background script返回成功', {
                    hasDataUrl: !!response.data.dataUrl,
                    type: response.data.type,
                    size: response.data.size
                });

                // 从background script返回的dataUrl直接创建文件
                try {
                    const dataUrl = response.data.dataUrl;
                    if (!dataUrl || !dataUrl.startsWith('data:')) {
                        throw new Error('无效的dataUrl格式');
                    }

                    // 解析dataUrl
                    const [header, base64Data] = dataUrl.split(',');
                    const mimeType = header.split(':')[1].split(';')[0];

                    // 转换base64为二进制数据
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);

                    // 创建blob和文件
                    const fileBlob = new Blob([byteArray], { type: mimeType });
                    const extension = mimeType.split('/')[1] || 'jpg';
                    const fileName = `image_${Date.now()}.${extension}`;
                    const file = new File([fileBlob], fileName, { type: mimeType });

                    debugLog('从dataUrl创建文件成功', {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        originalSize: response.data.size
                    });

                    resolve(file);
                } catch (parseError) {
                    debugLog('dataUrl解析失败:', parseError);
                    reject(new Error('dataUrl解析失败: ' + parseError.message));
                }
            } else {
                debugLog('background script返回失败:', response);
                reject(new Error(response?.error || 'background script获取图片失败'));
            }
        });
    });
}

// 标准Canvas转换方法（用于同域图片）
async function convertViaCanvas(imageInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            let imgElement;

            // 获取图片元素
            if (imageInfo instanceof HTMLImageElement) {
                imgElement = imageInfo;
            } else if (imageInfo && imageInfo.element instanceof HTMLImageElement) {
                imgElement = imageInfo.element;
            } else if (imageInfo && imageInfo.src) {
                // 在页面中查找匹配的图片元素
                const allImages = document.querySelectorAll('img[src]');
                imgElement = Array.from(allImages).find(img => img.src === imageInfo.src);

                if (!imgElement) {
                    // 创建新的图片元素
                    imgElement = new Image();

                    await new Promise((loadResolve, loadReject) => {
                        const timeout = setTimeout(() => {
                            loadReject(new Error('图片加载超时'));
                        }, 8000);

                        imgElement.onload = () => {
                            clearTimeout(timeout);
                            loadResolve();
                        };

                        imgElement.onerror = () => {
                            clearTimeout(timeout);
                            loadReject(new Error('图片加载失败'));
                        };

                        imgElement.src = imageInfo.src;
                    });
                }
            } else {
                throw new Error('无效的图片参数');
            }

            // 验证图片元素
            if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
                throw new Error('无效的图片元素');
            }

            const width = imgElement.naturalWidth || imgElement.width;
            const height = imgElement.naturalHeight || imgElement.height;

            if (!width || !height) {
                throw new Error('图片尺寸无效');
            }

            debugLog('开始Canvas转换（同域）', { width, height });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = width;
            canvas.height = height;

            // 绘制图片
            ctx.drawImage(imgElement, 0, 0);

            // 转换为blob
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'image.png', { type: 'image/png' });
                    debugLog('Canvas转换成功');
                    resolve(file);
                } else {
                    reject(new Error('Canvas转换为blob失败'));
                }
            }, 'image/png');

        } catch (error) {
            debugLog('Canvas转换失败:', error);
            reject(error);
        }
    });
}

// 上传到Running Hub API
// uploadToRunningHub 函数已移动到 src/modules/RunningHubManager.js

// ========== RunningHub 轮询与结果展示（最小增量） ==========

function updateDimensionModalProgress(text) {
    debugLog('📊 [PROGRESS] 更新进度显示', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        modalOpen: isDimensionCheckModalOpen,
        modalExists: !!dimensionCheckModal,
        timestamp: new Date().toISOString()
    });

    try {
        if (!isDimensionCheckModalOpen || !dimensionCheckModal) {
            debugLog('❌ [PROGRESS] 模态框未打开或不存在，跳过更新', {
                modalOpen: isDimensionCheckModalOpen,
                modalExists: !!dimensionCheckModal
            });
            return;
        }
        let bar = dimensionCheckModal.querySelector('#rh-status-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'rh-status-bar';
            bar.style.cssText = `
                margin-top: 12px;
                padding: 12px 15px;
                border-radius: 10px;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                color: #334155;
                font-size: 13px;
                line-height: 1.5;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            `;
            const content = dimensionCheckModal.querySelector('div[style*="max-width: 580px"]');
            if (content) content.appendChild(bar);
            else dimensionCheckModal.appendChild(bar);
        }

        // 左侧状态文字区域
        let textEl = bar.querySelector('#rh-status-text');
        if (!textEl) {
            textEl = document.createElement('div');
            textEl.id = 'rh-status-text';
            textEl.style.cssText = `
                flex: 1;
                white-space: pre-line;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                background: rgba(255, 255, 255, 0.7);
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.1);
                font-size: 12px;
                line-height: 1.4;
            `;
            bar.appendChild(textEl);
        }

        // 格式化显示文本
        const formattedText = typeof text === 'string' ? text : JSON.stringify(text);
        textEl.textContent = formattedText;

        debugLog('✅ [PROGRESS] 进度文本已更新到DOM', {
            formattedText,
            elementExists: !!textEl,
            elementId: textEl.id,
            finalContent: textEl.textContent
        });

        // 根据内容设置样式
        if (formattedText.includes('✅') || formattedText.includes('成功')) {
            textEl.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
            textEl.style.borderColor = '#16a34a';
            textEl.style.color = '#166534';
        } else if (formattedText.includes('❌') || formattedText.includes('失败') || formattedText.includes('错误')) {
            textEl.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
            textEl.style.borderColor = '#dc2626';
            textEl.style.color = '#991b1b';
        } else if (formattedText.includes('🚫') || formattedText.includes('取消')) {
            textEl.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
            textEl.style.borderColor = '#d97706';
            textEl.style.color = '#92400e';
        } else {
            textEl.style.background = 'rgba(255, 255, 255, 0.7)';
            textEl.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            textEl.style.color = '#334155';
        }

        // 右侧"取消任务"按钮
        let cancelBtn = bar.querySelector('#rh-cancel-btn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'rh-cancel-btn';
            cancelBtn.textContent = '取消任务';
            cancelBtn.style.cssText = `
                padding: 8px 12px;
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                color: #b91c1c;
                border: 1px solid #fecaca;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                cancelBtn.style.transform = 'translateY(-1px)';
                cancelBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                cancelBtn.style.transform = 'translateY(0)';
                cancelBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            });
            cancelBtn.addEventListener('click', async () => {
                try {
                    if (!window._rhTaskIdForCancel || !window._rhApiKeyForCancel) {
                        updateDimensionModalProgress('未找到可取消的任务');
                        return;
                    }
                    if (window._rhCancelRequested) return;
                    window._rhCancelRequested = true;
                    cancelBtn.disabled = true;
                    cancelBtn.textContent = '取消中...';
                    cancelBtn.style.opacity = '0.6';
                    await cancelRunningHubTask(window._rhApiKeyForCancel, window._rhTaskIdForCancel);
                    updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel}\n🚫 任务已申请取消，请稍候更新状态...`);

                    // 取消任务后，重新启用提交按钮
                    const submitBtn = document.querySelector('#dimensionCheckSubmitBtn');
                    enableSubmitButton(submitBtn, 'canceled');
                } catch (e) {
                    updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel || 'unknown'}\n❌ 取消失败：${e.message}`);
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = '取消任务';
                    cancelBtn.style.opacity = '1';
                    window._rhCancelRequested = false;
                }
            });
            bar.appendChild(cancelBtn);
        }
    } catch (_) {}
}

// pollRunningHubTaskStatus 函数已移动到 src/modules/RunningHubManager.js

// fetchRunningHubTaskOutputs 和 cancelRunningHubTask 函数已移动到 src/modules/RunningHubManager.js

function renderRunningHubResultsInModal(outputsJson) {
    try {
        debugLog('🎨 [RENDER] 开始渲染RunningHub结果', {
            outputsJson,
            modalOpen: isDimensionCheckModalOpen,
            modalExists: !!dimensionCheckModal,
            timestamp: new Date().toISOString()
        });

        // 检查函数依赖是否可用
        debugLog('🔍 [RENDER] 检查函数依赖', {
            downloadImageToLocal: typeof downloadImageToLocal,
            generateResultImageFileName: typeof generateResultImageFileName,
            extractFileNameFromUrl: typeof extractFileNameFromUrl,
            showNotification: typeof showNotification
        });

        if (!isDimensionCheckModalOpen || !dimensionCheckModal) {
            debugLog('❌ [RENDER] 模态框未打开或不存在，跳过渲染', {
                modalOpen: isDimensionCheckModalOpen,
                modalExists: !!dimensionCheckModal
            });
            return;
        }
        let wrap = dimensionCheckModal.querySelector('#rh-result-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'rh-result-wrap';
            wrap.style.cssText = `
                margin-top: 12px;
                padding: 12px;
                border-radius: 10px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
            `;
            const content = dimensionCheckModal.querySelector('div[style*="max-width: 580px"]');
            if (content) content.appendChild(wrap);
            else dimensionCheckModal.appendChild(wrap);
        }

        // 根据API文档，正确解析返回结果（恢复原有逻辑）
        const outputs = outputsJson?.data || outputsJson?.outputs || outputsJson;
        const items = Array.isArray(outputs) ? outputs : (outputs?.outputs || []);

        debugLog('🔍 [RENDER] 解析输出数据', {
            outputsJson,
            outputs,
            items: items ? items.length : 'null',
            itemsType: typeof items,
            itemsIsArray: Array.isArray(items),
            hasImageItems: items ? items.filter(item => item?.type === 'image' || (item?.value && typeof item.value === 'string' && item.value.startsWith('http'))).length : 0
        });

        wrap.innerHTML = '';

        if (!items || items.length === 0) {
            debugLog('⚠️ [RENDER] 无输出项目或输出为空', {
                hasItems: !!items,
                itemsLength: items ? items.length : 'null',
                itemsContent: items,
                rawOutputsJson: outputsJson
            });
            wrap.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 18px; margin-bottom: 10px;">📭</div>
                    <div>任务完成，但未返回可展示的输出。</div>
                    <div style="font-size: 12px; margin-top: 8px; color: #999;">
                        API返回: ${JSON.stringify(outputsJson).substring(0, 100)}...
                    </div>
                </div>
            `;
            return;
        }

        let hasRenderedContent = false;

        items.forEach((item, index) => {
            debugLog(`处理输出项目 #${index}`, item);

            // 根据API文档，正确的字段名是 fileUrl
            const fileUrl = item.fileUrl || item.url || item.imageUrl || item.value;
            const fileType = item.fileType || 'unknown';
            const nodeId = item.nodeId || 'unknown';
            const taskCostTime = item.taskCostTime || 0;
            const text = item.text || (typeof item.value === 'string' ? item.value : '');

            debugLog(`项目 #${index} 解析结果`, {
                fileUrl: fileUrl ? fileUrl.substring(0, 100) + '...' : 'no fileUrl',
                fileType,
                nodeId,
                taskCostTime,
                hasText: !!text
            });

            // 处理图片结果
            if (fileUrl && typeof fileUrl === 'string' && /(https?:\/\/|data:image)/i.test(fileUrl)) {
                debugLog(`渲染图片结果 #${index}`, fileUrl.substring(0, 50) + '...');

                const container = document.createElement('div');
                container.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                `;

                // 图片信息标题
                const infoHeader = document.createElement('div');
                infoHeader.style.cssText = `
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                `;
                infoHeader.innerHTML = `
                    <span>🎨 生成结果 #${index + 1}</span>
                    <span style="font-size: 11px; color: #6b7280; font-weight: 400;">
                        ${fileType.toUpperCase()} • 节点${nodeId} • ${taskCostTime}s
                    </span>
                `;

                // 图片容器 - 添加点击查看大图功能和双向滚动支持
                const imgContainer = document.createElement('div');
                imgContainer.style.cssText = `
                    text-align: center;
                    cursor: pointer;
                    position: relative;
                    border-radius: 8px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    max-height: 400px;
                    max-width: 100%;
                `;

                const img = document.createElement('img');
                img.src = fileUrl;
                img.alt = 'RunningHub生成结果';
                img.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    border: none;
                    transition: all 0.2s ease;
                    display: block;
                `;

                // 添加悬停提示
                const hoverOverlay = document.createElement('div');
                hoverOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                `;
                hoverOverlay.innerHTML = '🔍 点击查看大图';

                // 悬停效果和滚动提示
                imgContainer.addEventListener('mouseenter', () => {
                    hoverOverlay.style.opacity = '1';
                    // 检查是否需要滚动并显示相应提示
                    const needsVerticalScroll = img.scrollHeight > imgContainer.clientHeight;
                    const needsHorizontalScroll = img.scrollWidth > imgContainer.clientWidth;

                    if (needsVerticalScroll || needsHorizontalScroll) {
                        if (needsVerticalScroll && needsHorizontalScroll) {
                            scrollIndicator.innerHTML = '↕️↔️ 双向滚动';
                        } else if (needsVerticalScroll) {
                            scrollIndicator.innerHTML = '↕️ 垂直滚动';
                        } else {
                            scrollIndicator.innerHTML = '↔️ 水平滚动';
                        }
                        scrollIndicator.style.opacity = '0.8';
                    }
                });

                imgContainer.addEventListener('mouseleave', () => {
                    hoverOverlay.style.opacity = '0';
                    scrollIndicator.style.opacity = '0';
                });

                // 移除滚轮提示与滚动处理，固定窗口内完整展示
                imgContainer.addEventListener('wheel', (e) => {
                    e.stopPropagation();
                });

                // 点击查看大图
                imgContainer.addEventListener('click', () => {
                    showImageLightbox(fileUrl, `生成结果 #${index + 1}`, {
                        fileType,
                        nodeId,
                        taskCostTime,
                        fileName: generateResultImageFileName(originalImage, fileType, index, '副本')
                    });
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(hoverOverlay);

                // 添加滚动指示器
                const scrollIndicator = document.createElement('div');
                scrollIndicator.style.cssText = `
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    z-index: 10;
                `;
                scrollIndicator.innerHTML = '';
                imgContainer.appendChild(scrollIndicator);

                // 图片加载完成后，确保在固定窗口内完整展示
                img.addEventListener('load', () => {
                    scrollIndicator.style.display = 'none';
                });

                // 操作按钮区域
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = `
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                    flex-wrap: wrap;
                `;

                // 查看大图按钮
                const viewBtn = document.createElement('button');
                viewBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>🔍</span>
                        查看大图
                    </span>
                `;
                viewBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
                `;

                viewBtn.addEventListener('click', () => {
                    showImageLightbox(fileUrl, `生成结果 #${index + 1}`, {
                        fileType,
                        nodeId,
                        taskCostTime,
                        fileName: generateResultImageFileName(originalImage, fileType, index, '副本')
                    });
                });

                // 下载按钮 - 使用Chrome扩展下载
                const downloadBtn = document.createElement('button');
                downloadBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>📥</span>
                        下载并打开
                    </span>
                `;
                downloadBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
                `;

                downloadBtn.addEventListener('click', () => {
                    downloadImageToLocal(fileUrl, fileType, index, null, true); // 生成结果支持自动打开
                });

                // 上传图片按钮
                const uploadBtn = document.createElement('button');
                uploadBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>📤</span>
                        应用图片
                    </span>
                `;
                uploadBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
                `;

                uploadBtn.addEventListener('click', () => {
                    uploadImageToAnnotationPlatform(fileUrl, fileType, index);
                });

                // 按钮悬停效果
                [viewBtn, downloadBtn, uploadBtn].forEach(btn => {
                    btn.addEventListener('mouseenter', () => {
                        btn.style.transform = 'translateY(-1px)';
                        if (btn === viewBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.3)';
                        } else if (btn === downloadBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(5, 150, 105, 0.3)';
                        } else if (btn === uploadBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                        }
                    });

                    btn.addEventListener('mouseleave', () => {
                        btn.style.transform = 'translateY(0)';
                        if (btn === viewBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.2)';
                        } else if (btn === downloadBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(5, 150, 105, 0.2)';
                        } else if (btn === uploadBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                        }
                    });
                });

                buttonContainer.appendChild(viewBtn);
                buttonContainer.appendChild(downloadBtn);
                buttonContainer.appendChild(uploadBtn);

                container.appendChild(infoHeader);
                container.appendChild(imgContainer);
                container.appendChild(buttonContainer);
                wrap.appendChild(container);

                hasRenderedContent = true;
            }

            // 处理文本结果
            if (text && (!fileUrl || text !== fileUrl)) {
                debugLog(`渲染文本结果 #${index}`, text.substring(0, 50) + '...');

                const textContainer = document.createElement('div');
                textContainer.style.cssText = `
                    font-size: 13px;
                    color: #334155;
                    background: #f8fafc;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 8px;
                    line-height: 1.4;
                `;
                textContainer.textContent = text;
                wrap.appendChild(textContainer);

                hasRenderedContent = true;
            }
        });

        if (!hasRenderedContent) {
            debugLog('未渲染任何内容');
            wrap.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 18px; margin-bottom: 10px;">🤔</div>
                    <div>任务完成，但未找到可显示的结果。</div>
                    <div style="font-size: 12px; margin-top: 8px; color: #999;">
                        调试信息: ${JSON.stringify(outputsJson).substring(0, 200)}...
                    </div>
                </div>
            `;
        } else {
            debugLog('✅ [RENDER] 结果渲染完成', {
                itemCount: items.length,
                hasRenderedContent,
                renderTimestamp: new Date().toISOString(),
                modalStillOpen: isDimensionCheckModalOpen
            });
        }

    } catch (e) {
        console.error('渲染结果失败:', e);
        debugLog('renderRunningHubResultsInModal失败:', e);
        updateDimensionModalProgress('渲染结果失败: ' + e.message);
    }
}

// 显示图片对比查看器（原图 vs 生成结果）
function showImageLightbox(resultImageUrl, title, metadata) {
    debugLog('显示图片对比查看器', {
        resultImageUrl: resultImageUrl.substring(0, 50) + '...',
        title,
        hasOriginalImage: !!originalImage
    });

    // 创建lightbox容器
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
    `;

    // 顶部信息栏
    const infoBar = document.createElement('div');
    infoBar.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 16px 24px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        max-width: 90%;
        z-index: 10;
    `;

    // 检查是否有原图可对比
    const hasOriginalImage = originalImage && originalImage.src;

    infoBar.innerHTML = `
        <div style="margin-bottom: 4px;">${title} ${hasOriginalImage ? '- 对比查看' : ''}</div>
        <div style="font-size: 12px; opacity: 0.8;">
            ${metadata.fileType?.toUpperCase() || 'IMAGE'} • 节点${metadata.nodeId} • 耗时${metadata.taskCostTime}s
        </div>
        ${hasOriginalImage ? '<div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">左：原图 | 右：生成结果</div>' : ''}
    `;

    // 主要内容区域
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 80px 20px 100px 20px;
        gap: 20px;
    `;

    if (hasOriginalImage) {
        // 对比模式：显示原图和生成结果
        debugLog('创建对比查看模式');

        // 左侧：原图
        const originalContainer = createImageComparisonContainer(
            originalImage.src,
            '📸 原图',
            `${originalImage.width || '未知'} × ${originalImage.height || '未知'}px`,
            '#e3f2fd'
        );

        // 右侧：生成结果
        const resultContainer = createImageComparisonContainer(
            resultImageUrl,
            '🎨 生成结果',
            `${metadata.fileType?.toUpperCase() || 'IMAGE'} • 节点${metadata.nodeId}`,
            '#f3e5f5'
        );

        mainContent.appendChild(originalContainer);

        // 添加分隔线
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 2px;
            height: 80%;
            background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent);
            border-radius: 1px;
        `;
        mainContent.appendChild(separator);

        mainContent.appendChild(resultContainer);

        // 添加同步滚动功能
        setTimeout(() => {
            // 获取两个图片容器的滚动元素（第二个子元素是imgWrapper）
            const originalImgWrapper = originalContainer.children[1];
            const resultImgWrapper = resultContainer.children[1];

            // 验证元素存在性
            if (originalImgWrapper && resultImgWrapper) {
                // 同步滚动事件
                let isSyncingScroll = false;

                // 创建防抖函数
                const debounceSync = (callback) => {
                    if (!isSyncingScroll) {
                        isSyncingScroll = true;
                        callback();
                        requestAnimationFrame(() => {
                            isSyncingScroll = false;
                        });
                    }
                };

                // 原图滚动同步到结果图
                originalImgWrapper.addEventListener('scroll', () => {
                    debounceSync(() => {
                        // 同步垂直滚动
                        const originalScrollTop = originalImgWrapper.scrollTop;
                        const originalScrollHeight = originalImgWrapper.scrollHeight;
                        const originalClientHeight = originalImgWrapper.clientHeight;

                        const resultScrollHeight = resultImgWrapper.scrollHeight;
                        const resultClientHeight = resultImgWrapper.clientHeight;

                        // 按比例同步滚动位置
                        const scrollRatio = originalScrollTop / (originalScrollHeight - originalClientHeight);
                        resultImgWrapper.scrollTop = scrollRatio * (resultScrollHeight - resultClientHeight);

                        // 同步水平滚动
                        const originalScrollLeft = originalImgWrapper.scrollLeft;
                        const originalScrollWidth = originalImgWrapper.scrollWidth;
                        const originalClientWidth = originalImgWrapper.clientWidth;

                        const resultScrollWidth = resultImgWrapper.scrollWidth;
                        const resultClientWidth = resultImgWrapper.clientWidth;

                        const scrollLeftRatio = originalScrollLeft / (originalScrollWidth - originalClientWidth);
                        resultImgWrapper.scrollLeft = scrollLeftRatio * (resultScrollWidth - resultClientWidth);
                    });
                });

                // 结果图滚动同步到原图
                resultImgWrapper.addEventListener('scroll', () => {
                    debounceSync(() => {
                        // 同步垂直滚动
                        const resultScrollTop = resultImgWrapper.scrollTop;
                        const resultScrollHeight = resultImgWrapper.scrollHeight;
                        const resultClientHeight = resultImgWrapper.clientHeight;

                        const originalScrollHeight = originalImgWrapper.scrollHeight;
                        const originalClientHeight = originalImgWrapper.clientHeight;

                        // 按比例同步滚动位置
                        const scrollRatio = resultScrollTop / (resultScrollHeight - resultClientHeight);
                        originalImgWrapper.scrollTop = scrollRatio * (originalScrollHeight - originalClientHeight);

                        // 同步水平滚动
                        const resultScrollLeft = resultImgWrapper.scrollLeft;
                        const resultScrollWidth = resultImgWrapper.scrollWidth;
                        const resultClientWidth = resultImgWrapper.clientWidth;

                        const originalScrollWidth = originalImgWrapper.scrollWidth;
                        const originalClientWidth = originalImgWrapper.clientWidth;

                        const scrollLeftRatio = resultScrollLeft / (resultScrollWidth - resultClientWidth);
                        originalImgWrapper.scrollLeft = scrollLeftRatio * (originalScrollWidth - originalClientWidth);
                    });
                });
            }
        }, 0);

    } else {
        // 单图模式：只显示生成结果 - 添加滚动支持
        debugLog('创建单图查看模式');

        const singleContainer = document.createElement('div');
        singleContainer.style.cssText = `
            max-width: 95%;
            max-height: 85vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            overflow: auto;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        `;

        const img = document.createElement('img');
        img.src = resultImageUrl;
        img.alt = title;
        img.style.cssText = `
            width: auto;
            height: auto;
            max-width: none;
            max-height: none;
            border-radius: 8px;
            min-width: 400px;
            min-height: 300px;
        `;

        singleContainer.appendChild(img);
        mainContent.appendChild(singleContainer);
    }

    // 底部操作栏
    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 12px;
        z-index: 10;
    `;

    // 下载按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span>📥</span>
            下载并打开
        </span>
    `;
    downloadBtn.style.cssText = `
        padding: 12px 20px;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        backdrop-filter: blur(10px);
    `;

    downloadBtn.addEventListener('click', () => {
        downloadImageToLocal(resultImageUrl, metadata.fileType, 0, metadata.fileName, true); // 生成结果支持自动打开
        showNotification('开始下载生成结果...', 2000);
    });

    // 如果有原图，添加下载原图按钮
    if (hasOriginalImage) {
        const downloadOriginalBtn = document.createElement('button');
        downloadOriginalBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>📸</span>
                下载原图
            </span>
        `;
        downloadOriginalBtn.style.cssText = `
            padding: 12px 20px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            backdrop-filter: blur(10px);
        `;

        downloadOriginalBtn.addEventListener('click', () => {
            const originalFileName = generateResultImageFileName(originalImage, 'jpg', 0, '原图');
            downloadImageToLocal(originalImage.src, 'jpg', 0, originalFileName, false); // 原图不自动打开
            showNotification('开始下载原图...', 2000);
        });

        // 按钮悬停效果
        downloadOriginalBtn.addEventListener('mouseenter', () => {
            downloadOriginalBtn.style.transform = 'translateY(-2px)';
            downloadOriginalBtn.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
        });

        downloadOriginalBtn.addEventListener('mouseleave', () => {
            downloadOriginalBtn.style.transform = 'translateY(0)';
            downloadOriginalBtn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
        });

        actionBar.appendChild(downloadOriginalBtn);
    }

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span>✖️</span>
            关闭
        </span>
    `;
    closeBtn.style.cssText = `
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
    `;

    closeBtn.addEventListener('click', () => {
        lightbox.remove();
    });

    // 按钮悬停效果
    downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.transform = 'translateY(-2px)';
        downloadBtn.style.boxShadow = '0 6px 16px rgba(5, 150, 105, 0.4)';
    });

    downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.transform = 'translateY(0)';
        downloadBtn.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
    });

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        closeBtn.style.transform = 'translateY(-2px)';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        closeBtn.style.transform = 'translateY(0)';
    });

    actionBar.appendChild(downloadBtn);
    actionBar.appendChild(closeBtn);

    lightbox.appendChild(infoBar);
    lightbox.appendChild(mainContent);
    lightbox.appendChild(actionBar);

    // 点击背景关闭
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.remove();
        }
    });

    // ESC键关闭
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            lightbox.remove();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // 添加CSS动画
    if (!document.querySelector('#lightbox-styles')) {
        const styles = document.createElement('style');
        styles.id = 'lightbox-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(lightbox);
}

// 创建图片对比容器
function createImageComparisonContainer(imageUrl, label, info, accentColor) {
    const container = document.createElement('div');
    container.style.cssText = `
        flex: 1;
        max-width: 45%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    `;

    // 标签
    const labelElement = document.createElement('div');
    labelElement.style.cssText = `
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
    `;
    labelElement.textContent = label;

    // 图片容器 - 添加滚动支持
    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = `
        position: relative;
        max-width: 100%;
        max-height: 70vh;
        border-radius: 12px;
        overflow: auto;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
        border: 3px solid rgba(255, 255, 255, 0.1);
        background: ${accentColor || '#f8fafc'};
        display: flex;
        justify-content: center;
        align-items: flex-start;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = label;
    img.style.cssText = `
        width: auto;
        height: auto;
        max-width: none;
        max-height: none;
        border-radius: 8px;
        min-width: 300px;
        min-height: 200px;
    `;

    // 加载状态处理
    img.onload = () => {
        debugLog(`${label} 加载完成`, {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
        });

        // 更新信息显示实际尺寸
        if (img.naturalWidth && img.naturalHeight) {
            infoElement.innerHTML = `
                <div>${info}</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">
                    ${img.naturalWidth} × ${img.naturalHeight}px
                </div>
            `;
        }

        // 检查是否需要滚动并添加提示
        setTimeout(() => {
            const needsVerticalScroll = img.scrollHeight > imgWrapper.clientHeight;
            const needsHorizontalScroll = img.scrollWidth > imgWrapper.clientWidth;

            if (needsVerticalScroll || needsHorizontalScroll) {
                const scrollHint = document.createElement('div');
                scrollHint.style.cssText = `
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    z-index: 10;
                `;

                if (needsVerticalScroll && needsHorizontalScroll) {
                    scrollHint.innerHTML = '↕️↔️ 滚动查看';
                } else if (needsVerticalScroll) {
                    scrollHint.innerHTML = '↕️ 滚动查看';
                } else {
                    scrollHint.innerHTML = '↔️ 滚动查看';
                }

                imgWrapper.appendChild(scrollHint);

                // 3秒后自动隐藏
                setTimeout(() => {
                    scrollHint.style.opacity = '0';
                }, 3000);
            }
        }, 100);
    };

    img.onerror = () => {
        debugLog(`${label} 加载失败`);
        imgWrapper.innerHTML = `
            <div style="color: #dc2626; text-align: center; padding: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
                <div>图片加载失败</div>
            </div>
        `;
    };

    // 信息显示
    const infoElement = document.createElement('div');
    infoElement.style.cssText = `
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 12px;
        border-radius: 15px;
        font-size: 11px;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
    `;
    infoElement.innerHTML = `
        <div>${info}</div>
        <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">加载中...</div>
    `;

    imgWrapper.appendChild(img);
    container.appendChild(labelElement);
    container.appendChild(imgWrapper);
    container.appendChild(infoElement);

    return container;
}

// 上传生成结果图片到标注平台 - 直接上传结果图
async function uploadImageToAnnotationPlatform(imageUrl, fileType, index) {
    try {
        debugLog('开始直接上传生成结果到标注平台', {
            imageUrl: imageUrl.substring(0, 50) + '...',
            fileType,
            index
        });

        showNotification('正在获取生成结果图片...', 1000);

        // 获取图片数据
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`获取图片失败: HTTP ${response.status}`);
        }

        const blob = await response.blob();
        debugLog('图片数据获取成功', { size: blob.size, type: blob.type });

        // 创建File对象 - 使用智能文件名
        const fileName = generateResultImageFileName(originalImage, fileType, index, '副本');
        const file = new File([blob], fileName, { type: blob.type });

        showNotification('正在查找上传位置...', 1000);

        // 直接查找现有的文件输入框
        let fileInput = document.querySelector('input[type="file"]:not([style*="display: none"])');

        if (!fileInput) {
            // 查找所有文件输入框（包括隐藏的）
            const allFileInputs = document.querySelectorAll('input[type="file"]');
            if (allFileInputs.length > 0) {
                fileInput = allFileInputs[allFileInputs.length - 1]; // 使用最新的
                debugLog('使用隐藏的文件输入框');
            }
        }

        if (!fileInput) {
            // 如果还是没有，尝试触发A键功能
            debugLog('未找到文件输入框，尝试触发A键功能');
            showNotification('正在触发上传功能...', 1000);

            // 模拟A键按下
            const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']);
            if (uploadButton) {
                uploadButton.click();

                // 等待文件输入框出现
                await new Promise(resolve => setTimeout(resolve, 1500));

                const newFileInputs = document.querySelectorAll('input[type="file"]');
                if (newFileInputs.length > 0) {
                    fileInput = newFileInputs[newFileInputs.length - 1];
                } else {
                    throw new Error('触发上传后仍未找到文件输入框');
                }
            } else {
                throw new Error('未找到上传按钮');
            }
        }

        debugLog('找到文件输入框，开始上传', {
            inputId: fileInput.id || '无ID',
            inputName: fileInput.name || '无name'
        });

        // 直接设置文件到输入框
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // 触发所有相关事件
        const events = ['change', 'input', 'blur'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            fileInput.dispatchEvent(event);
        });

        debugLog('生成结果已直接上传到标注平台');
        showNotification(`✅ 生成结果已上传: ${file.name}`, 3000);

        // 检查上传是否成功（通过检测页面变化）
        setTimeout(() => {
            // 检查是否有预览显示
            const previewImages = document.querySelectorAll('img[src*="blob:"], img[src*="data:"]');
            if (previewImages.length > 0) {
                debugLog('检测到图片预览，上传成功');
                showNotification('📸 图片已成功上传到标注页面', 2000);
            } else {
                debugLog('未检测到图片预览，可能需要手动检查');
                showNotification('图片已上传，请检查页面显示', 2000);
            }
        }, 1500);

    } catch (error) {
        debugLog('直接上传生成结果失败:', error);
        showNotification('上传失败：' + error.message, 3000);
    }
}

// 生成RunningHub结果图的智能文件名
// generateResultImageFileName 函数已移动到 src/modules/DownloadManager.js
// 下载图片到本地 - 支持自动打开选项
// downloadImageToLocal 函数已移动到 src/modules/DownloadManager.js
// 通过fetch下载图片 - 备用方案
// downloadViaFetch 函数已移动到 src/modules/DownloadManager.js
// Running Hub AI应用配置缓存
let RUNNINGHUB_CONFIG = null;

// 加载Running Hub配置文件
// loadRunningHubConfig 和 createWorkflowTask 函数已移动到 src/modules/RunningHubManager.js

// 从浏览器缓存获取图片 - 空实现以防止错误
function getCachedImages() {
    debugLog('getCachedImages: 功能尚未实现');
    // TODO: 实现从浏览器缓存获取图片的功能
}