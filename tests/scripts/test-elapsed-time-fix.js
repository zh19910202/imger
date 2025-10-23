// 测试脚本 - 耗时为0问题修复验证
// 在浏览器控制台中运行以测试修复

console.log('=== 测试耗时为0问题修复 ===\n');

// 测试1: 检查completionStats数据结构一致性
console.log('测试1: 检查completionStats数据结构一致性');
try {
    if (typeof completionStats !== 'undefined' && completionStats.perPage) {
        console.log('✅ completionStats.perPage存在');
        const pageKeys = Object.keys(completionStats.perPage);

        if (pageKeys.length > 0) {
            console.log(`找到 ${pageKeys.length} 个页面记录:`);

            pageKeys.slice(0, 3).forEach((pageKey, index) => {
                const pageData = completionStats.perPage[pageKey];
                console.log(`\n页面 ${index + 1}: ${pageKey.substring(0, 30)}${pageKey.length > 30 ? '...' : ''}`);
                console.log(`  - completions: ${pageData.completions}`);
                console.log(`  - topicCount: ${pageData.topicCount}`);
                console.log(`  - elapsedSeconds: ${pageData.elapsedSeconds}`);
                console.log(`  - isValid: ${pageData.isValid}`);
                console.log(`  - firstCompletionTime: ${pageData.firstCompletionTime}`);
                console.log(`  - lastCompletionTime: ${pageData.lastCompletionTime}`);

                // 验证关键字段是否存在
                const hasElapsedSeconds = pageData.elapsedSeconds !== undefined;
                const hasValidStructure = pageData.completions !== undefined &&
                                         pageData.topicCount !== undefined &&
                                         pageData.isValid !== undefined;

                console.log(`  - 结构完整性: ${hasValidStructure ? '✅' : '❌'}`);
                console.log(`  - 耗时字段存在: ${hasElapsedSeconds ? '✅' : '❌'}`);
                console.log(`  - 耗时值有效: ${hasElapsedSeconds && pageData.elapsedSeconds > 0 ? '✅' : hasElapsedSeconds && pageData.elapsedSeconds === 0 ? '⚠️ 显示为0' : '❌ 不存在'}`);
            });
        } else {
            console.log('⚠️  暂无页面完成记录');
        }
    } else {
        console.log('⚠️  completionStats或perPage不存在');
    }
} catch (error) {
    console.error('❌ 测试1失败:', error.message);
}

// 测试2: 验证耗时计算逻辑
console.log('\n测试2: 验证耗时计算逻辑');
try {
    if (typeof collectedData !== 'undefined' && collectedData.startTime) {
        console.log('✅ collectedData.startTime存在');
        const currentTime = Date.now();
        const calculatedElapsed = Math.floor((currentTime - collectedData.startTime) / 1000);

        console.log(`当前时间: ${new Date(currentTime).toISOString()}`);
        console.log(`开始时间: ${new Date(collectedData.startTime).toISOString()}`);
        console.log(`计算耗时: ${calculatedElapsed} 秒`);
        console.log(`计算耗时: ${Math.floor(calculatedElapsed / 60)} 分 ${calculatedElapsed % 60} 秒`);

        if (calculatedElapsed > 0) {
            console.log('✅ 耗时计算逻辑正常');
        } else {
            console.log('⚠️  耗时为0，可能是刚开始或时间间隔太短');
        }
    } else {
        console.log('⚠️  collectedData.startTime不存在');
    }
} catch (error) {
    console.error('❌ 测试2失败:', error.message);
}

// 测试3: 模拟函数调用验证
console.log('\n测试3: 模拟函数调用验证');
try {
    // 模拟recordValidCompletion和recordCompletionOnConfirm的数据结构
    const simulatePageEntryCreation = () => {
        const topicCount = 5;
        const currentTime = Date.now();
        const startTime = currentTime - 120000; // 2分钟前
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

        const pageEntry = {
            completions: 0,
            topicId: 'test_topic_123',
            topicCount: topicCount,
            elapsedSeconds: elapsedSeconds,
            isValid: true,
            firstCompletionTime: currentTime,
            lastCompletionTime: currentTime
        };

        console.log('模拟创建的页面条目:');
        console.log(`  elapsedSeconds: ${pageEntry.elapsedSeconds} (应该约为120)`);
        console.log(`  所有字段存在: ${Object.keys(pageEntry).length === 7 ? '✅' : '❌'}`);

        return pageEntry;
    };

    const entry = simulatePageEntryCreation();
    if (entry.elapsedSeconds > 0) {
        console.log('✅ 模拟页面条目创建成功，耗时字段正确');
    } else {
        console.log('❌ 模拟页面条目创建失败，耗时字段为0');
    }
} catch (error) {
    console.error('❌ 测试3失败:', error.message);
}

console.log('\n=== 测试完成 ===');
console.log('请在实际使用中验证模态框显示的耗时是否正确。');
console.log('如果问题仍然存在，请检查:');
console.log('1. collectedData.startTime是否正确设置');
console.log('2. 页面切换时计时器是否正确重置');
console.log('3. recordCompletionOnConfirm是否被正确调用');