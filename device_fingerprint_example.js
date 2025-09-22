// Chrome 扩展中使用设备指纹读取功能的示例代码

/**
 * 读取设备指纹文件内容
 * @param {function} callback - 回调函数，接收结果
 */
function readDeviceFingerprint(callback) {
    const message = {
        action: 'read_device_fingerprint',
        read_id: 'fingerprint_' + Date.now() // 可选的请求ID
    };
    
    // 发送消息到 Native Host
    chrome.runtime.sendNativeMessage('com.annotateflow.assistant', message, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Native messaging error:', chrome.runtime.lastError);
            callback({
                success: false,
                error: chrome.runtime.lastError.message
            });
            return;
        }
        
        callback(response);
    });
}

// 使用示例
function initializeWithDeviceFingerprint() {
    readDeviceFingerprint((result) => {
        if (result.success) {
            console.log('设备指纹内容:', result.content);
            console.log('文件路径:', result.file_path);
            console.log('文件大小:', result.file_size, 'bytes');
            
            // 在这里使用设备指纹数据
            // 例如：发送到服务器、存储到本地等
            processDeviceFingerprint(result.content);
        } else {
            console.error('读取设备指纹失败:', result.error);
            // 处理错误情况
            handleFingerprintError(result.error);
        }
    });
}

// 处理设备指纹数据的函数
function processDeviceFingerprint(fingerprint) {
    // 这里可以添加你的业务逻辑
    console.log('处理设备指纹:', fingerprint);
    
    // 示例：存储到 Chrome 存储
    chrome.storage.local.set({
        'device_fingerprint': fingerprint,
        'fingerprint_timestamp': Date.now()
    });
}

// 处理错误的函数
function handleFingerprintError(error) {
    console.error('设备指纹错误:', error);
    
    // 可以显示用户友好的错误信息
    // 或者使用默认值
}

// 在扩展启动时调用
document.addEventListener('DOMContentLoaded', () => {
    initializeWithDeviceFingerprint();
});

// 也可以在需要时手动调用
// readDeviceFingerprint((result) => { /* 处理结果 */ });