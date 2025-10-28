// 数据看板侧边栏 - 与 appen-data-collector.js 配合使用
// 显示统计报表、趋势图表、数据表等

(function() {
    'use strict';

    const DashboardSidebar = {
        // 配置
        config: {
            width: {
                wide: '360px',    // 宽屏
                medium: '300px',  // 中屏
                mobile: '100%'    // 小屏
            },
            breakpoints: {
                medium: 800,
                mobile: 600
            },
            animationDuration: '0.3s',
            zIndex: 99900
        },

        // 状态
        state: {
            isOpen: false,
            currentTimeRange: 'day', // day, week, month, range
            selectedDate: null
        },

        // 初始化
        init: function() {
            console.log('[Dashboard Sidebar] 初始化侧边栏看板');
            this.injectStyles();
            this.createSidebar();
            this.attachEventListeners();
            this.listenForCacheUpdates();
        },

        // 注入样式
        injectStyles: function() {
            if (document.querySelector('style[data-dashboard-styles]')) {
                return; // 样式已注入
            }

            const style = document.createElement('style');
            style.setAttribute('data-dashboard-styles', 'true');
            style.textContent = `
                /* 侧边栏容器 */
                .dashboard-sidebar {
                    position: fixed;
                    right: -360px;
                    top: 0;
                    width: 360px;
                    height: 100vh;
                    background: white;
                    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.15);
                    z-index: ${this.config.zIndex};
                    overflow-y: auto;
                    transition: right ${this.config.animationDuration} ease-out;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    border-left: 1px solid #e0e0e0;
                }

                .dashboard-sidebar.open {
                    right: 0;
                }

                /* 侧边栏遮罩 */
                .dashboard-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    z-index: ${this.config.zIndex - 1};
                    opacity: 0;
                    transition: opacity ${this.config.animationDuration} ease-out;
                    pointer-events: none;
                }

                .dashboard-overlay.open {
                    opacity: 1;
                    pointer-events: auto;
                }

                /* 侧边栏头部 */
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f9fa;
                    flex-shrink: 0;
                }

                .dashboard-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #333;
                    font-weight: 600;
                }

                .dashboard-header-actions {
                    display: flex;
                    gap: 10px;
                }

                .dashboard-btn {
                    background: none;
                    border: none;
                    padding: 5px 10px;
                    cursor: pointer;
                    color: #666;
                    font-size: 18px;
                    transition: color 0.2s;
                    border-radius: 4px;
                }

                .dashboard-btn:hover {
                    color: #333;
                    background: rgba(0, 0, 0, 0.05);
                }

                /* 时间范围选择器 */
                .time-range-selector {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    padding: 15px 20px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .time-btn {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                    color: #666;
                }

                .time-btn:hover {
                    border-color: #2196F3;
                    background: #f0f7ff;
                }

                .time-btn.active {
                    background: #2196F3;
                    color: white;
                    border-color: #2196F3;
                }

                /* 统计卡片 */
                .stats-cards {
                    padding: 15px 20px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .stat-card {
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 12px;
                    text-align: center;
                }

                .stat-card-label {
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 6px;
                }

                .stat-card-value {
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                }

                .stat-card-change {
                    font-size: 11px;
                    color: #999;
                    margin-top: 4px;
                }

                .stat-card-change.positive {
                    color: #4CAF50;
                }

                .stat-card-change.negative {
                    color: #f44336;
                }

                /* 内容区 */
                .dashboard-content {
                    padding: 15px 20px;
                    flex: 1;
                    overflow-y: auto;
                }

                .dashboard-section {
                    margin-bottom: 20px;
                }

                .dashboard-section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e0e0e0;
                }

                /* 数据表 */
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                .data-table th {
                    background: #f8f9fa;
                    padding: 8px;
                    text-align: left;
                    color: #666;
                    font-weight: 600;
                    border-bottom: 1px solid #ddd;
                }

                .data-table td {
                    padding: 8px;
                    border-bottom: 1px solid #f0f0f0;
                }

                .data-table tr:hover {
                    background: #f8f9fa;
                }

                /* 加载状态 */
                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    color: #999;
                }

                .loading::after {
                    content: '';
                    width: 16px;
                    height: 16px;
                    margin-left: 8px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #2196F3;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* 响应式设计 */
                @media (max-width: 800px) {
                    .dashboard-sidebar {
                        width: 300px;
                        right: -300px;
                    }

                    .stats-cards {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 600px) {
                    .dashboard-sidebar {
                        width: 100%;
                        right: -100%;
                    }

                    .time-range-selector {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                /* 页脚 */
                .dashboard-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                    flex-shrink: 0;
                    flex-wrap: wrap;
                }

                .dashboard-footer-btn {
                    flex: 1;
                    min-width: 80px;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }

                .dashboard-footer-btn:hover {
                    border-color: #2196F3;
                    color: #2196F3;
                    background: #f0f7ff;
                }

                .dashboard-footer-btn.primary {
                    background: #2196F3;
                    color: white;
                    border-color: #2196F3;
                }

                .dashboard-footer-btn.primary:hover {
                    background: #1976D2;
                    border-color: #1976D2;
                }
            `;
            document.head.appendChild(style);
        },

        // 创建侧边栏 DOM
        createSidebar: function() {
            // 创建遮罩
            const overlay = document.createElement('div');
            overlay.className = 'dashboard-overlay';
            overlay.id = 'dashboard-overlay';
            overlay.addEventListener('click', () => this.close());

            // 创建侧边栏容器
            const sidebar = document.createElement('div');
            sidebar.className = 'dashboard-sidebar';
            sidebar.id = 'dashboard-sidebar';

            // 构建侧边栏内容
            sidebar.innerHTML = `
                <!-- 头部 -->
                <div class="dashboard-header">
                    <h3>📊 统计看板</h3>
                    <div class="dashboard-header-actions">
                        <button class="dashboard-btn" id="dashboard-refresh" title="刷新数据">🔄</button>
                        <button class="dashboard-btn" id="dashboard-close" title="关闭看板">✕</button>
                    </div>
                </div>

                <!-- 时间范围选择 -->
                <div class="time-range-selector">
                    <button class="time-btn active" data-range="day">今天</button>
                    <button class="time-btn" data-range="week">本周</button>
                    <button class="time-btn" data-range="month">本月</button>
                    <button class="time-btn" data-range="range">自定义</button>
                </div>

                <!-- 统计卡片 -->
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-card-label">总标注数</div>
                        <div class="stat-card-value" id="stat-total">0</div>
                        <div class="stat-card-change" id="stat-total-change"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">有效率</div>
                        <div class="stat-card-value" id="stat-valid">0%</div>
                        <div class="stat-card-change" id="stat-valid-change"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">无效数</div>
                        <div class="stat-card-value" id="stat-invalid">0</div>
                        <div class="stat-card-change" id="stat-invalid-change"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">平均耗时</div>
                        <div class="stat-card-value" id="stat-time">0s</div>
                        <div class="stat-card-change" id="stat-time-change"></div>
                    </div>
                </div>

                <!-- 内容区 -->
                <div class="dashboard-content">
                    <div class="dashboard-section">
                        <div class="dashboard-section-title">📈 趋势数据</div>
                        <div id="dashboard-chart-placeholder" class="loading">加载中...</div>
                    </div>

                    <div class="dashboard-section">
                        <div class="dashboard-section-title">📋 详细数据</div>
                        <div id="dashboard-table-placeholder" class="loading">暂无数据</div>
                    </div>
                </div>

                <!-- 页脚 -->
                <div class="dashboard-footer">
                    <button class="dashboard-footer-btn" id="dashboard-export">导出 CSV</button>
                    <button class="dashboard-footer-btn primary" id="dashboard-more">更多</button>
                </div>
            `;

            document.body.appendChild(overlay);
            document.body.appendChild(sidebar);

            // 绑定事件
            document.getElementById('dashboard-close').addEventListener('click', () => this.close());
            document.getElementById('dashboard-refresh').addEventListener('click', () => this.refresh());
            document.getElementById('dashboard-export').addEventListener('click', () => this.exportData());

            // 时间范围选择
            sidebar.querySelectorAll('.time-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.selectTimeRange(e.target.dataset.range));
            });

            console.log('[Dashboard Sidebar] 侧边栏创建完成');
        },

        // 绑定事件监听
        attachEventListeners: function() {
            // 监听缓存刷新事件
            window.addEventListener('statsDataRefreshed', (event) => {
                console.log('[Dashboard Sidebar] 检测到缓存刷新事件:', event.detail);
                this.refresh();
            });

            // 监听快捷键 (Ctrl+Shift+D 打开/关闭看板)
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        },

        // 监听缓存更新
        listenForCacheUpdates: function() {
            // 当有 statsDataRefreshed 事件时，刷新看板数据
            window.addEventListener('statsDataRefreshed', () => {
                if (this.state.isOpen) {
                    this.loadData();
                }
            });
        },

        // 打开侧边栏
        open: function() {
            if (this.state.isOpen) return;

            const sidebar = document.getElementById('dashboard-sidebar');
            const overlay = document.getElementById('dashboard-overlay');

            sidebar.classList.add('open');
            overlay.classList.add('open');
            this.state.isOpen = true;

            // 加载数据
            this.loadData();

            console.log('[Dashboard Sidebar] 侧边栏已打开');
        },

        // 关闭侧边栏
        close: function() {
            if (!this.state.isOpen) return;

            const sidebar = document.getElementById('dashboard-sidebar');
            const overlay = document.getElementById('dashboard-overlay');

            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            this.state.isOpen = false;

            console.log('[Dashboard Sidebar] 侧边栏已关闭');
        },

        // 切换侧边栏
        toggle: function() {
            this.state.isOpen ? this.close() : this.open();
        },

        // 选择时间范围
        selectTimeRange: function(range) {
            this.state.currentTimeRange = range;

            // 更新按钮状态
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.range === range) {
                    btn.classList.add('active');
                }
            });

            // 如果是自定义范围，打开日期选择器（未来实现）
            if (range === 'range') {
                console.log('[Dashboard Sidebar] 自定义范围选择（待实现）');
            }

            // 重新加载数据
            this.loadData();
        },

        // 加载数据
        loadData: async function() {
            console.log('[Dashboard Sidebar] 正在加载数据，时间范围:', this.state.currentTimeRange);

            // 显示加载状态
            const chartPlaceholder = document.getElementById('dashboard-chart-placeholder');
            const tablePlaceholder = document.getElementById('dashboard-table-placeholder');

            if (chartPlaceholder) chartPlaceholder.innerHTML = '<div class="loading">加载中...</div>';
            if (tablePlaceholder) tablePlaceholder.innerHTML = '<div class="loading">加载中...</div>';

            // 调用 updateStats 和其他更新方法
            await this.updateStats();
            this.updateChart();
            this.updateTable();
        },

        // 更新统计卡片
        updateStats: async function() {
            try {
                if (typeof window.DataService === 'undefined') {
                    console.warn('[Dashboard Sidebar] 数据服务未加载');
                    return;
                }

                let reportData = null;
                let previousReportData = null;

                // 根据时间范围获取数据
                switch (this.state.currentTimeRange) {
                    case 'day':
                        reportData = await window.DataService.getTodayReport();
                        // 获取昨天的数据用于对比
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        previousReportData = await window.DataService.getDayReport(
                            window.DataService.formatDate(yesterday)
                        );
                        break;
                    case 'week':
                        reportData = await window.DataService.getCurrentWeekReport();
                        // 获取上周的数据用于对比
                        const lastWeekDate = new Date();
                        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
                        previousReportData = await window.DataService.getCurrentWeekReport();
                        break;
                    case 'month':
                        reportData = await window.DataService.getCurrentMonthReport();
                        // 获取上月的数据用于对比
                        const lastMonth = new Date();
                        lastMonth.setMonth(lastMonth.getMonth() - 1);
                        const lastMonthStr = window.DataService.formatYearMonth(lastMonth);
                        previousReportData = await window.DataService.getMonthReport(lastMonthStr);
                        break;
                    default:
                        reportData = await window.DataService.getTodayReport();
                }

                if (!reportData || !reportData.statistics) {
                    console.warn('[Dashboard Sidebar] 无法获取报表数据');
                    return;
                }

                // 提取统计数据
                const stats = reportData.statistics || {};
                const previousStats = (previousReportData && previousReportData.statistics) ? previousReportData.statistics : {};

                // 计算对比增长率
                const totalChange = this.calculateChange(stats.totalRecords, previousStats.totalRecords);
                const validChange = this.calculateChange(
                    (stats.validRate || 0) * 100,
                    (previousStats.validRate || 0) * 100
                );
                const invalidChange = this.calculateChange(stats.invalidRecords, previousStats.invalidRecords);
                const timeChange = this.calculateChange(stats.averageElapsedTime, previousStats.averageElapsedTime);

                // 更新 DOM
                document.getElementById('stat-total').textContent = stats.totalRecords || 0;
                document.getElementById('stat-valid').textContent = ((stats.validRate || 0) * 100).toFixed(2) + '%';
                document.getElementById('stat-invalid').textContent = stats.invalidRecords || 0;
                document.getElementById('stat-time').textContent = Math.round(stats.averageElapsedTime || 0) + 's';

                // 更新对比信息
                const setChangeElement = (elementId, change, isPositiveGood = true) => {
                    const element = document.getElementById(elementId);
                    if (element) {
                        element.textContent = change;
                        element.className = 'stat-card-change';
                        
                        // 判断是否为正增长
                        const isPositive = change.includes('+');
                        const isNegative = change.includes('-') && !change.startsWith('-') === false;
                        
                        if (isPositiveGood && isPositive) {
                            element.classList.add('positive');
                        } else if (!isPositiveGood && isNegative) {
                            element.classList.add('positive'); // 负增长是好的（如无效数减少）
                        } else if (isNegative || (isPositiveGood && !isPositive)) {
                            element.classList.add('negative');
                        }
                    }
                };

                setChangeElement('stat-total-change', totalChange, true);     // 总数越多越好
                setChangeElement('stat-valid-change', validChange, true);      // 有效率越高越好
                setChangeElement('stat-invalid-change', invalidChange, false); // 无效数越少越好
                setChangeElement('stat-time-change', timeChange, false);       // 耗时越少越好

                console.log('[Dashboard Sidebar] 统计卡片已更新:', stats);
            } catch (error) {
                console.error('[Dashboard Sidebar] 更新统计卡片失败:', error);
            }
        },

        // 更新图表（未来实现，需要集成 Chart.js 或 ECharts）
        updateChart: function() {
            const chartPlaceholder = document.getElementById('dashboard-chart-placeholder');
            if (chartPlaceholder) {
                chartPlaceholder.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #999;">
                        📈 图表功能（待实现）
                    </div>
                `;
            }
        },

        // 计算增长率
        calculateChange: function(current, previous) {
            if (previous === 0 || previous === undefined || previous === null) {
                return current > 0 ? '+' + current.toFixed(0) : '0';
            }
            const change = current - previous;
            const changePercent = (change / previous * 100).toFixed(0);
            const sign = change >= 0 ? '+' : '';
            return sign + changePercent + '%';
        },

        // 更新数据表
        updateTable: function() {
            const tablePlaceholder = document.getElementById('dashboard-table-placeholder');
            if (tablePlaceholder) {
                const mockTableData = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>完成数</th>
                                <th>有效率</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>2024-10-28</td>
                                <td>45</td>
                                <td>88.89%</td>
                            </tr>
                            <tr>
                                <td>2024-10-27</td>
                                <td>52</td>
                                <td>88.46%</td>
                            </tr>
                            <tr>
                                <td>2024-10-26</td>
                                <td>48</td>
                                <td>89.58%</td>
                            </tr>
                        </tbody>
                    </table>
                `;
                tablePlaceholder.innerHTML = mockTableData;
            }
        },

        // 刷新数据
        refresh: function() {
            console.log('[Dashboard Sidebar] 手动刷新数据');
            this.loadData();
        },

        // 导出数据
        exportData: function() {
            console.log('[Dashboard Sidebar] 导出数据为 CSV');
            // 待实现：生成 CSV 并下载

            alert('导出功能待实现');
        }
    };

    // 导出到全局作用域，以便在其他脚本中使用
    window.DashboardSidebar = DashboardSidebar;

    // 当页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            DashboardSidebar.init();
        });
    } else {
        DashboardSidebar.init();
    }
})();
