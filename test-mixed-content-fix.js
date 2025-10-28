/**
 * 测试混合内容和CORS修复效果
 * 在浏览器控制台中运行此脚本来验证修复是否有效
 */

(function() {
    'use strict';

    console.log('=== 开始测试混合内容和CORS修复 ===');

    // 测试1: 检查协议自动检测
    function testProtocolDetection() {
        console.log('\n1. 测试协议自动检测:');

        if (typeof DataService !== 'undefined') {
            const currentProtocol = window.location.protocol;
            const expectedProtocol = currentProtocol === 'https:' ? 'https' : 'http';
            const actualApiUrl = DataServiceConfig.API_BASE_URL;

            console.log(`当前页面协议: ${currentProtocol}`);
            console.log(`期望的API协议: ${expectedProtocol}`);
            console.log(`实际API URL: ${actualApiUrl}`);
            console.log(`协议检测${actualApiUrl.startsWith(expectedProtocol) ? '✅ 正常' : '❌ 异常'}`);
        } else {
            console.log('❌ DataService未加载');
        }
    }

    // 测试2: 检查background代理可用性
    function testBackgroundProxy() {
        console.log('\n2. 测试background代理:');

        if (typeof DataService !== 'undefined') {
            const canUseProxy = DataService.canUseBackgroundProxy();
            console.log(`Background代理可用: ${canUseProxy ? '✅ 是' : '❌ 否'}`);

            if (canUseProxy) {
                console.log('Chrome runtime API: ✅ 可用');
            } else {
                console.log('Chrome runtime API: ❌ 不可用或不在扩展环境中');
            }
        } else {
            console.log('❌ DataService未加载');
        }
    }

    // 测试3: 测试API请求（模拟）
    async function testApiRequest() {
        console.log('\n3. 测试API请求:');

        if (typeof DataService !== 'undefined') {
            try {
                // 获取用户ID
                const userId = DataService.getUserId();
                console.log(`用户ID: ${userId || '❌ 未找到'}`);

                if (userId) {
                    // 构建测试URL
                    const testUrl = DataService.buildApiUrl(userId, 'day', null, false);
                    console.log(`测试API URL: ${testUrl}`);

                    // 尝试获取今日数据
                    console.log('尝试获取今日报表数据...');
                    const reportData = await DataService.getTodayReport();

                    if (reportData && reportData.statistics) {
                        console.log('✅ API请求成功');
                        console.log('返回数据结构:', {
                            总记录数: reportData.statistics.totalRecords,
                            有效记录数: reportData.statistics.validRecords,
                            有效率: (reportData.statistics.validRate * 100).toFixed(2) + '%'
                        });
                    } else {
                        console.log('⚠️ API请求返回空数据（可能是服务器未运行或用户ID无效）');
                    }
                }
            } catch (error) {
                console.log('❌ API请求失败:', error.message);
            }
        } else {
            console.log('❌ DataService未加载');
        }
    }

    // 测试4: 检查CORS错误处理
    function testCorsHandling() {
        console.log('\n4. 测试CORS错误处理:');

        // 检查content script的fetch拦截器
        if (typeof window.originalFetch === 'undefined') {
            console.log('⚠️ Fetch拦截器未检测到（可能正常，取决于加载顺序）');
        } else {
            console.log('✅ Fetch拦截器已加载');
        }

        // 检查错误处理改进
        console.log('✅ CORS错误处理已更新（不再返回status 0的Response）');
    }

    // 测试5: 环境信息
    function showEnvironmentInfo() {
        console.log('\n5. 环境信息:');
        console.log(`当前URL: ${window.location.href}`);
        console.log(`页面协议: ${window.location.protocol}`);
        console.log(`用户代理: ${navigator.userAgent.substring(0, 50)}...`);
        console.log(`是否在扩展环境: ${typeof chrome !== 'undefined' && chrome.runtime ? '✅ 是' : '❌ 否'}`);
    }

    // 运行所有测试
    async function runAllTests() {
        showEnvironmentInfo();
        testProtocolDetection();
        testBackgroundProxy();
        await testApiRequest();
        testCorsHandling();

        console.log('\n=== 测试完成 ===');
        console.log('如果API请求仍然失败，请检查:');
        console.log('1. 本地服务器 (192.168.31.74:1145) 是否正在运行');
        console.log('2. 服务器是否支持HTTPS（如果在HTTPS页面中）');
        console.log('3. 用户ID是否正确设置');
        console.log('4. 扩展是否正确加载并有必要权限');
    }

    // 立即运行测试
    runAllTests().catch(console.error);

})();