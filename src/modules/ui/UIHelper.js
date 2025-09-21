/**
 * UI助手模块
 * 负责通用的UI操作功能，如查找和点击链接、按钮等
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[UIHelper]', message, data || '');
    };
}

class UIHelper {
    constructor() {
        this.initialized = false;
    }

    isInitialized() {
        return this.initialized;
    }

    initialize() {
        try {
            debugLog('初始化 UIHelper');
            this.initialized = true;
            debugLog('UIHelper 初始化完成');
        } catch (error) {
            debugLog('UIHelper 初始化失败:', error);
            throw error;
        }
    }

    // 根据文本内容查找链接
    findLinkByText(textOptions) {
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

    // 根据文本内容查找按钮
    findButtonByText(textOptions) {
        // 查找所有可能的按钮元素
        const buttonSelectors = [
            'button',
            'input[type="button"]',
            'input[type="submit"]',
            'input[type="reset"]',
            '[role="button"]',
            '.btn',
            '.button',
            'a.btn',
            'a.button'
        ];

        const allElements = document.querySelectorAll(buttonSelectors.join(','));

        // 遍历所有元素，查找匹配的文本
        for (const element of allElements) {
            const text = (element.textContent || element.innerText || element.value || element.title || '').trim();

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

    // 点击链接并显示反馈
    clickLink(link, actionName) {
        try {
            debugLog(`点击${actionName}链接:`, link);

            // 添加视觉反馈
            this.addLinkClickEffect(link);

            // 模拟点击事件
            link.click();

            // 显示通知
            if (typeof showNotification === 'function') {
                showNotification(`已执行: ${actionName}`);
            }

        } catch (error) {
            debugLog(`点击${actionName}链接时发生错误:`, error);
            if (typeof showNotification === 'function') {
                showNotification(`执行${actionName}失败: ${error.message}`);
            }
        }
    }

    // 点击按钮并显示反馈
    clickButton(button, actionName) {
        try {
            debugLog(`点击${actionName}按钮:`, button);

            // 添加视觉反馈
            this.addButtonClickEffect(button);

            // 模拟点击事件
            button.click();

            // 显示通知
            if (typeof showNotification === 'function') {
                showNotification(`已执行: ${actionName}`);
            }

            // 播放音效（如果启用）
            if (typeof playNotificationSound === 'function') {
                playNotificationSound();
            }

        } catch (error) {
            debugLog(`点击${actionName}按钮时发生错误:`, error);
            if (typeof showNotification === 'function') {
                showNotification(`执行${actionName}失败: ${error.message}`);
            }
        }
    }

    // 为链接添加点击视觉效果
    addLinkClickEffect(link) {
        const originalStyle = {
            backgroundColor: link.style.backgroundColor,
            transform: link.style.transform,
            transition: link.style.transition,
            color: link.style.color
        };

        // 添加点击效果
        link.style.transition = 'all 0.2s ease';
        link.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
        link.style.transform = 'scale(0.98)';

        // 恢复原始样式
        setTimeout(() => {
            link.style.backgroundColor = originalStyle.backgroundColor || '';
            link.style.transform = originalStyle.transform || '';
            setTimeout(() => {
                link.style.transition = originalStyle.transition || '';
            }, 200);
        }, 150);
    }

    // 为按钮添加点击视觉效果
    addButtonClickEffect(button) {
        const originalStyle = {
            backgroundColor: button.style.backgroundColor,
            transform: button.style.transform,
            transition: button.style.transition,
            boxShadow: button.style.boxShadow
        };

        // 添加点击效果
        button.style.transition = 'all 0.1s ease';
        button.style.transform = 'scale(0.95)';
        button.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';

        // 恢复原始样式
        setTimeout(() => {
            button.style.transform = originalStyle.transform || '';
            button.style.boxShadow = originalStyle.boxShadow || '';
            setTimeout(() => {
                button.style.transition = originalStyle.transition || '';
            }, 100);
        }, 100);
    }
}

// 全局实例
let uiHelperInstance = null;

// 获取全局实例
function getUIHelper() {
    if (!uiHelperInstance) {
        uiHelperInstance = new UIHelper();
        // 设置到全局变量以保持兼容性
        window.uiHelper = uiHelperInstance;
    }
    return uiHelperInstance;
}

// 兼容性函数 - 保持向后兼容
function findLinkByText(textOptions) {
    const helper = getUIHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.findLinkByText(textOptions);
}

function findButtonByText(textOptions) {
    const helper = getUIHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.findButtonByText(textOptions);
}

function clickLink(link, actionName) {
    const helper = getUIHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.clickLink(link, actionName);
}

function clickButton(button, actionName) {
    const helper = getUIHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.clickButton(button, actionName);
}

// 初始化函数
function initializeUIHelper() {
    try {
        const helper = getUIHelper();
        helper.initialize();
        debugLog('UIHelper 全局初始化完成');
        return helper;
    } catch (error) {
        debugLog('UIHelper 全局初始化失败:', error);
        throw error;
    }
}

// 通知系统（从content.js迁移）
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
    
    debugLog('显示通知', { message, duration });
}

// 扩展UIHelper类以包含通知功能
UIHelper.prototype.showNotification = function(message, duration = 3000) {
    return showNotification(message, duration);
};

// 导出到全局作用域
window.UIHelper = UIHelper;
window.getUIHelper = getUIHelper;
window.initializeUIHelper = initializeUIHelper;

// 兼容性函数导出
window.findLinkByText = findLinkByText;
window.findButtonByText = findButtonByText;
window.clickLink = clickLink;
window.clickButton = clickButton;
window.showNotification = showNotification;

// 图片对比弹窗功能（完整原版复刻）
function createComparisonModal(original, uploaded, newImage) {
    // 移除已存在的对比弹窗
    if (window.comparisonModal && window.comparisonModal.parentNode) {
        window.comparisonModal.parentNode.removeChild(window.comparisonModal);
    }
    
    // 创建弹窗容器
    window.comparisonModal = document.createElement('div');
    window.comparisonModal.style.cssText = `
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
    if (typeof debugLog === 'function') {
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
    }
    
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
        
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        
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
                right: 20px;
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
    
    // 组装弹窗（不包含工具栏和底部提示）
    mainContainer.appendChild(comparisonArea);
    window.comparisonModal.appendChild(mainContainer);
    
    // 将工具栏添加到页面（独立定位）
    document.body.appendChild(toolbar);
    
    // 点击背景关闭
    window.comparisonModal.addEventListener('click', (e) => {
        if (e.target === window.comparisonModal) {
            closeComparisonModal();
        }
    });
    
    // 添加ESC键关闭功能
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && window.comparisonModal && window.comparisonModal.parentNode) {
            closeComparisonModal();
        }
    };
    // 保存到全局，方便清理
    window.currentHandleEscKey = handleEscKey;
    document.addEventListener('keydown', handleEscKey);
    
    // 添加到页面
    document.body.appendChild(window.comparisonModal);
    
    // 更新对比页面状态
    if (window.stateManager && window.stateManager.modal) {
        window.stateManager.modal.setComparisonModal(window.comparisonModal, true);
    }
    window.isComparisonModalOpen = true;
    
    if (typeof debugLog === 'function') {
        debugLog('对比弹窗已打开，状态已更新');
    }
    
    showNotification('图片对比界面已打开', 2000);
}

// 关闭对比弹窗功能（完整清理版本）
function closeComparisonModal() {
    // 清理ESC键监听器
    if (window.currentHandleEscKey) {
        document.removeEventListener('keydown', window.currentHandleEscKey);
        window.currentHandleEscKey = null;
    }
    
    // 清理闪烁模式的interval
    const comparisonArea = document.getElementById('comparison-area');
    if (comparisonArea && comparisonArea.blinkInterval) {
        clearInterval(comparisonArea.blinkInterval);
        comparisonArea.blinkInterval = null;
    }
    
    // 移除工具栏（独立添加的）
    const existingToolbars = document.querySelectorAll('div[style*="position: fixed"][style*="right: 5px"][style*="transform: translateY(-50%)"]');
    existingToolbars.forEach(toolbar => {
        if (toolbar.parentNode) {
            toolbar.parentNode.removeChild(toolbar);
        }
    });
    
    // 备用清理方法：通过其他特征查找工具栏
    const toolbars = document.querySelectorAll('div[style*="position: fixed"][style*="transform: translateY(-50%)"][style*="width: 80px"]');
    toolbars.forEach(tb => {
        if (tb && tb.parentNode) {
            tb.parentNode.removeChild(tb);
        }
    });
    
    // 移除对比弹窗
    if (window.comparisonModal && window.comparisonModal.parentNode) {
        window.comparisonModal.parentNode.removeChild(window.comparisonModal);
        window.comparisonModal = null;
    }
    
    // 更新状态
    if (window.stateManager && window.stateManager.modal) {
        window.stateManager.modal.setComparisonModal(null, false);
    }
    window.isComparisonModalOpen = false;
    
    if (typeof debugLog === 'function') {
        debugLog('对比弹窗已关闭，状态已更新');
    }
    
    showNotification('对比界面已关闭', 1500);
}

// 导出对比弹窗相关函数
window.createComparisonModal = createComparisonModal;
window.closeComparisonModal = closeComparisonModal;

debugLog('UIHelper 模块加载完成');