import time
import json
import sys
import os

# Add the server directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.modules.order.models import Outbox
from app.modules.user.models import User
from app.modules.product.models import Product
from datetime import datetime, UTC

def process_outbox():
    """
    Simulated worker that processes the outbox table and 'sends' notifications.
    In a real app, this would be a Celery task or a separate process.
    """
    db = SessionLocal()
    try:
        pending_items = db.query(Outbox).filter(Outbox.delivered_at == None).all()
        for item in pending_items:
            print("-" * 50)
            print(f"🔔 NEW NOTIFICATION EVENT: {item.topic}")
            payload = item.payload
            
            # Simulate sending Email/SMS/Push
            if item.topic == "order_status_changed":
                order_id = payload.get("order_id")
                to_status = payload.get("to_status")
                print(f"📧 [SIMULATED EMAIL] To: user@example.com")
                print(f"   Subject: Order {order_id} Update")
                print(f"   Body: Your order is now {to_status}. Thank you for shopping with TEMU!")
                
                print(f"📱 [SIMULATED PUSH] Title: Order Update")
                print(f"   Message: Order {order_id} is now {to_status}")
                
                if to_status == "shipped":
                    print(f"💬 [SIMULATED SMS] To: +1234567890")
                    print(f"   Message: Your order {order_id} has been shipped!")
                
                if to_status == "return_approved":
                    print(f"📧 [SIMULATED EMAIL] Your return for order {order_id} has been APPROVED.")
                    print(f"   Body: Please ship the items back using the provided label.")
                
                if to_status == "return_rejected":
                    print(f"📧 [SIMULATED EMAIL] Your return for order {order_id} was REJECTED.")
                    print(f"   Body: Reason: {payload.get('reason')}")

            item.delivered_at = datetime.now(UTC)
            item.attempts += 1
            db.add(item)
            db.commit()
            print(f"✅ Event marked as delivered in outbox.")
            print("-" * 50)
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting simulated notification worker...")
    while True:
        process_outbox()
        time.sleep(5) # Poll every 5 seconds
