/**
 * 事件管理器
 * 统一管理所有键盘事件，保持原有逻辑完全不变
 */

window.EventManager = class EventManager {
    constructor(stateManager, imageDownloader, notificationManager, modalManager, imageDetector, dimensionChecker, fileInputChecker) {
        this.stateManager = stateManager;
        this.imageDownloader = imageDownloader;
        this.notificationManager = notificationManager;
        this.modalManager = modalManager;
        this.imageDetector = imageDetector;
        this.dimensionChecker = dimensionChecker;
        this.fileInputChecker = fileInputChecker;
        
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
        
        window.Logger.debugLog('事件监听器已初始化');
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
        window.Logger.debugLog('按键事件:', key);

        // 根据按键执行相应操作
        switch (key) {
            case window.KEYBOARD_SHORTCUTS.DOWNLOAD_IMAGE:
                this.handleDownloadImage(event);
                break;
            case window.KEYBOARD_SHORTCUTS.SKIP_BUTTON:
                this.handleSkipButton(event);
                break;
            case window.KEYBOARD_SHORTCUTS.SUBMIT_CONTINUE:
                this.handleSubmitContinue(event);
                break;
            case window.KEYBOARD_SHORTCUTS.UPLOAD_IMAGE:
                this.handleUploadImage(event);
                break;
            case window.KEYBOARD_SHORTCUTS.VIEW_HISTORY:
                this.handleViewHistory(event);
                break;
            case window.KEYBOARD_SHORTCUTS.SMART_COMPARE:
                this.handleSmartCompare(event);
                break;
            case window.KEYBOARD_SHORTCUTS.DEBUG_MODE:
                this.handleDebugMode(event);
                break;
            case window.KEYBOARD_SHORTCUTS.MANUAL_DIMENSION_CHECK:
                this.handleManualDimensionCheck(event);
                break;
            case window.KEYBOARD_SHORTCUTS.CHECK_FILE_INPUT:
                this.handleCheckFileInput(event);
                break;
            case window.KEYBOARD_SHORTCUTS.REDETECT_ORIGINAL_B:
                this.handleRedetectOriginalB(event);
                break;
            case window.KEYBOARD_SHORTCUTS.REDETECT_ORIGINAL_N:
                this.handleRedetectOriginalN(event);
                break;
            case window.KEYBOARD_SHORTCUTS.SMART_DIMENSION_CHECK:
                this.handleSmartDimensionCheck(event);
                break;
            case window.KEYBOARD_SHORTCUTS.MARK_INVALID:
                this.handleMarkInvalid(event);
                break;
            case window.KEYBOARD_SHORTCUTS.PRINT_IMAGE_STATUS:
                this.handlePrintImageStatus(event);
                break;
            default:
                // F1键、F2键和ESC键需要特殊处理，因为它们不是小写
                if (event.key === window.KEYBOARD_SHORTCUTS.F1_AUTO_INVALID) {
                    this.handleF1Key(event);
                } else if (event.key === window.KEYBOARD_SHORTCUTS.SMART_DIMENSION_CHECK_F2) {
                    this.handleSmartDimensionCheckF2(event);
                } else if (event.key === window.KEYBOARD_SHORTCUTS.ESCAPE) {
                    this.handleEscape(event);
                }
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
        window.Logger.debugLog('D键被按下 - 下载图片');

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
        window.Logger.debugLog('空格键被按下 - 跳过');

        const skipButton = window.DOMUtils.findButtonByText('跳过');
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
        window.Logger.debugLog('S键被按下 - 提交并继续');

        const submitButton = window.DOMUtils.findButtonByText('提交并继续标注');
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
        window.Logger.debugLog('A键被按下 - 上传图片');

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
        window.Logger.debugLog('F键被按下 - 查看历史');

        // 这里需要实现查看历史的逻辑
        // 原有逻辑将在后续模块中实现
        this.notificationManager.showInfo('查看历史功能');
    }

    /**
     * 处理W键 - 智能对比
     */
    handleSmartCompare(event) {
        event.preventDefault();
        window.Logger.debugLog('W键被按下 - 智能对比');

        // 这里需要实现智能对比的逻辑
        // 原有逻辑将在后续模块中实现
        this.notificationManager.showInfo('智能对比功能');
    }

    /**
     * 处理Z键 - 调试模式
     */
    handleDebugMode(event) {
        event.preventDefault();
        window.Logger.debugLog('Z键被按下 - 切换调试模式');

        window.Logger.toggleDebugMode();
        const debugMode = window.Logger.debugMode;
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
        window.Logger.debugLog('F1键被按下 - 自动操作');

        // F1自动操作逻辑将在后续实现
        this.notificationManager.showInfo('F1自动操作');
    }

    /**
     * 处理R键 - 手动尺寸检查
     */
    handleManualDimensionCheck(event) {
        event.preventDefault();
        window.Logger.debugLog('R键被按下 - 手动尺寸检查');

        // 调用手动尺寸检查功能
        if (typeof window.manualDimensionCheck === 'function') {
            window.manualDimensionCheck();
        } else {
            this.notificationManager.showWarning('手动尺寸检查功能尚未实现');
        }
    }

    /**
     * 处理I键 - 检查文件输入状态
     */
    handleCheckFileInput(event) {
        event.preventDefault();
        window.Logger.debugLog('I键被按下 - 检查文件输入状态');

        // 调用文件输入检查功能
        if (this.fileInputChecker) {
            this.fileInputChecker.checkForFileInputChanges();
            this.notificationManager.showInfo('已手动检查文件输入状态，查看调试面板');
        } else {
            this.notificationManager.showWarning('文件输入检查器未初始化');
        }
    }

    /**
     * 处理B键 - 重新检测原图
     */
    handleRedetectOriginalB(event) {
        event.preventDefault();
        window.Logger.debugLog('B键被按下 - 重新检测原图');

        // 解锁原图并重新检测
        this.stateManager.set('originalImageLocked', false);
        this.stateManager.set('originalImage', null);

        // 调用重新检测功能
        if (this.imageDetector) {
            this.imageDetector.recordOriginalImages();
            this.notificationManager.showInfo('已重新检测原图，查看调试面板');
        } else {
            this.notificationManager.showWarning('图片检测器未初始化');
        }
    }

    /**
     * 处理N键 - 重新检测原图（简化版）
     */
    handleRedetectOriginalN(event) {
        event.preventDefault();
        window.Logger.debugLog('N键被按下 - 重新检测原图');

        this.notificationManager.showInfo('正在重新检测原图...');

        // 解锁原图，重新检测
        this.stateManager.set('originalImageLocked', false);
        this.stateManager.set('originalImage', null);

        // 调用重新检测功能
        if (this.imageDetector) {
            this.imageDetector.recordOriginalImages();
        } else {
            this.notificationManager.showWarning('图片检测器未初始化');
        }
    }

    /**
     * 处理P键 - 智能尺寸检查
     */
    handleSmartDimensionCheck(event) {
        event.preventDefault();
        window.Logger.debugLog('P键被按下 - 智能尺寸检查');

        // 调用智能尺寸检查功能（与F2键相同）
        if (typeof window.checkImageDimensionsAndShowModal === 'function') {
            window.checkImageDimensionsAndShowModal();
        } else {
            this.notificationManager.showWarning('智能尺寸检查功能尚未实现');
        }
    }

    /**
     * 处理F2键 - 智能尺寸检查
     */
    handleSmartDimensionCheckF2(event) {
        event.preventDefault();
        window.Logger.debugLog('F2键被按下 - 智能尺寸检查');

        // 调用智能尺寸检查功能
        if (typeof window.checkImageDimensionsAndShowModal === 'function') {
            window.checkImageDimensionsAndShowModal();
        } else {
            this.notificationManager.showWarning('智能尺寸检查功能尚未实现');
        }
    }

    /**
     * 处理X键 - 标记无效
     */
    handleMarkInvalid(event) {
        event.preventDefault();
        window.Logger.debugLog('X键被按下 - 标记无效');

        const invalidButton = window.DOMUtils.findButtonByText('无效');
        if (invalidButton) {
            invalidButton.click();
            this.notificationManager.showInfo('已点击无效按钮');
        } else {
            this.notificationManager.showWarning('未找到无效按钮');
        }
    }

    /**
     * 处理M键 - 打印图片状态
     */
    handlePrintImageStatus(event) {
        event.preventDefault();
        window.Logger.debugLog('M键被按下 - 打印图片状态');

        // 打印当前图片状态
        const imageStates = this.stateManager.getImageStates();
        window.Logger.debugLog('当前图片状态:', imageStates);
        this.notificationManager.showInfo('已打印图片状态，请查看调试面板');
    }

    /**
     * 处理ESC键 - 关闭模态框
     */
    handleEscape(event) {
        event.preventDefault();
        window.Logger.debugLog('ESC键被按下 - 关闭模态框');

        // 调用模态框管理器的关闭功能
        if (this.modalManager) {
            this.modalManager.closeAllModals();
        }

        // 如果有尺寸检查模态框，也要关闭
        if (typeof window.closeDimensionCheckModal === 'function') {
            window.closeDimensionCheckModal();
        }
    }

    /**
     * 初始化图片悬停监听器
     */
    initializeImageHoverListeners() {
        // 监听图片悬停事件
        document.addEventListener('mouseover', (event) => {
            if (event.target.tagName === 'IMG') {
                this.stateManager.set('lastHoveredImage', event.target);
                window.Logger.debugLog('图片悬停:', event.target.src);
            }
        });

        // 监听图片点击事件
        document.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG') {
                this.stateManager.set('selectedImage', event.target);
                window.Logger.debugLog('图片选中:', event.target.src);
            }
        });
    }

    /**
     * 移除事件监听器
     */
    removeEventListeners() {
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        window.Logger.debugLog('事件监听器已移除');
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