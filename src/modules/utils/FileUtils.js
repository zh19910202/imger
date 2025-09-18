/**
 * 文件处理工具类
 * 保持原有的文件处理逻辑完全不变
 */
export class FileUtils {
    /**
     * 生成文件名 - 原逻辑保持不变
     */
    static generateFileName(imageUrl, prefix = '') {
        try {
            // 原 generateFileName 相关逻辑
            const url = new URL(imageUrl);
            const pathname = url.pathname;
            
            // 提取文件名
            let fileName = pathname.split('/').pop() || 'image';
            
            // 如果没有扩展名，根据URL特征判断
            if (!fileName.includes('.')) {
                if (imageUrl.includes('cos.ap-') || imageUrl.includes('.myqcloud.com')) {
                    fileName += '.jpg'; // COS图片默认为jpg
                } else {
                    fileName += '.png'; // 其他情况默认为png
                }
            }
            
            // 添加前缀
            if (prefix) {
                const parts = fileName.split('.');
                const ext = parts.pop();
                const name = parts.join('.');
                fileName = `${prefix}_${name}.${ext}`;
            }
            
            // 添加时间戳避免重名
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const parts = fileName.split('.');
            const ext = parts.pop();
            const name = parts.join('.');
            
            return `${name}_${timestamp}.${ext}`;
            
        } catch (error) {
            console.warn('生成文件名失败，使用默认名称:', error);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            return `${prefix || 'image'}_${timestamp}.jpg`;
        }
    }

    /**
     * 清理文件名，移除非法字符
     */
    static sanitizeFileName(fileName) {
        if (!fileName) return 'untitled';
        
        // 移除或替换非法字符
        return fileName
            .replace(/[<>:"/\\|?*]/g, '_') // 替换非法字符为下划线
            .replace(/\s+/g, '_') // 替换空格为下划线
            .replace(/_{2,}/g, '_') // 合并多个下划线
            .replace(/^_+|_+$/g, ''); // 移除开头和结尾的下划线
    }

    /**
     * 获取文件扩展名
     */
    static getFileExtension(fileName) {
        if (!fileName) return '';
        
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex > 0 ? fileName.slice(lastDotIndex + 1).toLowerCase() : '';
    }

    /**
     * 更改文件扩展名
     */
    static changeFileExtension(fileName, newExt) {
        if (!fileName) return newExt ? `.${newExt}` : '';
        
        const lastDotIndex = fileName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
        
        return newExt ? `${nameWithoutExt}.${newExt}` : nameWithoutExt;
    }

    /**
     * 获取图片尺寸 - 原逻辑保持不变
     */
    static getImageDimensions(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = function() {
                resolve({
                    width: this.naturalWidth,
                    height: this.naturalHeight,
                    aspectRatio: this.naturalWidth / this.naturalHeight
                });
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            // 设置跨域属性，尝试获取图片信息
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
        });
    }

    /**
     * 检查图片格式
     */
    static getImageFormat(imageUrl) {
        try {
            const url = new URL(imageUrl);
            const pathname = url.pathname.toLowerCase();
            
            if (pathname.includes('.jpg') || pathname.includes('.jpeg')) {
                return 'jpeg';
            } else if (pathname.includes('.png')) {
                return 'png';
            } else if (pathname.includes('.gif')) {
                return 'gif';
            } else if (pathname.includes('.webp')) {
                return 'webp';
            } else if (pathname.includes('.svg')) {
                return 'svg';
            } else if (pathname.includes('.bmp')) {
                return 'bmp';
            }
            
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * 检查是否为COS图片URL - 原逻辑保持不变
     */
    static isCOSImage(imageUrl) {
        if (!imageUrl) return false;
        
        try {
            const url = new URL(imageUrl);
            return url.hostname.includes('cos.ap-') || 
                   url.hostname.includes('.myqcloud.com') ||
                   url.hostname.includes('tencentcos.cn');
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查是否为原图格式（JPEG）- 原逻辑保持不变
     */
    static isOriginalImageFormat(imageUrl) {
        const format = FileUtils.getImageFormat(imageUrl);
        return format === 'jpeg' && FileUtils.isCOSImage(imageUrl);
    }

    /**
     * 检查文件是否为图片
     */
    static isImageFile(file) {
        if (!file) return false;
        
        // 检查MIME类型
        if (file.type && file.type.startsWith('image/')) {
            return true;
        }
        
        // 检查文件扩展名
        const fileName = file.name || '';
        const ext = FileUtils.getFileExtension(fileName);
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        
        return imageExtensions.includes(ext);
    }

    /**
     * 文件大小格式化
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 检查文件类型是否被接受
     */
    static isFileTypeAccepted(file, acceptedTypes) {
        if (!acceptedTypes) return true;
        if (!file) return false;
        
        const fileType = file.type;
        const fileName = file.name.toLowerCase();
        
        return acceptedTypes.split(',').some(type => {
            type = type.trim();
            if (type.startsWith('.')) {
                // 扩展名匹配
                return fileName.endsWith(type);
            } else if (type.includes('*')) {
                // MIME类型通配符匹配
                const regex = new RegExp(type.replace('*', '.*'));
                return regex.test(fileType);
            } else {
                // 精确MIME类型匹配
                return fileType === type;
            }
        });
    }

    /**
     * 读取文件为DataURL
     */
    static readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * 读取文件为文本
     */
    static readFileAsText(file, encoding = 'UTF-8') {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file, encoding);
        });
    }

    /**
     * 下载Blob为文件
     */
    static downloadBlob(blob, fileName) {
        if (!blob) {
            throw new Error('No blob provided');
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download';
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * 验证URL是否有效
     */
    static isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 从URL提取域名
     */
    static extractDomainFromURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return '';
        }
    }

    /**
     * 为URL添加时间戳参数
     */
    static addTimestampToURL(url) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('_t', Date.now().toString());
            return urlObj.toString();
        } catch (error) {
            // 如果URL解析失败，直接添加参数
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}_t=${Date.now()}`;
        }
    }

    /**
     * 获取文件的MIME类型
     */
    static getMimeType(fileName) {
        const ext = FileUtils.getFileExtension(fileName);
        
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon',
            'tiff': 'image/tiff',
            'tif': 'image/tiff'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 检查图片尺寸是否为8的倍数 - 原逻辑保持不变
     */
    static isDimensionMultipleOf8(width, height) {
        return width % 8 === 0 && height % 8 === 0;
    }

    /**
     * 格式化图片尺寸信息
     */
    static formatDimensions(width, height) {
        if (!width || !height) return 'Unknown';
        
        const aspectRatio = (width / height).toFixed(2);
        const megapixels = ((width * height) / 1000000).toFixed(1);
        
        return {
            dimensions: `${width}x${height}`,
            aspectRatio: aspectRatio,
            megapixels: `${megapixels}MP`,
            isMultipleOf8: FileUtils.isDimensionMultipleOf8(width, height)
        };
    }

    /**
     * 创建文件下载链接
     */
    static createDownloadLink(url, fileName) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download';
        a.style.display = 'none';
        return a;
    }

    /**
     * 检查文件是否存在（通过HEAD请求）
     */
    static async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取文件信息（大小、类型等）
     */
    static async getFileInfo(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return {
                size: parseInt(response.headers.get('content-length')) || 0,
                type: response.headers.get('content-type') || 'unknown',
                lastModified: response.headers.get('last-modified'),
                exists: true
            };
        } catch (error) {
            return {
                size: 0,
                type: 'unknown',
                lastModified: null,
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * 比较两个文件URL是否相同（忽略查询参数）
     */
    static isSameFile(url1, url2) {
        try {
            const urlObj1 = new URL(url1);
            const urlObj2 = new URL(url2);
            
            return urlObj1.origin === urlObj2.origin && 
                   urlObj1.pathname === urlObj2.pathname;
        } catch (error) {
            return url1 === url2;
        }
    }
}