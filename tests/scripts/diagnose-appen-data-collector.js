// 诊断脚本 - Appen数据收集器优化功能测试
// 使用说明：在浏览器Console中运行此脚本进行诊断

console.log('=== Appen数据收集器优化功能诊断脚本 ===\n');

// 模拟测试环境
const testEnvironment = {
    isChromeExtension: typeof chrome !== 'undefined' && chrome.storage,
    hasDocument: typeof document !== 'undefined',
    hasWindow: typeof window !== 'undefined'
};

console.log('环境检查:');
console.log('- Chrome扩展环境:', testEnvironment.isChromeExtension);
console.log('- Document对象:', testEnvironment.hasDocument);
console.log('- Window对象:', testEnvironment.hasWindow);

// 测试日志级别系统
console.log('\n--- 测试日志级别系统 ---');
try {
    // 检查LOG_LEVEL常量是否存在
    if (typeof LOG_LEVEL !== 'undefined') {
        console.log('✅ LOG_LEVEL常量存在:', LOG_LEVEL);
    } else {
        console.log('⚠️  LOG_LEVEL常量不存在（可能不在正确的上下文中）');
    }

    // 检查log函数是否存在
    if (typeof log !== 'undefined') {
        console.log('✅ log函数存在');
        // 测试不同日志级别
        log(LOG_LEVEL.DEBUG, '测试DEBUG日志');
        log(LOG_LEVEL.INFO, '测试INFO日志');
        log(LOG_LEVEL.WARN, '测试WARN日志');
        log(LOG_LEVEL.ERROR, '测试ERROR日志');
        console.log('✅ 日志函数调用测试通过');
    } else {
        console.log('⚠️  log函数不存在（可能不在正确的上下文中）');
    }
} catch (error) {
    console.error('❌ 日志系统测试失败:', error.message);
}

// 测试ChromeStorage工具函数
console.log('\n--- 测试ChromeStorage工具函数 ---');
try {
    if (typeof ChromeStorage !== 'undefined') {
        console.log('✅ ChromeStorage对象存在');
        console.log('- isAvailable函数:', typeof ChromeStorage.isAvailable === 'function');
        console.log('- get函数:', typeof ChromeStorage.get === 'function');
        console.log('- set函数:', typeof ChromeStorage.set === 'function');
        console.log('- remove函数:', typeof ChromeStorage.remove === 'function');

        // 测试isAvailable函数
        const isAvailable = ChromeStorage.isAvailable();
        console.log('- 存储可用性检查:', isAvailable);
        console.log('✅ ChromeStorage工具函数测试通过');
    } else {
        console.log('⚠️  ChromeStorage对象不存在（可能不在正确的上下文中）');
    }
} catch (error) {
    console.error('❌ ChromeStorage工具函数测试失败:', error.message);
}

// 测试ElementSelector工具函数
console.log('\n--- 测试ElementSelector工具函数 ---');
try {
    if (typeof ElementSelector !== 'undefined') {
        console.log('✅ ElementSelector对象存在');
        console.log('- select函数:', typeof ElementSelector.select === 'function');
        console.log('- selectAll函数:', typeof ElementSelector.selectAll === 'function');
        console.log('- selectInContext函数:', typeof ElementSelector.selectInContext === 'function');
        console.log('- selectAllInContext函数:', typeof ElementSelector.selectAllInContext === 'function');
        console.log('✅ ElementSelector工具函数测试通过');
    } else {
        console.log('⚠️  ElementSelector对象不存在（可能不在正确的上下文中）');
    }
} catch (error) {
    console.error('❌ ElementSelector工具函数测试失败:', error.message);
}

// 测试ErrorHandler工具函数
console.log('\n--- 测试ErrorHandler工具函数 ---');
try {
    if (typeof ErrorHandler !== 'undefined') {
        console.log('✅ ErrorHandler对象存在');
        console.log('- handle函数:', typeof ErrorHandler.handle === 'function');
        console.log('- handleAsync函数:', typeof ErrorHandler.handleAsync === 'function');
        console.log('- handleAndRethrow函数:', typeof ErrorHandler.handleAndRethrow === 'function');
        console.log('- handleDOMError函数:', typeof ErrorHandler.handleDOMError === 'function');
        console.log('- handleNetworkError函数:', typeof ErrorHandler.handleNetworkError === 'function');
        console.log('- handleStorageError函数:', typeof ErrorHandler.handleStorageError === 'function');

        // 测试错误处理功能
        try {
            ErrorHandler.handle(new Error('测试错误'), '测试上下文', null, LOG_LEVEL.WARN);
            console.log('✅ ErrorHandler处理函数调用测试通过');
        } catch (handleError) {
            console.error('❌ ErrorHandler处理函数调用失败:', handleError.message);
        }
    } else {
        console.log('⚠️  ErrorHandler对象不存在（可能不在正确的上下文中）');
    }
} catch (error) {
    console.error('❌ ErrorHandler工具函数测试失败:', error.message);
}

// 测试配置和数据结构
console.log('\n--- 测试配置和数据结构 ---');
try {
    if (typeof CONFIG !== 'undefined') {
        console.log('✅ CONFIG对象存在');
        console.log('- API_ENDPOINT:', CONFIG.API_ENDPOINT);
        console.log('- MAX_RETRY_ATTEMPTS:', CONFIG.MAX_RETRY_ATTEMPTS);
        console.log('- TARGET_URL_PATTERN类型:', typeof CONFIG.TARGET_URL_PATTERN);
    } else {
        console.log('⚠️  CONFIG对象不存在（可能不在正确的上下文中）');
    }

    console.log('✅ 配置和数据结构测试完成');
} catch (error) {
    console.error('❌ 配置和数据结构测试失败:', error.message);
}

console.log('\n=== 诊断完成 ===');
console.log('请检查以上测试结果，确保所有功能正常工作。');
console.log('注意：某些功能可能需要在实际的Chrome扩展环境中才能完全测试。');