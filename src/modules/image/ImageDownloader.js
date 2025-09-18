/**
 * 图片下载器
 * 保持原有的图片下载逻辑完全不变
 */
import { FileUtils } from '../utils/FileUtils.js';

export class ImageDownloader {
    constructor(stateManager, notificationManager) {
        this.stateManager = stateManager;
        this.notificationManager = notificationManager;
    }

    /**
     * 下载图片 - 原逻辑保持不变
     */
    async downloadImage(imageUrl, autoOpen = false) {
        if (!imageUrl) {
            this.notificationManager.showError('没有找到图片URL');
            return;
        }

        try {
            // 生成文件名 - 使用原有逻辑
            const fileName = FileUtils.generateFileName(imageUrl);
            
            // 尝试使用fetch下载
            const success = await this.downloadViaFetch(imageUrl, fileName);
            
            if (success) {
                this.notificationManager.showSuccess(`图片已下载: ${fileName}`);
                
                // 如果需要自动打开
                if (autoOpen) {
                    this.openDownloadedImage(imageUrl);
                }
            } else {
                // 如果fetch失败，尝试使用传统方法
                this.downloadViaLink(imageUrl, fileName);
            }
            
        } catch (error) {
            console.error('下载图片失败:', error);
            this.notificationManager.showError('下载图片失败: ' + error.message);
        }
    }

    /**
     * 使用fetch下载图片 - 原逻辑保持不变
     */
    async downloadViaFetch(imageUrl, fileName) {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // 创建下载链接
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            return true;
        } catch (error) {
            console.warn('Fetch下载失败:', error);
            return false;
        }
    }

    /**
     * 使用链接下载图片 - 原逻辑保持不变
     */
    downloadViaLink(imageUrl, fileName) {
        try {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = fileName;
            link.target = '_blank';
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.notificationManager.showSuccess(`图片已下载: ${fileName}`);
        } catch (error) {
            console.error('链接下载失败:', error);
            this.notificationManager.showError('下载失败: ' + error.message);
        }
    }

    /**
     * 打开已下载的图片
     */
    openDownloadedImage(imageUrl) {
        try {
            window.open(imageUrl, '_blank');
        } catch (error) {
            console.warn('打开图片失败:', error);
        }
    }

    /**
     * 批量下载图片
     */
    async downloadMultipleImages(imageUrls, delay = 500) {
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
            this.notificationManager.showError('没有找到要下载的图片');
            return;
        }

        this.notificationManager.showInfo(`开始批量下载 ${imageUrls.length} 张图片`);

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            
            try {
                await this.downloadImage(imageUrl);
                
                // 添加延迟避免过快下载
                if (i < imageUrls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                console.error(`下载第 ${i + 1} 张图片失败:`, error);
            }
        }

        this.notificationManager.showSuccess('批量下载完成');
    }

    /**
     * 下载当前选中的图片
     */
    async downloadSelectedImage() {
        const selectedImage = this.stateManager.get('selectedImage');
        
        if (!selectedImage) {
            this.notificationManager.showWarning('请先选择要下载的图片');
            return;
        }

        const imageUrl = selectedImage.src || selectedImage.href || selectedImage;
        await this.downloadImage(imageUrl);
    }

    /**
     * 下载最后悬停的图片
     */
    async downloadLastHoveredImage() {
        const lastHoveredImage = this.stateManager.get('lastHoveredImage');
        
        if (!lastHoveredImage) {
            this.notificationManager.showWarning('没有找到最近悬停的图片');
            return;
        }

        const imageUrl = lastHoveredImage.src || lastHoveredImage.href || lastHoveredImage;
        await this.downloadImage(imageUrl);
    }

    /**
     * 获取图片信息
     */
    async getImageInfo(imageUrl) {
        try {
            const response = await fetch(imageUrl, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            const contentType = response.headers.get('content-type');
            
            return {
                size: contentLength ? parseInt(contentLength) : null,
                type: contentType,
                url: imageUrl
            };
        } catch (error) {
            console.warn('获取图片信息失败:', error);
            return null;
        }
    }
}