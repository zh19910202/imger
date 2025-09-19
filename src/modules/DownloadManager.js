/**
 * 下载管理器模块
 * 负责图片下载相关的所有功能，包括文件名生成、下载效果、多种下载方案等
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    // 如果 debugLog 不可用，使用 console.log 作为备选
    window.debugLog = function(message, data) {
        console.log('[DownloadManager]', message, data || '');
    };
}

class DownloadManager {
    constructor() {
        this.initialized = false;
        this.fileNameUtils = new FileNameUtils();
        this.downloadMethods = new DownloadMethods();
        this.visualEffects = new VisualEffects();
    }

    isInitialized() {
        return this.initialized;
    }

    getFileNameUtils() {
        return this.fileNameUtils;
    }

    getDownloadMethods() {
        return this.downloadMethods;
    }

    getVisualEffects() {
        return this.visualEffects;
    }

    initialize() {
        try {
            debugLog('初始化 DownloadManager');
            this.initialized = true;
            debugLog('DownloadManager 初始化完成');
        } catch (error) {
            debugLog('DownloadManager 初始化失败:', error);
            throw error;
        }
    }

    // 主要下载功能：通过图片元素下载
    downloadImage(img) {
        try {
            // 获取图片URL
            let imageUrl = img.src;

            // 检查URL是否有效
            if (!imageUrl || imageUrl === '') {
                console.error('图片URL无效:', imageUrl);
                if (typeof showNotification === 'function') {
                    showNotification('图片URL无效，无法下载');
                }
                return;
            }

            // 转换相对URL为绝对URL
            if (imageUrl.startsWith('//')) {
                imageUrl = window.location.protocol + imageUrl;
            } else if (imageUrl.startsWith('/')) {
                imageUrl = window.location.origin + imageUrl;
            }

            console.log('准备下载图片:', imageUrl);
            console.log('当前Chrome对象状态:', {
                chrome: typeof chrome,
                runtime: typeof chrome?.runtime,
                sendMessage: typeof chrome?.runtime?.sendMessage,
                extensionId: chrome?.runtime?.id
            });

            // 检查Chrome扩展API是否可用
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                console.error('Chrome扩展API不可用');
                console.error('详细信息:', {
                    chrome: chrome,
                    runtime: chrome?.runtime,
                    sendMessage: chrome?.runtime?.sendMessage
                });
                if (typeof showNotification === 'function') {
                    showNotification('下载失败：Chrome扩展API不可用');
                }
                return;
            }

            // 发送消息到background script
            try {
                // 使用安全的调用方式
                const chromeRuntime = chrome && chrome.runtime;
                if (!chromeRuntime || !chromeRuntime.sendMessage) {
                    throw new Error('Chrome runtime API不可用');
                }

                chromeRuntime.sendMessage({
                    action: 'downloadImage',
                    imageUrl: imageUrl,
                    pageUrl: window.location.href
                }, (response) => {
                    if (chromeRuntime.lastError) {
                        console.error('发送消息失败:', chromeRuntime.lastError);
                        if (typeof showNotification === 'function') {
                            showNotification('下载失败：无法连接到扩展后台');
                        }
                    } else if (response && response.success) {
                        console.log('下载请求已发送');
                        if (typeof showNotification === 'function') {
                            showNotification('开始下载图片...');
                        }
                        // 添加下载效果
                        this.visualEffects.addDownloadEffect(img);
                        // 记录图片为原图
                        if (typeof recordImageAsOriginalFlexible === 'function') {
                            try {
                                recordImageAsOriginalFlexible(img);
                            } catch (recordError) {
                                debugLog('记录原图失败:', recordError);
                            }
                        }
                    } else {
                        console.error('下载请求被拒绝:', response);
                        if (typeof showNotification === 'function') {
                            showNotification('下载失败：请求被拒绝');
                        }
                    }
                });
            } catch (error) {
                console.error('发送下载请求时出错:', error);
                if (typeof showNotification === 'function') {
                    showNotification('下载失败：' + error.message);
                }
            }
        } catch (error) {
            console.error('下载图片失败:', error);
            if (typeof showNotification === 'function') {
                showNotification('下载失败：' + error.message);
            }
        }
    }

    // 高级下载功能：支持自定义文件名和自动打开
    downloadImageToLocal(imageUrl, fileType, index, customFileName = null, autoOpen = true) {
        try {
            debugLog('开始下载图片到本地', {
                imageUrl: imageUrl.substring(0, 50) + '...',
                fileType,
                index,
                autoOpen
            });

            // 生成智能文件名
            const fileName = customFileName || this.fileNameUtils.generateResultImageFileName(
                window.originalImage, fileType, index, '副本'
            );

            debugLog('生成的文件名', fileName);

            // 检查Chrome扩展API
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                debugLog('Chrome扩展API不可用，使用fetch下载方案');
                this.downloadMethods.downloadViaFetch(imageUrl, fileName);
                return;
            }

            // 使用Chrome扩展的下载API - 支持自动打开控制
            debugLog('使用Chrome扩展下载API', { autoOpen });

            chrome.runtime.sendMessage({
                action: 'downloadImage',
                imageUrl: imageUrl,
                filename: fileName,
                pageUrl: window.location.href,
                autoOpen: autoOpen // 传递自动打开参数
            }, (response) => {
                if (chrome.runtime.lastError) {
                    debugLog('Chrome下载失败，尝试备用方案:', chrome.runtime.lastError);
                    // 如果Chrome下载失败，尝试fetch下载
                    this.downloadMethods.downloadViaFetch(imageUrl, fileName);
                } else if (response && response.success) {
                    debugLog('Chrome下载请求发送成功:', response);
                    const openText = autoOpen ? '（将自动打开）' : '';
                    if (typeof showNotification === 'function') {
                        showNotification(`✅ 开始下载: ${fileName}${openText}`, 3000);
                    }
                } else {
                    debugLog('Chrome下载被拒绝，尝试备用方案:', response);
                    this.downloadMethods.downloadViaFetch(imageUrl, fileName);
                }
            });

        } catch (error) {
            debugLog('下载图片失败:', error);
            if (typeof showNotification === 'function') {
                showNotification('下载失败：' + error.message, 3000);
            }
        }
    }
}

// 文件名工具类
class FileNameUtils {
    // 从URL中提取文件名
    extractFileNameFromUrl(url) {
        if (!url) return '未知';

        try {
            // 移除查询参数和锚点
            let cleanUrl = url.split('?')[0].split('#')[0];

            // 提取文件名部分
            let fileName = cleanUrl.split('/').pop();

            // 如果文件名为空或只是扩展名，返回默认名称
            if (!fileName || fileName === '' || fileName.startsWith('.')) {
                return '未知';
            }

            // URL解码
            try {
                fileName = decodeURIComponent(fileName);
            } catch (e) {
                // 解码失败，使用原始文件名
            }

            // 移除文件扩展名，只返回基本名称
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                fileName = fileName.substring(0, lastDotIndex);
            }

            // 清理文件名，移除特殊字符
            fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();

            // 如果清理后为空，返回默认名称
            if (!fileName || fileName.length < 1) {
                return '未知';
            }

            // 限制长度
            if (fileName.length > 50) {
                fileName = fileName.substring(0, 50);
            }

            return fileName;
        } catch (error) {
            debugLog('提取文件名失败:', error);
            return '未知';
        }
    }

    // 生成RunningHub结果图的智能文件名
    generateResultImageFileName(originalImageInfo, fileType, index = 0, suffix = '副本') {
        try {
            let baseName = 'runninghub-result';

            // 尝试从原图获取文件名
            if (originalImageInfo && originalImageInfo.src) {
                const originalFileName = this.extractFileNameFromUrl(originalImageInfo.src);
                if (originalFileName && originalFileName !== '未知' && originalFileName !== '原图') {
                    // 移除原始扩展名
                    baseName = originalFileName.replace(/\.[^/.]+$/, '');
                    debugLog('从原图提取文件名', { originalFileName, baseName });
                }
            }

            // 如果baseName仍是默认值，尝试其他方式
            if (baseName === 'runninghub-result') {
                if (originalImageInfo && originalImageInfo.name) {
                    baseName = originalImageInfo.name.replace(/\.[^/.]+$/, '');
                } else if (originalImageInfo && originalImageInfo.element && originalImageInfo.element.alt) {
                    baseName = originalImageInfo.element.alt.replace(/\.[^/.]+$/, '') || 'image';
                }
            }

            // 清理文件名，移除特殊字符
            baseName = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();

            // 确保文件名不为空
            if (!baseName || baseName.length < 1) {
                baseName = 'image';
            }

            // 生成最终文件名
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const extension = fileType || 'png';

            let finalName;
            if (index > 0) {
                finalName = `${baseName}_${suffix}_${index + 1}_${timestamp}.${extension}`;
            } else {
                finalName = `${baseName}_${suffix}_${timestamp}.${extension}`;
            }

            debugLog('生成结果图文件名', {
                originalSrc: originalImageInfo?.src?.substring(0, 50) + '...',
                baseName,
                suffix,
                index,
                timestamp,
                extension,
                finalName
            });

            return finalName;

        } catch (error) {
            debugLog('生成文件名失败:', error);
            // 返回安全的默认文件名
            const timestamp = new Date().toISOString().split('T')[0];
            const extension = fileType || 'png';
            return `image_${suffix}_${timestamp}.${extension}`;
        }
    }
}

// 下载方法类
class DownloadMethods {
    // 通过fetch下载图片 - 备用方案
    async downloadViaFetch(imageUrl, fileName) {
        try {
            debugLog('使用fetch下载方案', { imageUrl: imageUrl.substring(0, 50) + '...', fileName });

            if (typeof showNotification === 'function') {
                showNotification('正在获取图片数据...', 2000);
            }

            // 获取图片数据
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            debugLog('图片数据获取成功', { size: blob.size, type: blob.type });

            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';

            // 添加到DOM并触发下载
            document.body.appendChild(link);
            link.click();

            // 清理
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            debugLog('fetch下载完成', { fileName });
            if (typeof showNotification === 'function') {
                showNotification(`✅ 下载完成: ${fileName}`, 3000);
            }

        } catch (error) {
            debugLog('fetch下载失败:', error);
            if (typeof showNotification === 'function') {
                showNotification('下载失败：' + error.message, 3000);
            }
        }
    }
}

// 视觉效果类
class VisualEffects {
    // 添加下载视觉效果
    addDownloadEffect(img) {
        try {
            // 创建下载动画效果
            const originalTransform = img.style.transform;
            img.style.transition = 'transform 0.3s ease';
            img.style.transform = 'scale(0.95)';

            setTimeout(() => {
                img.style.transform = originalTransform || '';
                setTimeout(() => {
                    img.style.transition = '';
                }, 300);
            }, 150);
        } catch (error) {
            debugLog('添加下载效果失败:', error);
        }
    }
}

// 全局实例
let downloadManagerInstance = null;

// 获取全局实例
function getDownloadManager() {
    if (!downloadManagerInstance) {
        downloadManagerInstance = new DownloadManager();
        downloadManagerInstance.initialize();
        // 设置到全局变量以保持兼容性
        window.downloadManager = downloadManagerInstance;
    }
    return downloadManagerInstance;
}

// 兼容性函数 - 保持向后兼容
function downloadImage(img) {
    const manager = getDownloadManager();
    return manager.downloadImage(img);
}

function downloadImageToLocal(imageUrl, fileType, index, customFileName = null, autoOpen = true) {
    const manager = getDownloadManager();
    return manager.downloadImageToLocal(imageUrl, fileType, index, customFileName, autoOpen);
}

async function downloadViaFetch(imageUrl, fileName) {
    const manager = getDownloadManager();
    return await manager.getDownloadMethods().downloadViaFetch(imageUrl, fileName);
}

function generateResultImageFileName(originalImageInfo, fileType, index = 0, suffix = '副本') {
    const manager = getDownloadManager();
    return manager.getFileNameUtils().generateResultImageFileName(originalImageInfo, fileType, index, suffix);
}

function extractFileNameFromUrl(url) {
    const manager = getDownloadManager();
    return manager.getFileNameUtils().extractFileNameFromUrl(url);
}

function addDownloadEffect(img) {
    const manager = getDownloadManager();
    return manager.getVisualEffects().addDownloadEffect(img);
}

// 初始化函数
function initializeDownloadManager() {
    try {
        const manager = getDownloadManager();
        debugLog('DownloadManager 全局初始化完成');
        return manager;
    } catch (error) {
        debugLog('DownloadManager 全局初始化失败:', error);
        throw error;
    }
}

// 导出到全局作用域
window.DownloadManager = DownloadManager;
window.getDownloadManager = getDownloadManager;
window.initializeDownloadManager = initializeDownloadManager;

// 兼容性函数导出
window.downloadImage = downloadImage;
window.downloadImageToLocal = downloadImageToLocal;
window.downloadViaFetch = downloadViaFetch;
window.generateResultImageFileName = generateResultImageFileName;
window.extractFileNameFromUrl = extractFileNameFromUrl;
window.addDownloadEffect = addDownloadEffect;

debugLog('DownloadManager 模块加载完成');