# 外部应用程序 JavaScript API 使用示例

本文档展示了如何使用JavaScript与Native Host进行交互，包括发送和请求数据的示例代码。

## API 端点说明

Native Host 提供以下API端点用于外部应用程序与Chrome扩展之间的数据交换：

### Chrome 数据端点 (`/api/chrome-data`)
- **POST**: Chrome扩展发送原图和修改要求
- **GET**: 外部应用程序获取原图和修改要求

### 外部应用程序数据端点 (`/api/external-data`)
- **POST**: 外部应用程序发送修改图和蒙版图
- **GET**: Chrome扩展获取修改图和蒙版图

## 示例代码

### 1. 发送数据到Native Host（外部应用程序使用）

```javascript
/**
 * 发送修改图和蒙版图数据到Native Host
 * @param {string} modifiedImageData - 修改图数据 (base64编码)
 * @param {string} maskImageData - 蒙版图数据 (base64编码)
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 响应结果
 */
async function sendExternalImagesToNativeHost(modifiedImageData, maskImageData, instructions = '', metadata = {}) {
    const NATIVE_HOST_URL = 'http://localhost:8888';

    try {
        // 准备要发送的数据
        const imageData = {
            modified_image: modifiedImageData,    // 修改图数据
            mask_image: maskImageData,            // 蒙版图数据
            format: 'base64',
            metadata: {
                source: 'external-application',
                format: 'base64',
                timestamp: Date.now() / 1000,
                application: 'your-app-name',
                ...metadata
            }
        };

        // 发送POST请求到Native Host的HTTP服务器
        const response = await fetch(`${NATIVE_HOST_URL}/api/external-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ 图片数据发送成功!');
            return { success: true, data: result };
        } else {
            const errorText = await response.text();
            console.log(`❌ 发送失败: HTTP ${response.status}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, error: '连接失败: 无法连接到Native Host，请确保Native Host正在运行' };
        } else {
            return { success: false, error: `发送过程中出错: ${error.message}` };
        }
    }
}
```

### 2. 从Native Host获取数据（外部应用程序使用）

```javascript
/**
 * 获取Chrome扩展存储的原图和标注图数据
 * @returns {Promise<Object>} 图片数据
 */
async function getChromeDataFromNativeHost() {
    const NATIVE_HOST_URL = 'http://localhost:8888';

    try {
        const response = await fetch(`${NATIVE_HOST_URL}/api/chrome-data`);

        if (response.ok) {
            const imageData = await response.json();
            console.log('✅ 成功获取Chrome扩展图片数据');
            return { success: true, data: imageData };
        } else {
            const errorText = await response.text();
            console.log(`❌ 获取Chrome扩展图片数据失败: HTTP ${response.status}`);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, error: '连接失败: 无法连接到Native Host' };
        } else {
            return { success: false, error: `获取时出错: ${error.message}` };
        }
    }
}
```

### 3. 健康检查

```javascript
/**
 * 检查Native Host健康状态
 * @returns {Promise<Object>} 健康检查结果
 */
async function checkNativeHostHealth() {
    const NATIVE_HOST_URL = 'http://localhost:8888';

    try {
        const response = await fetch(`${NATIVE_HOST_URL}/api/health`);
        if (response.ok) {
            const healthData = await response.json();
            console.log('✅ Native Host HTTP服务器运行正常');
            return { success: true, data: healthData };
        } else {
            return { success: false, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, error: '连接失败: 无法连接到Native Host，请确保Native Host正在运行' };
        } else {
            return { success: false, error: `检查时出错: ${error.message}` };
        }
    }
}
```

### 4. 完整使用示例

```javascript
/**
 * 主函数 - 演示外部应用程序使用示例
 */
async function main() {
    console.log('=== 使用JavaScript模拟外部应用程序与Native Host交互 ===');

    // 1. 检查Native Host健康状态
    console.log('正在检查Native Host状态...');
    const healthResult = await checkNativeHostHealth();

    if (!healthResult.success) {
        console.log('无法连接到Native Host，退出程序');
        return;
    }

    // 2. 获取Chrome扩展存储的原图和标注图数据
    console.log('正在获取Chrome扩展存储的原图和标注图数据...');
    const getResult = await getChromeDataFromNativeHost();

    if (getResult.success) {
        console.log('\n🎉 成功获取Chrome扩展图片数据!');
        console.log('数据类型:', getResult.data.source_type);
        if (getResult.data.original_image) {
            console.log('  - 包含原图数据: ✓');
        }
        if (getResult.data.instructions) {
            console.log('  - 包含修改要求: ✓');
        }

        // 处理获取到的原图和修改要求
        // 在这里可以进行PS处理等工作

        // 3. 发送处理后的图片回Native Host
        // 创建模拟修改图数据（实际应用中应该是处理过的图片）
        const modifiedImage = getResult.data.original_image; // 示例中直接使用原图
        const maskImage = getResult.data.original_image; // 示例中直接使用原图作为蒙版

        console.log('正在发送修改图和蒙版图数据到Native Host...');
        const sendResult = await sendExternalImagesToNativeHost(
            modifiedImage,
            maskImage,
            '处理后的图片数据',
            { processed_by: 'your-external-app', version: '1.0' }
        );

        if (sendResult.success) {
            console.log('\n🎉 修改图和蒙版图发送成功!');
        } else {
            console.log('\n💥 修改图和蒙版图发送失败!');
            console.log('错误信息:', sendResult.error);
        }
    } else {
        console.log('\n💥 获取Chrome扩展图片数据失败!');
        console.log('错误信息:', getResult.error);
    }
}

// 运行示例
// main();
```

### 5. Node.js 使用示例

如果在Node.js环境中使用，需要安装`node-fetch`：

```bash
npm install node-fetch
```

```javascript
// Node.js环境下的使用示例
const fetch = require('node-fetch');
global.fetch = fetch;

// 使用上述定义的函数
async function runInNode() {
    const result = await checkNativeHostHealth();
    console.log('健康检查结果:', result);

    if (result.success) {
        const data = await getChromeDataFromNativeHost();
        console.log('获取数据结果:', data);
    }
}

// runInNode();
```

## 使用说明

1. 确保Native Host正在运行（监听在localhost:8888）
2. 根据您的需求修改示例代码中的数据处理逻辑
3. 在浏览器或Node.js环境中运行代码
4. 检查控制台输出以确认数据传输是否成功

## 错误处理

示例代码包含了基本的错误处理：
- 网络连接错误
- HTTP状态码错误
- JSON解析错误
- 其他运行时异常

在实际应用中，您可能需要根据具体需求增强错误处理逻辑。