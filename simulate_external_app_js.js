/**
 * 使用JavaScript模拟外部应用请求Native Host的接口示例
 *
 * 该示例演示了如何使用JavaScript通过HTTP请求与Native Host进行交互
 * Native Host运行在 localhost:8888 上，支持多种API端点
 */

// Native Host配置
const NATIVE_HOST_URL = 'http://localhost:8888';

/**
 * 发送图片数据到Native Host
 * @param {string} originalImageData - 原图数据 (base64编码)
 * @param {string} annotatedImageData - 标注图/蒙版图数据 (base64编码)
 * @param {string} instructions - 图片说明
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 响应结果
 */
async function sendImagesToNativeHost(originalImageData, annotatedImageData, instructions = '', metadata = {}) {
    try {
        // 准备要发送的数据
        const imageData = {
            original_image: originalImageData,    // 修改图数据
            annotated_image: annotatedImageData,  // 蒙版图数据
            instructions: instructions,
            source: 'external-application',       // 标识数据来源
            format: 'base64',
            metadata: {
                source: 'external-application',
                format: 'base64',
                timestamp: Date.now() / 1000,
                application: 'javascript-simulator',
                ...metadata
            }
        };

        // 发送POST请求到Native Host的HTTP服务器
        const response = await fetch(`${NATIVE_HOST_URL}/api/images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData)
        });

        console.log(`发送请求到: ${NATIVE_HOST_URL}/api/images`);
        console.log(`请求数据大小: ${JSON.stringify(imageData).length} 字符`);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ 图片数据发送成功!');
            console.log('响应:', result);
            return { success: true, data: result };
        } else {
            const errorText = await response.text();
            console.log(`❌ 发送失败: HTTP ${response.status}`);
            console.log(`响应内容: ${errorText}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log('❌ 连接失败: 无法连接到Native Host，请确保Native Host正在运行');
            return { success: false, error: '连接失败: 无法连接到Native Host，请确保Native Host正在运行' };
        } else {
            console.log(`❌ 发送过程中出错: ${error.message}`);
            return { success: false, error: `发送过程中出错: ${error.message}` };
        }
    }
}

/**
 * 将图片文件转换为base64编码
 * @param {File|Blob} file - 图片文件对象
 * @returns {Promise<string>} base64编码的图片数据
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * 发送图片文件到Native Host
 * @param {File|Blob} imageFile - 原图文件对象
 * @param {File|Blob} maskFile - 蒙版文件对象 (可选)
 * @param {string} instructions - 图片说明
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 响应结果
 */
async function sendImageFileToNativeHost(imageFile, maskFile = null, instructions = '来自外部应用程序的图片文件', metadata = {}) {
    try {
        // 将图片文件转换为base64
        console.log('正在读取图片文件...');
        const originalImageData = await fileToBase64(imageFile);

        // 如果提供了蒙版文件，则转换为base64，否则使用模拟数据
        let maskImageData;
        if (maskFile) {
            maskImageData = await fileToBase64(maskFile);
        } else {
            // 创建一个简单的SVG作为模拟蒙版数据
            const maskSvgData = `
                <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#000000"/>
                    <circle cx="200" cy="150" r="80" fill="#FFFFFF"/>
                    <text x="200" y="155" text-anchor="middle" font-family="Arial" font-size="24" fill="#000000">
                        Mask Image
                    </text>
                    <text x="200" y="185" text-anchor="middle" font-family="Arial" font-size="16" fill="#000000">
                        From External App
                    </text>
                </svg>
            `;
            const maskBase64 = btoa(maskSvgData);
            maskImageData = `data:image/svg+xml;base64,${maskBase64}`;
        }

        return await sendImagesToNativeHost(originalImageData, maskImageData, instructions, metadata);
    } catch (error) {
        console.log(`❌ 读取图片文件时出错: ${error.message}`);
        return { success: false, error: `读取图片文件时出错: ${error.message}` };
    }
}

/**
 * 创建模拟图片数据
 * @returns {string} base64编码的模拟图片数据
 */
function createSampleImageAsBase64() {
    // 创建一个简单的SVG图片作为模拟数据
    const svgData = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f0f0f0"/>
            <circle cx="200" cy="150" r="80" fill="#4CAF50"/>
            <text x="200" y="155" text-anchor="middle" font-family="Arial" font-size="24" fill="white">
                Sample Image
            </text>
            <text x="200" y="185" text-anchor="middle" font-family="Arial" font-size="16" fill="white">
                From External App
            </text>
        </svg>
    `;

    const svgBase64 = btoa(svgData);
    return `data:image/svg+xml;base64,${svgBase64}`;
}

/**
 * 创建模拟蒙版图片数据
 * @returns {string} base64编码的模拟蒙版图片数据
 */
function createMaskImageAsBase64() {
    // 创建一个简单的蒙版SVG图片作为模拟数据
    const maskSvgData = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#000000"/>
            <circle cx="200" cy="150" r="80" fill="#FFFFFF"/>
            <text x="200" y="155" text-anchor="middle" font-family="Arial" font-size="24" fill="#000000">
                Mask Image
            </text>
            <text x="200" y="185" text-anchor="middle" font-family="Arial" font-size="16" fill="#000000">
                From External App
            </text>
        </svg>
    `;

    const maskBase64 = btoa(maskSvgData);
    return `data:image/svg+xml;base64,${maskBase64}`;
}

/**
 * 检查Native Host健康状态
 * @returns {Promise<Object>} 健康检查结果
 */
async function checkNativeHostHealth() {
    try {
        const response = await fetch(`${NATIVE_HOST_URL}/api/health`);
        if (response.ok) {
            const healthData = await response.json();
            console.log('✅ Native Host HTTP服务器运行正常');
            console.log('健康信息:', healthData);
            return { success: true, data: healthData };
        } else {
            console.log(`⚠️  Native Host HTTP服务器返回状态: ${response.status}`);
            return { success: false, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log('❌ 无法连接到Native Host HTTP服务器，请确保Native Host正在运行');
            return { success: false, error: '连接失败: 无法连接到Native Host，请确保Native Host正在运行' };
        } else {
            console.log(`⚠️  检查Native Host状态时出错: ${error.message}`);
            return { success: false, error: `检查时出错: ${error.message}` };
        }
    }
}

/**
 * 获取存储在Native Host中的图片数据
 * @param {string} source - 数据源 ('chrome_extension' 或 'external_application')
 * @returns {Promise<Object>} 图片数据
 */
async function getStoredImageData(source = null) {
    try {
        // 构建URL，可选指定数据源
        let url = `${NATIVE_HOST_URL}/api/img`;
        if (source) {
            url += `?source=${source}`;
        }

        const response = await fetch(url);
        if (response.ok) {
            const imageData = await response.json();
            console.log('✅ 成功获取图片数据');
            console.log('图片数据:', imageData);
            return { success: true, data: imageData };
        } else {
            const errorText = await response.text();
            console.log(`❌ 获取图片数据失败: HTTP ${response.status}`);
            console.log(`响应内容: ${errorText}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log('❌ 连接失败: 无法连接到Native Host');
            return { success: false, error: '连接失败: 无法连接到Native Host' };
        } else {
            console.log(`❌ 获取图片数据时出错: ${error.message}`);
            return { success: false, error: `获取时出错: ${error.message}` };
        }
    }
}

/**
 * 主函数 - 演示示例用法
 */
async function main() {
    console.log('=== 使用JavaScript模拟外部程序发送图片到Native Host ===');
    console.log(`Native Host地址: ${NATIVE_HOST_URL}`);
    console.log();

    // 1. 检查Native Host健康状态
    console.log('正在检查Native Host状态...');
    const healthResult = await checkNativeHostHealth();
    console.log();

    if (!healthResult.success) {
        console.log('无法连接到Native Host，退出程序');
        return;
    }

    // 2. 发送模拟图片数据
    console.log('正在创建模拟图片数据...');
    const originalImage = createSampleImageAsBase64();
    const maskImage = createMaskImageAsBase64();

    console.log('正在发送模拟图片数据到Native Host...');
    const sendResult = await sendImagesToNativeHost(
        originalImage,
        maskImage,
        '来自JavaScript外部应用程序的图片数据',
        { custom_field: 'custom_value' }
    );

    if (sendResult.success) {
        console.log('\n🎉 模拟发送完成!');
    } else {
        console.log('\n💥 模拟发送失败!');
        console.log('错误信息:', sendResult.error);
    }

    console.log();

    // 3. 获取存储的图片数据
    console.log('正在获取存储在Native Host中的图片数据...');
    const getResult = await getStoredImageData('external_application');

    if (getResult.success) {
        console.log('\n🎉 成功获取图片数据!');
    } else {
        console.log('\n💥 获取图片数据失败!');
        console.log('错误信息:', getResult.error);
    }
}

// 如果在浏览器环境中运行，可以调用main函数
// main();

// Node.js环境下的使用示例 (需要安装node-fetch)
/*
const fetch = require('node-fetch');
global.fetch = fetch;
global.File = class {};
global.Blob = class {};
global.FileReader = class {
    readAsDataURL() {
        // 模拟实现
        setTimeout(() => {
            this.onload({ target: { result: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' } });
        }, 100);
    }
};

main();
*/

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendImagesToNativeHost,
        sendImageFileToNativeHost,
        checkNativeHostHealth,
        getStoredImageData,
        createSampleImageAsBase64,
        createMaskImageAsBase64
    };
}