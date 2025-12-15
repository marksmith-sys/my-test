let web3;
let currentAccount;
let paymentData = null;
let txHash = null;

// Підключення MetaMask
async function connectMetaMask() {
    try {
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
            
            // Запит доступу до акаунтів
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            currentAccount = accounts[0];
            
            showStatus(`✅ Connected: ${currentAccount.substring(0, 10)}...`, 'success');
            document.getElementById('payBtn').disabled = false;
            document.getElementById('connectBtn').innerHTML = '✅ Connected';
            document.getElementById('connectBtn').disabled = true;
            
            // Слухач змін акаунтів
            window.ethereum.on('accountsChanged', (accounts) => {
                currentAccount = accounts[0];
                showStatus(`Account changed: ${currentAccount.substring(0, 10)}...`, 'success');
            });
            
            // Слухач змін мережі
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
            
        } else {
            showStatus('⚠️ Please install MetaMask!', 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Створення платежу
async function createPayment() {
    const amount = document.getElementById('amount').value;
    const description = document.getElementById('description').value;
    
    if (!amount || amount <= 0) {
        showStatus('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        const response = await fetch('/create_payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                description: description
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            paymentData = result.payment;
            
            // Показати інформацію про платеж
            document.getElementById('paymentInfo').style.display = 'block';
            document.getElementById('paymentId').textContent = paymentData.id;
            document.getElementById('paymentAmount').textContent = paymentData.amount_eth;
            document.getElementById('receiverAddress').textContent = paymentData.receiver_address;
            
            showStatus('Payment created successfully!', 'success');
        } else {
            showStatus(`Error: ${result.error}`, 'error');
        }
        
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Відправка платежу через MetaMask
async function sendPayment() {
    if (!paymentData || !currentAccount) {
        showStatus('Please create payment first', 'error');
        return;
    }
    
    try {
        const transactionParameters = {
            from: currentAccount,
            to: paymentData.receiver_address,
            value: '0x' + paymentData.amount_wei.toString(16),
            chainId: '0x1', // Ethereum Mainnet
        };
        
        // Запит на підтвердження транзакції
        txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [transactionParameters],
        });
        
        document.getElementById('txInfo').style.display = 'block';
        document.getElementById('txHash').textContent = txHash;
        
        showStatus('Transaction sent! Waiting for confirmation...', 'success');
        
        // Очікування підтвердження
        const receipt = await waitForTransactionReceipt(txHash);
        
        if (receipt.status) {
            showStatus('Transaction confirmed! Now verify payment.', 'success');
        } else {
            showStatus('Transaction failed!', 'error');
        }
        
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Перевірка платежу
async function verifyPayment() {
    if (!paymentData || !txHash) {
        showStatus('No payment to verify', 'error');
        return;
    }
    
    try {
        const response = await fetch('/verify_payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payment_id: paymentData.id,
                tx_hash: txHash
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('paymentStatus').textContent = 'Completed';
            document.getElementById('paymentStatus').className = 'status-completed';
            showStatus('✅ Payment verified successfully!', 'success');
        } else {
            showStatus(`Verification failed: ${result.error}`, 'error');
        }
        
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Очікування підтвердження транзакції
async function waitForTransactionReceipt(hash) {
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const receipt = await web3.eth.getTransactionReceipt(hash);
                
                if (receipt) {
                    clearInterval(checkInterval);
                    resolve(receipt);
                }
            } catch (error) {
                clearInterval(checkInterval);
                reject(error);
            }
        }, 2000); // Перевіряти кожні 2 секунди
    });
}

// Показати статус
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `alert ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Автоматична спроба підключення при завантаженні
window.addEventListener('load', async () => {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
            });
            
            if (accounts.length > 0) {
                currentAccount = accounts[0];
                document.getElementById('connectBtn').innerHTML = '✅ Connected';
                document.getElementById('payBtn').disabled = false;
            }
        } catch (error) {
            console.log('No accounts found');
        }
    }
});