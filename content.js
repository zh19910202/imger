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
    console.log('支持功能: D键下载图片, 空格键跳过, S键提交标注, A键上传图片, F键查看历史');
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