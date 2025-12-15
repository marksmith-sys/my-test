from flask import Flask, render_template, request, jsonify, session
import json
import os
from datetime import datetime
from web3 import Web3
import hashlib
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here')

# Налаштування Web3 (Ethereum)
INFURA_URL = os.getenv('INFURA_URL', 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID')
web3 = Web3(Web3.HTTPProvider(INFURA_URL))

# Адреса вашого гаманця для отримання платежів
RECEIVER_ADDRESS = os.getenv('RECEIVER_ADDRESS', '0xYourWalletAddressHere')

class PaymentProcessor:
    def __init__(self):
        self.payments = {}
    
    def create_payment(self, amount_eth, description=""):
        """Створення нового платежу"""
        payment_id = hashlib.sha256(str(datetime.now()).encode()).hexdigest()[:16]
        
        payment_data = {
            'id': payment_id,
            'amount_eth': float(amount_eth),
            'amount_wei': web3.to_wei(float(amount_eth), 'ether'),
            'description': description,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
            'receiver_address': RECEIVER_ADDRESS
        }
        
        self.payments[payment_id] = payment_data
        return payment_data
    
    def verify_payment(self, payment_id, tx_hash):
        """Перевірка транзакції"""
        if payment_id not in self.payments:
            return {'success': False, 'error': 'Payment not found'}
        
        try:
            # Отримання інформації про транзакцію
            tx = web3.eth.get_transaction(tx_hash)
            
            if not tx:
                return {'success': False, 'error': 'Transaction not found'}
            
            # Перевірка адреси отримувача
            if tx['to'].lower() != RECEIVER_ADDRESS.lower():
                return {'success': False, 'error': 'Incorrect receiver address'}
            
            # Перевірка суми
            payment = self.payments[payment_id]
            if tx['value'] < payment['amount_wei']:
                return {'success': False, 'error': 'Insufficient amount'}
            
            # Перевірка підтверджень
            tx_receipt = web3.eth.get_transaction_receipt(tx_hash)
            if tx_receipt and tx_receipt['status'] == 1:
                payment['status'] = 'completed'
                payment['tx_hash'] = tx_hash
                payment['completed_at'] = datetime.now().isoformat()
                return {'success': True, 'message': 'Payment confirmed'}
            else:
                return {'success': False, 'error': 'Transaction failed'}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}

payment_processor = PaymentProcessor()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create_payment', methods=['POST'])
def create_payment():
    try:
        data = request.json
        amount = float(data.get('amount', 0))
        description = data.get('description', '')
        
        if amount <= 0:
            return jsonify({'success': False, 'error': 'Invalid amount'})
        
        payment = payment_processor.create_payment(amount, description)
        return jsonify({'success': True, 'payment': payment})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/verify_payment', methods=['POST'])
def verify_payment():
    try:
        data = request.json
        payment_id = data.get('payment_id')
        tx_hash = data.get('tx_hash')
        
        if not payment_id or not tx_hash:
            return jsonify({'success': False, 'error': 'Missing parameters'})
        
        result = payment_processor.verify_payment(payment_id, tx_hash)
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/payment_status/<payment_id>')
def payment_status(payment_id):
    payment = payment_processor.payments.get(payment_id)
    if payment:
        return jsonify({'success': True, 'payment': payment})
    return jsonify({'success': False, 'error': 'Payment not found'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)