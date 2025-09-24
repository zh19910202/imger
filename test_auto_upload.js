/**
 * 测试自动上传功能的简单脚本
 * 直接运行此脚本可以测试Native Host自动通知Chrome扩展上传图片的功能
 */

// 检查是否在Node.js环境中运行
if (typeof require !== 'undefined') {
    // Node.js环境下需要安装node-fetch
    try {
        const fetch = require('node-fetch');
        global.fetch = fetch;
    } catch (error) {
        console.error('请先安装node-fetch: npm install node-fetch');
        console.error('或者使用: yarn add node-fetch');
        process.exit(1);
    }
}

async function testAutoUpload() {
    console.log('=== 测试Native Host自动上传功能 ===');
    console.log('正在向Native Host发送测试数据...');

    // 创建测试图片数据
    const testImageData = 'data:image/jpg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    try {
        // 准备要发送的数据
        const imageData = {
            modified_image: testImageData,    // 修改图数据
            mask_image: testImageData,        // 蒙版图数据
            format: 'jpg',
            metadata: {
                source: 'test-script',
                format: 'jpg',
                timestamp: Date.now() / 1000,
                application: 'auto-upload-test',
                test: true
            }
        };

        console.log('发送数据到: http://localhost:8888/api/external-data');

        // 发送POST请求到Native Host
        const response = await fetch('http://localhost:8888/api/external-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData)
        });

        console.log(`HTTP状态码: ${response.status}`);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ 数据发送成功!');
            console.log('响应:', result);
            console.log('\n请检查Chrome扩展是否自动执行了上传操作。');
            console.log('您应该会在当前活动的标注页面看到上传通知。');
            return { success: true, data: result };
        } else {
            const errorText = await response.text();
            console.log(`❌ 发送失败: HTTP ${response.status}`);
            console.log(`响应内容: ${errorText}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log('❌ 连接失败: 无法连接到Native Host');
            console.log('请确保Native Host正在运行:');
            console.log('1. Chrome扩展已安装并启用');
            console.log('2. Native Host已正确安装和配置');
            console.log('3. Native Host服务正在运行');
            return { success: false, error: '连接失败: 无法连接到Native Host' };
        } else {
            console.log(`❌ 发送过程中出错: ${error.message}`);
            return { success: false, error: `发送过程中出错: ${error.message}` };
        }
    }
}

// 如果直接运行此脚本
if (typeof window === 'undefined' && typeof require !== 'undefined' && require.main === module) {
    testAutoUpload().then(result => {
        console.log('\n=== 测试完成 ===');
        if (result.success) {
            console.log('测试成功完成，请检查Chrome扩展的自动上传功能。');
        } else {
            console.log('测试失败，请检查错误信息。');
        }
    }).catch(error => {
        console.error('测试出错:', error);
    });
}

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testAutoUpload };
}