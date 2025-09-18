/**
 * 版本检查器
 * 用于快速识别当前运行的是哪个版本的AnnotateFlow Assistant
 */

// 版本检查函数
function checkAnnotateFlowVersion() {
    const versionInfo = window.ANNOTATEFLOW_VERSION;
    
    if (!versionInfo) {
        console.warn('❌ 未检测到AnnotateFlow Assistant版本信息');
        return null;
    }
    
    const isRefactored = versionInfo.type === 'refactored';
    const isOriginal = versionInfo.type === 'original';
    
    console.log(`${isRefactored ? '🚀' : '📜'} 当前运行版本:`, versionInfo);
    
    // 详细版本信息
    const details = {
        version: versionInfo.version,
        type: versionInfo.type,
        architecture: versionInfo.architecture,
        loadTime: versionInfo.loadTime,
        isRefactored,
        isOriginal
    };
    
    if (isRefactored) {
        details.modules = versionInfo.modules;
        details.totalModules = versionInfo.modules?.length || 0;
        console.log('📦 加载的模块:', versionInfo.modules);
    } else if (isOriginal) {
        details.fileSize = versionInfo.fileSize;
        console.log('📄 文件信息:', versionInfo.fileSize);
    }
    
    return details;
}

// 功能可用性检查
function checkFunctionAvailability() {
    const functions = {
        // 通用函数
        downloadImage: typeof downloadImage === 'function',
        showNotification: typeof showNotification === 'function',
        debugLog: typeof debugLog === 'function',
        
        // 重构版本特有
        getAppInfo: typeof getAppInfo === 'function',
        AnnotateFlowApp: typeof window.AnnotateFlowApp !== 'undefined',
        
        // 原始版本特有全局变量
        lastHoveredImage: typeof lastHoveredImage !== 'undefined',
        debugMode: typeof debugMode !== 'undefined',
        soundEnabled: typeof soundEnabled !== 'undefined'
    };
    
    console.log('🔧 功能可用性检查:', functions);
    return functions;
}

// 性能检查
function checkPerformance() {
    const performance = {
        loadTime: window.ANNOTATEFLOW_VERSION?.loadTime,
        memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
        } : 'Not available',
        timing: performance.timing ? {
            domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + 'ms',
            pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms'
        } : 'Not available'
    };
    
    console.log('⚡ 性能信息:', performance);
    return performance;
}

// 完整的版本报告
function generateVersionReport() {
    console.log('='.repeat(60));
    console.log('📋 AnnotateFlow Assistant 版本报告');
    console.log('='.repeat(60));
    
    const version = checkAnnotateFlowVersion();
    const functions = checkFunctionAvailability();
    const perf = checkPerformance();
    
    const report = {
        timestamp: new Date().toISOString(),
        version,
        functions,
        performance: perf,
        url: window.location.href,
        userAgent: navigator.userAgent
    };
    
    console.log('📊 完整报告:', report);
    
    // 生成简化的状态摘要
    if (version) {
        const summary = `
🎯 版本摘要:
   类型: ${version.type === 'refactored' ? '重构版本 🚀' : '原始版本 📜'}
   版本号: ${version.version}
   架构: ${version.architecture}
   ${version.type === 'refactored' ? `模块数: ${version.totalModules}` : `文件大小: ${version.fileSize}`}
   加载时间: ${version.loadTime}
        `;
        console.log(summary);
    }
    
    return report;
}

// 键盘测试函数
function testKeyboardShortcuts() {
    console.log('⌨️ 开始键盘快捷键测试...');
    console.log('请按以下键进行测试:');
    console.log('- D键: 下载图片');
    console.log('- 空格键: 跳过按钮');
    console.log('- S键: 提交按钮');
    console.log('- Z键: 调试模式');
    
    const testResults = {};
    
    const originalKeyHandler = document.onkeydown;
    
    document.addEventListener('keydown', function testKeyHandler(e) {
        const key = e.key.toLowerCase();
        const testKeys = ['d', ' ', 's', 'z', 'a', 'f', 'w'];
        
        if (testKeys.includes(key)) {
            testResults[key] = {
                timestamp: new Date().toISOString(),
                version: window.ANNOTATEFLOW_VERSION?.type,
                handled: true
            };
            
            console.log(`✅ ${key === ' ' ? 'Space' : key.toUpperCase()}键测试通过 - ${window.ANNOTATEFLOW_VERSION?.type}版本`);
        }
    });
    
    // 10秒后停止测试
    setTimeout(() => {
        console.log('⌨️ 键盘测试完成，结果:', testResults);
        document.onkeydown = originalKeyHandler;
    }, 10000);
}

// 自动检查函数（页面加载时执行）
function autoCheck() {
    // 等待1秒确保应用完全加载
    setTimeout(() => {
        generateVersionReport();
    }, 1000);
}

// 导出函数到全局作用域，方便控制台调用
window.checkAnnotateFlowVersion = checkAnnotateFlowVersion;
window.checkFunctionAvailability = checkFunctionAvailability;
window.checkPerformance = checkPerformance;
window.generateVersionReport = generateVersionReport;
window.testKeyboardShortcuts = testKeyboardShortcuts;

// 页面加载时自动检查
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoCheck);
} else {
    autoCheck();
}

console.log('🔍 版本检查器已加载，可用函数:');
console.log('- checkAnnotateFlowVersion() - 检查版本信息');
console.log('- checkFunctionAvailability() - 检查功能可用性');
console.log('- checkPerformance() - 检查性能信息');
console.log('- generateVersionReport() - 生成完整报告');
console.log('- testKeyboardShortcuts() - 测试键盘快捷键');