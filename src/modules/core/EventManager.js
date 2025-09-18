/**
 * 事件管理器
 * 统一管理所有键盘事件，保持原有逻辑完全不变
 */
import { KEYBOARD_SHORTCUTS } from '../../config/constants.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { Logger } from '../utils/Logger.js';

window.EventManager = class EventManager {
    constructor(stateManager, imageDownloader, notificationManager, modalManager) {
        this.stateManager = stateManager;
        this.imageDownloader = imageDownloader;
        this.notificationManager = notificationManager;
        this.modalManager = modalManager;
        
        this.initializeEventListeners();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 键盘事件监听 - 保持原有逻辑
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // 图片悬停事件监听
        this.initializeImageHoverListeners();
        
        Logger.debugLog('事件监听器已初始化');
    }

    /**
     * 处理键盘按下事件 - 原逻辑保持不变
     */
    handleKeydown(event) {
        // 检查是否在输入框中
        if (this.isInInputField(event.target)) {
            return;
        }

        // 检查并关闭模态框
        if (this.modalManager && this.modalManager.checkAndCloseModalIfOpen(event.key)) {
            return;
        }

        const key = event.key.toLowerCase();
        Logger.debugLog('按键事件:', key);

        // 根据按键执行相应操作
        switch (key) {
            case KEYBOARD_SHORTCUTS.DOWNLOAD_IMAGE:
                this.handleDownloadImage(event);
                break;
            case KEYBOARD_SHORTCUTS.SKIP_BUTTON:
                this.handleSkipButton(event);
                break;
            case KEYBOARD_SHORTCUTS.SUBMIT_CONTINUE:
                this.handleSubmitContinue(event);
                break;
            case KEYBOARD_SHORTCUTS.UPLOAD_IMAGE:
                this.handleUploadImage(event);
                break;
            case KEYBOARD_SHORTCUTS.VIEW_HISTORY:
                this.handleViewHistory(event);
                break;
            case KEYBOARD_SHORTCUTS.SMART_COMPARE:
                this.handleSmartCompare(event);
                break;
            case KEYBOARD_SHORTCUTS.DEBUG_MODE:
                this.handleDebugMode(event);
                break;
            case KEYBOARD_SHORTCUTS.F1_KEY:
                this.handleF1Key(event);
                break;
            default:
                // 其他按键不处理
                break;
        }
    }

    /**
     * 检查是否在输入框中
     */
    isInInputField(target) {
        const inputTypes = ['input', 'textarea', 'select'];
        const tagName = target.tagName.toLowerCase();
        
        return inputTypes.includes(tagName) || 
               target.contentEditable === 'true' ||
               target.isContentEditable;
    }

    /**
     * 处理D键 - 下载图片
     */
    handleDownloadImage(event) {
        event.preventDefault();
        Logger.debugLog('D键被按下 - 下载图片');

        const selectedImage = this.stateManager.get('selectedImage');
        const lastHoveredImage = this.stateManager.get('lastHoveredImage');

        if (selectedImage) {
            this.imageDownloader.downloadImage(selectedImage.src);
        } else if (lastHoveredImage) {
            this.imageDownloader.downloadImage(lastHoveredImage.src);
        } else {
            this.notificationManager.showWarning('没有找到要下载的图片');
        }
    }

    /**
     * 处理空格键 - 跳过按钮
     */
    handleSkipButton(event) {
        event.preventDefault();
        Logger.debugLog('空格键被按下 - 跳过');

        const skipButton = DOMUtils.findButtonByText('跳过');
        if (skipButton) {
            skipButton.click();
            this.notificationManager.showInfo('已点击跳过按钮');
        } else {
            this.notificationManager.showWarning('未找到跳过按钮');
        }
    }

    /**
     * 处理S键 - 提交并继续
     */
    handleSubmitContinue(event) {
        event.preventDefault();
        Logger.debugLog('S键被按下 - 提交并继续');

        const submitButton = DOMUtils.findButtonByText('提交并继续标注');
        if (submitButton) {
            submitButton.click();
            this.notificationManager.showInfo('已点击提交按钮');
        } else {
            this.notificationManager.showWarning('未找到提交按钮');
        }
    }

    /**
     * 处理A键 - 上传图片
     */
    handleUploadImage(event) {
        event.preventDefault();
        Logger.debugLog('A键被按下 - 上传图片');

        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.click();
            this.notificationManager.showInfo('已打开文件选择器');
        } else {
            this.notificationManager.showWarning('未找到文件上传控件');
        }
    }

    /**
     * 处理F键 - 查看历史
     */
    handleViewHistory(event) {
        event.preventDefault();
        Logger.debugLog('F键被按下 - 查看历史');

        // 这里需要实现查看历史的逻辑
        // 原有逻辑将在后续模块中实现
        this.notificationManager.showInfo('查看历史功能');
    }

    /**
     * 处理W键 - 智能对比
     */
    handleSmartCompare(event) {
        event.preventDefault();
        Logger.debugLog('W键被按下 - 智能对比');

        // 这里需要实现智能对比的逻辑
        // 原有逻辑将在后续模块中实现
        this.notificationManager.showInfo('智能对比功能');
    }

    /**
     * 处理Z键 - 调试模式
     */
    handleDebugMode(event) {
        event.preventDefault();
        Logger.debugLog('Z键被按下 - 切换调试模式');

        Logger.toggleDebugMode();
        const debugMode = Logger.debugMode;
        this.stateManager.set('debugMode', debugMode);
        
        this.notificationManager.showInfo(
            debugMode ? '调试模式已开启' : '调试模式已关闭'
        );
    }

    /**
     * 处理F1键 - 自动操作
     */
    handleF1Key(event) {
        event.preventDefault();
        Logger.debugLog('F1键被按下 - 自动操作');

        // F1自动操作逻辑将在后续实现
        this.notificationManager.showInfo('F1自动操作');
    }

    /**
     * 初始化图片悬停监听器
     */
    initializeImageHoverListeners() {
        // 监听图片悬停事件
        document.addEventListener('mouseover', (event) => {
            if (event.target.tagName === 'IMG') {
                this.stateManager.set('lastHoveredImage', event.target);
                Logger.debugLog('图片悬停:', event.target.src);
            }
        });

        // 监听图片点击事件
        document.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG') {
                this.stateManager.set('selectedImage', event.target);
                Logger.debugLog('图片选中:', event.target.src);
            }
        });
    }

    /**
     * 移除事件监听器
     */
    removeEventListeners() {
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        Logger.debugLog('事件监听器已移除');
    }

    /**
     * 获取当前事件状态
     */
    getEventState() {
        return {
            selectedImage: this.stateManager.get('selectedImage'),
            lastHoveredImage: this.stateManager.get('lastHoveredImage'),
            debugMode: this.stateManager.get('debugMode')
        };
    }
}