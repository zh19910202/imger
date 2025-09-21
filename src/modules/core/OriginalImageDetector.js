/**
 * 原图检测管理器
 * 负责多策略原图检测、状态管理和DOM监听
 * 
 * 检测策略优先级：
 * 1. COS图片拦截 (最高优先级)
 * 2. 精确DOM选择器 (高优先级) 
 * 3. COS原图DOM检测 (中优先级)
 * 4. 通用DOM扫描 (低优先级)
 * 5. 竞速模式检测 (备选方案)
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[OriginalImageDetector]', message, data || '');
    };
}

class OriginalImageDetector {
    constructor() {
        this.originalImage = null;
        this.originalImageLocked = false;
        this.currentPageUrl = '';
        this.domObserver = null;
        this.pendingTimeouts = [];
        this.initialized = false;
        
        // 检测策略配置
        this.detectionStrategies = {
            precise: true,      // 精确DOM选择器
            cos: true,          // COS图片检测
            general: true,      // 通用DOM扫描
            competitive: true   // 竞速模式
        };
        
        // 重试配置
        this.retryConfig = {
            intervals: [500, 1000, 2000, 3000, 5000],
            maxAttempts: 5
        };

        // 支持的图片格式（扩展支持）
        this.supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'];
    }

    /**
     * 初始化原图检测器
     */
    initialize() {
        if (this.initialized) {
            debugLog('OriginalImageDetector 已经初始化');
            return;
        }

        debugLog('初始化 OriginalImageDetector');
        
        // 初始化DOM监听
        this.initializeDOMObserver();
        
        // 记录当前页面URL
        this.currentPageUrl = window.location.href;
        
        this.initialized = true;
        debugLog('✅ OriginalImageDetector 初始化完成');
    }

    /**
     * 主要检测方法 - 多策略原图检测
     */
    async detectOriginalImage() {
        if (this.originalImageLocked) {
            debugLog('原图已锁定，跳过检测');
            return this.originalImage;
        }

        debugLog('🔍 开始多策略原图检测');
        
        // 检查页面变化
        this.checkPageChange();

        // 策略1: 快速性能API检查
        const quickResult = await this.quickPerformanceAPICheck();
        if (quickResult) {
            debugLog('✅ 快速检测成功', quickResult);
            this.setOriginalImage(quickResult);
            return quickResult;
        }

        // 策略2: COS图片检测（支持多格式）
        const cosResult = this.detectCOSImages();
        if (cosResult) {
            debugLog('✅ COS图片检测成功', cosResult);
            this.setOriginalImage(cosResult);
            return cosResult;
        }

        // 策略3: 精确DOM选择器检测
        const preciseResult = this.detectWithPreciseSelectors();
        if (preciseResult) {
            debugLog('✅ 精确选择器检测成功', preciseResult);
            this.setOriginalImage(preciseResult);
            return preciseResult;
        }

        // 策略4: 通用DOM扫描（这是主要的检测逻辑）
        const generalResult = this.detectWithGeneralScan();
        if (generalResult) {
            debugLog('✅ 通用扫描检测成功', generalResult);
            // 注意：handleDetectedImage已经处理了setOriginalImage
            return generalResult;
        }

        // 策略5: 竞速模式检测
        this.startCompetitiveDetection();

        debugLog('⚠️ 所有检测策略均未找到原图');
        return null;
    }

    /**
     * 快速性能API检查
     */
    async quickPerformanceAPICheck() {
        if (!window.performance || !window.performance.getEntriesByType) {
            return null;
        }

        const resources = window.performance.getEntriesByType('resource');
        const imageResources = resources.filter(resource => 
            resource.initiatorType === 'img' && this.isSupportedImageFormat(resource.name)
        );

        if (imageResources.length > 0) {
            // 优先选择COS图片
            const cosImage = imageResources.find(resource => this.isCOSOriginalImage(resource.name));
            if (cosImage) {
                return {
                    url: cosImage.name,
                    source: 'performance-api-cos',
                    loadTime: cosImage.responseEnd - cosImage.startTime
                };
            }

            // 选择最近加载的图片
            const latestImage = imageResources[imageResources.length - 1];
            return {
                url: latestImage.name,
                source: 'performance-api',
                loadTime: latestImage.responseEnd - latestImage.startTime
            };
        }

        return null;
    }

    /**
     * COS图片检测（支持多格式）
     */
    detectCOSImages() {
        debugLog('🔍 检测COS图片（支持多格式）');
        
        // 动态生成COS选择器
        const cosImageSelectors = [];
        this.supportedFormats.forEach(format => {
            cosImageSelectors.push(`img[src*="cos.ap-guangzhou.myqcloud.com/target/"][src$="${format}"]`);
            cosImageSelectors.push(`img[src*="cos.ap-guangzhou.myqcloud.com/dataset/"][src$="${format}"]`);
        });

        for (const selector of cosImageSelectors) {
            const cosImages = document.querySelectorAll(selector);
            if (cosImages.length > 0) {
                // 优先选择已加载的图片
                for (const img of cosImages) {
                    if (img.complete && img.naturalWidth > 0) {
                        debugLog(`✅ 找到COS原图: ${img.src}`);
                        return {
                            element: img,
                            url: img.src,
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                            source: 'cos-selector',
                            type: this.getImageFormat(img.src)
                        };
                    }
                }
                
                // 如果没有已加载的，返回第一个
                const firstImg = cosImages[0];
                return {
                    element: firstImg,
                    url: firstImg.src,
                    width: firstImg.naturalWidth || 0,
                    height: firstImg.naturalHeight || 0,
                    source: 'cos-selector-pending',
                    type: this.getImageFormat(firstImg.src)
                };
            }
        }

        return null;
    }

    /**
     * 精确DOM选择器检测（从LEGACY迁移的完整逻辑）
     */
    detectWithPreciseSelectors() {
        debugLog('🔍 精确DOM选择器检测（完整版）');
        
        // 1. 精确的DOM选择器（最高优先级）
        const preciseSelectorCandidates = [
            'div[data-v-92a52416].safe-image img[data-v-92a52416][src]',
            'div.safe-image img[data-v-92a52416][src]',
            'img[data-v-92a52416][src].img',
            'img[data-v-92a52416][src]',
            'div.safe-image img[src]',
            '.image-item img[src]'
        ];

        // 2. COS原图选择器（支持多种图片格式）
        const cosImageSelectors = this.generateCOSSelectors();

        // 合并选择器，精确DOM选择器优先
        const selectorCandidates = [
            ...preciseSelectorCandidates,
            ...cosImageSelectors
        ];

        let targetImages = [];
        let usedSelector = '';

        // 按优先级尝试每个选择器
        for (const selector of selectorCandidates) {
            targetImages = document.querySelectorAll(selector);
            if (targetImages.length > 0) {
                usedSelector = selector;
                debugLog('使用选择器找到原图', {
                    selector: selector,
                    found: targetImages.length
                });
                break;
            }
        }

        // 如果所有特定选择器都没找到，使用更宽泛的查找
        if (targetImages.length === 0) {
            debugLog('所有特定选择器未找到图片，尝试查找所有带data-v属性的图片');
            
            const allImages = document.querySelectorAll('img[src]');
            const dataVImages = Array.from(allImages).filter(img => {
                const hasDataV = Array.from(img.attributes).some(attr => 
                    attr.name.startsWith('data-v-')
                );
                const isSupported = this.isSupportedImageFormat(img.src);
                return hasDataV && isSupported;
            });
            
            debugLog('找到带data-v属性的支持格式图片', dataVImages.length);
            targetImages = dataVImages;
            usedSelector = '带data-v属性的支持格式图片';
            
            if (targetImages.length === 0) {
                debugLog('仍未找到，使用所有支持格式图片作为备选');
                const supportedImages = Array.from(allImages).filter(img => this.isSupportedImageFormat(img.src));
                targetImages = supportedImages;
                usedSelector = '所有支持格式图片';
                debugLog('找到支持格式图片数量', supportedImages.length);
            }
        }

        debugLog('最终图片候选数量', {
            count: targetImages.length,
            selector: usedSelector
        });

        if (targetImages.length === 0) {
            debugLog('页面中无符合条件的图片元素');
            return null;
        }

        // 详细检查每个候选图片
        this.logCandidateImages(targetImages);

        // 方法1：优先选择最精确选择器找到的已加载图片
        let mainImage = this.selectFromExactSelector(targetImages);

        // 方法2：如果精确选择器没找到，从候选图片中选择
        if (!mainImage && targetImages.length > 0) {
            mainImage = this.selectFromCandidates(targetImages);
        }

        if (mainImage) {
            debugLog('✅ 精确选择器检测成功', {
                src: mainImage.src.substring(0, 50) + '...',
                selector: usedSelector
            });
            
            return {
                element: mainImage,
                url: mainImage.src,
                width: mainImage.naturalWidth || mainImage.width,
                height: mainImage.naturalHeight || mainImage.height,
                source: 'precise-selector-enhanced',
                selector: usedSelector,
                type: this.getImageFormat(mainImage.src)
            };
        }

        return null;
    }

    /**
     * 生成COS选择器
     */
    generateCOSSelectors() {
        const cosImageSelectors = [];
        
        this.supportedFormats.forEach(format => {
            // 去掉点号，因为CSS选择器中需要
            const ext = format.replace('.', '');
            cosImageSelectors.push(
                `img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".${ext}"]`,
                `img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".${ext}"]`,
                `img[src*="/target/"][src*=".${ext}"]`,
                `img[src*="/target/dataset/"][src*=".${ext}"]`,
                `img[src*="dataset/"][src*=".${ext}"]`
            );
        });

        return cosImageSelectors;
    }

    /**
     * 记录候选图片详细信息
     */
    logCandidateImages(targetImages) {
        Array.from(targetImages).forEach((img, index) => {
            const parentDiv = img.closest('div[data-v-92a52416], div.safe-image, div.image-item');
            debugLog(`检查候选图片 #${index}`, {
                src: img.src ? img.src.substring(0, 100) + '...' : '无src',
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                width: img.width,
                height: img.height,
                complete: img.complete,
                className: img.className,
                id: img.id || '无ID',
                dataset: Object.keys(img.dataset).map(key => `${key}=${img.dataset[key]}`).join(', ') || '无data属性',
                hasDataV92a52416: img.hasAttribute('data-v-92a52416'),
                parentDivClasses: parentDiv ? parentDiv.className : '无父容器',
                parentDivDataAttrs: parentDiv ? Object.keys(parentDiv.dataset).join(', ') : '无父容器data属性'
            });
        });
    }

    /**
     * 从精确选择器中选择图片
     */
    selectFromExactSelector(targetImages) {
        const exactSelector = 'div[data-v-92a52416].safe-image img[data-v-92a52416][src]';
        const exactImages = document.querySelectorAll(exactSelector);
        
        if (exactImages.length > 0) {
            // 优先选择已加载的支持格式图片
            let mainImage = Array.from(exactImages).find(img => {
                const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
                const isSupported = this.isSupportedImageFormat(img.src);
                if (isLoaded && isSupported) {
                    debugLog('找到精确选择器且已加载的支持格式原图', {
                        src: img.src.substring(0, 50) + '...',
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        selector: exactSelector
                    });
                }
                return isLoaded && isSupported;
            });
            
            // 如果没有已加载的，选择第一个支持格式的
            if (!mainImage) {
                mainImage = Array.from(exactImages).find(img => this.isSupportedImageFormat(img.src));
                if (mainImage) {
                    debugLog('选择精确选择器的第一个支持格式图片（可能未完全加载）', {
                        src: mainImage.src ? mainImage.src.substring(0, 50) + '...' : '无src',
                        complete: mainImage.complete
                    });
                } else {
                    debugLog('精确选择器未找到支持格式的图片');
                }
            }
            
            return mainImage;
        }
        
        return null;
    }

    /**
     * 从候选图片中选择最佳图片
     */
    selectFromCandidates(targetImages) {
        // 优先选择已加载且在safe-image容器中的支持格式图片
        let mainImage = Array.from(targetImages).find(img => {
            const isInSafeImage = img.closest('.safe-image') !== null;
            const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            const isSupported = this.isSupportedImageFormat(img.src);
            return isInSafeImage && isLoaded && isSupported;
        });
        
        if (mainImage) {
            debugLog('找到safe-image容器中的已加载支持格式图片');
            return mainImage;
        }
        
        // 选择第一个已加载的支持格式图片
        mainImage = Array.from(targetImages).find(img => {
            const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            const isSupported = this.isSupportedImageFormat(img.src);
            return isLoaded && isSupported;
        });
        
        if (mainImage) {
            debugLog('找到已加载的候选支持格式图片');
            return mainImage;
        }
        
        // 选择第一个支持格式的候选图片
        mainImage = Array.from(targetImages).find(img => this.isSupportedImageFormat(img.src));
        if (mainImage) {
            debugLog('未找到任何支持格式的候选图片');
        }
        
        return mainImage;
    }

    /**
     * 通用DOM扫描检测（从LEGACY完整迁移）
     */
    detectWithGeneralScan() {
        debugLog('🔍 通用DOM扫描检测（完整版）');
        
        // 这个方法实际上就是recordOriginalImages_LEGACY的核心逻辑
        // 1. 精确的DOM选择器（最高优先级）
        const preciseSelectorCandidates = [
            'div[data-v-92a52416].safe-image img[data-v-92a52416][src]',
            'div.safe-image img[data-v-92a52416][src]',
            'img[data-v-92a52416][src].img',
            'img[data-v-92a52416][src]',
            'div.safe-image img[src]',
            '.image-item img[src]'
        ];
        
        // 2. COS原图选择器（支持多种图片格式）
        const cosImageSelectors = this.generateCompleteCOSSelectors();
        
        // 合并选择器，精确DOM选择器优先
        const selectorCandidates = [
            ...preciseSelectorCandidates,
            ...cosImageSelectors
        ];
        
        let targetImages = [];
        let usedSelector = '';
        
        // 按优先级尝试每个选择器
        for (const selector of selectorCandidates) {
            targetImages = document.querySelectorAll(selector);
            if (targetImages.length > 0) {
                usedSelector = selector;
                debugLog('使用选择器找到原图', {
                    selector: selector,
                    found: targetImages.length
                });
                break;
            }
        }
        
        // 如果所有特定选择器都没找到，使用更宽泛的查找
        if (targetImages.length === 0) {
            debugLog('所有特定选择器未找到图片，尝试查找所有带data-v属性的图片');
            
            const allImages = document.querySelectorAll('img[src]');
            const dataVImages = Array.from(allImages).filter(img => {
                const hasDataV = Array.from(img.attributes).some(attr => 
                    attr.name.startsWith('data-v-')
                );
                const isSupported = this.isSupportedImageFormat(img.src);
                return hasDataV && isSupported;
            });
            
            debugLog('找到带data-v属性的支持格式图片', dataVImages.length);
            targetImages = dataVImages;
            usedSelector = '带data-v属性的支持格式图片';
            
            if (targetImages.length === 0) {
                debugLog('仍未找到，使用所有支持格式图片作为备选');
                const supportedImages = Array.from(allImages).filter(img => this.isSupportedImageFormat(img.src));
                targetImages = supportedImages;
                usedSelector = '所有支持格式图片';
                debugLog('找到支持格式图片数量', supportedImages.length);
            }
        }
        
        debugLog('最终图片候选数量', {
            count: targetImages.length,
            selector: usedSelector
        });
        
        if (targetImages.length === 0) {
            debugLog('页面中无符合条件的图片元素');
            return null;
        }
        
        // 详细检查每个候选图片
        this.logCandidateImages(targetImages);
        
        let mainImage = null;
        
        // 方法1：优先选择最精确选择器找到的已加载图片
        const exactSelector = 'div[data-v-92a52416].safe-image img[data-v-92a52416][src]';
        const exactImages = document.querySelectorAll(exactSelector);
        if (exactImages.length > 0) {
            mainImage = Array.from(exactImages).find(img => {
                const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
                const isSupported = this.isSupportedImageFormat(img.src);
                if (isLoaded && isSupported) {
                    debugLog('找到精确选择器且已加载的支持格式原图', {
                        src: img.src.substring(0, 50) + '...',
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        selector: exactSelector
                    });
                }
                return isLoaded && isSupported;
            });
            
            // 如果没有已加载的，选择第一个支持格式的
            if (!mainImage) {
                mainImage = Array.from(exactImages).find(img => this.isSupportedImageFormat(img.src));
                if (mainImage) {
                    debugLog('选择精确选择器的第一个支持格式图片（可能未完全加载）', {
                        src: mainImage.src ? mainImage.src.substring(0, 50) + '...' : '无src',
                        complete: mainImage.complete
                    });
                } else {
                    debugLog('精确选择器未找到支持格式的图片');
                }
            }
        }
        
        // 方法2：如果精确选择器没找到，从候选图片中选择
        if (!mainImage && targetImages.length > 0) {
            // 优先选择已加载且在safe-image容器中的支持格式图片
            mainImage = Array.from(targetImages).find(img => {
                const isInSafeImage = img.closest('.safe-image') !== null;
                const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
                const isSupported = this.isSupportedImageFormat(img.src);
                return isInSafeImage && isLoaded && isSupported;
            });
            
            if (mainImage) {
                debugLog('找到safe-image容器中的已加载支持格式图片');
            } else {
                // 选择第一个已加载的支持格式图片
                mainImage = Array.from(targetImages).find(img => {
                    const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
                    const isSupported = this.isSupportedImageFormat(img.src);
                    return isLoaded && isSupported;
                });
                
                if (mainImage) {
                    debugLog('找到已加载的候选支持格式图片');
                } else {
                    // 选择第一个支持格式的候选图片
                    mainImage = Array.from(targetImages).find(img => this.isSupportedImageFormat(img.src));
                    if (!mainImage) {
                        debugLog('未找到任何支持格式的候选图片');
                    }
                }
            }
        }
        
        if (mainImage) {
            debugLog('✅ 通用扫描检测成功', {
                src: mainImage.src.substring(0, 50) + '...',
                selector: usedSelector
            });
            
            // 使用handleDetectedImage处理图片加载逻辑
            return this.handleDetectedImage(mainImage, usedSelector);
        }

        return null;
    }

    /**
     * 生成完整的COS选择器（从LEGACY迁移）
     */
    generateCompleteCOSSelectors() {
        const cosImageSelectors = [
            // JPEG格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpg"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpeg"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpg"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpeg"]',
            // PNG格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".png"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".png"]',
            // WebP格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".webp"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".webp"]',
            // GIF格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".gif"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".gif"]',
            // BMP格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".bmp"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".bmp"]',
            // TIFF格式
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".tiff"]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".tiff"]',
            // 通用路径匹配（所有格式）
            'img[src*="/target/"][src*=".jpg"]',
            'img[src*="/target/"][src*=".jpeg"]',
            'img[src*="/target/"][src*=".png"]',
            'img[src*="/target/"][src*=".webp"]',
            'img[src*="/target/"][src*=".gif"]',
            'img[src*="/target/"][src*=".bmp"]',
            'img[src*="/target/"][src*=".tiff"]',
            'img[src*="/target/dataset/"][src*=".jpg"]',
            'img[src*="/target/dataset/"][src*=".jpeg"]',
            'img[src*="/target/dataset/"][src*=".png"]',
            'img[src*="/target/dataset/"][src*=".webp"]',
            'img[src*="/target/dataset/"][src*=".gif"]',
            'img[src*="/target/dataset/"][src*=".bmp"]',
            'img[src*="/target/dataset/"][src*=".tiff"]',
            'img[src*="dataset/"][src*=".jpg"]',
            'img[src*="dataset/"][src*=".jpeg"]',
            'img[src*="dataset/"][src*=".png"]',
            'img[src*="dataset/"][src*=".webp"]',
            'img[src*="dataset/"][src*=".gif"]',
            'img[src*="dataset/"][src*=".bmp"]',
            'img[src*="dataset/"][src*=".tiff"]'
        ];
        
        return cosImageSelectors;
    }

    /**
     * 竞速模式检测
     */
    startCompetitiveDetection() {
        debugLog('🏁 启动竞速模式检测');
        
        this.retryConfig.intervals.forEach((interval, index) => {
            const timeoutId = setTimeout(() => {
                if (!this.originalImageLocked) {
                    debugLog(`🔄 竞速重试 ${index + 1}/${this.retryConfig.maxAttempts}`);
                    this.detectOriginalImage();
                }
            }, interval);
            
            this.pendingTimeouts.push(timeoutId);
        });
    }

    /**
     * 强制重新检测（解锁后重新检测）
     */
    forceRedetect() {
        debugLog('🔓 强制重新检测原图');
        this.unlockOriginalImage();
        return this.detectOriginalImage();
    }

    /**
     * 设置原图信息（增强版，包含图片加载处理）
     */
    setOriginalImage(imageInfo) {
        this.originalImage = imageInfo;
        this.originalImageLocked = true;
        
        // 清除待执行的重试任务
        this.clearPendingTimeouts();
        
        // 同步到全局状态
        if (window.stateManager) {
            window.stateManager.setOriginalImage(imageInfo, true);
        } else {
            // 兼容性：直接设置全局变量
            window.originalImage = imageInfo;
            window.originalImageLocked = true;
        }
        
        debugLog('✅ 原图已设置并锁定', imageInfo);
    }

    /**
     * 处理检测到的图片（包含加载等待逻辑）
     */
    handleDetectedImage(mainImage, usedSelector = '') {
        if (!mainImage) {
            debugLog('未找到任何可用的原图');
            // 延迟重试，可能图片还在动态加载
            setTimeout(() => {
                debugLog('延迟3秒后重试检测原图');
                this.detectOriginalImage();
            }, 3000);
            return null;
        }

        debugLog('最终选定的原图', {
            src: mainImage.src ? mainImage.src.substring(0, 100) + '...' : '无src',
            complete: mainImage.complete,
            naturalWidth: mainImage.naturalWidth,
            naturalHeight: mainImage.naturalHeight,
            hasDataV: mainImage.hasAttribute('data-v-92a52416'),
            className: mainImage.className,
            parentContainer: mainImage.closest('.safe-image, .image-item') ? '在安全图片容器中' : '不在特定容器中',
            usedSelector: usedSelector
        });
        
        // 如果图片还没完全加载，等待加载完成
        if (!mainImage.complete || mainImage.naturalWidth === 0) {
            debugLog('选中的原图还没完全加载，等待加载完成');
            
            const handleLoad = () => {
                debugLog('原图加载完成，记录原图信息');
                this.recordImageAsOriginal(mainImage);
                mainImage.removeEventListener('load', handleLoad);
            };
            
            const handleError = () => {
                debugLog('原图加载失败，尝试记录当前状态');
                this.recordImageAsOriginal(mainImage);
                mainImage.removeEventListener('error', handleError);
            };
            
            mainImage.addEventListener('load', handleLoad);
            mainImage.addEventListener('error', handleError);
            
            // 也立即记录当前状态，以防万一
            this.recordImageAsOriginal(mainImage);
        } else {
            this.recordImageAsOriginal(mainImage);
        }

        return {
            element: mainImage,
            url: mainImage.src,
            width: mainImage.naturalWidth || mainImage.width,
            height: mainImage.naturalHeight || mainImage.height,
            source: 'detected-with-loading',
            selector: usedSelector,
            type: this.getImageFormat(mainImage.src)
        };
    }

    /**
     * 解锁原图状态
     */
    unlockOriginalImage() {
        this.originalImageLocked = false;
        this.originalImage = null;
        
        // 同步到全局状态
        if (window.stateManager) {
            window.stateManager.unlockOriginalImage();
        } else {
            // 兼容性：直接设置全局变量
            window.originalImageLocked = false;
            window.originalImage = null;
        }
        
        debugLog('🔓 原图状态已解锁');
    }

    /**
     * 记录指定图片为原图（严格版本，从LEGACY迁移）
     */
    recordImageAsOriginal(img) {
        // 如果原图已经被锁定，不允许在同一页面内更改
        if (this.originalImageLocked && this.originalImage) {
            debugLog('原图已在当前页面锁定，跳过更新', {
                existingOriginal: this.originalImage.url.substring(0, 50) + '...',
                attemptedNew: img.src ? img.src.substring(0, 50) + '...' : '无src',
                currentPage: this.currentPageUrl.substring(0, 50) + '...'
            });
            return false;
        }
        
        // 验证图片格式：只接受支持的格式
        if (!img.src || !this.isSupportedImageFormat(img.src)) {
            debugLog('跳过不支持格式的图片', {
                src: img.src ? img.src.substring(0, 100) + '...' : '无src',
                reason: '不是支持的格式'
            });
            return false;
        }

        this.setOriginalImageCommon(img);
        return true;
    }

    /**
     * 宽松版本：允许常见位图格式（从LEGACY迁移）
     */
    recordImageAsOriginalFlexible(img) {
        // 如果原图已经被锁定，不允许在同一页面内更改
        if (this.originalImageLocked && this.originalImage) {
            debugLog('原图已在当前页面锁定（宽松模式跳过）');
            return false;
        }

        if (!img || !img.src) {
            debugLog('宽松模式：无有效图片可标记为原图');
            return false;
        }
        
        const url = img.src.toLowerCase();
        const isRaster =
            /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|#|$)/i.test(url) ||
            url.startsWith('data:image/') ||
            url.startsWith('blob:');

        if (!isRaster) {
            debugLog('宽松模式：非位图格式，跳过标记', url.substring(0, 100) + '...');
            return false;
        }

        this.setOriginalImageCommon(img);
        return true;
    }

    /**
     * 设置原图的公共实现（从LEGACY迁移）
     */
    setOriginalImageCommon(img) {
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;

        const imageInfo = {
            element: img,
            url: img.src,
            width: width,
            height: height,
            name: this.extractFileNameFromUrl(img.src),
            source: 'common-record',
            type: this.getImageFormat(img.src)
        };

        // 设置内部状态
        this.originalImage = imageInfo;
        this.originalImageLocked = true;

        // 同步到全局状态
        if (window.stateManager) {
            window.stateManager.setOriginalImage(imageInfo, true);
        } else {
            // 兼容性：直接设置全局变量
            window.originalImage = {
                src: img.src,
                width: width,
                height: height,
                name: imageInfo.name,
                element: img
            };
            window.originalImageLocked = true;
        }

        debugLog('成功记录原图并锁定到当前页面（通用）', {
            src: imageInfo.url.substring(0, 50) + '...',
            width: imageInfo.width,
            height: imageInfo.height,
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            locked: this.originalImageLocked,
            currentPage: this.currentPageUrl.substring(0, 50) + '...'
        });

        console.log('记录原图:', imageInfo.url);
        
        // 显示通知
        if (typeof showNotification === 'function') {
            showNotification(`已锁定原图: ${width}×${height}`, 2000);
        }

        return imageInfo;
    }

    /**
     * 从URL提取文件名
     */
    extractFileNameFromUrl(url) {
        if (!url) return 'unknown';
        
        // 如果全局函数可用，使用它
        if (typeof window.extractFileNameFromUrl === 'function') {
            return window.extractFileNameFromUrl(url);
        }
        
        // 简单的文件名提取逻辑
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename || 'image';
        } catch (e) {
            // 如果URL解析失败，使用简单的字符串分割
            return url.split('/').pop() || 'image';
        }
    }

    /**
     * 检查是否为JPEG格式（LEGACY兼容）
     */
    isJpegImage(url) {
        if (!url) return false;
        
        const lowerUrl = url.toLowerCase();
        
        // 检查文件扩展名
        const hasJpegExt = /\.(jpe?g)(\?|$)/i.test(url);
        
        // 检查URL中是否包含JPEG关键词
        const hasJpegKeyword = lowerUrl.includes('jpeg') || lowerUrl.includes('jpg');
        
        const result = hasJpegExt || hasJpegKeyword;
        
        if (!result) {
            debugLog('非JPEG格式图片', {
                url: url.substring(0, 100) + '...',
                hasJpegExt,
                hasJpegKeyword
            });
        }
        
        return result;
    }

    /**
     * 检查是否为支持的图片格式
     */
    isSupportedImageFormat(url) {
        if (!url) return false;
        const supportedFormats = /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|$)/i;
        return supportedFormats.test(url);
    }

    /**
     * 获取图片格式
     */
    getImageFormat(url) {
        if (!url) return 'unknown';
        const match = url.match(/\.([a-z]+)(\?|$)/i);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    /**
     * 检查是否为COS原图
     */
    isCOSOriginalImage(url) {
        if (!url) return false;
        return /cos\.ap-guangzhou\.myqcloud\.com\/(target|dataset)\/.*\.(jpe?g|png|webp|gif|bmp|tiff)(\?|$)/i.test(url);
    }

    /**
     * 已加载图片快速检测
     */
    getLoadedOriginalImage() {
        const allImages = document.querySelectorAll('img');
        
        for (const img of allImages) {
            if (img.complete && img.naturalWidth > 0 && this.isSupportedImageFormat(img.src)) {
                // 优先返回COS图片
                if (this.isCOSOriginalImage(img.src)) {
                    return {
                        element: img,
                        url: img.src,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        source: 'loaded-cos',
                        type: this.getImageFormat(img.src)
                    };
                }
            }
        }
        
        // 如果没有COS图片，返回第一个支持格式的图片
        for (const img of allImages) {
            if (img.complete && img.naturalWidth > 0 && this.isSupportedImageFormat(img.src)) {
                return {
                    element: img,
                    url: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    source: 'loaded-general',
                    type: this.getImageFormat(img.src)
                };
            }
        }
        
        return null;
    }

    /**
     * 获取当前原图信息
     */
    getOriginalImage() {
        return this.originalImage;
    }

    /**
     * 检查原图是否已锁定
     */
    isOriginalImageLocked() {
        return this.originalImageLocked;
    }

    /**
     * 清除原图状态
     */
    clearOriginalImage() {
        this.unlockOriginalImage();
        debugLog('🗑️ 原图状态已清除');
    }

    /**
     * 初始化DOM监听器
     */
    initializeDOMObserver() {
        if (this.domObserver) {
            this.domObserver.disconnect();
        }

        this.domObserver = new MutationObserver((mutations) => {
            let hasNewImages = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'IMG' || node.querySelector('img')) {
                                hasNewImages = true;
                            }
                        }
                    });
                }
            });

            if (hasNewImages && !this.originalImageLocked) {
                debugLog('🔄 检测到新图片，尝试重新检测原图');
                setTimeout(() => {
                    this.detectOriginalImage();
                }, 500);
            }
        });

        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        debugLog('👁️ DOM监听器已启动');
    }

    /**
     * 检查页面变化
     */
    checkPageChange() {
        const currentUrl = window.location.href;
        if (this.currentPageUrl !== currentUrl) {
            debugLog('🔄 检测到页面变化，重置原图状态');
            this.currentPageUrl = currentUrl;
            this.unlockOriginalImage();
        }
    }

    /**
     * 清除待执行任务
     */
    clearPendingTimeouts() {
        this.pendingTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.pendingTimeouts = [];
    }

    /**
     * 销毁检测器
     */
    destroy() {
        debugLog('🗑️ 销毁 OriginalImageDetector');
        
        // 断开DOM监听
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
        }
        
        // 清除所有待执行任务
        this.clearPendingTimeouts();
        
        // 重置状态
        this.originalImage = null;
        this.originalImageLocked = false;
        this.initialized = false;
        
        debugLog('✅ OriginalImageDetector 已销毁');
    }
}

// 全局实例管理
let originalImageDetectorInstance = null;

/**
 * 获取原图检测器实例
 */
function getOriginalImageDetector() {
    if (!originalImageDetectorInstance) {
        originalImageDetectorInstance = new OriginalImageDetector();
    }
    return originalImageDetectorInstance;
}

/**
 * 初始化原图检测器
 */
function initializeOriginalImageDetector() {
    const detector = getOriginalImageDetector();
    detector.initialize();
    return detector;
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.OriginalImageDetector = OriginalImageDetector;
    window.getOriginalImageDetector = getOriginalImageDetector;
    window.initializeOriginalImageDetector = initializeOriginalImageDetector;
}

debugLog('✅ OriginalImageDetector 模块加载完成');