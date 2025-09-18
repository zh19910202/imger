/**
 * 应用常量定义
 * 将原有的硬编码值提取为常量
 */

// 键盘快捷键定义
export const KEYBOARD_SHORTCUTS = {
    DOWNLOAD_IMAGE: 'd',
    SKIP_BUTTON: ' ',
    SUBMIT_CONTINUE: 's',
    UPLOAD_IMAGE: 'a',
    VIEW_HISTORY: 'f',
    SMART_COMPARE: 'w',
    DEBUG_MODE: 'z',
    CHECK_FILE_INPUT: 'i',
    REDETECT_ORIGINAL_B: 'b',
    REDETECT_ORIGINAL_N: 'n',
    SMART_DIMENSION_CHECK: 'p',
    SMART_DIMENSION_CHECK_F2: 'F2',
    MANUAL_DIMENSION_CHECK: 'r',
    F1_AUTO_INVALID: 'F1',
    ESCAPE: 'Escape'
};

// DOM选择器定义
export const SELECTORS = {
    // 按钮选择器
    SKIP_BUTTON: 'button:contains("跳过"), button[title*="跳过"], .skip-btn',
    SUBMIT_BUTTON: 'button:contains("提交并继续标注"), button:contains("提交"), .submit-btn',
    INVALID_BUTTON: 'button:contains("无效"), button:contains("Invalid"), .invalid-btn',
    
    // 输入元素选择器
    FILE_INPUT: 'input[type="file"]',
    IMAGE_INPUT: 'input[type="file"][accept*="image"]',
    
    // 图片选择器
    IMAGES: 'img',
    COS_IMAGES: 'img[src*="cos.ap-"], img[src*=".myqcloud.com"]',
    
    // 模态框选择器
    DIMENSION_CHECK_MODAL: '.dimension-check-modal',
    COMPARISON_MODAL: '.comparison-modal',
    
    // 调试面板选择器
    DEBUG_PANEL: '.debug-panel',
    DEBUG_LOGS: '.debug-logs',
    
    // 通知选择器
    NOTIFICATION: '.notification',
    
    // 提示框选择器
    TOOLTIP: '.dimension-tooltip'
};

// 应用设置默认值
export const DEFAULT_SETTINGS = {
    // 音效设置
    SOUND_ENABLED: true,
    
    // F1自动无效化设置
    F1_INTERVAL_MS: 800,
    F1_MAX_RUNS: 0, // 0表示无限制
    
    // 自动对比设置
    AUTO_COMPARE_ENABLED: true,
    
    // 通知设置
    NOTIFICATION_DURATION: 3000,
    
    // 调试设置
    DEBUG_MODE: false,
    MAX_DEBUG_LOGS: 1000,
    
    // 图片检测设置
    IMAGE_DETECTION_INTERVAL: 1000,
    
    // 网络监听设置
    NETWORK_TIMEOUT: 10000
};

// 样式常量
export const STYLES = {
    // 通知样式
    NOTIFICATION: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#333',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '6px',
        fontSize: '14px',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '300px',
        wordWrap: 'break-word'
    },
    
    // 调试面板样式
    DEBUG_PANEL: {
        position: 'fixed',
        top: '10px',
        left: '10px',
        width: '400px',
        height: '500px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        border: '1px solid #333',
        borderRadius: '8px',
        zIndex: '9999',
        fontFamily: 'monospace',
        fontSize: '12px'
    },
    
    // 模态框样式
    MODAL_OVERLAY: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: '10000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    }
};

// 错误消息常量
export const ERROR_MESSAGES = {
    CHROME_API_UNAVAILABLE: 'Chrome扩展API不可用，插件可能未正确加载',
    IMAGE_DOWNLOAD_FAILED: '图片下载失败',
    IMAGE_UPLOAD_FAILED: '图片上传失败',
    NETWORK_REQUEST_FAILED: '网络请求失败',
    FILE_NOT_FOUND: '文件未找到',
    INVALID_IMAGE_FORMAT: '不支持的图片格式',
    DIMENSION_CHECK_FAILED: '尺寸检查失败'
};

// 成功消息常量
export const SUCCESS_MESSAGES = {
    IMAGE_DOWNLOADED: '图片下载成功',
    IMAGE_UPLOADED: '图片上传成功',
    SETTINGS_SAVED: '设置保存成功',
    DEBUG_MODE_ENABLED: '调试模式已开启',
    DEBUG_MODE_DISABLED: '调试模式已关闭'
};

// API端点常量
export const API_ENDPOINTS = {
    RUNNINGHUB_BASE: 'https://api.runninghub.cn',
    RUNNINGHUB_WORKFLOW: '/api/v1/workflow',
    RUNNINGHUB_UPLOAD: '/api/v1/upload'
};

// 文件类型常量
export const FILE_TYPES = {
    IMAGES: 'image/*',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    WEBP: 'image/webp'
};

// 正则表达式常量
export const REGEX_PATTERNS = {
    COS_URL: /cos\.ap-[^.]+\.myqcloud\.com|tencentcos\.cn/,
    IMAGE_URL: /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i,
    DIMENSION_8_MULTIPLE: /^(\d+)x(\d+)$/
};

// 事件名称常量
export const EVENTS = {
    STATE_CHANGED: 'state:changed',
    IMAGE_DETECTED: 'image:detected',
    IMAGE_UPLOADED: 'image:uploaded',
    IMAGE_DOWNLOADED: 'image:downloaded',
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
    DEBUG_MODE_TOGGLED: 'debug:toggled',
    NOTIFICATION_SHOWN: 'notification:shown'
};

// 存储键名常量
export const STORAGE_KEYS = {
    SOUND_ENABLED: 'soundEnabled',
    F1_INTERVAL: 'f1Interval',
    F1_MAX_RUNS: 'f1MaxRuns',
    AUTO_COMPARE_ENABLED: 'autoCompareEnabled',
    DEBUG_MODE: 'debugMode',
    CACHED_RESULTS: 'cachedRunningHubResults',
    LAST_TASK_ID: 'lastSuccessfulTaskId'
};