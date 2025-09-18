/**
 * 模态框管理器
 * 统一管理所有模态框操作，保持原有逻辑完全不变
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { Logger } from '../utils/Logger.js';

export class ModalManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.activeModals = new Set();
    }

    /**
     * 检查并关闭模态框 - 原逻辑保持不变
     */
    checkAndCloseModalIfOpen(keyName) {
        // 查找可能的模态框元素
        const modalSelectors = [
            '.modal',
            '.popup',
            '.dialog',
            '[role="dialog"]',
            '.overlay',
            '.lightbox'
        ];

        let modalFound = false;

        for (const selector of modalSelectors) {
            const modals = document.querySelectorAll(selector);
            
            modals.forEach(modal => {
                if (this.isModalVisible(modal)) {
                    this.closeModal(modal, keyName);
                    modalFound = true;
                }
            });
        }

        // 检查是否有遮罩层
        const overlays = document.querySelectorAll('.modal-backdrop, .backdrop, .overlay-backdrop');
        overlays.forEach(overlay => {
            if (this.isModalVisible(overlay)) {
                this.closeModal(overlay, keyName);
                modalFound = true;
            }
        });

        Logger.debugLog('模态框检查结果:', { keyName, modalFound });
        return modalFound;
    }

    /**
     * 检查模态框是否可见
     */
    isModalVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 && 
               rect.height > 0;
    }

    /**
     * 关闭模态框
     */
    closeModal(modal, keyName) {
        try {
            // 尝试多种关闭方式
            
            // 1. 查找关闭按钮
            const closeButton = this.findCloseButton(modal);
            if (closeButton) {
                closeButton.click();
                Logger.debugLog('通过关闭按钮关闭模态框:', keyName);
                return true;
            }

            // 2. 触发ESC键事件
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true
            });
            modal.dispatchEvent(escEvent);
            document.dispatchEvent(escEvent);

            // 3. 直接隐藏模态框
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';

            // 4. 移除模态框类
            modal.classList.remove('show', 'active', 'open', 'visible');

            this.activeModals.delete(modal);
            Logger.debugLog('模态框已关闭:', keyName);
            return true;

        } catch (error) {
            Logger.debugLog('关闭模态框失败:', error);
            return false;
        }
    }

    /**
     * 查找关闭按钮
     */
    findCloseButton(modal) {
        const closeSelectors = [
            '.close',
            '.btn-close',
            '.modal-close',
            '.popup-close',
            '[data-dismiss="modal"]',
            '[data-close]',
            '.fa-times',
            '.fa-close',
            'button[aria-label*="close" i]',
            'button[title*="close" i]'
        ];

        for (const selector of closeSelectors) {
            const button = modal.querySelector(selector);
            if (button && this.isElementClickable(button)) {
                return button;
            }
        }

        // 查找包含×符号的按钮
        const buttons = modal.querySelectorAll('button, a, span');
        for (const button of buttons) {
            const text = button.textContent.trim();
            if (text === '×' || text === '✕' || text === 'Close' || text === '关闭') {
                if (this.isElementClickable(button)) {
                    return button;
                }
            }
        }

        return null;
    }

    /**
     * 检查元素是否可点击
     */
    isElementClickable(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               !element.disabled;
    }

    /**
     * 确保所有模态框都已关闭 - 原逻辑保持不变
     */
    ensureModalClosed() {
        const modalSelectors = [
            '.modal.show',
            '.modal.active',
            '.popup.show',
            '.dialog.open',
            '.overlay.visible'
        ];

        let closedCount = 0;

        modalSelectors.forEach(selector => {
            const modals = document.querySelectorAll(selector);
            modals.forEach(modal => {
                if (this.closeModal(modal, 'ensureClose')) {
                    closedCount++;
                }
            });
        });

        Logger.debugLog('强制关闭模态框数量:', closedCount);
        return closedCount;
    }

    /**
     * 创建自定义模态框
     */
    createModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        
        const defaultOptions = {
            width: '500px',
            height: 'auto',
            closable: true,
            backdrop: true
        };

        const config = { ...defaultOptions, ...options };

        // 设置模态框样式
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: config.width,
            height: config.height,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: '10000',
            padding: '20px',
            maxHeight: '80vh',
            overflow: 'auto'
        });

        // 添加内容
        if (typeof content === 'string') {
            modal.innerHTML = content;
        } else {
            modal.appendChild(content);
        }

        // 添加关闭按钮
        if (config.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.className = 'modal-close-btn';
            Object.assign(closeBtn.style, {
                position: 'absolute',
                top: '10px',
                right: '15px',
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#999'
            });

            closeBtn.onclick = () => this.closeModal(modal, 'closeButton');
            modal.appendChild(closeBtn);
        }

        // 添加背景遮罩
        if (config.backdrop) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            Object.assign(backdrop.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: '9999'
            });

            backdrop.onclick = () => {
                if (config.closable) {
                    this.closeModal(modal, 'backdrop');
                    document.body.removeChild(backdrop);
                }
            };

            document.body.appendChild(backdrop);
        }

        document.body.appendChild(modal);
        this.activeModals.add(modal);

        return modal;
    }

    /**
     * 获取当前活动的模态框
     */
    getActiveModals() {
        return Array.from(this.activeModals);
    }

    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        this.activeModals.forEach(modal => {
            this.closeModal(modal, 'closeAll');
        });
        this.activeModals.clear();
    }
}