/**
 * 通知管理器
 * 保持原有的通知功能，移除音效功能
 */
import { SETTINGS } from '../../config/constants.js';

export class NotificationManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.activeNotifications = new Set();
    }

    /**
     * 显示通知 - 原逻辑保持不变（移除音效）
     */
    showNotification(message, duration = SETTINGS.NOTIFICATION_DURATION) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        notification.textContent = message;
        
        // 设置样式 - 保持原有样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: '10000',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '300px',
            wordWrap: 'break-word',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease-in-out'
        });

        // 添加到页面
        document.body.appendChild(notification);
        this.activeNotifications.add(notification);

        // 显示动画
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // 自动隐藏
        setTimeout(() => {
            this.hideNotification(notification);
        }, duration);

        return notification;
    }

    /**
     * 隐藏通知
     */
    hideNotification(notification) {
        if (!this.activeNotifications.has(notification)) {
            return;
        }

        // 隐藏动画
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';

        // 移除元素
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.activeNotifications.delete(notification);
        }, 300);
    }

    /**
     * 清除所有通知
     */
    clearAllNotifications() {
        this.activeNotifications.forEach(notification => {
            this.hideNotification(notification);
        });
    }

    /**
     * 显示成功通知
     */
    showSuccess(message, duration) {
        const notification = this.showNotification(message, duration);
        notification.style.backgroundColor = '#4CAF50';
        return notification;
    }

    /**
     * 显示错误通知
     */
    showError(message, duration) {
        const notification = this.showNotification(message, duration);
        notification.style.backgroundColor = '#f44336';
        return notification;
    }

    /**
     * 显示警告通知
     */
    showWarning(message, duration) {
        const notification = this.showNotification(message, duration);
        notification.style.backgroundColor = '#ff9800';
        return notification;
    }

    /**
     * 显示信息通知
     */
    showInfo(message, duration) {
        const notification = this.showNotification(message, duration);
        notification.style.backgroundColor = '#2196F3';
        return notification;
    }
}