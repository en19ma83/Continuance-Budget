"""
Stock price fetching engine.
Fetches current market prices for tickers using public endpoints.
"""
import requests
from typing import Optional

def get_stock_price(ticker: str) -> Optional[float]:
    """
    Fetches the current price for a given ticker.
    Supports Global tickers (e.g. 'AAPL', 'VGS.AX').
    """
    # Using Yahoo Finance's query endpoint (unofficial but widely used for personal projects)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Extract the regularMarketPrice or the latest result
        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
            
        meta = result[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        
        if price is None:
            # Fallback to last close value in indicators if metadata price is missing
            indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
            closes = indicators.get("close", [])
            if closes:
                # Find the last non-None value
                valid_closes = [c for c in closes if c is not None]
                if valid_closes:
                    price = valid_closes[-1]
                    
        return price
    except Exception as e:
        print(f"[StockEngine] Error fetching {ticker}: {e}")
        return None
