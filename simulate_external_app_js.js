/**
 * 使用JavaScript模拟外部应用请求Native Host的接口示例
 *
 * 该示例演示了如何使用JavaScript通过HTTP请求与Native Host进行交互
 * Native Host运行在 localhost:8888 上，支持多种API端点
 *
 * 新的API端点设计：
 * /api/chrome-data: 用于存放和获取来自谷歌插件的数据
 *   POST /api/chrome-data: 谷歌插件调用此接口，用于发送【原图】和【标注图】
 *   GET /api/chrome-data: 外部应用调用此接口，用于获取【原图】和【标注图】
 *
 * /api/external-data: 用于存放和获取来自外部应用（如PS插件）的数据
 *   POST /api/external-data: 外部应用调用此接口，用于发送【修改图】和【蒙版图】
 *   GET /api/external-data: 谷歌插件调用此接口，用于获取【修改图】和【蒙版图】
 */

// Native Host配置
const NATIVE_HOST_URL = 'http://localhost:8888';

/**
 * 发送修改图和蒙版图数据到Native Host（外部应用使用）
 * @param {string} modifiedImageData - 修改图数据 (base64编码)
 * @param {string} maskImageData - 蒙版图数据 (base64编码)
 * @param {string} instructions - 图片说明
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 响应结果
 */
async function sendExternalImagesToNativeHost(modifiedImageData, maskImageData, instructions = '', metadata = {}) {
    try {
        // 准备要发送的数据
        const imageData = {
            modified_image: modifiedImageData,    // 修改图数据
            mask_image: maskImageData,            // 蒙版图数据
            instructions: instructions,
            format: 'base64',
            metadata: {
                source: 'external-application',
                format: 'base64',
                timestamp: Date.now() / 1000,
                application: 'javascript-simulator',
                ...metadata
            }
        };

        // 发送POST请求到Native Host的HTTP服务器（使用新的外部应用端点）
        const response = await fetch(`${NATIVE_HOST_URL}/api/external-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData)
        });

        console.log(`发送请求到: ${NATIVE_HOST_URL}/api/external-data`);
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
 * 发送图片文件到Native Host（外部应用使用新API）
 * @param {File|Blob} modifiedFile - 修改图文件对象
 * @param {File|Blob} maskFile - 蒙版文件对象
 * @param {string} instructions - 图片说明
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 响应结果
 */
async function sendExternalImageFileToNativeHost(modifiedFile, maskFile, instructions = '来自外部应用程序的图片文件', metadata = {}) {
    try {
        // 将图片文件转换为base64
        console.log('正在读取图片文件...');
        const modifiedImageData = await fileToBase64(modifiedFile);
        const maskImageData = await fileToBase64(maskFile);

        return await sendExternalImagesToNativeHost(modifiedImageData, maskImageData, instructions, metadata);
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
 * 获取Chrome扩展存储的原图和标注图数据（外部应用使用）
 * @returns {Promise<Object>} 图片数据
 */
async function getChromeDataFromNativeHost() {
    try {
        // 使用新的API端点获取Chrome扩展数据
        const response = await fetch(`${NATIVE_HOST_URL}/api/chrome-data`);

        if (response.ok) {
            const imageData = await response.json();
            console.log('✅ 成功获取Chrome扩展图片数据');
            console.log('图片数据:', imageData);
            return { success: true, data: imageData };
        } else {
            const errorText = await response.text();
            console.log(`❌ 获取Chrome扩展图片数据失败: HTTP ${response.status}`);
            console.log(`响应内容: ${errorText}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log('❌ 连接失败: 无法连接到Native Host');
            return { success: false, error: '连接失败: 无法连接到Native Host' };
        } else {
            console.log(`❌ 获取Chrome扩展图片数据时出错: ${error.message}`);
            return { success: false, error: `获取时出错: ${error.message}` };
        }
    }
}

/**
 * 主函数 - 演示外部应用使用新API的示例用法
 */
async function main() {
    console.log('=== 使用JavaScript模拟外部应用通过新API与Native Host交互 ===');
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

    // 2. 发送修改图和蒙版图数据到Native Host
    console.log('正在创建模拟图片数据...');
    const modifiedImage = createSampleImageAsBase64();
    const maskImage = createMaskImageAsBase64();

    console.log('正在发送修改图和蒙版图数据到Native Host...');
    const sendResult = await sendExternalImagesToNativeHost(
        modifiedImage,
        maskImage,
        '来自JavaScript外部应用程序的修改图和蒙版图数据',
        { custom_field: 'custom_value' }
    );

    if (sendResult.success) {
        console.log('\n🎉 修改图和蒙版图发送成功!');
    } else {
        console.log('\n💥 修改图和蒙版图发送失败!');
        console.log('错误信息:', sendResult.error);
    }

    console.log();

    // 3. 获取Chrome扩展存储的原图和标注图数据
    console.log('正在获取Chrome扩展存储的原图和标注图数据...');
    const getResult = await getChromeDataFromNativeHost();

    if (getResult.success) {
        console.log('\n🎉 成功获取Chrome扩展图片数据!');
        console.log('数据类型:', getResult.data.source_type);
        if (getResult.data.original_image) {
            console.log('  - 包含原图数据: ✓');
        }
        if (getResult.data.annotated_image) {
            console.log('  - 包含标注图数据: ✓');
        }
    } else {
        console.log('\n💥 获取Chrome扩展图片数据失败!');
        console.log('错误信息:', getResult.error);
    }
}

// 模拟发送原图和标注图到Native Host的示例
async function sendOriginalAndAnnotatedImages() {
    console.log('=== 模拟发送原图和标注图到Native Host ===');

    try {
        // 1. 检查Native Host健康状态
        console.log('正在检查Native Host状态...');
        const healthResult = await checkNativeHostHealth();
        console.log();

        if (!healthResult.success) {
            console.log('无法连接到Native Host，退出程序');
            return;
        }

        // 2. 创建原图数据 (模拟一张产品图片)
        console.log('正在创建原图数据...');
        const originalImageSvg = `
            <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f5f5f5"/>
                <rect x="50" y="50" width="400" height="300" fill="#ffffff" stroke="#ddd" stroke-width="2" rx="10"/>
                <circle cx="250" cy="200" r="80" fill="#4CAF50" opacity="0.7"/>
                <rect x="150" y="150" width="200" height="100" fill="#2196F3" opacity="0.8" rx="5"/>
                <text x="250" y="180" text-anchor="middle" font-family="Arial" font-size="20" fill="#333">
                    Product Image
                </text>
                <text x="250" y="210" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
                    Original Photo
                </text>
                <text x="250" y="240" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">
                    ${new Date().toLocaleString()}
                </text>
            </svg>
        `;
        const originalImageBase64 = btoa(originalImageSvg);
        const originalImageData = `data:image/svg+xml;base64,${originalImageBase64}`;

        // 3. 创建标注图数据 (模拟标注后的图片)
        console.log('正在创建标注图数据...');
        const annotatedImageSvg = `
            <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f5f5f5"/>
                <rect x="50" y="50" width="400" height="300" fill="#ffffff" stroke="#ddd" stroke-width="2" rx="10"/>
                <!-- 标注区域 -->
                <circle cx="250" cy="200" r="80" fill="#4CAF50" opacity="0.3" stroke="#4CAF50" stroke-width="3"/>
                <rect x="150" y="150" width="200" height="100" fill="#2196F3" opacity="0.4" rx="5" stroke="#2196F3" stroke-width="3"/>
                <!-- 标注标记 -->
                <circle cx="250" cy="200" r="5" fill="#ff0000"/>
                <text x="260" y="195" font-family="Arial" font-size="14" fill="#ff0000">A</text>
                <rect x="150" y="150" width="5" height="5" fill="#ff0000"/>
                <text x="160" y="155" font-family="Arial" font-size="14" fill="#ff0000">B</text>
                <!-- 说明文字 -->
                <text x="250" y="370" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">
                    Annotated Image with Markers
                </text>
            </svg>
        `;
        const annotatedImageBase64 = btoa(annotatedImageSvg);
        const annotatedImageData = `data:image/svg+xml;base64,${annotatedImageBase64}`;

        // 4. 发送图片数据到Native Host
        console.log('正在发送原图和标注图数据到Native Host...');
        const sendResult = await sendImagesToNativeHost(
            originalImageData,
            annotatedImageData,
            '产品图片标注数据 - 原图和标注图示例',
            {
                image_type: 'product_annotation',
                category: 'example',
                version: '1.0'
            }
        );

        if (sendResult.success) {
            console.log('\n🎉 原图和标注图发送成功!');
        } else {
            console.log('\n💥 原图和标注图发送失败!');
            console.log('错误信息:', sendResult.error);
        }

        console.log();

        // 5. 获取存储的图片数据进行验证
        console.log('正在获取存储在Native Host中的图片数据进行验证...');
        const getResult = await getStoredImageData('external_application');

        if (getResult.success) {
            console.log('\n🎉 成功获取图片数据!');
            console.log('获取到的图片数据包含:');
            if (getResult.data.modified_image) {
                console.log('  - 修改图数据: ✓');
            }
            if (getResult.data.mask_image) {
                console.log('  - 蒙版图数据: ✓');
            }
            console.log('  - 数据源类型:', getResult.data.source_type);
        } else {
            console.log('\n💥 获取图片数据失败!');
            console.log('错误信息:', getResult.error);
        }

        console.log('\n=== 模拟发送完成 ===');
    } catch (error) {
        console.log('❌ 执行过程中出错:', error.message);
    }
}

// 如果在浏览器环境中运行，可以调用main函数
// main();
// 或者调用新的示例函数
// sendOriginalAndAnnotatedImages();

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
// 或者调用新的示例函数
// sendOriginalAndAnnotatedImages();
*/

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendExternalImagesToNativeHost,
        sendExternalImageFileToNativeHost,
        checkNativeHostHealth,
        getChromeDataFromNativeHost,
        createSampleImageAsBase64,
        createMaskImageAsBase64,
        sendOriginalAndAnnotatedImages
    };
}