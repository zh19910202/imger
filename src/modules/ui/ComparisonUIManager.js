/**
 * 图片对比UI管理器模块
 * 负责图片对比弹窗的创建、显示、隐藏和交互
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[ComparisonUIManager]', message, data || '');
    };
}

class ComparisonUIManager {
    constructor() {
        this.comparisonModal = null;
        this.isComparisonModalOpen = false;
        this.modalCleanupHandlers = [];
        this.initialized = false;
    }

    isInitialized() {
        return this.initialized;
    }

    initialize() {
        try {
            debugLog('初始化 ComparisonUIManager');
            this.initialized = true;
            debugLog('ComparisonUIManager 初始化完成');
        } catch (error) {
            debugLog('ComparisonUIManager 初始化失败:', error);
            throw error;
        }
    }

    // 创建对比弹窗 - 使用原始实现以确保兼容性
    createComparisonModal(original, uploaded, newImage) {
        // 移除已存在的对比弹窗
        if (this.comparisonModal && this.comparisonModal.parentNode) {
            this.comparisonModal.parentNode.removeChild(this.comparisonModal);
        }

        // 创建弹窗容器
        this.comparisonModal = document.createElement('div');
        this.comparisonModal.style.cssText = `
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
            padding: 8px 12px;
            font-size: 16px;
            font-weight: 600;
            color: white;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            width: 100%;
            text-align: center;
            box-sizing: border-box;
        `;

        toolbar.appendChild(title);

        // 创建关闭按钮
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
        `;

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(255, 100, 100, 0.8)';
            closeButton.style.transform = 'scale(1.1)';
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
            closeButton.style.transform = 'scale(1)';
        });

        closeButton.addEventListener('click', () => {
            this.closeComparisonModal();
        });

        toolbar.appendChild(closeButton);

        // 创建主内容区域
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            display: flex;
            gap: 30px;
            align-items: flex-start;
            max-width: 90vw;
            max-height: 85vh;
        `;

        // 创建简单的图片创建函数
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

        // 添加图片到容器
        if (original && original.src) {
            const originalContainer = document.createElement('div');
            originalContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
            `;

            const originalLabel = document.createElement('div');
            originalLabel.textContent = '原图';
            originalLabel.style.cssText = `
                color: white;
                font-size: 16px;
                font-weight: 500;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 20px;
                backdrop-filter: blur(5px);
            `;

            const originalImg = createSimpleImage(original.src, '原图');
            originalImg.style.cssText = `
                max-width: 45vw;
                max-height: 70vh;
                object-fit: contain;
                display: block;
                border-radius: 4px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;

            // 添加下载按钮
            const downloadButton1 = document.createElement('button');
            downloadButton1.innerHTML = '⬇';
            downloadButton1.title = '下载原图';
            downloadButton1.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: none;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;

            downloadButton1.addEventListener('mouseenter', () => {
                downloadButton1.style.background = 'rgba(33, 150, 243, 0.9)';
                downloadButton1.style.transform = 'scale(1.1)';
            });

            downloadButton1.addEventListener('mouseleave', () => {
                downloadButton1.style.background = 'rgba(0, 0, 0, 0.7)';
                downloadButton1.style.transform = 'scale(1)';
            });

            downloadButton1.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof downloadImage === 'function') {
                    downloadImage(originalImg);
                }
            });

            const originalWrapper = document.createElement('div');
            originalWrapper.style.cssText = `
                position: relative;
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                overflow: hidden;
                max-width: 45vw;
                max-height: 75vh;
            `;

            originalWrapper.appendChild(originalImg);
            originalWrapper.appendChild(downloadButton1);

            originalContainer.appendChild(originalLabel);
            originalContainer.appendChild(originalWrapper);
            imageContainer.appendChild(originalContainer);
        }

        if (uploaded && uploaded.src) {
            const uploadedContainer = document.createElement('div');
            uploadedContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
            `;

            const uploadedLabel = document.createElement('div');
            uploadedLabel.textContent = '上传/修改图';
            uploadedLabel.style.cssText = `
                color: white;
                font-size: 16px;
                font-weight: 500;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 20px;
                backdrop-filter: blur(5px);
            `;

            const uploadedImg = createSimpleImage(uploaded.src, '上传/修改图');
            uploadedImg.style.cssText = `
                max-width: 45vw;
                max-height: 70vh;
                object-fit: contain;
                display: block;
                border-radius: 4px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;

            // 添加下载按钮
            const downloadButton2 = document.createElement('button');
            downloadButton2.innerHTML = '⬇';
            downloadButton2.title = '下载修改图';
            downloadButton2.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: none;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;

            downloadButton2.addEventListener('mouseenter', () => {
                downloadButton2.style.background = 'rgba(33, 150, 243, 0.9)';
                downloadButton2.style.transform = 'scale(1.1)';
            });

            downloadButton2.addEventListener('mouseleave', () => {
                downloadButton2.style.background = 'rgba(0, 0, 0, 0.7)';
                downloadButton2.style.transform = 'scale(1)';
            });

            downloadButton2.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof downloadImage === 'function') {
                    downloadImage(uploadedImg);
                }
            });

            const uploadedWrapper = document.createElement('div');
            uploadedWrapper.style.cssText = `
                position: relative;
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                overflow: hidden;
                max-width: 45vw;
                max-height: 75vh;
            `;

            uploadedWrapper.appendChild(uploadedImg);
            uploadedWrapper.appendChild(downloadButton2);

            uploadedContainer.appendChild(uploadedLabel);
            uploadedContainer.appendChild(uploadedWrapper);
            imageContainer.appendChild(uploadedContainer);
        }

        content.appendChild(imageContainer);
        this.comparisonModal.appendChild(content);
        this.comparisonModal.appendChild(toolbar);

        // 添加ESC键关闭功能
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                this.closeComparisonModal();
            }
        };

        document.addEventListener('keydown', handleEsc);
        this.modalCleanupHandlers.push(() => {
            document.removeEventListener('keydown', handleEsc);
        });

        // 添加点击背景关闭功能
        this.comparisonModal.addEventListener('click', (event) => {
            if (event.target === this.comparisonModal) {
                this.closeComparisonModal();
            }
        });

        document.body.appendChild(this.comparisonModal);
        this.isComparisonModalOpen = true;

        debugLog('对比弹窗已创建并显示');

        // 更新全局状态
        window.isComparisonModalOpen = true;
    }

    // 关闭对比弹窗
    closeComparisonModal() {
        if (this.comparisonModal && this.comparisonModal.parentNode) {
            this.comparisonModal.parentNode.removeChild(this.comparisonModal);
            this.comparisonModal = null;
        }

        // 执行清理处理器
        this.modalCleanupHandlers.forEach(handler => {
            try {
                handler();
            } catch (e) {
                debugLog('清理处理器执行错误:', e);
            }
        });
        this.modalCleanupHandlers = [];

        this.isComparisonModalOpen = false;
        window.isComparisonModalOpen = false;

        debugLog('对比弹窗已关闭');
    }

    // 显示智能对比 - 简化实现，直接使用已保存的原图
    async showSmartComparison(comparisonPair) {
        debugLog('显示智能对比', comparisonPair);

        try {
            debugLog('图片源信息:', {
                image1Src: comparisonPair.image1.src,
                image2Src: comparisonPair.image2.src,
                image1Label: comparisonPair.image1.label,
                image2Label: comparisonPair.image2.label
            });

            // 直接使用comparisonPair中的图片信息创建对比弹窗
            const originalImgObj = {
                src: comparisonPair.image1.src
            };

            const uploadedImgObj = {
                src: comparisonPair.image2.src
            };

            debugLog('创建的图片对象:', {
                original: originalImgObj,
                uploaded: uploadedImgObj
            });

            // 调用创建对比弹窗函数
            this.createComparisonModal(originalImgObj, uploadedImgObj, uploadedImgObj);

            debugLog('智能对比弹窗已创建', {
                image1: comparisonPair.image1.label,
                image2: comparisonPair.image2.label,
                mode: comparisonPair.mode
            });

        } catch (error) {
            debugLog('智能对比失败', error);
            if (typeof showNotification === 'function') {
                showNotification('❌ 图片对比失败: ' + error.message, 3000);
            }
        }
    }
}

// 全局实例
let comparisonUIManagerInstance = null;

// 获取全局实例
function getComparisonUIManager() {
    if (!comparisonUIManagerInstance) {
        comparisonUIManagerInstance = new ComparisonUIManager();
        // 设置到全局变量以保持兼容性
        window.comparisonUIManager = comparisonUIManagerInstance;
    }
    return comparisonUIManagerInstance;
}

// 兼容性函数 - 保持向后兼容
function createComparisonModal(original, uploaded, newImage) {
    const manager = getComparisonUIManager();
    if (!manager.isInitialized()) {
        manager.initialize();
    }
    return manager.createComparisonModal(original, uploaded, newImage);
}

function closeComparisonModal() {
    const manager = getComparisonUIManager();
    if (!manager.isInitialized()) {
        manager.initialize();
    }
    return manager.closeComparisonModal();
}

async function showSmartComparison(comparisonPair) {
    const manager = getComparisonUIManager();
    if (!manager.isInitialized()) {
        manager.initialize();
    }
    return await manager.showSmartComparison(comparisonPair);
}

// 初始化函数
function initializeComparisonUIManager() {
    try {
        const manager = getComparisonUIManager();
        manager.initialize();
        debugLog('ComparisonUIManager 全局初始化完成');
        return manager;
    } catch (error) {
        debugLog('ComparisonUIManager 全局初始化失败:', error);
        throw error;
    }
}

// 导出到全局作用域
window.ComparisonUIManager = ComparisonUIManager;
window.getComparisonUIManager = getComparisonUIManager;
window.initializeComparisonUIManager = initializeComparisonUIManager;

// 兼容性函数导出
window.createComparisonModal = createComparisonModal;
window.closeComparisonModal = closeComparisonModal;
window.showSmartComparison = showSmartComparison;

debugLog('ComparisonUIManager 模块加载完成');