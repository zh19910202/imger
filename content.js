// 图片快捷下载器 + 按钮快捷键 - Content Script
// 实现功能:
// 1. D键 - 快捷下载图片
// 2. 空格键 - 点击"跳过"按钮
// 3. S键 - 点击"提交并继续标注"按钮

// 全局变量
let lastHoveredImage = null;
let selectedImage = null;
let notificationAudio = null;
let soundEnabled = true; // 音效开关状态
let dimensionTooltip = null; // 尺寸提示框元素
let originalImage = null; // 存储原图引用用于对比
let uploadedImage = null; // 存储上传图片引用
let comparisonModal = null; // 图片对比弹窗元素
let debugMode = true; // 调试模式开关
let debugPanel = null; // 调试面板元素
let debugLogs = []; // 调试日志数组

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
    console.log('支持功能: D键下载图片, 空格键跳过, S键提交标注, A键上传图片, F键查看历史, X键标记无效, C键图片对比, Z键调试模式, V键检查文件输入, B键重新检测原图');
    console.log('Chrome对象:', typeof chrome);
    console.log('Chrome.runtime:', typeof chrome?.runtime);
    console.log('扩展ID:', chrome?.runtime?.id);
    
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
    
    // 初始化音效
    initializeAudio();
    
    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeydown);
    
    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.soundEnabled) {
            soundEnabled = changes.soundEnabled.newValue;
            console.log('音效设置已更新:', soundEnabled);
        }
    });
    
    // 为所有图片添加鼠标事件监听器
    addImageEventListeners();
    
    // 使用 MutationObserver 监听动态添加的图片
    observeImageChanges();
    
    // 初始化图片上传监听
    initializeUploadMonitoring();
    
    // 添加图片加载监听器
    addImageLoadListeners();
    
    // 初始化调试功能
    if (debugMode) {
        initializeDebugPanel();
    }
    
    debugLog('AnnotateFlow Assistant 初始化完成，调试模式已启用');
    console.log('AnnotateFlow Assistant 初始化完成');
}

// 处理键盘事件
function handleKeydown(event) {
    // 检查是否在输入框中
    if (isInInputField(event.target)) {
        return; // 在输入框中，不处理快捷键
    }
    
    const key = event.key.toLowerCase();
    
    // 处理D键 - 下载图片
    if (key === 'd') {
        // 阻止默认行为
        event.preventDefault();
        
        // 获取要下载的图片
        const imageToDownload = getImageToDownload();
        
        if (imageToDownload) {
            downloadImage(imageToDownload);
        } else {
            console.log('没有找到可下载的图片');
            showNotification('请先鼠标悬停在图片上，然后按D键下载');
        }
    }
    // 处理空格键 - 点击"跳过"按钮
    else if (event.code === 'Space') {
        const skipButton = findButtonByText(['跳过', 'Skip', '跳過']);
        if (skipButton) {
            event.preventDefault(); // 阻止空格键的默认滚动行为
            clickButton(skipButton, '跳过');
        }
    }
    // 处理S键 - 点击"提交并继续标注"按钮
    else if (key === 's') {
        const submitButton = findButtonByText(['提交并继续标注', '提交', 'Submit', '继续标注', 'Continue']);
        if (submitButton) {
            event.preventDefault();
            // 播放音效
            playNotificationSound();
            clickButton(submitButton, '提交并继续标注');
        }
    }
    // 处理A键 - 点击"上传图片"按钮
    else if (key === 'a') {
        const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']);
        if (uploadButton) {
            event.preventDefault();
            clickButton(uploadButton, '上传图片');
        } else {
            showNotification('未找到上传图片按钮');
        }
    }
    // 处理F键 - 点击"查看历史"链接
    else if (key === 'f') {
        const historyLink = findLinkByText(['点击查看历史', '查看历史', '历史', 'History', '历史记录', '查看记录']);
        if (historyLink) {
            event.preventDefault();
            clickLink(historyLink, '查看历史');
        } else {
            showNotification('未找到查看历史链接');
        }
    }
    // 处理X键 - 点击"标记无效"按钮
    else if (key === 'x') {
        const invalidButton = findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']);
        if (invalidButton) {
            event.preventDefault();
            clickButton(invalidButton, '标记无效');
        } else {
            showNotification('未找到标记无效按钮');
        }
    }
    // 处理C键 - 手动触发图片对比
    else if (key === 'c') {
        event.preventDefault();
        if (originalImage || uploadedImage) {
            debugLog('手动触发图片对比');
            performImageComparison();
        } else {
            debugLog('手动对比失败 - 无可用图片', { originalImage, uploadedImage });
            showNotification('暂无图片可供对比');
        }
    }
    // 处理Z键 - 切换调试模式
    else if (key === 'z') {
        event.preventDefault();
        toggleDebugMode();
    }
    // 处理V键 - 手动检查所有文件输入状态
    else if (key === 'v') {
        event.preventDefault();
        debugLog('手动触发文件输入状态检查');
        checkForFileInputChanges();
        showNotification('已手动检查文件输入状态，查看调试面板', 2000);
    }
    // 处理B键 - 手动重新检测原图
    else if (key === 'b') {
        event.preventDefault();
        debugLog('手动重新检测原图');
        recordOriginalImages();
        showNotification('已重新检测原图，查看调试面板', 2000);
    }
}

// 检查目标元素是否是输入框
function isInInputField(target) {
    const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTypes.includes(target.tagName) || target.contentEditable === 'true';
}

// 获取要下载的图片
function getImageToDownload() {
    // 优先级：选中的图片 > 鼠标悬停的图片
    return selectedImage || lastHoveredImage;
}

// 为所有图片添加事件监听器
function addImageEventListeners() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        addImageListeners(img);
    });
}

// 为单个图片添加事件监听器
function addImageListeners(img) {
    // 鼠标悬停事件
    img.addEventListener('mouseenter', (event) => {
        lastHoveredImage = event.target;
        highlightImage(event.target, true);
        showImageDimensions(event.target, event);
    });
    
    img.addEventListener('mouseleave', (event) => {
        if (lastHoveredImage === event.target) {
            highlightImage(event.target, false);
        }
        hideImageDimensions();
    });
    
    // 鼠标移动事件 - 更新提示框位置
    img.addEventListener('mousemove', (event) => {
        updateTooltipPosition(event);
    });
    
    // 点击选择事件
    img.addEventListener('click', (event) => {
        // 如果按住Ctrl键点击，选择图片
        if (event.ctrlKey) {
            event.preventDefault();
            selectImage(event.target);
        }
    });
}

// 高亮显示图片
function highlightImage(img, highlight) {
    if (highlight) {
        img.style.outline = '3px solid #4CAF50';
        img.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
    } else {
        if (selectedImage !== img) {
            img.style.outline = '';
            img.style.boxShadow = '';
        }
    }
}

// 选择图片
function selectImage(img) {
    // 清除之前选中的图片样式
    if (selectedImage) {
        selectedImage.style.outline = '';
        selectedImage.style.boxShadow = '';
    }
    
    // 设置新选中的图片
    selectedImage = img;
    img.style.outline = '3px solid #2196F3';
    img.style.boxShadow = '0 0 15px rgba(33, 150, 243, 0.7)';
    
    showNotification('图片已选中，按D键下载');
}

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
function downloadImage(img) {
    try {
        // 获取图片URL
        let imageUrl = img.src;
        
        // 检查URL是否有效
        if (!imageUrl || imageUrl === '') {
            console.error('图片URL无效:', imageUrl);
            showNotification('图片URL无效，无法下载');
            return;
        }
        
        // 转换相对URL为绝对URL
        if (imageUrl.startsWith('//')) {
            imageUrl = window.location.protocol + imageUrl;
        } else if (imageUrl.startsWith('/')) {
            imageUrl = window.location.origin + imageUrl;
        }
        
        console.log('准备下载图片:', imageUrl);
        console.log('当前Chrome对象状态:', {
            chrome: typeof chrome,
            runtime: typeof chrome?.runtime,
            sendMessage: typeof chrome?.runtime?.sendMessage,
            extensionId: chrome?.runtime?.id
        });
        
        // 检查Chrome扩展API是否可用
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Chrome扩展API不可用');
            console.error('详细信息:', {
                chrome: chrome,
                runtime: chrome?.runtime,
                sendMessage: chrome?.runtime?.sendMessage
            });
            showNotification('下载失败：Chrome扩展API不可用');
            return;
        }
        
        // 发送消息到background script
        try {
            // 使用安全的调用方式
            const chromeRuntime = chrome && chrome.runtime;
            if (!chromeRuntime || !chromeRuntime.sendMessage) {
                throw new Error('Chrome runtime API不可用');
            }
            
            chromeRuntime.sendMessage({
                action: 'downloadImage',
                imageUrl: imageUrl,
                pageUrl: window.location.href
            }, (response) => {
                if (chromeRuntime.lastError) {
                    console.error('发送消息失败:', chromeRuntime.lastError);
                    showNotification('下载失败：无法连接到扩展后台');
                } else if (response && response.success) {
                    console.log('下载请求已发送');
                    showNotification('开始下载图片...');
                    // 添加下载效果
                    addDownloadEffect(img);
                } else {
                    console.error('下载请求失败');
                    showNotification('下载失败');
                }
            });
        } catch (apiError) {
            console.error('Chrome API调用异常:', apiError);
            showNotification('下载失败：' + apiError.message);
        }
        
    } catch (error) {
        console.error('下载图片时发生错误:', error);
        showNotification('下载失败：' + error.message);
    }
}

// 添加下载视觉效果
function addDownloadEffect(img) {
    // 创建下载动画效果
    const originalTransform = img.style.transform;
    img.style.transition = 'transform 0.3s ease';
    img.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        img.style.transform = originalTransform;
    }, 300);
}

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
function findButtonByText(textOptions) {
    // 查找所有可能的按钮元素
    const buttonSelectors = [
        'button',
        'input[type="button"]',
        'input[type="submit"]',
        '[role="button"]',
        '.btn',
        '.button',
        'a[href="#"]',
        'a[onclick]',
        'div[onclick]',
        'span[onclick]'
    ];
    
    const allElements = document.querySelectorAll(buttonSelectors.join(','));
    
    // 遍历所有元素，查找匹配的文本
    for (const element of allElements) {
        const text = (element.textContent || element.value || element.innerText || '').trim();
        
        // 检查是否匹配任一文本选项
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            return element;
        }
    }
    
    return null;
}

// 点击按钮并显示反馈
function clickButton(button, actionName) {
    try {
        console.log(`点击${actionName}按钮:`, button);
        
        // 添加视觉反馈
        addButtonClickEffect(button);
        
        // 模拟点击事件
        button.click();
        
        // 显示通知
        showNotification(`已执行: ${actionName}`);
        
    } catch (error) {
        console.error(`点击${actionName}按钮时发生错误:`, error);
        showNotification(`执行${actionName}失败: ${error.message}`);
    }
}

// 为按钮添加点击视觉效果
function addButtonClickEffect(button) {
    const originalStyle = {
        backgroundColor: button.style.backgroundColor,
        transform: button.style.transform,
        transition: button.style.transition
    };
    
    // 添加点击效果
    button.style.transition = 'all 0.2s ease';
    button.style.transform = 'scale(0.95)';
    button.style.backgroundColor = '#e3f2fd';
    
    // 恢复原始样式
    setTimeout(() => {
        button.style.backgroundColor = originalStyle.backgroundColor;
        button.style.transform = originalStyle.transform;
        button.style.transition = originalStyle.transition;
    }, 200);
}

// 清理函数
function cleanup() {
    debugLog('执行清理函数');
    
    document.removeEventListener('keydown', handleKeydown);
    // 移除所有图片的事件监听器和样式
    document.querySelectorAll('img').forEach(img => {
        img.style.outline = '';
        img.style.boxShadow = '';
    });
    // 清理尺寸提示框
    if (dimensionTooltip && dimensionTooltip.parentNode) {
        dimensionTooltip.parentNode.removeChild(dimensionTooltip);
        dimensionTooltip = null;
    }
    // 清理图片对比弹窗
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
        comparisonModal = null;
    }
    // 清理调试面板
    if (debugPanel && debugPanel.parentNode) {
        debugPanel.parentNode.removeChild(debugPanel);
        debugPanel = null;
    }
    // 清理图片引用
    originalImage = null;
    uploadedImage = null;
    // 清理调试日志
    debugLogs = [];
}

// 初始化音效
function initializeAudio() {
    try {
        // 获取扩展中音效文件的URL
        const audioUrl = chrome.runtime.getURL('notification.mp3');
        notificationAudio = new Audio(audioUrl);
        
        // 设置音效属性
        notificationAudio.volume = 0.6; // 设置音量为60%
        notificationAudio.preload = 'auto'; // 预加载音效
        
        console.log('音效初始化成功:', audioUrl);
    } catch (error) {
        console.error('音效初始化失败:', error);
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
function findLinkByText(textOptions) {
    // 查找所有可能的链接元素，包括更广泛的选择器
    const linkSelectors = [
        'a[href]',
        'a[onclick]',
        '[role="link"]',
        '.link',
        '.history-link',
        '.nav-link',
        'span[onclick]',
        'div[onclick]',
        'span[style*="cursor: pointer"]',
        'div[style*="cursor: pointer"]',
        'span[class*="link"]',
        'div[class*="link"]',
        'span[class*="history"]',
        'div[class*="history"]',
        'span[class*="click"]',
        'div[class*="click"]'
    ];
    
    const allElements = document.querySelectorAll(linkSelectors.join(','));
    
    // 遍历所有元素，查找匹配的文本
    for (const element of allElements) {
        const text = (element.textContent || element.innerText || element.title || '').trim();
        
        // 检查是否匹配任一文本选项
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            return element;
        }
    }
    
    // 如果上面的方法没找到，尝试在整个页面中搜索包含目标文本的元素
    const allTextElements = document.querySelectorAll('*');
    for (const element of allTextElements) {
        const text = (element.textContent || element.innerText || '').trim();
        
        // 检查是否包含目标文本
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            // 检查这个元素是否可点击（有onclick、cursor:pointer等）
            const style = window.getComputedStyle(element);
            const hasClickHandler = element.onclick || 
                                  element.getAttribute('onclick') ||
                                  style.cursor === 'pointer' ||
                                  element.tagName === 'A' ||
                                  element.getAttribute('role') === 'link';
            
            if (hasClickHandler) {
                return element;
            }
        }
    }
    
    return null;
}

// 点击链接并显示反馈
function clickLink(link, actionName) {
    try {
        console.log(`点击${actionName}链接:`, link);
        
        // 添加视觉反馈
        addLinkClickEffect(link);
        
        // 模拟点击事件
        link.click();
        
        // 显示通知
        showNotification(`已执行: ${actionName}`);
        
    } catch (error) {
        console.error(`点击${actionName}链接时发生错误:`, error);
        showNotification(`执行${actionName}失败: ${error.message}`);
    }
}

// 为链接添加点击视觉效果
function addLinkClickEffect(link) {
    const originalStyle = {
        backgroundColor: link.style.backgroundColor,
        transform: link.style.transform,
        transition: link.style.transition,
        color: link.style.color
    };
    
    // 添加点击效果
    link.style.transition = 'all 0.2s ease';
    link.style.transform = 'scale(0.95)';
    link.style.backgroundColor = '#e3f2fd';
    link.style.color = '#1976d2';
    
    // 恢复原始样式
    setTimeout(() => {
        link.style.backgroundColor = originalStyle.backgroundColor;
        link.style.transform = originalStyle.transform;
        link.style.transition = originalStyle.transition;
        link.style.color = originalStyle.color;
    }, 200);
}

// 显示图片尺寸提示框
function showImageDimensions(img, event) {
    try {
        // 获取图片的真实尺寸
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        
        // 如果尺寸无效，不显示提示框
        if (!width || !height) {
            return;
        }
        
        // 创建或更新提示框
        if (!dimensionTooltip) {
            createDimensionTooltip();
        }
        
        // 设置提示框内容
        dimensionTooltip.textContent = `${width} × ${height}`;
        
        // 显示提示框
        dimensionTooltip.style.display = 'block';
        
        // 更新位置
        updateTooltipPosition(event);
        
    } catch (error) {
        console.error('显示图片尺寸时发生错误:', error);
    }
}

// 隐藏图片尺寸提示框
function hideImageDimensions() {
    if (dimensionTooltip) {
        dimensionTooltip.style.display = 'none';
    }
}

// 创建尺寸提示框元素
function createDimensionTooltip() {
    dimensionTooltip = document.createElement('div');
    dimensionTooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        transition: opacity 0.2s ease;
        white-space: nowrap;
        display: none;
    `;
    
    document.body.appendChild(dimensionTooltip);
}

// 更新提示框位置
function updateTooltipPosition(event) {
    if (!dimensionTooltip || dimensionTooltip.style.display === 'none') {
        return;
    }
    
    const offsetX = 15;
    const offsetY = -30;
    
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    
    // 防止提示框超出屏幕边界
    const tooltipRect = dimensionTooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 右边界检查
    if (x + tooltipRect.width > viewportWidth) {
        x = event.clientX - tooltipRect.width - offsetX;
    }
    
    // 上边界检查
    if (y < 0) {
        y = event.clientY + Math.abs(offsetY);
    }
    
    dimensionTooltip.style.left = x + 'px';
    dimensionTooltip.style.top = y + 'px';
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

// 图片上传监听和对比功能
function initializeUploadMonitoring() {
    console.log('初始化图片上传监听功能');
    
    // 监听文件输入元素的变化
    observeFileInputs();
    
    // 监听网络请求中的图片上传
    observeNetworkUploads();
    
    // 记录当前页面的原图
    recordOriginalImages();
}

// 监听文件输入元素
function observeFileInputs() {
    // 查找所有现有的文件输入元素
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => addUploadListener(input));
    
    // 使用 MutationObserver 监听动态添加的文件输入元素
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是文件输入
                    if (node.tagName === 'INPUT' && node.type === 'file') {
                        addUploadListener(node);
                    }
                    // 检查新添加的元素内部是否有文件输入
                    const inputs = node.querySelectorAll && node.querySelectorAll('input[type="file"]');
                    if (inputs) {
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
}

// 为文件输入添加上传监听器
function addUploadListener(input) {
    if (input._uploadListenerAdded) return; // 防止重复添加
    input._uploadListenerAdded = true;
    
    input.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                console.log('检测到图片上传:', file.name, file.type, file.size);
                handleImageUpload(file, input);
            }
        }
    });
}

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
        
        debugLog('上传图片信息已保存', {
            name: uploadedImage.name,
            size: uploadedImage.size,
            type: uploadedImage.type,
            srcLength: uploadedImage.src ? uploadedImage.src.length : 0
        });
        
        showNotification(`图片上传完成: ${file.name}`, 2000);
        
        // 等待一段时间后进行对比（给页面时间处理上传）
        setTimeout(() => {
            debugLog('延迟执行图片对比');
            performImageComparison();
        }, 1000);
    };
    
    reader.onerror = (error) => {
        debugLog('FileReader读取失败', error);
        showNotification('图片读取失败', 2000);
    };
    
    debugLog('开始FileReader.readAsDataURL');
    reader.readAsDataURL(file);
}

// 记录页面原始图片
function recordOriginalImages() {
    debugLog('开始记录页面原始图片');
    
    const images = document.querySelectorAll('img');
    debugLog('发现页面图片总数', images.length);
    
    if (images.length === 0) {
        debugLog('页面中无图片元素');
        return;
    }
    
    // 详细检查每个图片
    images.forEach((img, index) => {
        debugLog(`检查图片 #${index}`, {
            src: img.src ? img.src.substring(0, 100) + '...' : '无src',
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            width: img.width,
            height: img.height,
            complete: img.complete,
            className: img.className,
            id: img.id || '无ID'
        });
    });
    
    // 方法1：优先选择已完全加载的图片
    let mainImage = Array.from(images).find(img => {
        const isLoaded = img.complete && img.naturalWidth > 100 && img.naturalHeight > 100;
        if (isLoaded) {
            debugLog('找到已加载的合适图片', {
                src: img.src.substring(0, 50) + '...',
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
            });
        }
        return isLoaded;
    });
    
    // 方法2：如果没找到，选择尺寸最大的图片（即使还没完全加载）
    if (!mainImage) {
        debugLog('未找到已加载的图片，尝试选择最大的图片');
        let maxArea = 0;
        
        images.forEach(img => {
            // 使用显示尺寸或属性尺寸
            const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
            const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
            const area = width * height;
            
            debugLog(`图片面积计算`, {
                src: img.src ? img.src.substring(0, 30) + '...' : '无src',
                width: width,
                height: height,
                area: area
            });
            
            if (area > maxArea && area > 10000) { // 至少100x100
                maxArea = area;
                mainImage = img;
                debugLog('选择新的最大图片', { area, width, height });
            }
        });
    }
    
    // 方法3：如果还是没找到，选择第一个有src的图片
    if (!mainImage) {
        debugLog('仍未找到合适图片，选择第一个有src的图片');
        mainImage = Array.from(images).find(img => img.src && img.src.length > 0);
    }
    
    if (mainImage) {
        // 如果图片还没完全加载，等待加载完成
        if (!mainImage.complete || mainImage.naturalWidth === 0) {
            debugLog('选中的图片还没完全加载，等待加载完成');
            
            const handleLoad = () => {
                debugLog('图片加载完成，重新记录');
                recordImageAsOriginal(mainImage);
                mainImage.removeEventListener('load', handleLoad);
            };
            
            const handleError = () => {
                debugLog('图片加载失败');
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
        debugLog('未找到任何可用的图片');
        
        // 延迟重试，可能图片还在动态加载
        setTimeout(() => {
            debugLog('延迟重试检测原图');
            const newImages = document.querySelectorAll('img');
            if (newImages.length > images.length) {
                debugLog('发现新的图片元素，重新检测');
                recordOriginalImages();
            }
        }, 2000);
    }
}

// 将图片记录为原图
function recordImageAsOriginal(img) {
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    
    originalImage = {
        src: img.src,
        width: width,
        height: height,
        element: img
    };
    
    debugLog('成功记录原图', {
        src: originalImage.src.substring(0, 50) + '...',
        width: originalImage.width,
        height: originalImage.height,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
    });
    
    console.log('记录原图:', originalImage.src);
    showNotification(`已识别原图: ${width}×${height}`, 2000);
}

// 监听网络请求中的图片上传（使用 fetch 拦截）
function observeNetworkUploads() {
    // 拦截 fetch 请求
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const request = args[0];
        const url = typeof request === 'string' ? request : request.url;
        
        return originalFetch.apply(this, args).then(response => {
            // 检查是否是图片上传相关的请求
            if (url.includes('upload') || url.includes('image')) {
                console.log('检测到可能的图片上传请求:', url);
                // 延时检查页面是否有新图片
                setTimeout(() => {
                    checkForNewImages();
                }, 2000);
            }
            return response;
        }).catch(error => {
            console.error('网络请求错误:', error);
            throw error;
        });
    };
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
            // 如果有上传的图片，进行对比
            if (uploadedImage) {
                performImageComparison(img);
            }
        });
    }
}

// 执行图片对比
function performImageComparison(newImage = null) {
    debugLog('开始执行图片对比', {
        hasOriginalImage: !!originalImage,
        hasUploadedImage: !!uploadedImage,
        hasNewImage: !!newImage
    });
    
    if (!originalImage || !uploadedImage) {
        debugLog('图片对比失败 - 缺少必要的图片', { 
            originalImage: originalImage ? '有' : '无', 
            uploadedImage: uploadedImage ? '有' : '无' 
        });
        return;
    }
    
    debugLog('图片对比条件满足，创建对比界面');
    showNotification('正在对比图片...', 1000);
    
    // 创建对比界面
    createComparisonModal(originalImage, uploadedImage, newImage);
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
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
    `;
    
    // 创建对比内容容器
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;
    
    // 创建标题
    const title = document.createElement('h2');
    title.textContent = '图片对比';
    title.style.cssText = `
        margin: 0 0 20px 0;
        text-align: center;
        color: #333;
        font-family: Arial, sans-serif;
    `;
    
    // 创建图片对比区域
    const comparisonArea = document.createElement('div');
    comparisonArea.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
    `;
    
    // 创建原图区域
    const originalArea = createImageArea('原图', original.src, original);
    
    // 创建上传图区域
    const uploadedArea = createImageArea('上传图片', uploaded.src, uploaded);
    
    comparisonArea.appendChild(originalArea);
    comparisonArea.appendChild(uploadedArea);
    
    // 创建对比信息
    const infoArea = createComparisonInfo(original, uploaded);
    
    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭对比';
    closeButton.style.cssText = `
        display: block;
        margin: 20px auto 0;
        padding: 10px 30px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-family: Arial, sans-serif;
    `;
    
    closeButton.addEventListener('click', () => {
        if (comparisonModal && comparisonModal.parentNode) {
            comparisonModal.parentNode.removeChild(comparisonModal);
        }
    });
    
    // 组装弹窗
    content.appendChild(title);
    content.appendChild(comparisonArea);
    content.appendChild(infoArea);
    content.appendChild(closeButton);
    comparisonModal.appendChild(content);
    
    // 点击背景关闭
    comparisonModal.addEventListener('click', (e) => {
        if (e.target === comparisonModal) {
            comparisonModal.parentNode.removeChild(comparisonModal);
        }
    });
    
    // 添加到页面
    document.body.appendChild(comparisonModal);
    
    showNotification('图片对比界面已打开', 2000);
}

// 创建单个图片显示区域
function createImageArea(title, src, imageInfo) {
    const area = document.createElement('div');
    area.style.cssText = `
        text-align: center;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        background: #f9f9f9;
    `;
    
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.cssText = `
        margin: 0 0 10px 0;
        color: #666;
        font-family: Arial, sans-serif;
        font-size: 16px;
    `;
    
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
        max-width: 100%;
        max-height: 300px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    
    const info = document.createElement('div');
    info.style.cssText = `
        margin-top: 10px;
        font-size: 12px;
        color: #666;
        font-family: Arial, sans-serif;
    `;
    
    // 显示图片信息
    if (imageInfo.width && imageInfo.height) {
        info.innerHTML = `尺寸: ${imageInfo.width} × ${imageInfo.height}px`;
    }
    if (imageInfo.size) {
        info.innerHTML += `<br>大小: ${(imageInfo.size / 1024).toFixed(1)} KB`;
    }
    if (imageInfo.name) {
        info.innerHTML += `<br>文件名: ${imageInfo.name}`;
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
            
            comparison = `
                <strong>尺寸对比:</strong><br>
                • 原图: ${original.width} × ${original.height}px<br>
                • 上传图: ${tempImg.width} × ${tempImg.height}px<br>
                • 差异: 宽度${widthDiff > 0 ? '+' : ''}${widthDiff}px, 高度${heightDiff > 0 ? '+' : ''}${heightDiff}px<br><br>
                
                <strong>相似度分析:</strong><br>
                • ${widthDiff === 0 && heightDiff === 0 ? '✓ 尺寸完全一致' : '⚠ 尺寸有差异'}<br>
                • ${uploaded.size ? `文件大小: ${(uploaded.size / 1024).toFixed(1)} KB` : '无法获取文件大小'}<br>
                • ${uploaded.type || '未知格式'}
            `;
            
            details.innerHTML = comparison;
        };
        tempImg.src = uploaded.src;
    } else {
        details.innerHTML = '正在分析图片信息...';
    }
    
    infoArea.appendChild(title);
    infoArea.appendChild(details);
    
    return infoArea;
}

// ============== 调试功能 ==============

// 调试日志函数
function debugLog(message, data = null) {
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
    
    // 输出到控制台
    console.log(`[调试 ${timestamp}] ${message}`, data || '');
    
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
                
                // 如果还没有原图，或者这个图片更大，考虑更新原图
                if (!originalImage || (
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
            if (!originalImage || (
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
            if (!originalImage || (
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
        if (!originalImage || (
            img.naturalWidth * img.naturalHeight > 
            (originalImage.width || 0) * (originalImage.height || 0)
        )) {
            debugLog('新图片已加载且更合适，更新原图记录');
            recordImageAsOriginal(img);
        }
    }
}