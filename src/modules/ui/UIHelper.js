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

// 导出到全局作用域
window.UIHelper = UIHelper;
window.getUIHelper = getUIHelper;
window.initializeUIHelper = initializeUIHelper;

// 兼容性函数导出
window.findLinkByText = findLinkByText;
window.findButtonByText = findButtonByText;
window.clickLink = clickLink;
window.clickButton = clickButton;

debugLog('UIHelper 模块加载完成');