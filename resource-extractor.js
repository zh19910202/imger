// 资源提取器 - 多种技术路线获取图片资源
// 可以在content.js中调用或作为独立模块

class ResourceExtractor {
    constructor() {
        this.capturedResources = new Map();
        this.observers = [];
    }

    // 路线1: DOM元素读取 - 获取页面中已加载的图片（仅显示用）
    async extractFromDOM() {
        const images = [];
        const imgElements = document.querySelectorAll('img');
        
        for (const img of imgElements) {
            try {
                // 检查图片是否完全加载
                if (img.complete && img.naturalHeight !== 0) {
                    // 检查是否是COS图片
                    const isCOSImage = img.src.includes('aidata-1258344706.cos.ap-guangzhou.myqcloud.com');
                    
                    // 如果只需要显示，直接使用图片URL，无需转换blob
                    images.push({
                        src: img.src,
                        blob: null, // 显示用途不需要blob
                        size: 0,    // 显示用途不需要精确大小
                        dimensions: {
                            width: img.naturalWidth,
                            height: img.naturalHeight
                        },
                        element: img,
                        method: isCOSImage ? 'DOM (COS显示)' : 'DOM',
                        displayReady: true, // 标记为可直接显示
                        isCOSImage: isCOSImage
                    });
                }
            } catch (error) {
                console.warn('提取图片信息失败:', img.src, error);
            }
        }
        
        console.log(`🖼️ DOM提取完成，获取${images.length}张图片 (显示用)`);
        return images;
    }

    // 路线2: Performance API - 获取网络请求历史（仅显示用）
    async extractFromPerformance() {
        const resources = [];
        const entries = performance.getEntriesByType('resource');
        
        const imageEntries = entries.filter(entry => {
            return entry.initiatorType === 'img' || 
                   entry.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i);
        });

        // 显示用途：只需要URL信息，无需重新fetch
        const processedUrls = new Set();

        for (const entry of imageEntries) {
            if (processedUrls.has(entry.name)) {
                continue;
            }
            processedUrls.add(entry.name);

            const isCOSImage = entry.name.includes('aidata-1258344706.cos.ap-guangzhou.myqcloud.com');
            
            resources.push({
                src: entry.name,
                blob: null,           // 显示用途不需要blob
                size: entry.transferSize || 0,
                loadTime: entry.duration,
                transferSize: entry.transferSize,
                method: isCOSImage ? 'Performance API (COS显示)' : 'Performance API',
                displayReady: true,   // 标记为可直接显示
                isCOSImage: isCOSImage
            });
        }
        
        console.log(`📊 Performance API提取完成，获取${resources.length}个资源 (显示用)`);
        return resources;
    }

    // 通过background script代理获取COS图片
    async fetchCOSImageViaProxy(imageUrl) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                reject(new Error('Chrome runtime不可用'));
                return;
            }
            
            // 添加超时保护，防止无限等待
            const timeoutId = setTimeout(() => {
                reject(new Error('代理获取超时'));
            }, 10000);
            
            chrome.runtime.sendMessage({
                action: 'fetchCOSImage',
                url: imageUrl
            }, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    try {
                        // 将base64转换为blob
                        const byteCharacters = atob(response.data.base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: response.data.type });
                        
                        resolve({
                            blob: blob,
                            size: response.data.size,
                            type: response.data.type,
                            dataUrl: response.data.dataUrl
                        });
                    } catch (parseError) {
                        reject(new Error('Base64解析失败: ' + parseError.message));
                    }
                } else {
                    reject(new Error(response?.error || '代理获取失败'));
                }
            });
        });
    }

    // 路线3: Cache API - 从浏览器缓存获取
    async extractFromCache() {
        const cachedImages = [];
        
        try {
            const cacheNames = await caches.keys();
            
            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();
                
                for (const request of requests) {
                    if (request.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)) {
                        try {
                            const response = await cache.match(request);
                            if (response) {
                                const blob = await response.clone().blob();
                                cachedImages.push({
                                    src: request.url,
                                    blob: blob,
                                    size: blob.size,
                                    cacheName: cacheName,
                                    method: 'Cache API'
                                });
                            }
                        } catch (error) {
                            console.warn('缓存读取失败:', request.url, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Cache API不可用:', error);
        }
        
        console.log(`💾 缓存提取完成，获取${cachedImages.length}张图片`);
        return cachedImages;
    }

    // 路线4: 监听新的网络请求（需要与background.js配合）
    startNetworkMonitoring() {
        // 监听来自background.js的网络请求数据
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'NETWORK_IMAGE_DETECTED') {
                    console.log('🌐 监听到新的图片请求:', message.data);
                    this.capturedResources.set(message.data.url, message.data);
                    
                    // 触发自定义事件
                    this.notifyObservers('networkImage', message.data);
                }
            });
        }
    }

    // 路线5: 实时监听DOM变化中的新图片
    startDOMMonitoring() {
        const observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const addedImages = [];
                    
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // 检查是否是img元素
                            if (node.tagName === 'IMG') {
                                addedImages.push(node);
                            }
                            // 检查子元素中的img
                            const imgs = node.querySelectorAll && node.querySelectorAll('img');
                            if (imgs) {
                                addedImages.push(...imgs);
                            }
                        }
                    });

                    // 处理新添加的图片
                    for (const img of addedImages) {
                        img.addEventListener('load', async () => {
                            try {
                                const imageData = await this.convertImageToBlob(img);
                                const data = {
                                    src: img.src,
                                    blob: imageData.blob,
                                    size: imageData.size,
                                    dimensions: {
                                        width: img.naturalWidth,
                                        height: img.naturalHeight
                                    },
                                    element: img,
                                    method: 'DOM监听'
                                };
                                
                                console.log('🔄 监听到新图片加载:', img.src);
                                this.notifyObservers('domImage', data);
                            } catch (error) {
                                console.warn('处理新图片失败:', error);
                            }
                        });
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observers.push(observer);
        console.log('👀 DOM监听已启动');
    }

    // 工具方法：将img元素转换为blob
    async convertImageToBlob(imgElement) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            
            try {
                ctx.drawImage(imgElement, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve({
                            blob: blob,
                            size: blob.size,
                            dataURL: canvas.toDataURL()
                        });
                    } else {
                        reject(new Error('转换blob失败'));
                    }
                }, 'image/png');
            } catch (error) {
                reject(error);
            }
        });
    }

    // 综合提取方法 - 使用所有可用技术
    async extractAllResources() {
        console.log('🚀 开始综合资源提取...');
        
        const results = {
            dom: [],
            performance: [],
            cache: [],
            network: Array.from(this.capturedResources.values()),
            summary: {}
        };

        // 并行执行多种提取方法，添加更好的错误处理
        const extractionPromises = [
            this.extractFromDOM().catch(error => {
                console.warn('DOM提取失败:', error);
                return [];
            }),
            this.extractFromPerformance().catch(error => {
                console.warn('Performance API提取失败:', error);
                return [];
            }),
            this.extractFromCache().catch(error => {
                console.warn('Cache API提取失败:', error);
                return [];
            })
        ];

        try {
            const [domResults, perfResults, cacheResults] = await Promise.allSettled(extractionPromises);

            if (domResults.status === 'fulfilled') {
                results.dom = domResults.value || [];
            } else {
                console.warn('DOM提取Promise失败:', domResults.reason);
                results.dom = [];
            }
            
            if (perfResults.status === 'fulfilled') {
                results.performance = perfResults.value || [];
            } else {
                console.warn('Performance提取Promise失败:', perfResults.reason);
                results.performance = [];
            }
            
            if (cacheResults.status === 'fulfilled') {
                results.cache = cacheResults.value || [];
            } else {
                console.warn('Cache提取Promise失败:', cacheResults.reason);
                results.cache = [];
            }

            // 生成汇总信息
            const allResources = [
                ...results.dom,
                ...results.performance,
                ...results.cache,
                ...results.network
            ].filter(resource => resource && resource.src); // 过滤无效资源

            const uniqueUrls = new Set(allResources.map(r => r.src));
            results.summary = {
                totalMethods: 4,
                totalResources: allResources.length,
                uniqueResources: uniqueUrls.size,
                byMethod: {
                    DOM: results.dom.length,
                    Performance: results.performance.length,
                    Cache: results.cache.length,
                    Network: results.network.length
                },
                errors: {
                    dom: results.dom.filter(r => r.error).length,
                    performance: results.performance.filter(r => r.error).length,
                    cache: results.cache.filter(r => r.error).length
                }
            };

            console.log('✅ 综合提取完成:', results.summary);
            return results;

        } catch (error) {
            console.error('综合提取发生意外错误:', error);
            
            // 即使出错也返回部分结果
            results.summary = {
                totalMethods: 4,
                totalResources: results.network.length,
                uniqueResources: new Set(results.network.map(r => r.src)).size,
                byMethod: {
                    DOM: 0,
                    Performance: 0,
                    Cache: 0,
                    Network: results.network.length
                },
                error: error.message
            };
            
            return results;
        }
    }

    // 观察者模式 - 注册回调
    addObserver(callback) {
        this.observers.push(callback);
    }

    // 通知观察者
    notifyObservers(type, data) {
        this.observers.forEach(observer => {
            if (typeof observer === 'function') {
                try {
                    observer(type, data);
                } catch (error) {
                    console.warn('观察者回调失败:', error);
                }
            }
        });
    }

    // 清理资源
    cleanup() {
        this.observers.forEach(observer => {
            if (observer && observer.disconnect) {
                observer.disconnect();
            }
        });
        this.observers = [];
        this.capturedResources.clear();
    }
}

// 使用示例
const resourceExtractor = new ResourceExtractor();

// 启动监听
resourceExtractor.startNetworkMonitoring();
resourceExtractor.startDOMMonitoring();

// 注册回调处理新资源
resourceExtractor.addObserver((type, data) => {
    console.log(`📨 收到新资源 [${type}]:`, data.src);
    
    // 这里可以添加你的处理逻辑，比如：
    // - 保存到本地存储
    // - 发送到服务器
    // - 触发下载
    // - 更新UI等
});

// 导出供其他脚本使用
if (typeof window !== 'undefined') {
    window.ResourceExtractor = ResourceExtractor;
    window.resourceExtractor = resourceExtractor;
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    resourceExtractor.cleanup();
});