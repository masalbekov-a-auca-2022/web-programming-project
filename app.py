import yfinance as yf
from flask import Flask, request, render_template, jsonify, redirect, url_for
import threading
import time
from datetime import datetime, timedelta
import pandas as pd

app = Flask(__name__, template_folder='templates')

stock_cache = {}
cache_timeout = 60


def clear_old_cache():
    while True:
        current_time = time.time()
        to_delete = []
        for ticker, data in stock_cache.items():
            if current_time - data['timestamp'] > cache_timeout:
                to_delete.append(ticker)

        for ticker in to_delete:
            del stock_cache[ticker]

        time.sleep(30)


cache_thread = threading.Thread(target=clear_old_cache, daemon=True)
cache_thread.start()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/stock/<ticker>')
def stock_details(ticker):
    return render_template('stock_details.html', ticker=ticker.upper())


@app.route('/api/stock_details/<ticker>')
def get_stock_details(ticker):
    ticker = ticker.upper()

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        company_data = {
            'ticker': ticker,
            'name': info.get('shortName', ticker),
            'longName': info.get('longName', ''),
            'industry': info.get('industry', 'Not available'),
            'sector': info.get('sector', 'Not available'),
            'website': info.get('website', ''),
            'logo': info.get('logo_url', ''),
            'description': info.get('longBusinessSummary', 'No description available'),
            'employees': info.get('fullTimeEmployees', 'Not available'),
            'country': info.get('country', 'Not available'),
            'city': info.get('city', 'Not available'),
            'address': info.get('address1', 'Not available'),
            'marketCap': info.get('marketCap', 0),
            'peRatio': info.get('trailingPE', 'N/A'),
            'forwardPE': info.get('forwardPE', 'N/A'),
            'dividendYield': info.get('dividendYield', 0) * 100 if info.get('dividendYield') else 'N/A',
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', 0),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', 0),
            'averageVolume': info.get('averageVolume', 0),
        }

        return jsonify(company_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/historical_data/<ticker>')
def get_historical_data(ticker):
    ticker = ticker.upper()
    period = request.args.get('period', '1mo')  #
    interval = request.args.get('interval', '1d')

    period_map = {
        '1w': '1wk',
        '1mo': '1mo',
        '3mo': '3mo',
        '6mo': '6mo',
        '1y': '1y',
        '5y': '5y',
        'max': 'max'
    }

    yf_period = period_map.get(period, '1mo')

    try:
        stock = yf.Ticker(ticker)
        hist_data = stock.history(period=yf_period, interval=interval)

        if hist_data.empty:
            return jsonify({"error": "No historical data available"}), 404

        dates = hist_data.index.strftime('%Y-%m-%d').tolist()
        prices = hist_data['Close'].round(2).tolist()
        volumes = hist_data['Volume'].tolist()

        sma_20 = None
        sma_50 = None

        if len(hist_data) >= 20:
            sma_20 = hist_data['Close'].rolling(window=20).mean().round(2).tolist()

        if len(hist_data) >= 50:
            sma_50 = hist_data['Close'].rolling(window=50).mean().round(2).tolist()

        return jsonify({
            'dates': dates,
            'prices': prices,
            'volumes': volumes,
            'sma20': sma_20,
            'sma50': sma_50,
            'period': period
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/get_stock_data', methods=['POST'])
def get_stock_data():
    ticker = request.get_json()['ticker'].upper()

    # Check cache first
    if ticker in stock_cache and time.time() - stock_cache[ticker]['timestamp'] < cache_timeout:
        return jsonify(stock_cache[ticker]['data'])

    try:
        stock = yf.Ticker(ticker)
        data = stock.history(period='1d', interval='1m')

        if data.empty:
            return jsonify({"error": "No data available for this ticker"}), 404

        latest = data.iloc[-1]
        info = stock.info

        response = {
            'ticker': ticker,
            'currentPrice': round(latest.Close, 2),
            'openPrice': round(latest.Open, 2),
            'highPrice': round(latest.High, 2),
            'lowPrice': round(latest.Low, 2),
            'volume': int(latest.Volume),
            'change': round(latest.Close - latest.Open, 2),
            'changePercent': round(((latest.Close - latest.Open) / latest.Open) * 100, 2),
            'companyName': info.get('shortName', ticker),
            'lastUpdated': datetime.now().strftime('%H:%M:%S')
        }

        stock_cache[ticker] = {
            'data': response,
            'timestamp': time.time()
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/get_multiple_stocks', methods=['POST'])
def get_multiple_stocks():
    tickers = request.get_json()['tickers']
    results = {}

    for ticker in tickers:
        try:
            stock_request = {'ticker': ticker}
            result = get_stock_data()
            if result.status_code == 200:
                results[ticker] = result.json
        except Exception:
            results[ticker] = {"error": "Failed to fetch data"}

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)