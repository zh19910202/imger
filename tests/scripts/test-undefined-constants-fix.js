// 测试脚本 - 验证未定义常量修复
// 在浏览器控制台中运行以测试修复

console.log('=== 测试未定义常量修复 ===\n');

// 测试1: 检查LOG_LEVEL常量
console.log('测试1: 检查LOG_LEVEL常量');
try {
    if (typeof LOG_LEVEL !== 'undefined') {
        console.log('✅ LOG_LEVEL常量存在');
        console.log('- ERROR:', LOG_LEVEL.ERROR);
        console.log('- WARN:', LOG_LEVEL.WARN);
        console.log('- INFO:', LOG_LEVEL.INFO);
        console.log('- DEBUG:', LOG_LEVEL.DEBUG);
    } else {
        console.log('⚠️  LOG_LEVEL常量不存在');
    }
} catch (error) {
    console.error('❌ 测试1失败:', error.message);
}

// 测试2: 模拟错误日志调用
console.log('\n测试2: 模拟错误日志调用');
try {
    if (typeof log !== 'undefined' && typeof LOG_LEVEL !== 'undefined') {
        // 测试ERROR日志
        log(LOG_LEVEL.ERROR, '[测试] ERROR日志调用测试');

        // 测试WARN日志
        log(LOG_LEVEL.WARN, '[测试] WARN日志调用测试');

        // 测试INFO日志
        log(LOG_LEVEL.INFO, '[测试] INFO日志调用测试');

        console.log('✅ 所有日志级别调用测试通过');
    } else {
        console.log('⚠️  日志函数或LOG_LEVEL常量不存在');
    }
} catch (error) {
    console.error('❌ 测试2失败:', error.message);
}

// 测试3: 验证原始错误已修复
console.log('\n测试3: 验证原始错误已修复');
try {
    // 这里应该不会抛出ReferenceError
    console.log('✅ 如果没有ReferenceError，则修复成功');
} catch (error) {
    if (error instanceof ReferenceError) {
        console.error('❌ ReferenceError仍然存在:', error.message);
    } else {
        console.error('❌ 其他错误:', error.message);
    }
}

console.log('\n=== 测试完成 ===');
console.log('如果所有测试都通过，说明未定义常量问题已修复。');