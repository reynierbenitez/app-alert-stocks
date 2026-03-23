#!/usr/bin/env python3
"""
Test script for Trading Alerts Dashboard webhook endpoint.
This script sends a test alert to the backend API.
"""

import json
import requests
import sys
from datetime import datetime

def test_webhook(base_url="http://localhost:3000"):
    """Test the webhook endpoint with a sample alert."""
    
    webhook_url = f"{base_url}/api/webhook"
    
    # Sample alert data
    alert_data = {
        "symbol": "AAPL",
        "price": 175.50,
        "condition": "BUY",
        "message": "Price crossed 50-day moving average",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    print(f"Testing webhook endpoint: {webhook_url}")
    print(f"Sending alert: {json.dumps(alert_data, indent=2)}")
    
    try:
        response = requests.post(webhook_url, json=alert_data, timeout=10)
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.text:
            try:
                response_data = response.json()
                print(f"Response Body: {json.dumps(response_data, indent=2)}")
            except:
                print(f"Response Body: {response.text}")
        
        if response.status_code == 201:
            print("\n✅ Webhook test PASSED!")
            return True
        else:
            print(f"\n❌ Webhook test FAILED with status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Connection failed. Is the backend running at {base_url}?")
        print("   Start the backend with: docker-compose up backend")
        return False
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out.")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False

def test_alerts_endpoint(base_url="http://localhost:3000"):
    """Test the alerts retrieval endpoint."""
    
    alerts_url = f"{base_url}/api/alerts"
    
    print(f"\nTesting alerts endpoint: {alerts_url}")
    
    try:
        response = requests.get(alerts_url, timeout=10)
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                alert_count = len(data.get('alerts', []))
                total_alerts = data.get('total', 0)
                print(f"✅ Retrieved {alert_count} alerts (total: {total_alerts})")
                return True
            except:
                print(f"Response: {response.text[:200]}...")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_health_endpoint(base_url="http://localhost:3000"):
    """Test the health check endpoint."""
    
    health_url = f"{base_url}/health"
    
    print(f"\nTesting health endpoint: {health_url}")
    
    try:
        response = requests.get(health_url, timeout=5)
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data.get('status', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def main():
    """Run all tests."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Trading Alerts Dashboard API')
    parser.add_argument('--base-url', default='http://localhost:3000',
                       help='Base URL of the backend API (default: http://localhost:3000)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Trading Alerts Dashboard - API Test Suite")
    print("=" * 60)
    
    # Run tests
    health_ok = test_health_endpoint(args.base_url)
    webhook_ok = test_webhook(args.base_url)
    alerts_ok = test_alerts_endpoint(args.base_url)
    
    print("\n" + "=" * 60)
    print("Test Summary:")
    print(f"  Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"  Webhook Test: {'✅ PASS' if webhook_ok else '❌ FAIL'}")
    print(f"  Alerts Test:  {'✅ PASS' if alerts_ok else '❌ FAIL'}")
    
    if health_ok and webhook_ok and alerts_ok:
        print("\n🎉 All tests passed! The API is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())