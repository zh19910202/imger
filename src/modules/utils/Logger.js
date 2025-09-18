/**
 * 调试日志工具类
 * 保持原有的调试功能完全不变
 */
window.Logger = class Logger {
    static debugMode = false;
    static debugLogs = [];
    static debugPanel = null;

    /**
     * 调试日志记录 - 原 debugLog 函数逻辑
     */
    static debugLog(message, data = null) {
        if (!Logger.debugMode) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        Logger.debugLogs.push(logEntry);
        console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
        
        // 更新调试面板显示
        Logger.updateDebugPanel();
        
        // 限制日志数量，避免内存泄漏
        if (Logger.debugLogs.length > 1000) {
            Logger.debugLogs = Logger.debugLogs.slice(-500);
        }
    }

    /**
     * 信息日志记录
     */
    static info(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[INFO ${timestamp}] ${message}`, data || '');
        
        if (Logger.debugMode) {
            Logger.debugLog(`[INFO] ${message}`, data);
        }
    }

    /**
     * 警告日志记录
     */
    static warn(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        console.warn(`[WARN ${timestamp}] ${message}`, data || '');
        
        if (Logger.debugMode) {
            Logger.debugLog(`[WARN] ${message}`, data);
        }
    }

    /**
     * 错误日志记录
     */
    static error(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[ERROR ${timestamp}] ${message}`, data || '');
        
        if (Logger.debugMode) {
            Logger.debugLog(`[ERROR] ${message}`, data);
        }
    }

    /**
     * 切换调试模式 - 原 toggleDebugMode 函数逻辑
     */
    static toggleDebugMode() {
        Logger.debugMode = !Logger.debugMode;
        
        if (Logger.debugMode) {
            if (!Logger.debugPanel) {
                Logger.initializeDebugPanel();
            } else {
                Logger.debugPanel.style.display = 'block';
            }
            Logger.debugLog('调试模式已开启');
            // 这里需要通过事件系统通知UI显示通知
            Logger.notifyModeChange('调试模式已开启 (Z键切换)', 2000);
        } else {
            if (Logger.debugPanel) {
                Logger.debugPanel.style.display = 'none';
            }
            console.log('调试模式已关闭');
            Logger.notifyModeChange('调试模式已关闭 (Z键切换)', 2000);
        }
    }

    /**
     * 设置调试模式
     */
    static setDebugMode(enabled) {
        if (Logger.debugMode === enabled) return;
        Logger.toggleDebugMode();
    }

    /**
     * 初始化调试面板 - 原逻辑保持不变
     */
    static initializeDebugPanel() {
        // 如果面板已存在，先移除
        if (Logger.debugPanel) {
            Logger.debugPanel.remove();
        }

        // 创建调试面板
        Logger.debugPanel = document.createElement('div');
        Logger.debugPanel.className = 'debug-panel';
        Logger.debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            width: 400px;
            height: 500px;
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            border: 1px solid #333;
            border-radius: 8px;
            z-index: 9999;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #555;
        `;
        titleBar.innerHTML = `
            <span style="font-weight: bold;">🐛 调试面板</span>
            <div>
                <button id="debug-clear-logs" style="background: #444; color: white; border: none; padding: 2px 6px; margin-right: 5px; border-radius: 3px; cursor: pointer;">清空</button>
                <button id="debug-export-logs" style="background: #444; color: white; border: none; padding: 2px 6px; margin-right: 5px; border-radius: 3px; cursor: pointer;">导出</button>
                <button id="debug-close" style="background: #d32f2f; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">×</button>
            </div>
        `;

        // 创建信息区域
        const infoArea = document.createElement('div');
        infoArea.className = 'debug-info';
        infoArea.style.cssText = `
            margin-bottom: 10px;
            padding: 5px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            font-size: 11px;
            max-height: 120px;
            overflow-y: auto;
        `;

        // 创建日志区域
        const logArea = document.createElement('div');
        logArea.className = 'debug-logs';
        logArea.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            padding: 5px;
            font-size: 10px;
            line-height: 1.3;
        `;

        // 组装面板
        Logger.debugPanel.appendChild(titleBar);
        Logger.debugPanel.appendChild(infoArea);
        Logger.debugPanel.appendChild(logArea);

        // 添加事件监听器
        titleBar.querySelector('#debug-clear-logs').addEventListener('click', () => {
            Logger.clearLogs();
        });

        titleBar.querySelector('#debug-export-logs').addEventListener('click', () => {
            Logger.exportLogs();
        });

        titleBar.querySelector('#debug-close').addEventListener('click', () => {
            Logger.debugPanel.style.display = 'none';
            Logger.debugMode = false;
        });

        // 添加到页面
        document.body.appendChild(Logger.debugPanel);

        // 初始更新
        Logger.updateDebugPanel();
    }

    /**
     * 更新调试面板显示
     */
    static updateDebugPanel() {
        if (!Logger.debugPanel || !Logger.debugMode) return;
        
        const logArea = Logger.debugPanel.querySelector('.debug-logs');
        const infoArea = Logger.debugPanel.querySelector('.debug-info');
        
        if (logArea) {
            const recentLogs = Logger.debugLogs.slice(-50); // 显示最近50条
            logArea.innerHTML = recentLogs.map(log => 
                `<div class="debug-log-entry" style="margin-bottom: 3px; padding: 2px; border-left: 2px solid #4caf50;">
                    <span style="color: #888;">[${log.timestamp}]</span>
                    <span style="color: #fff;">${log.message}</span>
                    ${log.data ? `<pre style="margin: 2px 0; padding: 2px; background: rgba(255,255,255,0.1); font-size: 9px; white-space: pre-wrap;">${log.data}</pre>` : ''}
                </div>`
            ).join('');
            
            // 自动滚动到底部
            logArea.scrollTop = logArea.scrollHeight;
        }

        if (infoArea) {
            Logger.updateInfoArea(infoArea);
        }
    }

    /**
     * 更新信息区域显示
     */
    static updateInfoArea(infoArea) {
        let infoHtml = '<div style="font-weight: bold; margin-bottom: 5px;">📊 系统状态</div>';
        
        // 基本信息
        infoHtml += `<div>日志数量: ${Logger.debugLogs.length}</div>`;
        infoHtml += `<div>调试模式: <span style="color: #4caf50;">开启</span></div>`;
        infoHtml += `<div>页面URL: ${window.location.href.substring(0, 50)}...</div>`;
        
        infoArea.innerHTML = infoHtml;
    }

    /**
     * 通知模式变化 - 需要与NotificationManager集成
     */
    static notifyModeChange(message, duration) {
        // 这里需要通过事件系统或依赖注入来调用NotificationManager
        // 暂时使用全局函数，后续会被替换
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, duration);
        } else {
            // 临时通知方案
            Logger.showTempNotification(message, duration);
        }
    }

    /**
     * 临时通知显示方案
     */
    static showTempNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #333;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    /**
     * 清空调试日志
     */
    static clearLogs() {
        Logger.debugLogs = [];
        Logger.updateDebugPanel();
        Logger.debugLog('调试日志已清空');
    }

    /**
     * 导出调试日志
     */
    static exportLogs() {
        const logsText = Logger.debugLogs.map(log => 
            `[${log.timestamp}] ${log.message}${log.data ? '\n' + log.data : ''}`
        ).join('\n\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        Logger.debugLog('调试日志已导出');
    }

    /**
     * 获取日志
     */
    static getLogs(filter = null) {
        if (!filter) return [...Logger.debugLogs];
        
        return Logger.debugLogs.filter(log => {
            if (typeof filter === 'string') {
                return log.message.includes(filter);
            } else if (typeof filter === 'function') {
                return filter(log);
            }
            return true;
        });
    }

    /**
     * 销毁调试面板
     */
    static destroy() {
        if (Logger.debugPanel) {
            Logger.debugPanel.remove();
            Logger.debugPanel = null;
        }
        Logger.debugLogs = [];
        Logger.debugMode = false;
    }
}