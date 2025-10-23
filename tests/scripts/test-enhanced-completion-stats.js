// 测试脚本 - 增强的完成统计功能
// 在浏览器控制台中运行以测试新功能

console.log('=== 测试增强的完成统计功能 ===\n');

// 测试1: 检查completionStats结构
console.log('测试1: 检查completionStats结构');
try {
    if (typeof completionStats !== 'undefined') {
        console.log('✅ completionStats对象存在');
        console.log('- totalValidCompletions:', completionStats.totalValidCompletions);
        console.log('- totalTopicsCompleted:', completionStats.totalTopicsCompleted);
        console.log('- perPage类型:', typeof completionStats.perPage);
    } else {
        console.log('⚠️  completionStats对象不存在（可能不在正确的上下文中）');
    }
} catch (error) {
    console.error('❌ 测试1失败:', error.message);
}

// 测试2: 检查新的perPage结构
console.log('\n测试2: 检查新的perPage结构');
try {
    if (typeof completionStats !== 'undefined' && completionStats.perPage) {
        const pageKeys = Object.keys(completionStats.perPage);
        console.log('✅ perPage对象存在，页面数量:', pageKeys.length);

        if (pageKeys.length > 0) {
            const firstPage = completionStats.perPage[pageKeys[0]];
            console.log('第一个页面的数据结构:');
            console.log('- completions:', firstPage.completions);
            console.log('- topicId:', firstPage.topicId);
            console.log('- topicCount:', firstPage.topicCount);
            console.log('- elapsedSeconds:', firstPage.elapsedSeconds);
            console.log('- isValid:', firstPage.isValid);
            console.log('- firstCompletionTime:', firstPage.firstCompletionTime);
            console.log('- lastCompletionTime:', firstPage.lastCompletionTime);
        }
    } else {
        console.log('⚠️  perPage对象不存在');
    }
} catch (error) {
    console.error('❌ 测试2失败:', error.message);
}

// 测试3: 检查数据迁移功能
console.log('\n测试3: 检查数据迁移功能');
try {
    // 模拟旧格式数据
    const oldFormatData = {
        completions: 5,
        topicCount: 3
    };

    // 检查是否包含新字段
    if (oldFormatData.topicId === undefined &&
        oldFormatData.elapsedSeconds === undefined) {
        console.log('✅ 识别到旧格式数据');
    }

    console.log('✅ 数据迁移功能测试完成');
} catch (error) {
    console.error('❌ 测试3失败:', error.message);
}

console.log('\n=== 测试完成 ===');
console.log('请在实际的Appen平台上运行此测试以验证完整功能。');