/**
 * 常量配置模块
 * 集中管理所有常量定义，便于维护和修改
 */

const AuxisConstants = {
    // 应用信息
    APP_NAME: 'Auxis',
    VERSION: '2.5.0',

    // 目标域名
    TARGET_DOMAIN: 'qlabel.tencent.com',

    // 键盘快捷键
    KEYBOARD: {
        DOWNLOAD: 'KeyD',           // D键 - 下载图片
        SKIP: 'Space',              // 空格键 - 跳过
        SUBMIT: 'KeyS',             // S键 - 提交
        UPLOAD: 'KeyA',             // A键 - 上传
        HISTORY: 'KeyF',            // F键 - 查看历史
        DIMENSION_CHECK: 'KeyR',    // R键 - RunningHub检查
        MARK_INVALID: 'KeyX',       // X键 - 标记无效
        BATCH_INVALID: 'F1'         // F1键 - 批量无效
    },

    // RunningHub 配置
    RUNNINGHUB: {
        API_BASE_URL: 'https://www.runninghub.cn',
        CONFIG_FILE: 'runninghub-config.json',
        STORAGE_KEY: 'runninghub_api_key',
        POLL_INTERVAL: 3000,        // 3秒轮询间隔
        POLL_TIMEOUT: 210000,       // 3.5分钟超时
        DEFAULT_WORKFLOW: 'defaultWorkflow'
    },

    // 本地存储键
    STORAGE_KEYS: {
        AUTO_OPEN: 'autoOpenImages',
        SOUND_ENABLED: 'soundEnabled',
        RUNNINGHUB_API: 'runninghub_api_key',
        DEBUG_MODE: 'debugMode'
    },

    // UI 配置
    UI: {
        NOTIFICATION_DURATION: 3000,    // 默认通知显示时间
        MODAL_Z_INDEX: 10000,          // 模态框层级
        ANIMATION_DURATION: 300,        // 动画持续时间
        COMPARISON_MODAL_ID: 'auxis-comparison-modal',
        DIMENSION_MODAL_ID: 'auxis-dimension-check-modal'
    },

    // 文件处理
    FILE: {
        MAX_SIZE: 50 * 1024 * 1024,    // 50MB 最大文件大小
        SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        DEFAULT_FORMAT: 'png'
    },

    // 网络配置
    NETWORK: {
        REQUEST_TIMEOUT: 30000,         // 30秒请求超时
        RETRY_COUNT: 3,                 // 重试次数
        RETRY_DELAY: 1000              // 重试延迟
    },

    // CSS 类名
    CSS_CLASSES: {
        HIGHLIGHT: 'auxis-highlight',
        DOWNLOADING: 'auxis-downloading',
        MODAL_OVERLAY: 'auxis-modal-overlay',
        MODAL_CONTENT: 'auxis-modal-content',
        NOTIFICATION: 'auxis-notification'
    },

    // 状态枚举
    STATUS: {
        TASK: {
            PENDING: 'PENDING',
            RUNNING: 'RUNNING',
            SUCCESS: 'SUCCESS',
            FAILED: 'FAILED',
            CANCELED: 'CANCELED',
            ERROR: 'ERROR'
        },
        BUTTON: {
            READY: 'ready',
            PROCESSING: 'processing',
            SUCCESS: 'success',
            FAILED: 'failed',
            CANCELED: 'canceled'
        }
    },

    // 消息类型
    MESSAGE_TYPES: {
        DOWNLOAD: 'download',
        UPLOAD: 'upload',
        TASK_UPDATE: 'task_update',
        STATE_CHANGE: 'state_change'
    }
};

// 冻结对象防止修改
Object.freeze(AuxisConstants);

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuxisConstants;
} else {
    window.AuxisConstants = AuxisConstants;
}