document.addEventListener('DOMContentLoaded', function() {
    const REFRESH_INTERVAL = 60; // seconds
    const SAVED_TICKERS_KEY = 'savedTickers';
    
    const addTickerForm = document.getElementById('add-ticker-form');
    const newTickerInput = document.getElementById('new-ticker');
    const tickersGrid = document.getElementById('tickers-grid');
    const stocksMessage = document.getElementById('stocks-message');
    const counterElement = document.getElementById('counter');
    const themeSwitch = document.getElementById('theme-switch');
    const marketStatus = document.getElementById('market-status-text');
    const marketIndicator = document.getElementById('market-indicator');
    const currentDateElement = document.getElementById('current-date');
    
    let savedTickers = JSON.parse(localStorage.getItem(SAVED_TICKERS_KEY)) || [];
    let countdownInterval;
    let secondsLeft = REFRESH_INTERVAL;
    
    function init() {
        setupEventListeners();
        setupTheme();
        updateCurrentDate();
        checkMarketStatus();
        
        if (savedTickers.length > 0) {
            hideMessage();
            fetchAllStockData();
        } else {
            showMessage();
        }

        startCountdown();
    }

    function setupEventListeners() {
        addTickerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const ticker = newTickerInput.value.trim().toUpperCase();

            if (ticker && !savedTickers.includes(ticker)) {
                addTicker(ticker);
                newTickerInput.value = '';

                hideMessage();
            } else if (savedTickers.includes(ticker)) {
                showNotification('This ticker is already added', 'warning');
            }
        });

        themeSwitch.addEventListener('change', function() {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('darkTheme', themeSwitch.checked);
        });

        tickersGrid.addEventListener('click', function(e) {
            if (e.target.closest('.remove-btn')) {
                const card = e.target.closest('.stock-card');
                const ticker = card.getAttribute('data-ticker');
                removeTicker(ticker);
                e.stopPropagation(); // Prevent navigating to detail page
            }
        });
    }

    function setupTheme() {
        const darkTheme = localStorage.getItem('darkTheme') === 'true';
        if (darkTheme) {
            document.body.classList.add('dark-theme');
            themeSwitch.checked = true;
        }
    }

    function makeStockCardsClickable() {
        const stockCards = document.querySelectorAll('.stock-card');

        stockCards.forEach(card => {
            card.classList.add('clickable');

            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);

            newCard.addEventListener('click', function(e) {
                if (!e.target.closest('.remove-btn')) {
                    const ticker = this.getAttribute('data-ticker');
                    if (ticker) {
                        window.location.href = `/stock/${ticker}`;
                    }
                }
            });
        });
    }

    function startCountdown() {
        clearInterval(countdownInterval);
        secondsLeft = REFRESH_INTERVAL;
        updateCounter();

        countdownInterval = setInterval(function() {
            secondsLeft--;
            updateCounter();

            if (secondsLeft <= 0) {
                fetchAllStockData();
                secondsLeft = REFRESH_INTERVAL;
            }
        }, 1000);
    }

    function updateCounter() {
        counterElement.textContent = secondsLeft;
    }

    function addTicker(ticker) {
        savedTickers.push(ticker);
        localStorage.setItem(SAVED_TICKERS_KEY, JSON.stringify(savedTickers));

        if (stocksMessage) {
            hideMessage();
        }

        fetchStockData(ticker);
    }

    function removeTicker(ticker) {
        const index = savedTickers.indexOf(ticker);
        if (index !== -1) {
            savedTickers.splice(index, 1);
            localStorage.setItem(SAVED_TICKERS_KEY, JSON.stringify(savedTickers));

            const card = document.querySelector(`.stock-card[data-ticker="${ticker}"]`);
            if (card) {
                card.classList.add('removing');
                setTimeout(() => {
                    card.remove();
                    if (savedTickers.length === 0) {
                        showMessage();
                    }
                }, 300);
            }
        }
    }

    function fetchAllStockData() {
        document.querySelector('.refresh-info i').classList.add('refreshing');

        savedTickers.forEach(ticker => {
            fetchStockData(ticker);
        });

        setTimeout(() => {
            document.querySelector('.refresh-info i').classList.remove('refreshing');
            makeStockCardsClickable();
        }, 1500);
    }

    function fetchStockData(ticker) {
        fetch('/get_stock_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticker: ticker }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showNotification(`Error: ${data.error}`, 'error');
                removeTicker(ticker);
                return;
            }

            hideMessage();

            updateStockCard(data);

            makeStockCardsClickable();
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification(`Failed to fetch data for ${ticker}`, 'error');
        });
    }

    function updateStockCard(data) {
        const existingCard = document.querySelector(`.stock-card[data-ticker="${data.ticker}"]`);

        if (existingCard) {
            existingCard.querySelector('.current-price').textContent = `$${data.currentPrice}`;

            const priceChange = existingCard.querySelector('.price-change');
            const changeValue = data.change;
            const changePercent = data.changePercent;

            priceChange.textContent = `${changeValue > 0 ? '+' : ''}${changeValue} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
            priceChange.className = 'price-change ' + (changeValue >= 0 ? 'positive' : 'negative');

            existingCard.querySelector('.open-price').textContent = `$${data.openPrice}`;
            existingCard.querySelector('.high-price').textContent = `$${data.highPrice}`;
            existingCard.querySelector('.low-price').textContent = `$${data.lowPrice}`;
            existingCard.querySelector('.volume').textContent = formatNumber(data.volume);
            existingCard.querySelector('.last-updated').textContent = `Updated: ${data.lastUpdated}`;
        } else {
            const template = document.getElementById('stock-card-template');
            const fragment = template.content.cloneNode(true);
            const card = fragment.querySelector('.stock-card');

            card.setAttribute('data-ticker', data.ticker);
            card.querySelector('.ticker').textContent = data.ticker;
            card.querySelector('.company-name').textContent = data.companyName;
            card.querySelector('.current-price').textContent = `$${data.currentPrice}`;

            const priceChange = card.querySelector('.price-change');
            const changeValue = data.change;
            const changePercent = data.changePercent;

            priceChange.textContent = `${changeValue > 0 ? '+' : ''}${changeValue} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
            priceChange.className = 'price-change ' + (changeValue >= 0 ? 'positive' : 'negative');

            card.querySelector('.open-price').textContent = `$${data.openPrice}`;
            card.querySelector('.high-price').textContent = `$${data.highPrice}`;
            card.querySelector('.low-price').textContent = `$${data.lowPrice}`;
            card.querySelector('.volume').textContent = formatNumber(data.volume);
            card.querySelector('.last-updated').textContent = `Updated: ${data.lastUpdated}`;

            tickersGrid.appendChild(card);
        }
    }

    function showMessage() {
        if (stocksMessage) {
            stocksMessage.classList.remove('hidden');
            console.log('Message shown');
        }
    }

    function hideMessage() {
        if (stocksMessage) {
            stocksMessage.classList.add('hidden');
            console.log('Message hidden');
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    }

    function checkMarketStatus() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();

        if (day === 0 || day === 6) {
            updateMarketStatus(false, 'Market Closed (Weekend)');
            return;
        }

        if (hour >= 9 && hour < 16) {
            updateMarketStatus(true, 'Market Open');
        } else {
            updateMarketStatus(false, 'Market Closed');
        }
    }

    function updateMarketStatus(isOpen, statusText) {
        marketStatus.textContent = statusText;
        marketIndicator.className = isOpen ? 'open' : 'closed';
    }

    function updateCurrentDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date().toLocaleDateString(undefined, options);
        currentDateElement.textContent = date;
    }

    function formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    init();
});