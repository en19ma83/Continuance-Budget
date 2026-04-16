import os
import requests
from functools import lru_cache
from typing import Dict

API_KEY = os.getenv("CURRENCY_API_KEY", "")
BASE_URL = f"https://v6.exchangerate-api.com/v6/{API_KEY}/latest" if API_KEY else None

# In-memory cache of rates, keyed by base currency
_rate_cache: Dict[str, Dict[str, float]] = {}

def get_rates(base_currency: str = "AUD") -> Dict[str, float]:
    """Fetch conversion rates from the API. Returns a mapping of currency -> rate relative to base."""
    if base_currency in _rate_cache:
        return _rate_cache[base_currency]
    
    if not BASE_URL:
        return {}

    try:
        resp = requests.get(f"{BASE_URL}/{base_currency}", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        rates = data.get("conversion_rates", {})
        _rate_cache[base_currency] = rates
        return rates
    except Exception as e:
        # Fallback: return 1:1 rates if API fails
        print(f"[CurrencyEngine] Failed to fetch rates: {e}. Using 1:1 fallback.")
        return {}

def convert(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert an amount from one currency to another."""
    if from_currency == to_currency:
        return amount
    
    rates = get_rates(to_currency)
    if not rates:
        return amount  # Fallback: no conversion
    
    # The rates are already relative to to_currency (base)
    # e.g. if base=AUD, rates["USD"] = 0.63 means 1 AUD = 0.63 USD
    # To convert FROM USD TO AUD: amount / rates["USD"]
    rate = rates.get(from_currency)
    if not rate or rate == 0:
        return amount
    
    return amount / rate

def get_supported_currencies() -> list:
    """Return a list of common supported currencies."""
    return ["AUD", "USD", "EUR", "GBP", "NZD", "JPY", "CAD", "SGD", "HKD", "CNY"]

def invalidate_cache():
    """Force a fresh rate fetch on the next request."""
    global _rate_cache
    _rate_cache = {}
