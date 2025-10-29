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
            selectedDate: null,
            customStartDate: null,
            customEndDate: null
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

        // 更新图表
        updateChart: async function() {
            const chartPlaceholder = document.getElementById('dashboard-chart-placeholder');
            if (!chartPlaceholder) return;

            try {
                // 确保 Chart.js 已加载
                await this.loadChartJS();

                // 获取图表数据
                let chartData = await this.getChartData();
                
                if (!chartData || chartData.labels.length === 0) {
                    chartPlaceholder.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无图表数据</div>';
                    return;
                }

                // 创建或更新图表
                this.renderChart(chartPlaceholder, chartData);

            } catch (error) {
                console.error('[Dashboard Sidebar] 更新图表失败:', error);
                chartPlaceholder.innerHTML = '<div style="text-align: center; padding: 20px; color: #f44336;">图表加载失败</div>';
            }
        },

        // 加载 Chart.js 库
        loadChartJS: async function() {
            // Chart.js 现在作为 content script 预加载，只需要检查是否可用
            console.log('[Dashboard Sidebar] 检查 Chart.js 可用性...');
            console.log('[Dashboard Sidebar] window.Chart 类型:', typeof window.Chart);

            if (typeof window.Chart !== 'undefined') {
                console.log('[Dashboard Sidebar] Chart.js 已可用');
                return;
            }

            // 如果主window中没有，尝试从页面上下文获取
            try {
                const chartFromPage = document.defaultView.Chart;
                if (chartFromPage) {
                    window.Chart = chartFromPage;
                    console.log('[Dashboard Sidebar] 从页面上下文获取 Chart 成功');
                    return;
                }
            } catch (e) {
                console.log('[Dashboard Sidebar] 无法从页面上下文获取 Chart:', e);
            }

            // 等待一小段时间，以防Chart.js还在初始化
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50; // 最多等待5秒

                const checkInterval = setInterval(() => {
                    attempts++;

                    if (typeof window.Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        console.log('[Dashboard Sidebar] Chart.js 加载成功');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.error('[Dashboard Sidebar] Chart.js 加载超时');
                        reject(new Error('Chart.js 加载失败: 请确保扩展已正确重新加载'));
                    }
                }, 100);
            });
        },

        // 获取图表数据
        getChartData: async function() {
            if (typeof window.DataService === 'undefined') {
                return null;
            }

            let labels = [];
            let totalRecordsData = [];
            let validRateData = [];

            try {
                // 根据时间范围获取不同维度的数据
                switch (this.state.currentTimeRange) {
                    case 'day': {
                        // 最近7天
                        const daysData = await this.getRecentDaysData(7);
                        daysData.reverse(); // 从旧到新排序
                        labels = daysData.map(d => d.label.substring(5)); // 只显示 MM-DD
                        totalRecordsData = daysData.map(d => d.totalRecords);
                        validRateData = daysData.map(d => parseFloat(d.validRate) || 0);
                        break;
                    }
                    case 'week': {
                        // 最近4周
                        const weeksData = await this.getRecentWeeksData(4);
                        weeksData.reverse();
                        labels = weeksData.map(d => d.label.length > 15 ? d.label.substring(5, 15) : d.label);
                        totalRecordsData = weeksData.map(d => d.totalRecords);
                        validRateData = weeksData.map(d => parseFloat(d.validRate) || 0);
                        break;
                    }
                    case 'month': {
                        // 最近6个月
                        const monthsData = await this.getRecentMonthsData(6);
                        monthsData.reverse();
                        labels = monthsData.map(d => d.label);
                        totalRecordsData = monthsData.map(d => d.totalRecords);
                        validRateData = monthsData.map(d => parseFloat(d.validRate) || 0);
                        break;
                    }
                    default: {
                        const daysData = await this.getRecentDaysData(7);
                        daysData.reverse();
                        labels = daysData.map(d => d.label.substring(5));
                        totalRecordsData = daysData.map(d => d.totalRecords);
                        validRateData = daysData.map(d => parseFloat(d.validRate) || 0);
                    }
                }

                return {
                    labels,
                    datasets: [
                        {
                            label: '完成数',
                            data: totalRecordsData,
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            yAxisID: 'y',
                            tension: 0.3
                        },
                        {
                            label: '有效率 (%)',
                            data: validRateData,
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            yAxisID: 'y1',
                            tension: 0.3
                        }
                    ]
                };

            } catch (error) {
                console.error('[Dashboard Sidebar] 获取图表数据失败:', error);
                return null;
            }
        },

        // 渲染图表
        renderChart: function(container, chartData) {
            // 清空容器并创建 canvas
            container.innerHTML = '<canvas id="dashboard-chart" style="max-height: 250px;"></canvas>';
            const canvas = document.getElementById('dashboard-chart');
            const ctx = canvas.getContext('2d');

            // 销毁旧图表实例
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            // 创建新图表
            this.chartInstance = new window.Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 11
                                },
                                boxWidth: 12
                            }
                        },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toFixed(2);
                                        if (context.datasetIndex === 1) {
                                            label += '%';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: false
                            },
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: '完成数',
                                font: {
                                    size: 11
                                }
                            },
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: '有效率 (%)',
                                font: {
                                    size: 11
                                }
                            },
                            ticks: {
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                drawOnChartArea: false,
                            },
                        },
                    }
                }
            });

            console.log('[Dashboard Sidebar] 图表渲染完成');
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
        updateTable: async function() {
            const tablePlaceholder = document.getElementById('dashboard-table-placeholder');
            if (!tablePlaceholder) return;

            if (typeof window.DataService === 'undefined') {
                tablePlaceholder.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">数据服务未加载</div>';
                return;
            }

            try {
                let tableData = [];

                // 根据时间范围获取不同维度的数据
                switch (this.state.currentTimeRange) {
                    case 'day':
                        // 获取最近7天的数据
                        tableData = await this.getRecentDaysData(7);
                        break;
                    case 'week':
                        // 获取最近4周的数据
                        tableData = await this.getRecentWeeksData(4);
                        break;
                    case 'month':
                        // 获取最近6个月的数据
                        tableData = await this.getRecentMonthsData(6);
                        break;
                    default:
                        tableData = await this.getRecentDaysData(7);
                }

                // 生成表格HTML
                if (tableData.length === 0) {
                    tablePlaceholder.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无历史数据</div>';
                    return;
                }

                const tableHTML = this.generateTableHTML(tableData);
                tablePlaceholder.innerHTML = tableHTML;

            } catch (error) {
                console.error('[Dashboard Sidebar] 更新数据表失败:', error);
                tablePlaceholder.innerHTML = '<div style="text-align: center; padding: 20px; color: #f44336;">加载失败</div>';
            }
        },

        // 获取最近N天的数据
        getRecentDaysData: async function(days) {
            const data = [];
            const today = new Date();

            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = window.DataService.formatDate(date);

                try {
                    const reportData = await window.DataService.getDayReport(dateStr);
                    if (reportData && reportData.statistics) {
                        const stats = reportData.statistics;
                        data.push({
                            label: dateStr,
                            totalRecords: stats.totalRecords || 0,
                            validRate: ((stats.validRate || 0) * 100).toFixed(2) + '%',
                            validRecords: stats.validRecords || 0,
                            invalidRecords: stats.invalidRecords || 0,
                            avgTime: Math.round(stats.averageElapsedTime || 0) + 's'
                        });
                    }
                } catch (error) {
                    console.warn(`[Dashboard Sidebar] 获取 ${dateStr} 数据失败:`, error);
                }
            }

            return data;
        },

        // 获取最近N周的数据
        getRecentWeeksData: async function(weeks) {
            const data = [];
            const today = new Date();

            for (let i = 0; i < weeks; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - (i * 7));

                try {
                    const reportData = await window.DataService.getCurrentWeekReport();
                    if (reportData && reportData.statistics) {
                        const stats = reportData.statistics;
                        const weekLabel = reportData.week || window.DataService.calculateWeekNumber(date);
                        const dateRange = reportData.startDate && reportData.endDate
                            ? `${reportData.startDate} ~ ${reportData.endDate}`
                            : weekLabel;

                        data.push({
                            label: dateRange,
                            totalRecords: stats.totalRecords || 0,
                            validRate: ((stats.validRate || 0) * 100).toFixed(2) + '%',
                            validRecords: stats.validRecords || 0,
                            invalidRecords: stats.invalidRecords || 0,
                            avgTime: Math.round(stats.averageElapsedTime || 0) + 's'
                        });
                    }
                } catch (error) {
                    console.warn(`[Dashboard Sidebar] 获取第 ${i + 1} 周数据失败:`, error);
                }
            }

            return data;
        },

        // 获取最近N个月的数据
        getRecentMonthsData: async function(months) {
            const data = [];
            const today = new Date();

            for (let i = 0; i < months; i++) {
                const date = new Date(today);
                date.setMonth(date.getMonth() - i);
                const monthStr = window.DataService.formatYearMonth(date);

                try {
                    const reportData = await window.DataService.getMonthReport(monthStr);
                    if (reportData && reportData.statistics) {
                        const stats = reportData.statistics;
                        data.push({
                            label: monthStr,
                            totalRecords: stats.totalRecords || 0,
                            validRate: ((stats.validRate || 0) * 100).toFixed(2) + '%',
                            validRecords: stats.validRecords || 0,
                            invalidRecords: stats.invalidRecords || 0,
                            avgTime: Math.round(stats.averageElapsedTime || 0) + 's'
                        });
                    }
                } catch (error) {
                    console.warn(`[Dashboard Sidebar] 获取 ${monthStr} 数据失败:`, error);
                }
            }

            return data;
        },

        // 生成表格HTML
        generateTableHTML: function(tableData) {
            const rows = tableData.map(item => `
                <tr>
                    <td>${item.label}</td>
                    <td>${item.totalRecords}</td>
                    <td>${item.validRate}</td>
                    <td>${item.avgTime}</td>
                </tr>
            `).join('');

            return `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>完成数</th>
                            <th>有效率</th>
                            <th>平均耗时</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        },

        // 刷新数据
        refresh: function() {
            console.log('[Dashboard Sidebar] 手动刷新数据');
            this.loadData();
        },

        // 导出数据
        exportData: async function() {
            console.log('[Dashboard Sidebar] 导出数据为 CSV');
            
            try {
                if (typeof window.DataService === 'undefined') {
                    alert('数据服务未加载，无法导出');
                    return;
                }

                // 获取当前视图的数据
                let exportData = [];
                let filename = '';

                switch (this.state.currentTimeRange) {
                    case 'day':
                        exportData = await this.getRecentDaysData(30); // 导出最近30天
                        filename = `标注统计_日报表_${this.formatDateForFilename(new Date())}.csv`;
                        break;
                    case 'week':
                        exportData = await this.getRecentWeeksData(12); // 导出最近12周
                        filename = `标注统计_周报表_${this.formatDateForFilename(new Date())}.csv`;
                        break;
                    case 'month':
                        exportData = await this.getRecentMonthsData(12); // 导出最近12个月
                        filename = `标注统计_月报表_${this.formatDateForFilename(new Date())}.csv`;
                        break;
                    default:
                        exportData = await this.getRecentDaysData(30);
                        filename = `标注统计_${this.formatDateForFilename(new Date())}.csv`;
                }

                if (exportData.length === 0) {
                    alert('暂无数据可导出');
                    return;
                }

                // 生成 CSV 内容
                const csvContent = this.generateCSV(exportData);

                // 下载 CSV 文件
                this.downloadCSV(csvContent, filename);

                console.log('[Dashboard Sidebar] CSV 导出成功:', filename);

            } catch (error) {
                console.error('[Dashboard Sidebar] 导出数据失败:', error);
                alert('导出失败，请稍后重试');
            }
        },

        // 生成 CSV 内容
        generateCSV: function(data) {
            // CSV 表头
            const headers = ['时间', '完成数', '有效记录数', '无效记录数', '有效率', '平均耗时'];
            const csvRows = [];

            // 添加 UTF-8 BOM，确保 Excel 正确识别中文
            csvRows.push('\uFEFF');

            // 添加表头
            csvRows.push(headers.join(','));

            // 添加数据行
            data.forEach(item => {
                const row = [
                    item.label,
                    item.totalRecords,
                    item.validRecords,
                    item.invalidRecords,
                    item.validRate,
                    item.avgTime
                ];
                csvRows.push(row.join(','));
            });

            return csvRows.join('\n');
        },

        // 下载 CSV 文件
        downloadCSV: function(content, filename) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (navigator.msSaveBlob) {
                // IE 10+
                navigator.msSaveBlob(blob, filename);
            } else {
                // 现代浏览器
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // 释放 URL 对象
                setTimeout(() => {
                    URL.revokeObjectURL(link.href);
                }, 100);
            }
        },

        // 格式化日期用于文件名
        formatDateForFilename: function(date) {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            return `${year}${month}${day}_${hour}${minute}`;
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
