/**
 * DOM操作工具类
 * 封装常用的DOM操作，提高代码复用性
 */
window.DOMUtils = class DOMUtils {
    /**
     * 安全的querySelector，带错误处理
     */
    static querySelector(selector, context = document) {
        try {
            return context.querySelector(selector);
        } catch (error) {
            console.warn(`querySelector failed for selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * 安全的querySelectorAll，带错误处理
     */
    static querySelectorAll(selector, context = document) {
        try {
            return Array.from(context.querySelectorAll(selector));
        } catch (error) {
            console.warn(`querySelectorAll failed for selector: ${selector}`, error);
            return [];
        }
    }

    /**
     * 查找包含特定文本的按钮 - 保持原有逻辑
     */
    static findButtonByText(text) {
        const buttons = DOMUtils.querySelectorAll('button');
        return buttons.find(button => {
            const buttonText = button.textContent || button.innerText || '';
            return buttonText.includes(text);
        });
    }

    /**
     * 查找跳过按钮 - 原逻辑保持不变
     */
    static findSkipButton() {
        // 尝试多种方式查找跳过按钮
        let skipButton = DOMUtils.findButtonByText('跳过');
        
        if (!skipButton) {
            skipButton = DOMUtils.querySelector('button[title*="跳过"]');
        }
        
        if (!skipButton) {
            skipButton = DOMUtils.querySelector('.skip-btn');
        }
        
        return skipButton;
    }

    /**
     * 查找提交按钮 - 原逻辑保持不变
     */
    static findSubmitButton() {
        // 尝试多种方式查找提交按钮
        let submitButton = DOMUtils.findButtonByText('提交并继续标注');
        
        if (!submitButton) {
            submitButton = DOMUtils.findButtonByText('提交');
        }
        
        if (!submitButton) {
            submitButton = DOMUtils.querySelector('.submit-btn');
        }
        
        return submitButton;
    }

    /**
     * 查找无效按钮 - 原逻辑保持不变
     */
    static findInvalidButton() {
        let invalidButton = DOMUtils.findButtonByText('无效');
        
        if (!invalidButton) {
            invalidButton = DOMUtils.findButtonByText('Invalid');
        }
        
        if (!invalidButton) {
            invalidButton = DOMUtils.querySelector('.invalid-btn');
        }
        
        return invalidButton;
    }

    /**
     * 创建元素并设置属性
     */
    static createElement(tag, props = {}, children = []) {
        const element = document.createElement(tag);
        
        // 设置属性
        Object.entries(props).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                // 事件监听器
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // 添加子元素
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    }

    /**
     * 从HTML字符串创建元素
     */
    static createElementFromHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    }

    /**
     * 检查元素是否可见
     */
    static isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }

    /**
     * 等待元素出现
     */
    static waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = DOMUtils.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = DOMUtils.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 超时处理
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * 平滑滚动到元素
     */
    static scrollToElement(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }

    /**
     * 获取元素的绝对位置
     */
    static getElementPosition(element) {
        if (!element) return { x: 0, y: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * 检查点击是否在元素内
     */
    static isClickInsideElement(event, element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left &&
               event.clientX <= rect.right &&
               event.clientY >= rect.top &&
               event.clientY <= rect.bottom;
    }

    /**
     * 设置元素样式
     */
    static setStyles(element, styles) {
        if (!element || !styles) return;
        
        Object.entries(styles).forEach(([property, value]) => {
            element.style[property] = value;
        });
    }

    /**
     * 添加CSS类
     */
    static addClass(element, className) {
        if (!element || !className) return;
        element.classList.add(className);
    }

    /**
     * 移除CSS类
     */
    static removeClass(element, className) {
        if (!element || !className) return;
        element.classList.remove(className);
    }

    /**
     * 切换CSS类
     */
    static toggleClass(element, className) {
        if (!element || !className) return;
        element.classList.toggle(className);
    }

    /**
     * 批量添加事件监听器
     */
    static addEventListeners(element, events) {
        if (!element || !events) return;
        
        Object.entries(events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }

    /**
     * 批量移除事件监听器
     */
    static removeEventListeners(element, events) {
        if (!element || !events) return;
        
        Object.entries(events).forEach(([event, handler]) => {
            element.removeEventListener(event, handler);
        });
    }

    /**
     * 事件委托
     */
    static delegateEvent(container, selector, event, handler) {
        if (!container) return;
        
        container.addEventListener(event, (e) => {
            const target = e.target.closest(selector);
            if (target) {
                handler.call(target, e);
            }
        });
    }

    /**
     * 获取所有图片元素
     */
    static getAllImages() {
        return DOMUtils.querySelectorAll('img');
    }

    /**
     * 获取所有COS图片元素 - 保持原有逻辑
     */
    static getCOSImages() {
        const images = DOMUtils.getAllImages();
        return images.filter(img => {
            const src = img.src || '';
            return src.includes('cos.ap-') || src.includes('.myqcloud.com') || src.includes('tencentcos.cn');
        });
    }

    /**
     * 获取所有文件输入元素
     */
    static getFileInputs() {
        return DOMUtils.querySelectorAll('input[type="file"]');
    }

    /**
     * 获取所有图片文件输入元素
     */
    static getImageFileInputs() {
        return DOMUtils.querySelectorAll('input[type="file"][accept*="image"]');
    }

    /**
     * 移除元素
     */
    static removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * 清空元素内容
     */
    static clearElement(element) {
        if (element) {
            element.innerHTML = '';
        }
    }

    /**
     * 获取元素文本内容
     */
    static getTextContent(element) {
        if (!element) return '';
        return element.textContent || element.innerText || '';
    }

    /**
     * 检查元素是否包含特定类名
     */
    static hasClass(element, className) {
        if (!element || !className) return false;
        return element.classList.contains(className);
    }

    /**
     * 获取元素的计算样式
     */
    static getComputedStyle(element, property) {
        if (!element) return null;
        
        const styles = window.getComputedStyle(element);
        return property ? styles[property] : styles;
    }

    /**
     * 检查元素是否在视口内
     */
    static isElementInViewport(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * 获取元素相对于父元素的位置
     */
    static getRelativePosition(element, parent) {
        if (!element || !parent) return { x: 0, y: 0 };
        
        const elementRect = element.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        
        return {
            x: elementRect.left - parentRect.left,
            y: elementRect.top - parentRect.top
        };
    }
}