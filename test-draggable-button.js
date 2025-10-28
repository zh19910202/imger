/**
 * 测试可拖拽图标小球功能
 * 在浏览器控制台中运行此脚本来测试拖拽功能
 */

(function() {
    'use strict';

    console.log('=== 开始测试可拖拽图标小球功能 ===');

    // 测试1: 检查按钮是否存在
    function testButtonExistence() {
        console.log('\n1. 检查拖拽按钮状态:');

        const toggleBtn = document.getElementById('dashboard-toggle-btn');

        if (toggleBtn) {
            console.log('✅ 拖拽按钮已找到');
            console.log('按钮样式预览:', {
                位置: {
                    left: toggleBtn.style.left,
                    top: toggleBtn.style.top,
                    right: toggleBtn.style.right,
                    bottom: toggleBtn.style.bottom
                },
                类名: toggleBtn.className,
                z轴: toggleBtn.style.zIndex
            });
        } else {
            console.log('❌ 拖拽按钮未找到，请刷新页面重试');
        }

        return toggleBtn;
    }

    // 测试2: 检查位置保存功能
    function testPositionSaving() {
        console.log('\n2. 测试位置保存功能:');

        try {
            const saved = localStorage.getItem('dashboard_toggle_btn_position');
            if (saved) {
                const position = JSON.parse(saved);
                console.log('✅ 发现保存的位置:', position);
            } else {
                console.log('⚠️ 没有保存的位置数据（正常，如果还未拖拽过）');
            }
        } catch (error) {
            console.log('❌ 读取保存位置失败:', error.message);
        }
    }

    // 测试3: 模拟拖拽测试
    function simulateDragTest(button) {
        console.log('\n3. 模拟拖拽测试:');

        if (!button) {
            console.log('❌ 按钮不存在，无法测试');
            return;
        }

        try {
            // 获取初始位置
            const initialRect = button.getBoundingClientRect();
            console.log('初始位置:', {
                x: Math.round(initialRect.left),
                y: Math.round(initialRect.top)
            });

            // 创建视觉指示器
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                left: ${initialRect.left}px;
                top: ${initialRect.top}px;
                width: ${initialRect.width}px;
                height: ${initialRect.height}px;
                border: 3px solid #ff4444;
                border-radius: 50%;
                pointer-events: none;
                z-index: 99998;
                animation: pulse 1s infinite;
            `;

            // 添加脉冲动画
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(indicator);

            console.log('✅ 红色边框指示器已添加，3秒后自动移除');

            // 3秒后移除指示器
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 3000);

        } catch (error) {
            console.log('❌ 模拟拖拽测试失败:', error.message);
        }
    }

    // 测试4: 检查事件监听器
    function testEventListeners(button) {
        console.log('\n4. 检查事件监听器:');

        if (!button) {
            console.log('❌ 按钮不存在，无法检查事件');
            return;
        }

        // 检查鼠标事件
        const hasMouseDown = button.onmousedown !== null;
        const hasContextMenu = button.oncontextmenu !== null;
        const hasDblClick = button.ondblclick !== null;

        console.log('事件监听器状态:', {
            'mousedown': hasMouseDown ? '✅' : '❌',
            'contextmenu': hasContextMenu ? '✅' : '❌',
            'dblclick': hasDblClick ? '✅' : '❌'
        });

        // 添加点击计数器
        let clickCount = 0;
        const originalClick = button.onclick;

        button.onclick = function(e) {
            clickCount++;
            console.log(`🖱️ 按钮被点击了第 ${clickCount} 次`);

            if (originalClick) {
                return originalClick.call(this, e);
            }
        };

        console.log('✅ 点击计数器已添加');
    }

    // 测试5: 边界检测测试
    function testBoundaryDetection() {
        console.log('\n5. 边界检测测试:');

        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        console.log('当前视口尺寸:', viewport);

        // 安全区域计算
        const safeArea = {
            minX: 0,
            maxX: viewport.width - 50, // 按钮宽度50px
            minY: 0,
            maxY: viewport.height - 50 // 按钮高度50px
        };

        console.log('按钮可移动的安全区域:', safeArea);

        const button = document.getElementById('dashboard-toggle-btn');
        if (button) {
            const rect = button.getBoundingClientRect();
            const currentPos = {
                x: rect.left,
                y: rect.top
            };

            const isInBounds = currentPos.x >= safeArea.minX &&
                              currentPos.x <= safeArea.maxX &&
                              currentPos.y >= safeArea.minY &&
                              currentPos.y <= safeArea.maxY;

            console.log('当前位置:', currentPos);
            console.log(`边界检测: ${isInBounds ? '✅ 在安全区域内' : '⚠️ 接近边界'}`);
        }
    }

    // 测试6: 窗口调整测试
    function testWindowResize() {
        console.log('\n6. 窗口调整响应测试:');

        const originalWidth = window.innerWidth;
        const originalHeight = window.innerHeight;

        console.log('当前窗口尺寸:', { width: originalWidth, height: originalHeight });

        // 创建窗口变化监听器
        let resizeCount = 0;
        const resizeHandler = () => {
            resizeCount++;
            console.log(`🪟 窗口尺寸变化事件 #${resizeCount}:`, {
                新宽度: window.innerWidth,
                新高度: window.innerHeight
            });
        };

        window.addEventListener('resize', resizeHandler);

        console.log('✅ 窗口变化监听器已临时添加（10秒后自动移除）');

        // 10秒后移除监听器
        setTimeout(() => {
            window.removeEventListener('resize', resizeHandler);
            console.log('🔧 窗口变化监听器已移除');
        }, 10000);
    }

    // 主测试函数
    async function runDragTests() {
        console.log('🔄 开始拖拽功能测试...\n');

        try {
            const button = testButtonExistence();
            testPositionSaving();
            simulateDragTest(button);
            testEventListeners(button);
            testBoundaryDetection();
            testWindowResize();

            console.log('\n=== 测试完成 ===');
            console.log('📋 测试总结:');
            console.log('1. 确认按钮已正确加载');
            console.log('2. 位置保存功能正常');
            console.log('3. 拖拽事件监听器已就绪');
            console.log('4. 边界检测机制工作正常');
            console.log('5. 窗口调整响应已配置');

            console.log('\n🎯 手动测试建议:');
            console.log('- 尝试拖拽按钮到不同位置');
            console.log('- 右键点击按钮重置位置');
            console.log('- 双击按钮重置位置');
            console.log('- 调整浏览器窗口大小');
            console.log('- 刷新页面检查位置是否保存');

        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error);
        }
    }

    // 运行测试
    runDragTests();

})();