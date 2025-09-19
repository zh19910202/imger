/**
 * 调试日志工具模块
 * 提供统一的日志记录功能，支持不同级别的日志输出
 */

class Logger {
    static isDebugMode = true; // 可以通过配置控制

    /**
     * 调试日志 - 对应原来的 debugLog 函数
     * @param {...any} args - 日志参数
     */
    static debug(...args) {
        if (!this.isDebugMode) return;

        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[AUXIS DEBUG ${timestamp}]`;

        if (args.length === 1 && typeof args[0] === 'string') {
            console.log(`${prefix} ${args[0]}`);
        } else if (args.length === 2) {
            console.log(`${prefix} ${args[0]}`, args[1]);
        } else {
            console.log(prefix, ...args);
        }
    }

    /**
     * 信息日志
     * @param {...any} args - 日志参数
     */
    static info(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[AUXIS INFO ${timestamp}]`, ...args);
    }

    /**
     * 警告日志
     * @param {...any} args - 日志参数
     */
    static warn(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.warn(`[AUXIS WARN ${timestamp}]`, ...args);
    }

    /**
     * 错误日志
     * @param {...any} args - 日志参数
     */
    static error(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[AUXIS ERROR ${timestamp}]`, ...args);
    }

    /**
     * 设置调试模式
     * @param {boolean} enabled - 是否启用调试模式
     */
    static setDebugMode(enabled) {
        this.isDebugMode = enabled;
        this.info('Debug mode', enabled ? 'enabled' : 'disabled');
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
} else {
    window.AuxisLogger = Logger;
}