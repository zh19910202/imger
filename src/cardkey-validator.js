// 卡密验证器 - 用于向远程服务器发送设备指纹验证请求

class CardKeyValidator {
    constructor() {
        // 验证服务器地址
        this.validationEndpoint = 'http://124.222.206.147:1145/api/Cardkey/ValidateCardkeyByFigId';
        // 本地存储键名
        this.storageKey = 'cardkey_validation_result';
        // 缓存有效期（24小时）
        this.cacheExpiry = 24 * 60 * 60 * 1000;
    }

    // 验证卡密
    async validateCardKey(figId) {
        try {
            // 检查本地缓存
            const cachedResult = this.getCachedResult(figId);
            if (cachedResult && !this.isCacheExpired(cachedResult)) {
                console.log('使用缓存的验证结果:', cachedResult);
                return cachedResult.data;
            }

            // 构建验证URL
            const url = `${this.validationEndpoint}?figId=${encodeURIComponent(figId)}`;
            
            console.log('正在验证卡密:', figId);
            
            // 发送验证请求
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                // 设置超时
                signal: AbortSignal.timeout(10000) // 10秒超时
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const result = await response.json();
            console.log('卡密验证结果:', result);

            // 缓存结果
            this.cacheResult(figId, result);
            
            return result;
        } catch (error) {
            console.error('卡密验证失败:', error);
            
            // 如果是网络错误，检查是否有缓存的过期数据可以使用
            const cachedResult = this.getCachedResult(figId);
            if (cachedResult) {
                console.log('使用过期的缓存数据:', cachedResult);
                return {
                    ...cachedResult.data,
                    isFromCache: true,
                    cacheExpired: true
                };
            }
            
            // 返回错误信息
            return {
                KeyStatus: false,
                Message: `验证失败: ${error.message}`,
                error: true
            };
        }
    }

    // 获取缓存的结果
    getCachedResult(figId) {
        try {
            const cached = localStorage.getItem(`${this.storageKey}_${figId}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('读取缓存失败:', error);
            return null;
        }
    }

    // 缓存结果
    cacheResult(figId, data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                figId: figId
            };
            localStorage.setItem(`${this.storageKey}_${figId}`, JSON.stringify(cacheData));
        } catch (error) {
            console.error('缓存结果失败:', error);
        }
    }

    // 检查缓存是否过期
    isCacheExpired(cachedResult) {
        if (!cachedResult || !cachedResult.timestamp) {
            return true;
        }
        return (Date.now() - cachedResult.timestamp) > this.cacheExpiry;
    }

    // 清除缓存
    clearCache(figId = null) {
        try {
            if (figId) {
                localStorage.removeItem(`${this.storageKey}_${figId}`);
            } else {
                // 清除所有卡密验证缓存
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(this.storageKey)) {
                        localStorage.removeItem(key);
                    }
                });
            }
        } catch (error) {
            console.error('清除缓存失败:', error);
        }
    }
}

// 创建全局实例
const cardKeyValidator = new CardKeyValidator();

// 导出供其他模块使用
if (typeof window !== 'undefined') {
    window.CardKeyValidator = CardKeyValidator;
    window.cardKeyValidator = cardKeyValidator;
}

// 如果使用模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardKeyValidator, cardKeyValidator };
}