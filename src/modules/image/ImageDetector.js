/**
 * 图片检测器
 * 保持原有的图片检测和识别逻辑完全不变
 */

window.ImageDetector = class ImageDetector {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.originalImages = new Map();
        this.imageObserver = null;
        
        this.initializeImageObserver();
    }

    /**
     * 记录原图 - 原逻辑保持不变
     */
    recordOriginalImages() {
        try {
            // 查找所有图片元素
            const images = document.querySelectorAll('img');
            
            images.forEach((img, index) => {
                if (img.src && !this.originalImages.has(img.src)) {
                    this.originalImages.set(img.src, {
                        element: img,
                        index: index,
                        timestamp: Date.now(),
                        dimensions: {
                            width: img.naturalWidth || img.width,
                            height: img.naturalHeight || img.height
                        }
                    });
                }
            });

            window.Logger.debugLog('已记录原图数量:', this.originalImages.size);
            this.stateManager.set('originalImagesCount', this.originalImages.size);
            
        } catch (error) {
            window.Logger.debugLog('记录原图失败:', error);
        }
    }

    /**
     * 检测原图 - 原逻辑保持不变
     */
    detectOriginalImage() {
        try {
            const images = document.querySelectorAll('img');
            let detectedImage = null;

            // 检测策略1: 查找最大尺寸的图片
            let maxArea = 0;
            images.forEach(img => {
                if (img.src && img.naturalWidth && img.naturalHeight) {
                    const area = img.naturalWidth * img.naturalHeight;
                    if (area > maxArea) {
                        maxArea = area;
                        detectedImage = img;
                    }
                }
            });

            // 检测策略2: 查找包含特定关键词的图片
            if (!detectedImage) {
                const keywords = ['original', 'source', 'full', 'large', 'high'];
                images.forEach(img => {
                    const src = img.src.toLowerCase();
                    const alt = (img.alt || '').toLowerCase();
                    const className = (img.className || '').toLowerCase();
                    
                    for (const keyword of keywords) {
                        if (src.includes(keyword) || alt.includes(keyword) || className.includes(keyword)) {
                            detectedImage = img;
                            break;
                        }
                    }
                });
            }

            // 检测策略3: 查找非缩略图
            if (!detectedImage) {
                const thumbnailKeywords = ['thumb', 'small', 'mini', 'preview'];
                images.forEach(img => {
                    const src = img.src.toLowerCase();
                    const isThumb = thumbnailKeywords.some(keyword => src.includes(keyword));
                    
                    if (!isThumb && img.naturalWidth > 200 && img.naturalHeight > 200) {
                        detectedImage = img;
                    }
                });
            }

            if (detectedImage) {
                this.stateManager.set('originalImage', detectedImage);
                window.Logger.debugLog('检测到原图:', detectedImage.src);
                return detectedImage;
            } else {
                window.Logger.debugLog('未检测到原图');
                return null;
            }

        } catch (error) {
            window.Logger.debugLog('检测原图失败:', error);
            return null;
        }
    }

    /**
     * 初始化图片观察器
     */
    initializeImageObserver() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.tagName === 'IMG') {
                        this.onImageVisible(entry.target);
                    }
                });
            }, {
                threshold: 0.1
            });

            // 观察现有图片
            document.querySelectorAll('img').forEach(img => {
                this.imageObserver.observe(img);
            });
        }
    }

    /**
     * 图片可见时的处理
     */
    onImageVisible(img) {
        if (!this.originalImages.has(img.src)) {
            this.originalImages.set(img.src, {
                element: img,
                timestamp: Date.now(),
                dimensions: {
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                }
            });
            
            window.Logger.debugLog('新图片可见:', img.src);
        }
    }

    /**
     * 监听新图片加载
     */
    watchForNewImages() {
        // 使用MutationObserver监听DOM变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查新添加的图片
                        if (node.tagName === 'IMG') {
                            this.onNewImageAdded(node);
                        }
                        
                        // 检查新添加元素内的图片
                        const images = node.querySelectorAll && node.querySelectorAll('img');
                        if (images) {
                            images.forEach(img => this.onNewImageAdded(img));
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.mutationObserver = observer;
        window.Logger.debugLog('图片监听器已启动');
    }

    /**
     * 新图片添加时的处理
     */
    onNewImageAdded(img) {
        // 等待图片加载完成
        if (img.complete) {
            this.processNewImage(img);
        } else {
            img.onload = () => this.processNewImage(img);
            img.onerror = () => window.Logger.debugLog('图片加载失败:', img.src);
        }

        // 添加到观察器
        if (this.imageObserver) {
            this.imageObserver.observe(img);
        }
    }

    /**
     * 处理新图片
     */
    processNewImage(img) {
        if (img.src && !this.originalImages.has(img.src)) {
            this.originalImages.set(img.src, {
                element: img,
                timestamp: Date.now(),
                dimensions: {
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                },
                isNew: true
            });

            window.Logger.debugLog('处理新图片:', img.src);
            
            // 触发新图片事件
            this.stateManager.set('lastNewImage', img);
        }
    }

    /**
     * 获取所有检测到的图片
     */
    getAllDetectedImages() {
        return Array.from(this.originalImages.values());
    }

    /**
     * 根据条件筛选图片
     */
    filterImages(criteria) {
        const images = this.getAllDetectedImages();
        
        return images.filter(imageData => {
            const { element, dimensions } = imageData;
            
            // 尺寸筛选
            if (criteria.minWidth && dimensions.width < criteria.minWidth) return false;
            if (criteria.minHeight && dimensions.height < criteria.minHeight) return false;
            if (criteria.maxWidth && dimensions.width > criteria.maxWidth) return false;
            if (criteria.maxHeight && dimensions.height > criteria.maxHeight) return false;
            
            // URL筛选
            if (criteria.urlContains && !element.src.includes(criteria.urlContains)) return false;
            if (criteria.urlExcludes && element.src.includes(criteria.urlExcludes)) return false;
            
            // 文件类型筛选
            if (criteria.fileTypes) {
                const extension = element.src.split('.').pop().toLowerCase();
                if (!criteria.fileTypes.includes(extension)) return false;
            }
            
            return true;
        });
    }

    /**
     * 获取最大的图片
     */
    getLargestImage() {
        const images = this.getAllDetectedImages();
        let largest = null;
        let maxArea = 0;

        images.forEach(imageData => {
            const area = imageData.dimensions.width * imageData.dimensions.height;
            if (area > maxArea) {
                maxArea = area;
                largest = imageData;
            }
        });

        return largest;
    }

    /**
     * 清理检测器
     */
    cleanup() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        this.originalImages.clear();
        window.Logger.debugLog('图片检测器已清理');
    }

    /**
     * 获取检测统计信息
     */
    getDetectionStats() {
        const images = this.getAllDetectedImages();
        const totalImages = images.length;
        const newImages = images.filter(img => img.isNew).length;
        const avgWidth = images.reduce((sum, img) => sum + img.dimensions.width, 0) / totalImages;
        const avgHeight = images.reduce((sum, img) => sum + img.dimensions.height, 0) / totalImages;

        return {
            totalImages,
            newImages,
            avgWidth: Math.round(avgWidth),
            avgHeight: Math.round(avgHeight),
            largestImage: this.getLargestImage()
        };
    }
}