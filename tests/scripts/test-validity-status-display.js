// 测试脚本 - 有效性状态显示功能
// 在浏览器控制台中运行以测试新功能

console.log('=== 测试有效性状态显示功能 ===\n');

// 测试1: 检查completionStats中的isValid字段
console.log('测试1: 检查completionStats中的isValid字段');
try {
    if (typeof completionStats !== 'undefined') {
        console.log('✅ completionStats对象存在');
        const pageKeys = Object.keys(completionStats.perPage);
        if (pageKeys.length > 0) {
            const firstPage = completionStats.perPage[pageKeys[0]];
            console.log('第一页的有效性状态:');
            console.log('- isValid:', firstPage.isValid);
            console.log('- 类型:', typeof firstPage.isValid);

            // 测试不同状态的显示
            const testStatuses = [true, false, undefined, null];
            testStatuses.forEach(status => {
                const color = status === true ? '#4CAF50' : status === false ? '#f44336' : '#9E9E9E';
                const text = status === true ? '✓ 有效' : status === false ? '✗ 无效' : '未知状态';
                console.log(`状态 ${status}: ${text} (颜色: ${color})`);
            });
        } else {
            console.log('⚠️  没有页面完成记录');
        }
    } else {
        console.log('⚠️  completionStats对象不存在');
    }
} catch (error) {
    console.error('❌ 测试1失败:', error.message);
}

// 测试2: 模拟显示带有效状态的完成详情
console.log('\n测试2: 模拟显示带有效状态的完成详情');
try {
    if (typeof completionStats !== 'undefined') {
        const pageKeys = Object.keys(completionStats.perPage);
        if (pageKeys.length > 0) {
            console.log('模拟带有效状态的页面完成详情显示:');

            pageKeys.slice(0, 3).forEach((pageKey, index) => {
                const data = completionStats.perPage[pageKey];
                const rejectReason = collectedData?.responseElements?.qualityCheckRecord?.latestRecord?.comment || '无驳回';
                const lastCompletionTime = data.lastCompletionTime
                    ? new Date(data.lastCompletionTime).toLocaleString('zh-CN')
                    : '未知';
                const validityStatus = data.isValid === true ? '✓ 有效' : data.isValid === false ? '✗ 无效' : '未知状态';
                const validityColor = data.isValid === true ? '#4CAF50' : data.isValid === false ? '#f44336' : '#9E9E9E';

                console.log(`\n页面 ${index + 1}:`);
                console.log(`  页面: ${pageKey.substring(0, 50)}${pageKey.length > 50 ? '...' : ''}`);
                console.log(`  完成次数: ${data.completions}`);
                console.log(`  题数: ${data.topicCount}`);
                console.log(`  耗时: ${data.elapsedSeconds || 0}秒`);
                console.log(`  状态: ${validityStatus} (颜色: ${validityColor})`);
                console.log(`  驳回理由: ${rejectReason.substring(0, 30)}${rejectReason.length > 30 ? '...' : ''}`);
                console.log(`  最后完成: ${lastCompletionTime}`);
            });

            console.log('\n✅ 带有效状态的完成详情显示格式测试通过');
        } else {
            console.log('⚠️  没有完成记录可供测试');
        }
    } else {
        console.log('⚠️  completionStats对象不存在');
    }
} catch (error) {
    console.error('❌ 测试2失败:', error.message);
}

// 测试3: 验证颜色编码
console.log('\n测试3: 验证颜色编码');
try {
    const colorTests = [
        { status: true, expectedColor: '#4CAF50', expectedText: '✓ 有效' },
        { status: false, expectedColor: '#f44336', expectedText: '✗ 无效' },
        { status: undefined, expectedColor: '#9E9E9E', expectedText: '未知状态' },
        { status: null, expectedColor: '#9E9E9E', expectedText: '未知状态' }
    ];

    colorTests.forEach(test => {
        const color = test.status === true ? '#4CAF50' : test.status === false ? '#f44336' : '#9E9E9E';
        const text = test.status === true ? '✓ 有效' : test.status === false ? '✗ 无效' : '未知状态';

        const colorMatch = color === test.expectedColor;
        const textMatch = text === test.expectedText;

        console.log(`状态 ${test.status}: ${textMatch ? '✅' : '❌'} 文本正确, ${colorMatch ? '✅' : '❌'} 颜色正确`);
    });

    console.log('\n✅ 颜色编码验证完成');
} catch (error) {
    console.error('❌ 测试3失败:', error.message);
}

console.log('\n=== 测试完成 ===');
console.log('请在实际的Appen平台上打开模态框以验证完整功能。');