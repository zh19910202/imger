// 测试脚本 - 增强的模态框完成统计显示
// 在浏览器控制台中运行以测试新功能

console.log('=== 测试增强的模态框完成统计显示 ===\n');

// 测试1: 检查completionStats结构
console.log('测试1: 检查completionStats结构');
try {
    if (typeof completionStats !== 'undefined') {
        console.log('✅ completionStats对象存在');
        console.log('- totalValidCompletions:', completionStats.totalValidCompletions);
        console.log('- totalTopicsCompleted:', completionStats.totalTopicsCompleted);
        console.log('- perPage类型:', typeof completionStats.perPage);

        // 检查增强的perPage结构
        const pageKeys = Object.keys(completionStats.perPage);
        if (pageKeys.length > 0) {
            const firstPage = completionStats.perPage[pageKeys[0]];
            console.log('第一页的增强数据结构:');
            console.log('- completions:', firstPage.completions);
            console.log('- topicId:', firstPage.topicId);
            console.log('- topicCount:', firstPage.topicCount);
            console.log('- elapsedSeconds:', firstPage.elapsedSeconds);
            console.log('- isValid:', firstPage.isValid);
            console.log('- lastCompletionTime:', firstPage.lastCompletionTime);
        }
    } else {
        console.log('⚠️  completionStats对象不存在');
    }
} catch (error) {
    console.error('❌ 测试1失败:', error.message);
}

// 测试2: 检查收集的数据结构
console.log('\n测试2: 检查收集的数据结构');
try {
    if (typeof collectedData !== 'undefined') {
        console.log('✅ collectedData对象存在');
        console.log('- userId:', collectedData.userId);
        console.log('- taskId:', collectedData.taskId);
        console.log('- topicId:', collectedData.topicId);

        // 检查质检记录
        if (collectedData.responseElements?.qualityCheckRecord) {
            console.log('质检记录存在:');
            console.log('- hasRecord:', collectedData.responseElements.qualityCheckRecord.hasRecord);
            if (collectedData.responseElements.qualityCheckRecord.latestRecord) {
                console.log('- latestRecord.comment:', collectedData.responseElements.qualityCheckRecord.latestRecord.comment);
            }
        } else {
            console.log('⚠️  质检记录不存在或为空');
        }
    } else {
        console.log('⚠️  collectedData对象不存在');
    }
} catch (error) {
    console.error('❌ 测试2失败:', error.message);
}

// 测试3: 模拟显示增强的完成详情
console.log('\n测试3: 模拟显示增强的完成详情');
try {
    if (typeof completionStats !== 'undefined' && typeof collectedData !== 'undefined') {
        const pageKeys = Object.keys(completionStats.perPage);
        if (pageKeys.length > 0) {
            console.log('模拟增强的页面完成详情显示:');

            pageKeys.slice(0, 3).forEach((pageKey, index) => {
                const data = completionStats.perPage[pageKey];
                const rejectReason = collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '无驳回';
                const lastCompletionTime = data.lastCompletionTime
                    ? new Date(data.lastCompletionTime).toLocaleString('zh-CN')
                    : '未知';

                console.log(`\n页面 ${index + 1}:`);
                console.log(`  页面: ${pageKey.substring(0, 50)}${pageKey.length > 50 ? '...' : ''}`);
                console.log(`  完成次数: ${data.completions}`);
                console.log(`  题数: ${data.topicCount}`);
                console.log(`  耗时: ${data.elapsedSeconds || 0}秒`);
                console.log(`  驳回理由: ${rejectReason.substring(0, 30)}${rejectReason.length > 30 ? '...' : ''}`);
                console.log(`  最后完成: ${lastCompletionTime}`);
            });

            console.log('\n✅ 增强的完成详情显示格式测试通过');
        } else {
            console.log('⚠️  没有完成记录可供测试');
        }
    } else {
        console.log('⚠️  必需的数据对象不存在');
    }
} catch (error) {
    console.error('❌ 测试3失败:', error.message);
}

console.log('\n=== 测试完成 ===');
console.log('请在实际的Appen平台上打开模态框以验证完整功能。');