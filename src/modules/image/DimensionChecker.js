/**
 * 图片尺寸检查器
 * 保持原有的R键和F2键尺寸检查逻辑完全不变
 */
window.DimensionChecker = class DimensionChecker {
    constructor(stateManager, notificationManager, modalManager) {
        this.stateManager = stateManager;
        this.notificationManager = notificationManager;
        this.modalManager = modalManager;

        // 状态变量
        this.dimensionCheckModal = null;
        this.isDimensionCheckModalOpen = false;
        this.lastDimensionCheckInfo = null;
        this.cachedRunningHubResults = null;
        this.currentPageTaskInfo = null;

        this.initializeGlobalFunctions();
    }

    /**
     * 初始化全局函数 - 保持原有的函数名不变
     */
    initializeGlobalFunctions() {
        // 将函数挂载到window对象，保持原有调用方式
        window.manualDimensionCheck = this.manualDimensionCheck.bind(this);
        window.checkImageDimensionsAndShowModal = this.checkImageDimensionsAndShowModal.bind(this);
        window.closeDimensionCheckModal = this.closeDimensionCheckModal.bind(this);
        window.showDimensionCheckModal = this.showDimensionCheckModal.bind(this);
        window.clearRunningHubCache = this.clearRunningHubCache.bind(this);
    }

    /**
     * R键功能：手动触发图片尺寸检查 - 原逻辑保持不变
     */
    async manualDimensionCheck() {
        window.Logger.debugLog('手动触发图片尺寸检查');

        // 首先检查是否有缓存的结果可以快速显示
        if (this.cachedRunningHubResults && this.currentPageTaskInfo) {
            window.Logger.debugLog('检测到缓存结果，询问用户是否查看', {
                taskId: this.currentPageTaskInfo.taskId,
                cachedAt: new Date(this.currentPageTaskInfo.cachedAt).toLocaleString()
            });

            const timeAgo = Math.round((Date.now() - this.currentPageTaskInfo.cachedAt) / 60000);
            const shouldViewCached = confirm(
                `检测到${timeAgo < 1 ? '刚才' : timeAgo + '分钟前'}的生成结果缓存\n` +
                `任务ID: ${this.currentPageTaskInfo.taskId}\n` +
                `需求: ${this.currentPageTaskInfo.comment || '无'}\n\n` +
                `是否查看缓存的结果？\n` +
                `点击"确定"查看缓存，点击"取消"重新检查图片`
            );

            if (shouldViewCached) {
                window.Logger.debugLog('用户选择查看缓存结果');
                // 直接显示模态框，缓存会自动恢复
                const originalImage = this.stateManager.get('originalImage');
                const imageInfoForModal = {
                    src: originalImage?.src || 'cached_result',
                    width: originalImage?.width || 0,
                    height: originalImage?.height || 0,
                    name: originalImage?.name || '缓存结果'
                };
                this.showDimensionCheckModal(imageInfoForModal, true);
                this.notificationManager.showSuccess('已显示缓存的生成结果');
                return true;
            } else {
                window.Logger.debugLog('用户选择重新检查，清除缓存');
                this.clearRunningHubCache();
            }
        }

        try {
            // 获取当前原图
            const originalImage = this.stateManager.get('originalImage');
            if (!originalImage) {
                window.Logger.debugLog('未找到原图，尝试重新检测');

                // 通知图片检测器重新检测
                if (window.AnnotateFlowApp && window.AnnotateFlowApp.imageDetector) {
                    window.AnnotateFlowApp.imageDetector.recordOriginalImages();
                }

                // 等待一下再检查
                await new Promise(resolve => setTimeout(resolve, 500));

                const newOriginalImage = this.stateManager.get('originalImage');
                if (!newOriginalImage) {
                    this.notificationManager.showError('❌ 未找到原图，请等待页面加载完成');
                    return false;
                }
            }

            // 创建新的Image对象来获取真实的图片尺寸
            const img = new Image();
            const currentOriginalImage = this.stateManager.get('originalImage');

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

            img.src = currentOriginalImage.src;

            // 等待图片加载或超时
            const { width, height } = await Promise.race([loadPromise, timeoutPromise]);

            window.Logger.debugLog('手动检查图片尺寸', { width, height, src: currentOriginalImage.src });

            // 检查尺寸是否符合要求（长宽都是8的倍数）
            const isWidthValid = width % 8 === 0;
            const isHeightValid = height % 8 === 0;
            const isDimensionValid = isWidthValid && isHeightValid;

            window.Logger.debugLog('手动尺寸检查结果', {
                width,
                height,
                isWidthValid,
                isHeightValid,
                isDimensionValid
            });

            if (isDimensionValid) {
                // 尺寸符合要求，弹出模态框
                this.notificationManager.showSuccess('✅ 图片尺寸符合要求，弹出模态框');

                // 保存检查信息
                this.lastDimensionCheckInfo = {
                    imageInfo: {
                        src: currentOriginalImage.src,
                        width: width,
                        height: height,
                        name: `${width}x${height}`
                    },
                    checkTime: Date.now()
                };

                // 显示模态框
                this.showDimensionCheckModal(this.lastDimensionCheckInfo.imageInfo);
                return true; // 返回true表示符合要求

            } else {
                // 尺寸不符合要求
                const message = `❌ 图片尺寸不符合要求 (${width}x${height})\n` +
                              `宽度${isWidthValid ? '✅' : '❌'}: ${width} ${isWidthValid ? '' : '不'}是8的倍数\n` +
                              `高度${isHeightValid ? '✅' : '❌'}: ${height} ${isHeightValid ? '' : '不'}是8的倍数`;

                this.notificationManager.showWarning(message);

                window.Logger.debugLog('尺寸检查失败', {
                    width, height, isWidthValid, isHeightValid
                });
                return false; // 返回false表示不符合要求
            }

        } catch (error) {
            window.Logger.debugLog('手动检查图片尺寸时出错', error);
            this.notificationManager.showError('❌ 检查图片尺寸时出错: ' + error.message);
            return false; // 出错时返回false
        }
    }

    /**
     * F2键：智能尺寸检查 - 复用R键逻辑，如果不符合要求则自动跳过直到找到合适图片
     */
    async checkImageDimensionsAndShowModal() {
        window.Logger.debugLog('F2键触发：智能尺寸检查');
        await this.autoSkipToValidImageWithRKeyLogic();
    }

    /**
     * 自动跳过到符合要求的图片，使用R键逻辑
     */
    async autoSkipToValidImageWithRKeyLogic() {
        window.Logger.debugLog('开始智能跳过到符合要求的图片');

        let attempts = 0;
        const maxAttempts = 10; // 最多尝试10次

        while (attempts < maxAttempts) {
            attempts++;
            window.Logger.debugLog(`第${attempts}次尝试检查图片`);

            // 执行R键的逻辑：手动尺寸检查
            const checkResult = await this.manualDimensionCheck();

            if (checkResult === true) {
                // 找到符合要求的图片，R键逻辑已经显示了模态框
                window.Logger.debugLog('找到符合要求的图片，停止自动跳过');
                this.notificationManager.showSuccess(`经过${attempts}次检查，找到符合要求的图片`);
                return;
            }

            // 不符合要求，点击跳过按钮
            const skipButton = window.DOMUtils.findButtonByText('跳过');
            if (skipButton) {
                window.Logger.debugLog(`第${attempts}次检查不符合要求，自动点击跳过`);
                skipButton.click();

                // 等待页面加载
                await new Promise(resolve => setTimeout(resolve, 1500));

                // 重新检测原图（页面已经跳转到下一个）
                this.stateManager.set('originalImageLocked', false);
                this.stateManager.set('originalImage', null);

                if (window.AnnotateFlowApp && window.AnnotateFlowApp.imageDetector) {
                    window.AnnotateFlowApp.imageDetector.recordOriginalImages();
                }

                // 再等待一下让检测完成
                await new Promise(resolve => setTimeout(resolve, 1000));

            } else {
                window.Logger.debugLog('未找到跳过按钮，停止自动跳过');
                this.notificationManager.showWarning('未找到跳过按钮，无法继续自动跳过');
                break;
            }
        }

        if (attempts >= maxAttempts) {
            this.notificationManager.showWarning(`已尝试${maxAttempts}次，未找到符合要求的图片`);
        }
    }

    /**
     * 显示尺寸检查模态框 - 简化版本
     */
    showDimensionCheckModal(imageInfo, showCachedResults = false) {
        window.Logger.debugLog('显示尺寸检查模态框', imageInfo);

        // 如果已经有模态框打开，先关闭
        if (this.isDimensionCheckModalOpen) {
            this.closeDimensionCheckModal();
        }

        // 创建模态框
        this.dimensionCheckModal = document.createElement('div');
        this.dimensionCheckModal.className = 'dimension-check-modal';
        this.dimensionCheckModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // 创建模态框内容
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
        `;

        modalContent.innerHTML = `
            <h3>图片尺寸检查结果</h3>
            <p><strong>图片尺寸:</strong> ${imageInfo.width}x${imageInfo.height}</p>
            <p><strong>状态:</strong> ✅ 尺寸符合要求 (长宽都是8的倍数)</p>
            <div style="margin-top: 20px;">
                <button id="close-modal" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">关闭</button>
                ${showCachedResults ? '<p style="color: #666; font-size: 12px;">显示的是缓存结果</p>' : ''}
            </div>
        `;

        this.dimensionCheckModal.appendChild(modalContent);
        document.body.appendChild(this.dimensionCheckModal);

        // 设置状态
        this.isDimensionCheckModalOpen = true;

        // 绑定关闭事件
        const closeBtn = modalContent.querySelector('#close-modal');
        closeBtn.addEventListener('click', () => {
            this.closeDimensionCheckModal();
        });

        // ESC键关闭
        const handleEscape = (e) => {
            if (e.key === 'Escape' && this.isDimensionCheckModalOpen) {
                this.closeDimensionCheckModal();
            }
        };
        document.addEventListener('keydown', handleEscape);
        this.dimensionCheckModal._handleEscape = handleEscape;

        // 点击背景关闭
        this.dimensionCheckModal.addEventListener('click', (e) => {
            if (e.target === this.dimensionCheckModal) {
                this.closeDimensionCheckModal();
            }
        });

        window.Logger.debugLog('尺寸检查模态框已显示');
    }

    /**
     * 关闭尺寸检查模态框
     */
    closeDimensionCheckModal() {
        if (this.dimensionCheckModal && this.dimensionCheckModal.parentNode) {
            // 移除事件监听器
            if (this.dimensionCheckModal._handleEscape) {
                document.removeEventListener('keydown', this.dimensionCheckModal._handleEscape);
            }

            // 移除模态框
            this.dimensionCheckModal.parentNode.removeChild(this.dimensionCheckModal);
            this.dimensionCheckModal = null;
            this.isDimensionCheckModalOpen = false;

            window.Logger.debugLog('尺寸检查模态框已关闭');
        }
    }

    /**
     * 清除RunningHub缓存 - 占位函数
     */
    clearRunningHubCache() {
        this.cachedRunningHubResults = null;
        this.currentPageTaskInfo = null;
        window.Logger.debugLog('RunningHub缓存已清除');
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isDimensionCheckModalOpen: this.isDimensionCheckModalOpen,
            lastDimensionCheckInfo: this.lastDimensionCheckInfo,
            hasCachedResults: !!this.cachedRunningHubResults
        };
    }
}