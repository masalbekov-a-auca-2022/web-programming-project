document.addEventListener('DOMContentLoaded', function() {
    const pathParts = window.location.pathname.split('/');
    const ticker = pathParts[pathParts.length - 1];

    let priceChart = null;

    const defaultPeriod = '3mo';

    const themeSwitch = document.getElementById('theme-switch');
    const currentDateElement = document.getElementById('current-date');
    const loadingElement = document.getElementById('loading');
    const contentElement = document.getElementById('content');

    function init() {
        setupTheme();
        updateCurrentDate();
        loadStockData();
        loadStockDetails();
        loadHistoricalData(defaultPeriod);
        setupEventListeners();
    }

    function setupEventListeners() {
        themeSwitch.addEventListener('change', function() {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('darkTheme', themeSwitch.checked);

            if (priceChart) {
                updateChartTheme();
            }
        });

        document.querySelectorAll('.time-button').forEach(button => {
            button.addEventListener('click', function() {
                const period = this.getAttribute('data-period');

                document.querySelectorAll('.time-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');

                loadHistoricalData(period);
            });
        });
    }


    function setupTheme() {
        const darkTheme = localStorage.getItem('darkTheme') === 'true';
        if (darkTheme) {
            document.body.classList.add('dark-theme');
            themeSwitch.checked = true;
        }
    }

    function updateChartTheme() {
        const isDarkTheme = document.body.classList.contains('dark-theme');
        const textColor = isDarkTheme ? '#E5E7EB' : '#2C3E50';
        const gridColor = isDarkTheme ? '#374151' : '#E5E7EB';

        priceChart.options.scales.x.grid.color = gridColor;
        priceChart.options.scales.x.ticks.color = textColor;
        priceChart.options.scales.y.grid.color = gridColor;
        priceChart.options.scales.y.ticks.color = textColor;

        priceChart.update();
    }

    function loadStockData() {
        fetch(`/get_stock_data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticker: ticker }),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showError(`Error: ${data.error}`);
                return;
            }

            updateStockData(data);
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Failed to fetch stock data: ${error.message}`);
        });
    }

    function loadStockDetails() {
        fetch(`/api/stock_details/${ticker}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showError(`Error: ${data.error}`);
                return;
            }

            updateCompanyDetails(data);

            loadingElement.classList.add('hidden');
            contentElement.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Failed to fetch company details: ${error.message}`);
        });
    }

    function loadHistoricalData(period) {
        if (priceChart) {
            priceChart.destroy();
        }

        const chartCanvas = document.getElementById('priceChart');
        const ctx = chartCanvas.getContext('2d');
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        ctx.font = '16px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Loading chart data...', chartCanvas.width / 2, chartCanvas.height / 2);

        fetch(`/api/historical_data/${ticker}?period=${period}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showError(`Error: ${data.error}`);
                return;
            }

            createChart(data);
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Failed to fetch historical data: ${error.message}`);
        });
    }

    function updateStockData(data) {
        document.getElementById('current-price').textContent = `$${data.currentPrice}`;

        const priceChangeElement = document.getElementById('price-change');
        const changeValue = data.change;
        const changePercent = data.changePercent;

        priceChangeElement.textContent = `${changeValue > 0 ? '+' : ''}${changeValue} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
        priceChangeElement.className = 'price-change ' + (changeValue >= 0 ? 'positive' : 'negative');

        document.getElementById('open-price').textContent = `$${data.openPrice}`;
        document.getElementById('high-price').textContent = `$${data.highPrice}`;
        document.getElementById('low-price').textContent = `$${data.lowPrice}`;
        document.getElementById('volume').textContent = formatNumber(data.volume);
        document.getElementById('company-name').textContent = `- ${data.companyName}`;
    }

    function updateCompanyDetails(data) {
        document.title = `${data.name} (${data.ticker}) Stock Details | StockTracker Pro`;

        document.getElementById('long-company-name').textContent = data.longName || data.name;
        document.getElementById('industry').textContent = data.industry;
        document.getElementById('sector').textContent = data.sector;

        const websiteElem = document.getElementById('website');
        if (data.website) {
            websiteElem.textContent = new URL(data.website).hostname;
            websiteElem.href = data.website;
        } else {
            websiteElem.textContent = 'Website not available';
            websiteElem.removeAttribute('href');
        }

        document.getElementById('description').textContent = data.description;

        const logoElement = document.getElementById('company-logo');
        if (data.logo) {
            logoElement.src = data.logo;
            logoElement.alt = `${data.name} logo`;
        } else {
            logoElement.style.display = 'none';
            const logoContainer = document.getElementById('company-logo-container');

            const letterDiv = document.createElement('div');
            letterDiv.className = 'company-letter';
            letterDiv.textContent = data.ticker.charAt(0);

            logoContainer.appendChild(letterDiv);
            logoContainer.style.backgroundColor = getRandomColor(data.ticker);
            logoContainer.style.color = '#FFFFFF';
            logoContainer.style.fontSize = '24px';
            logoContainer.style.fontWeight = 'bold';
            logoContainer.style.display = 'flex';
            logoContainer.style.alignItems = 'center';
            logoContainer.style.justifyContent = 'center';
        }

        document.getElementById('market-cap').textContent = formatCurrency(data.marketCap);
        document.getElementById('pe-ratio').textContent = data.peRatio;
        document.getElementById('forward-pe').textContent = data.forwardPE;
        document.getElementById('dividend-yield').textContent = typeof data.dividendYield === 'number' ?
            `${data.dividendYield.toFixed(2)}%` : data.dividendYield;

        document.getElementById('52-week-high').textContent = `$${data.fiftyTwoWeekHigh}`;
        document.getElementById('52-week-low').textContent = `$${data.fiftyTwoWeekLow}`;
        document.getElementById('avg-volume').textContent = formatNumber(data.averageVolume);
        document.getElementById('employees').textContent = typeof data.employees === 'number' ?
            formatNumber(data.employees) : data.employees;

        const address = [];
        if (data.address !== 'Not available') address.push(data.address);
        if (data.city !== 'Not available') address.push(data.city);
        if (data.country !== 'Not available') address.push(data.country);

        document.getElementById('headquarters').textContent =
            address.length > 0 ? address.join(', ') : 'Address not available';
    }

    function createChart(data) {
        const isDarkTheme = document.body.classList.contains('dark-theme');
        const textColor = isDarkTheme ? '#E5E7EB' : '#2C3E50';
        const gridColor = isDarkTheme ? '#374151' : '#E5E7EB';

        const ctx = document.getElementById('priceChart').getContext('2d');

        const datasets = [
            {
                label: 'Price',
                data: data.prices,
                borderColor: '#1ABC9C',
                backgroundColor: 'rgba(26, 188, 156, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#1ABC9C',
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBorderWidth: 2,
                pointHitRadius: 10,
            }
        ];

        if (data.sma20) {
            datasets.push({
                label: '20-day MA',
                data: data.sma20,
                borderColor: '#E74C3C',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
            });
        }

        if (data.sma50) {
            datasets.push({
                label: '50-day MA',
                data: data.sma50,
                borderColor: '#3498DB',
                borderWidth: 2,
                borderDash: [2, 2],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
            });
        }

        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += '$' + context.parsed.y.toFixed(2);
                                }
                                return label;
                            },
                            title: function(tooltipItems) {
                                const date = new Date(tooltipItems[0].label);
                                return date.toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    function getRandomColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            '#3498DB',
            '#2ECC71',
            '#9B59B6',
            '#E74C3C',
            '#F39C12',
            '#1ABC9C',
            '#E67E22',
            '#16A085',
            '#8E44AD',
            '#D35400',
            '#2980B9',
            '#27AE60'
        ];

        return colors[Math.abs(hash) % colors.length];
    }

    function showError(message) {
        loadingElement.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <a href="/" class="btn-primary">Back to Dashboard</a>
            </div>
        `;
    }

    function formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    function formatCurrency(num) {
        if (typeof num !== 'number') return 'N/A';

        if (num >= 1e12) {
            return '$' + (num / 1e12).toFixed(2) + ' T';
        } else if (num >= 1e9) {
            return '$' + (num / 1e9).toFixed(2) + ' B';
        } else if (num >= 1e6) {
            return '$' + (num / 1e6).toFixed(2) + ' M';
        } else {
            return '$' + formatNumber(num);
        }
    }

    function updateCurrentDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date().toLocaleDateString(undefined, options);
        currentDateElement.textContent = date;
    }

    init();
});