"""
Search Service - Integrates live search data using SerpAPI.
Detects when queries need live data and fetches results.
"""

import requests
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import json

logger = logging.getLogger(__name__)


class SearchService:
    """Service for real-time web search integration."""
    
    # Keywords that indicate need for live search
    LIVE_DATA_KEYWORDS = {
        'weather': ['weather', 'temperature', 'forecast', 'rain', 'snow', 'humidity', 'wind', 'cloud', 'climate'],
        'crypto': ['bitcoin', 'ethereum', 'btc', 'eth', 'crypto', 'cryptocurrency', 'blockchain', 'coin price', 'token price', 'doge', 'ripple', 'litecoin', 'cardano', 'solana', 'polygon', 'avalanche'],
        'stock': ['stock', 'stock price', 'market price', 'share price', 'trading', 'nasdaq', 'sp500', 'dow jones', 'ftse', 'nifty', 'sensex', 'ticker', 'share'],
        'price': ['price', 'how much', 'cost', 'worth', 'how much is', 'what is the price', 'current price', 'latest price', 'real-time price'],
        'news': ['news', 'today', 'breaking', 'latest', 'headline', 'current event', 'recent', 'happening', 'update'],
        'sports': ['score', 'game', 'match', 'championship', 'league', 'playoff', 'tournament', 'winning'],
        'realtime': ['now', 'current', 'live', 'right now', 'this moment', 'latest', 'recent'],
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize search service with SerpAPI key."""
        self.api_key = api_key or os.getenv('SERPAPI_API_KEY')
        self.base_url = 'https://serpapi.com/search'
        if not self.api_key:
            logger.warning("SERPAPI_API_KEY not configured - search disabled")
    
    def should_search(self, query: str) -> bool:
        """Detect if query needs live search data."""
        if not self.api_key:
            return False
        
        query_lower = query.lower()
        
        # Check for live data keywords
        for category, keywords in self.LIVE_DATA_KEYWORDS.items():
            if any(keyword in query_lower for keyword in keywords):
                logger.info(f"✓ Detected {category} query - will search")
                return True
        
        return False
    
    def search(self, query: str, search_type: str = 'google') -> Optional[Dict]:
        """
        Perform web search using SerpAPI.
        
        Args:
            query: Search query
            search_type: Type of search ('google', 'news', 'shopping')
            
        Returns:
            Formatted search results
        """
        if not self.api_key:
            logger.warning("Search API key not configured")
            return None
        
        try:
            params = {
                'q': query,
                'api_key': self.api_key,
                'engine': search_type
            }
            
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"✓ Search completed for: {query}")
            
            return self._format_results(data, search_type)
            
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            return None
    
    def _format_results(self, data: Dict, search_type: str) -> Dict:
        """Format search results for display."""
        if search_type == 'news':
            return self._format_news(data)
        elif search_type == 'shopping':
            return self._format_shopping(data)
        else:
            return self._format_google(data)
    
    @staticmethod
    def _format_google(data: Dict) -> Dict:
        """Format Google search results."""
        results = {
            'type': 'google_search',
            'query': data.get('search_parameters', {}).get('q', ''),
            'total_results': data.get('search_information', {}).get('total_results', 0),
            'items': []
        }
        
        # Add organic results
        for item in data.get('organic_results', [])[:5]:  # Top 5
            results['items'].append({
                'title': item.get('title'),
                'url': item.get('link'),
                'snippet': item.get('snippet'),
                'source': item.get('source')
            })
        
        return results
    
    @staticmethod
    def _format_news(data: Dict) -> Dict:
        """Format news search results."""
        results = {
            'type': 'news',
            'query': data.get('search_parameters', {}).get('q', ''),
            'items': []
        }
        
        for item in data.get('news_results', [])[:5]:
            results['items'].append({
                'title': item.get('title'),
                'link': item.get('link'),
                'source': item.get('source'),
                'date': item.get('date'),
                'snippet': item.get('snippet')
            })
        
        return results
    
    @staticmethod
    def _format_shopping(data: Dict) -> Dict:
        """Format shopping results."""
        results = {
            'type': 'shopping',
            'query': data.get('search_parameters', {}).get('q', ''),
            'items': []
        }
        
        for item in data.get('shopping_results', [])[:5]:
            results['items'].append({
                'title': item.get('title'),
                'price': item.get('price'),
                'currency': item.get('currency'),
                'source': item.get('source'),
                'image': item.get('image'),
                'link': item.get('link')
            })
        
        return results
    
    def format_for_response(self, results: Optional[Dict]) -> str:
        """Convert search results to readable text format."""
        if not results:
            return "No search results found."
        
        text = f"\n**Search Results for:** {results.get('query')}\n"
        text += f"**Type:** {results.get('type')}\n\n"
        
        for i, item in enumerate(results.get('items', []), 1):
            if results['type'] == 'google_search':
                text += f"{i}. **{item.get('title')}**\n"
                text += f"   {item.get('snippet')}\n"
                text += f"   [Link]({item.get('url')})\n\n"
            
            elif results['type'] == 'news':
                text += f"{i}. **{item.get('title')}** - {item.get('source')}\n"
                text += f"   Date: {item.get('date')}\n"
                text += f"   {item.get('snippet')}\n\n"
            
            elif results['type'] == 'shopping':
                text += f"{i}. **{item.get('title')}**\n"
                text += f"   Price: {item.get('currency')} {item.get('price')}\n"
                text += f"   Source: {item.get('source')}\n\n"
        
        return text
